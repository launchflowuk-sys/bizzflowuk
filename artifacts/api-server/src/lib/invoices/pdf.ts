import PDFDocument from "pdfkit";

/**
 * The invoice a customer actually receives.
 *
 * pdfkit rather than a headless browser, for the same reason the certificate
 * renderer uses it: ~300MB of Chromium for one document is a poor trade on a
 * box already running web and api together.
 *
 * Where this deliberately differs from the certificate renderer is tone. A
 * certificate is a legal record that gets printed, photographed and emailed on,
 * so it is plain and high-contrast on purpose. An invoice is the last thing a
 * customer sees from a business and the document they judge it by, so this one
 * is designed: the business's own colour, real hierarchy, a totals block that
 * answers "what do I owe" before anything else, and the bank details on the
 * page rather than in a covering email nobody keeps.
 *
 * Everything is laid out against a single content column with named vertical
 * rhythm, so a long line-item list flows onto page two without the totals
 * detaching from the table.
 */

type RenderArgs = {
  invoice: any;
  items: any[];
  customer: any | null;
  tenant: any;
  settings: any;
  /** Fetched by the caller — this renderer never does network I/O. */
  logo?: Buffer | null;
};

const INK = "#0F172A";
const MUTED = "#64748B";
const RULE = "#E2E8F0";
const WASH = "#F8FAFC";
const PAGE_MARGIN = 48;

