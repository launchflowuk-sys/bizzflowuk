import PDFDocument from "pdfkit";
import type { CertificateType } from "./registry";
import { readCertificateFile } from "./storage";

/**
 * Certificate PDF renderer.
 *
 * pdfkit rather than a headless browser: the output is a fixed-layout form, and
 * adding ~300MB of Chromium to the image for it would be a poor trade on a box
 * that already runs web and api together. It is also chosen over
 * @react-pdf/renderer because this is a plain Express server with no React in
 * it, and pulling React in for one document is weight without benefit.
 *
 * The layout is deliberately plain and high-contrast: this is a legal record
 * that gets printed, photographed and emailed on, not a brochure.
 */

type RenderArgs = {
  certificate: any;
  appliances: any[];
  /** Optional: older call sites render without them. */
  photos?: any[];
  type: CertificateType;
  tenant: any;
  settings: any;
};

const INK = "#111827";
const MUTED = "#6B7280";
const RULE = "#D1D5DB";
const PAGE_MARGIN = 46;

function fmtDate(value: unknown): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Tri-state. "Not tested" must never render as "failed". */
function fmtCheck(v: boolean | null | undefined): string {
  if (v === true) return "Pass";
  if (v === false) return "FAIL";
  return "N/A";
}

export async function renderCertificatePdf(args: RenderArgs): Promise<Buffer> {
  const { certificate: c, appliances, type, tenant, settings } = args;
  const photoRows = args.photos ?? [];

  /**
   * Signatures are read before drawing starts, not during.
   *
   * pdfkit's document building is synchronous once it begins; awaiting a file
   * read in the middle of it means pages get written in whatever order the
   * promises settle. Read first, then draw.
   *
   * A missing file leaves an empty box rather than failing the render. The
   * record is still the truth of what was checked; losing the whole PDF
   * because one image went astray helps nobody.
   */
  const signatures = {
    engineer: c.engineerSignaturePath ? await readCertificateFile(c.engineerSignaturePath) : null,
    customer: c.customerSignaturePath ? await readCertificateFile(c.customerSignaturePath) : null,
  };

  /**
   * Photographs, read up front for the same reason as the signatures: once
   * pdfkit starts laying out, it is synchronous.
   *
   * Capped, because a certificate is a document somebody emails and a landlord
   * opens on a phone. Thirty photographs would make it slow to send and slow to
   * open, and the record is the point -- the photos are supporting evidence.
   * Anything past the cap stays on the job in the dashboard.
   */
  const MAX_PDF_PHOTOS = 12;
  const photos: Array<{ bytes: Buffer; caption: string | null }> = [];
  for (const row of photoRows.slice(0, MAX_PDF_PHOTOS)) {
    const bytes = await readCertificateFile(row.path);
    if (bytes) photos.push({ bytes, caption: row.caption ?? null });
  }

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, info: {
      Title: `${type.label} — ${c.reference}`,
      Author: tenant?.name ?? "",
      Subject: c.propertyAddress,
    } });

    const chunks: Buffer[] = [];
    doc.on("data", (ch: Buffer) => chunks.push(ch));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = PAGE_MARGIN;
    const right = doc.page.width - PAGE_MARGIN;
    const width = right - left;

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(17).text(type.label, left, left);
    doc.font("Helvetica").fontSize(10).fillColor(MUTED)
      .text(`Reference ${c.reference}`, left, doc.y + 2);

    doc.font("Helvetica-Bold").fontSize(12).fillColor(INK)
      .text(tenant?.name ?? "", left, left, { width, align: "right" });
    const contact = [settings?.phone, settings?.email].filter(Boolean).join("  ·  ");
    if (contact) {
      doc.font("Helvetica").fontSize(9).fillColor(MUTED)
        .text(contact, left, doc.y + 1, { width, align: "right" });
    }

    doc.moveTo(left, 104).lineTo(right, 104).strokeColor(RULE).lineWidth(1).stroke();
    doc.y = 118;

    // ── Two-column detail block ─────────────────────────────────────────────
    const colGap = 18;
    const colW = (width - colGap) / 2;

    function field(label: string, value: string, x: number, y: number, w: number): number {
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED)
        .text(label.toUpperCase(), x, y, { width: w, characterSpacing: 0.6 });
      doc.font("Helvetica-Bold").fontSize(10).fillColor(INK)
        .text(value || "—", x, doc.y + 1, { width: w });
      return doc.y + 9;
    }

    let yL = doc.y;
    let yR = doc.y;
    yL = field("Property address", [c.propertyAddress, c.propertyPostcode].filter(Boolean).join(", "), left, yL, colW);
    yL = field("Landlord", c.landlordName ?? "—", left, yL, colW);
    if (c.landlordAddress) yL = field("Landlord address", c.landlordAddress, left, yL, colW);

    const rx = left + colW + colGap;
    yR = field("Date of check", fmtDate(c.checkedAt), rx, yR, colW);
    // Omitted entirely for a record that does not lapse. "Next check due --"
    // on a warning notice invites the reader to think one is due.
    if (c.expiresAt) yR = field("Next check due", fmtDate(c.expiresAt), rx, yR, colW);
    yR = field("Engineer", c.engineerName ?? "—", rx, yR, colW);
    if (c.engineerRegNo) yR = field("Registration number", c.engineerRegNo, rx, yR, colW);

    doc.y = Math.max(yL, yR) + 6;
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(RULE).stroke();
    doc.y += 14;

    // ── Appliances ──────────────────────────────────────────────────────────
    if (type.usesAppliances) {
      doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Appliances checked", left, doc.y);
      doc.y += 8;

      if (!appliances.length) {
        doc.font("Helvetica").fontSize(10).fillColor(MUTED).text("No appliances recorded.", left, doc.y);
        doc.y += 14;
      }

      for (const a of appliances) {
        // Keep an appliance block together rather than split across a page break.
        if (doc.y > doc.page.height - 190) { doc.addPage(); doc.y = PAGE_MARGIN; }

        doc.font("Helvetica-Bold").fontSize(10).fillColor(INK)
          .text(`${a.location}${a.applianceType ? ` — ${a.applianceType}` : ""}`, left, doc.y);
        const makeModel = [a.make, a.model].filter(Boolean).join(" ");
        if (makeModel) {
          doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(makeModel, left, doc.y + 1);
        }
        doc.y += 6;

        if (!a.wasInspected) {
          doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#B45309")
            .text("Not inspected", left + 8, doc.y);
          doc.y += 14;
        } else {
          const checks: Array<[string, boolean | null | undefined]> = [
            ["Flue flow", a.flueFlowPass],
            ["Safety devices", a.safetyDevicesPass],
            ["Ventilation", a.ventilationPass],
            ["Visual condition", a.visualConditionPass],
            ["Gas tightness", a.gasTightnessPass],
          ];
          const cellW = width / checks.length;
          const rowY = doc.y;
          checks.forEach(([label, val], i) => {
            const x = left + i * cellW;
            doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(label.toUpperCase(), x, rowY, { width: cellW - 4, characterSpacing: 0.4 });
            const colour = val === false ? "#B42318" : val === true ? "#12795A" : MUTED;
            doc.font("Helvetica-Bold").fontSize(10).fillColor(colour).text(fmtCheck(val), x, rowY + 10, { width: cellW - 4 });
          });
          doc.y = rowY + 26;

          const extras = [
            a.operatingPressure ? `Operating pressure: ${a.operatingPressure}` : null,
            a.combustionReading ? `Combustion: ${a.combustionReading}` : null,
          ].filter(Boolean).join("     ");
          if (extras) {
            doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(extras, left, doc.y);
            doc.y += 12;
          }

          if (a.defects) {
            doc.font("Helvetica-Bold").fontSize(9).fillColor("#B42318").text("Defects", left, doc.y);
            doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(a.defects, left, doc.y + 1, { width });
            doc.y += 6;
          }
          if (a.actionTaken) {
            doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("Action taken", left, doc.y);
            doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(a.actionTaken, left, doc.y + 1, { width });
            doc.y += 6;
          }

          const safe = a.safeToUse === true;
          doc.font("Helvetica-Bold").fontSize(10)
            .fillColor(safe ? "#12795A" : "#B42318")
            .text(safe ? "Safe to use" : "NOT SAFE TO USE", left, doc.y);
          doc.y += 16;
        }

        doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(RULE).lineWidth(0.5).stroke();
        doc.y += 12;
      }
    }

    // ── Notes ───────────────────────────────────────────────────────────────
    const notes = (c.data as any)?.notes;
    if (notes) {
      if (doc.y > doc.page.height - 150) { doc.addPage(); doc.y = PAGE_MARGIN; }
      doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text("Notes", left, doc.y);
      doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(String(notes), left, doc.y + 2, { width });
      doc.y += 14;
    }

    // ── Photographs ─────────────────────────────────────────────────────────
    //
    // Three to a row, uniform boxes, `fit` so a portrait shot of a flue and a
    // landscape shot of a boiler both sit inside their box rather than one
    // being stretched to match the other.
    if (photos.length) {
      if (doc.y > doc.page.height - 220) { doc.addPage(); doc.y = PAGE_MARGIN; }
      doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(RULE).lineWidth(0.5).stroke();
      doc.y += 12;
      doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text("Photographs", left, doc.y);
      doc.y += 14;

      const perRow = 3;
      const gap = 12;
      const cell = (width - gap * (perRow - 1)) / perRow;
      const cellH = cell * 0.75;

      for (let i = 0; i < photos.length; i += perRow) {
        const row = photos.slice(i, i + perRow);
        const needs = cellH + (row.some(p => p.caption) ? 14 : 4);
        if (doc.y + needs > doc.page.height - PAGE_MARGIN) { doc.addPage(); doc.y = PAGE_MARGIN; }
        const top = doc.y;

        row.forEach((photo, n) => {
          const x = left + n * (cell + gap);
          try {
            doc.image(photo.bytes, x, top, { fit: [cell, cellH] });
          } catch {
            // A photo that will not decode must never cost the whole record.
            doc.rect(x, top, cell, cellH).strokeColor(RULE).lineWidth(0.5).stroke();
          }
          if (photo.caption) {
            doc.font("Helvetica").fontSize(7.5).fillColor(MUTED)
              .text(photo.caption, x, top + cellH + 3, { width: cell, height: 10, ellipsis: true });
          }
        });

        doc.y = top + needs + 6;
      }
      doc.y += 4;
    }

    // ── Signatures ──────────────────────────────────────────────────────────
    //
    // The engineer's signature is one of the particulars a landlord gas safety
    // record has to carry, so an empty box here is not a cosmetic gap -- it is
    // an unfinished document. Drawn before the attestation because that is
    // where a signature belongs on anything anybody has ever signed.
    if (signatures.engineer || signatures.customer) {
      if (doc.y > doc.page.height - 200) { doc.addPage(); doc.y = PAGE_MARGIN; }
      doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(RULE).lineWidth(0.5).stroke();
      doc.y += 12;

      const boxW = (width - 24) / 2;
      const boxH = 62;
      const top = doc.y;

      const drawSignature = (x: number, title: string, png: Buffer | null, name: string, when: unknown) => {
        doc.font("Helvetica").fontSize(8).fillColor(MUTED)
          .text(title.toUpperCase(), x, top, { width: boxW, characterSpacing: 0.6 });
        if (png) {
          try {
            // `fit` keeps the aspect ratio, so a wide scrawl and a small neat
            // one both sit inside the box instead of stretching to fill it.
            doc.image(png, x, top + 12, { fit: [boxW, boxH - 28] });
          } catch { /* a corrupt image must never take down the whole record */ }
        }
        doc.moveTo(x, top + boxH - 14).lineTo(x + boxW, top + boxH - 14)
          .strokeColor(RULE).lineWidth(0.5).stroke();
        doc.font("Helvetica").fontSize(8.5).fillColor(INK)
          .text(name || "—", x, top + boxH - 10, { width: boxW });
        if (when) {
          doc.font("Helvetica").fontSize(8).fillColor(MUTED)
            .text(fmtDate(when), x, top + boxH + 2, { width: boxW });
        }
      };

      drawSignature(left, "Engineer", signatures.engineer,
        c.engineerName ?? "", c.signedAt ?? c.checkedAt);
      drawSignature(left + boxW + 24, "Received by", signatures.customer,
        c.customerSignatureName ?? "", c.customerSignaturePath ? c.checkedAt : null);

      doc.y = top + boxH + 18;
    }

    // ── Attestation + footer ────────────────────────────────────────────────
    if (doc.y > doc.page.height - 150) { doc.addPage(); doc.y = PAGE_MARGIN; }
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor(RULE).lineWidth(1).stroke();
    doc.y += 12;

    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK)
      .text(`Issued by ${c.engineerName ?? "—"}${c.engineerRegNo ? `, registration ${c.engineerRegNo}` : ""}`, left, doc.y, { width });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text(`Issued ${fmtDate(c.issuedAt ?? new Date())} · Reference ${c.reference}`, left, doc.y + 2, { width });
    doc.y += 12;

    if (type.footerNote) {
      doc.font("Helvetica").fontSize(8).fillColor(MUTED)
        .text(type.footerNote, left, doc.y, { width, lineGap: 1.5 });
    }

    doc.end();
  });
}
