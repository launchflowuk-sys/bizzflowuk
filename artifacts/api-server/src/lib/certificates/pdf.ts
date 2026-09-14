import PDFDocument from "pdfkit";
import type { CertificateType } from "./registry";

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

export function renderCertificatePdf(args: RenderArgs): Promise<Buffer> {
  const { certificate: c, appliances, type, tenant, settings } = args;

  return new Promise((resolve, reject) => {
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
    yR = field("Next check due", fmtDate(c.expiresAt), rx, yR, colW);
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