/** Falls back to slate when a tenant has no colour or a malformed one. */
function brandColour(settings: any): string {
  const raw = String(settings?.primaryColor ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : "#0F172A";
}

function money(v: unknown): string {
  const n = Number(v ?? 0);
  return `£${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function fmtDate(value: unknown): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Quantity reads as an integer when it is one: "2", not "2.00". */
function fmtQty(v: unknown): string {
  const n = Number(v ?? 1);
  if (!Number.isFinite(n)) return "1";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function renderInvoicePdf(args: RenderArgs): Promise<Buffer> {
  const { invoice, items, customer, tenant, settings, logo } = args;
  const brand = brandColour(settings);

  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", c => chunks.push(c as Buffer));
  const done = new Promise<Buffer>(resolve => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const left = PAGE_MARGIN;
  const right = doc.page.width - PAGE_MARGIN;
  const width = right - left;

  // ── Masthead ───────────────────────────────────────────────────────────────
  // A colour band rather than a logo-on-white: it reads as "this business"
  // instantly even for the many trades who have no usable logo file.
  doc.rect(0, 0, doc.page.width, 6).fill(brand);

  let y = PAGE_MARGIN + 10;

  if (logo) {
    try {
      // Bounded box, never stretched — a logo squashed to fit looks worse than
      // no logo at all.
      doc.image(logo, left, y, { fit: [150, 46] });
    } catch {
      // A corrupt or unsupported image must not take the whole invoice down.
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(17).text(tenant?.name ?? "", left, y + 8);
    }
  } else {
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(17).text(tenant?.name ?? "", left, y + 8, { width: width * 0.5 });
  }

  // The word INVOICE, and the one number the customer will quote back.
  doc.font("Helvetica-Bold").fontSize(26).fillColor(brand)
    .text("INVOICE", left + width * 0.5, y, { width: width * 0.5, align: "right" });
  doc.font("Helvetica").fontSize(10.5).fillColor(MUTED)
    .text(invoice.reference ?? "", left + width * 0.5, y + 30, { width: width * 0.5, align: "right" });

  y += 58;

  // ── Who it is from, who it is to ───────────────────────────────────────────
  const colW = width * 0.46;
  const rightColX = left + width - colW;

  const fromLines = [
    tenant?.name,
    settings?.address,
    settings?.city,
    settings?.phone,
    settings?.email,
    settings?.vatRegistered && settings?.vatNumber ? `VAT no. ${settings.vatNumber}` : null,
  ].filter(Boolean).map(String);

  const toName = customer
    ? [customer.firstName, customer.lastName].filter(Boolean).join(" ")
    : null;
  const toLines = [
    toName,
    customer?.address,
    customer?.city,
    customer?.postcode,
    customer?.email,
  ].filter(Boolean).map(String);

  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text("FROM", left, y, { characterSpacing: 0.8 });
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text("BILL TO", rightColX, y, { characterSpacing: 0.8 });

  doc.font("Helvetica").fontSize(10).fillColor(INK);
  doc.text(fromLines.join("\n") || "—", left, y + 14, { width: colW, lineGap: 2 });
  const fromBottom = doc.y;
  doc.text(toLines.join("\n") || "No customer on this invoice", rightColX, y + 14, { width: colW, lineGap: 2 });

  y = Math.max(fromBottom, doc.y) + 16;

  // ── Dates ──────────────────────────────────────────────────────────────────
  doc.rect(left, y, width, 34).fill(WASH);
  const dateCells: Array<[string, string]> = [
    ["Issued", fmtDate(invoice.issuedOn)],
    ["Due", fmtDate(invoice.dueOn)],
    ["Amount due", money(invoice.outstanding ?? invoice.total)],
  ];
  const cellW = width / dateCells.length;
  dateCells.forEach(([label, value], i) => {
    const x = left + i * cellW + 12;
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(label.toUpperCase(), x, y + 7, { characterSpacing: 0.6 });
    doc.font("Helvetica-Bold").fontSize(11).fillColor(i === 2 ? brand : INK).text(value, x, y + 18);
  });

  y += 46;

  // ── Line items ─────────────────────────────────────────────────────────────
  const cols = {
    desc: left,
    qty: left + width * 0.56,
    unit: left + width * 0.68,
    total: left + width * 0.84,
  };
  const colWidths = {
    desc: width * 0.54,
    qty: width * 0.10,
    unit: width * 0.14,
    total: width * 0.16,
  };

  function tableHeader(atY: number): number {
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED);
    doc.text("DESCRIPTION", cols.desc, atY, { width: colWidths.desc, characterSpacing: 0.6 });
    doc.text("QTY", cols.qty, atY, { width: colWidths.qty, align: "right", characterSpacing: 0.6 });
    doc.text("UNIT", cols.unit, atY, { width: colWidths.unit, align: "right", characterSpacing: 0.6 });
    doc.text("AMOUNT", cols.total, atY, { width: colWidths.total, align: "right", characterSpacing: 0.6 });
    const ruleY = atY + 14;
    doc.moveTo(left, ruleY).lineTo(right, ruleY).lineWidth(1).strokeColor(brand).stroke();
    return ruleY + 9;
  }

  y = tableHeader(y);

  const BOTTOM_LIMIT = doc.page.height - PAGE_MARGIN - 40;

  for (const item of items) {
    doc.font("Helvetica").fontSize(10).fillColor(INK);
    const descHeight = doc.heightOfString(String(item.description ?? ""), { width: colWidths.desc });
    const rowHeight = Math.max(descHeight, 12) + 10;

    // Break before drawing, never through a row — a description split across
    // two pages is how a customer decides the paperwork is sloppy.
    if (y + rowHeight > BOTTOM_LIMIT) {
      doc.addPage();
      y = PAGE_MARGIN;
      y = tableHeader(y);
    }

    doc.font("Helvetica").fontSize(10).fillColor(INK)
      .text(String(item.description ?? ""), cols.desc, y, { width: colWidths.desc });
    doc.text(fmtQty(item.quantity), cols.qty, y, { width: colWidths.qty, align: "right" });
    doc.text(money(item.unitPrice), cols.unit, y, { width: colWidths.unit, align: "right" });
    doc.font("Helvetica-Bold").text(money(item.total), cols.total, y, { width: colWidths.total, align: "right" });

    y += rowHeight;
    doc.moveTo(left, y - 5).lineTo(right, y - 5).lineWidth(0.5).strokeColor(RULE).stroke();
  }

  if (!items.length) {
    doc.font("Helvetica-Oblique").fontSize(10).fillColor(MUTED)
      .text("No items on this invoice yet.", cols.desc, y, { width: colWidths.desc });
    y += 24;
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalsRows: Array<[string, string, boolean]> = [["Subtotal", money(invoice.subtotal), false]];
  if (Number(invoice.vatAmount) > 0) {
    const rate = invoice.vatRate ? ` (${Number(invoice.vatRate)}%)` : "";
    totalsRows.push([`VAT${rate}`, money(invoice.vatAmount), false]);
  }
  if (Number(invoice.cisDeduction) > 0) {
    // Shown as a deduction, with the minus, because a customer reading a CIS
    // line without one will read it as an extra charge.
    totalsRows.push([`CIS deduction${settings?.cisRate ? ` (${Number(settings.cisRate)}%)` : ""}`, `-${money(invoice.cisDeduction)}`, false]);
  }
  totalsRows.push(["Total", money(invoice.total), true]);
  if (Number(invoice.amountPaid) > 0) {
    totalsRows.push(["Paid", money(invoice.amountPaid), false]);
    totalsRows.push(["Amount due", money(invoice.outstanding ?? 0), true]);
  }

  const totalsHeight = totalsRows.length * 19 + 16;
  if (y + totalsHeight > BOTTOM_LIMIT) { doc.addPage(); y = PAGE_MARGIN; }

  y += 8;
  const totalsX = left + width * 0.55;
  const totalsW = width * 0.45;

  for (const [label, value, strong] of totalsRows) {
    if (strong) {
      doc.rect(totalsX - 10, y - 4, totalsW + 10, 22).fill(WASH);
    }
    doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 12 : 10)
      .fillColor(strong ? INK : MUTED)
      .text(label, totalsX, y, { width: totalsW * 0.55 });
    doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 12 : 10)
      .fillColor(strong ? brand : INK)
      .text(value, totalsX + totalsW * 0.55, y, { width: totalsW * 0.45, align: "right" });
    y += strong ? 22 : 17;
  }

  y += 8;

  // ── How to pay ─────────────────────────────────────────────────────────────
  const bankRows: Array<[string, string]> = [];
  if (settings?.bankAccountName) bankRows.push(["Account name", String(settings.bankAccountName)]);
  if (settings?.bankName) bankRows.push(["Bank", String(settings.bankName)]);
  if (settings?.bankSortCode) bankRows.push(["Sort code", String(settings.bankSortCode)]);
  if (settings?.bankAccountNumber) bankRows.push(["Account number", String(settings.bankAccountNumber)]);
  if (bankRows.length) bankRows.push(["Payment reference", String(invoice.reference ?? "")]);

  const instructions = settings?.paymentInstructions ? String(settings.paymentInstructions) : null;

  if (bankRows.length || instructions) {
    const blockHeight = 26 + bankRows.length * 15 + (instructions ? 28 : 0);
    if (y + blockHeight > BOTTOM_LIMIT) { doc.addPage(); y = PAGE_MARGIN; }

    doc.rect(left, y, width, blockHeight).fill(WASH);
    doc.rect(left, y, 3, blockHeight).fill(brand);

    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text("How to pay", left + 14, y + 10);
    let ry = y + 26;
    for (const [k, v] of bankRows) {
      doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(k, left + 14, ry, { width: 110 });
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(v, left + 128, ry, { width: width - 142 });
      ry += 15;
    }
    if (instructions) {
      doc.font("Helvetica").fontSize(9.5).fillColor(MUTED)
        .text(instructions, left + 14, ry + 3, { width: width - 28, lineGap: 1.5 });
    }
    y += blockHeight + 12;
  }

  // ── Notes and terms ────────────────────────────────────────────────────────
  const notes = invoice.notes ? String(invoice.notes) : null;
  const terms = invoice.terms || settings?.invoiceTerms || null;

  /**
   * Notes are for this customer; terms are boilerplate.
   *
   * Setting them at the same weight was what pushed a four-line invoice onto a
   * second page carrying nothing but the Late Payment Act. A near-empty page
   * two makes a business look careless, which is the opposite of what an
   * invoice is for, so the terms are small print — present, legible, and not
   * competing with the figures.
   */
  const blocks: Array<[string, string | null, number]> = [
    ["Notes", notes, 9.5],
    ["Terms", terms, 8],
  ];
  for (const [heading, body, size] of blocks) {
    if (!body) continue;
    doc.font("Helvetica").fontSize(size);
    const h = doc.heightOfString(body, { width }) + 18;
    if (y + h > BOTTOM_LIMIT) { doc.addPage(); y = PAGE_MARGIN; }
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(heading.toUpperCase(), left, y, { characterSpacing: 0.6 });
    doc.font("Helvetica").fontSize(size).fillColor(size < 9 ? MUTED : INK)
      .text(body, left, y + 11, { width, lineGap: 1.2 });
    y = doc.y + 10;
  }

  // ── Footer on every page ───────────────────────────────────────────────────
  // Written after all content so the page count is known. bufferPages keeps
  // them addressable.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    /**
     * Drop the bottom margin before writing the footer.
     *
     * pdfkit AUTO-ADDS A PAGE when text is placed below the bottom margin, and
     * the footer deliberately sits in that band. Without this, drawing the
     * footer on page one appends a blank page two, and drawing the footer on
     * that one appends another — the run stops only because the loop is over a
     * count taken before it started. A four-line invoice was coming out two
     * pages long and the second page was empty.
     */
    doc.page.margins.bottom = 0;
    const footY = doc.page.height - PAGE_MARGIN + 6;
    doc.moveTo(left, footY - 8).lineTo(right, footY - 8).lineWidth(0.5).strokeColor(RULE).stroke();
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
      .text(
        [tenant?.name, settings?.phone, settings?.email].filter(Boolean).join("  ·  "),
        left, footY, { width: width * 0.7 },
      );
    if (range.count > 1) {
      doc.text(`Page ${i + 1} of ${range.count}`, left + width * 0.7, footY, { width: width * 0.3, align: "right" });
    }
  }

  doc.end();
  return done;
}
