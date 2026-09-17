/**
 * What a lead actually says, with nothing it doesn't.
 *
 * The leads table grew one industry at a time — rendering first, then
 * construction, then landscaping — and the detail page listed every column with
 * a "-" when empty. A cleaning company's enquiry opened as a wall of rendering
 * questions nobody asked. This is the single list of every field a lead can
 * carry; the page shows only the ones that are filled. No tenant or industry
 * branch anywhere: a field either has a value or it doesn't.
 *
 * Website plugins (the WordPress connector) can't write columns they don't
 * know, so they pack extra form fields into `notes` as "field-name: value"
 * lines. `parseLeadNotes` turns those back into labelled fields.
 */

export interface LeadField {
  label: string;
  value: string;
  /** Long text that should span the full width. */
  wide?: boolean;
}

type Lead = Record<string, unknown>;

interface FieldSpec {
  key: string;
  label: string;
  /** Companion "Other — …" free-text column. */
  other?: string;
  wide?: boolean;
}

/**
 * Every structured column worth showing, in reading order. Contact channels,
 * name, service and message are shown in the panel header, not here.
 */
const FIELD_SPECS: FieldSpec[] = [
  { key: "companyName", label: "Company" },
  { key: "address", label: "Address", wide: true },
  { key: "city", label: "Town / City" },
  { key: "postcode", label: "Postcode" },
  { key: "preferredContactMethod", label: "Preferred contact" },
  { key: "bestTimeToContact", label: "Best time to contact" },
  { key: "timeframe", label: "Timeframe" },
  { key: "budget", label: "Budget" },
  { key: "clientType", label: "Client type" },
  { key: "urgency", label: "Urgency" },
  { key: "propertyType", label: "Property type", other: "propertyTypeOther" },
  { key: "propertyStatus", label: "Property status" },
  { key: "planningStatus", label: "Planning / building regs" },
  { key: "hasDrawings", label: "Has drawings / plans" },
  { key: "areaToRender", label: "Area to be rendered", other: "areaToRenderOther" },
  { key: "numberOfStoreys", label: "Number of storeys" },
  { key: "wallArea", label: "Approx. wall area" },
  { key: "existingSurface", label: "Existing surface" },
  { key: "currentCondition", label: "Current condition", wide: true },
  { key: "desiredFinish", label: "Desired finish" },
  { key: "preferredColour", label: "Preferred colour", other: "preferredColourOther" },
  { key: "requiresInsulation", label: "Requires insulation" },
  { key: "insulationThickness", label: "Insulation thickness" },
  { key: "insulationMaterial", label: "Insulation material" },
  { key: "accessConditions", label: "Access conditions", wide: true },
  { key: "gardenSize", label: "Garden / area size" },
  { key: "currentSurface", label: "Current surface" },
  { key: "levelChange", label: "Level change" },
  { key: "drainageIssues", label: "Drainage issues" },
  { key: "wasteRemoval", label: "Waste removal" },
  { key: "desiredFeatures", label: "Features wanted", wide: true },
];

/** Form field names that mean "the enquiry itself". */
const MESSAGE_KEY = /message|enquiry|inquiry|comment|details|description/i;
/**
 * A packed note line: a form field name as the connector writes it — lowercase,
 * no spaces — a colon, a value. Lowercase-only keeps "Note: call after 5" typed
 * by a person out of it.
 */
const NOTE_LINE = /^([a-z0-9][a-z0-9_-]*):\s?(.*)$/;

function text(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).map(String).join(", ");
  if (value === null || value === undefined || typeof value === "boolean") return "";
  return String(value).trim();
}

function specValue(lead: Lead, spec: FieldSpec): string {
  const value = text(lead[spec.key]);
  const other = spec.other ? text(lead[spec.other]) : "";
  if (other && (value === "Other" || value === "Custom Colour")) return `${value} — ${other}`;
  return value;
}

/** "your-message" → "Message", "site_location" → "Site location". */
export function humaniseKey(key: string): string {
  const words = key.replace(/^your[-_]/i, "").replace(/[-_]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

export interface ParsedNotes {
  fields: { key: string; label: string; value: string }[];
  /** Whatever was not in "field: value" form — typed notes, kept verbatim. */
  freeText: string;
}

/**
 * Split packed "field: value" lines out of the notes. A line that does not look
 * like a field continues the previous field (multi-line messages), unless no
 * field has started yet, in which case it is ordinary free text.
 */
export function parseLeadNotes(notes: unknown): ParsedNotes {
  const raw = text(notes);
  const fields: ParsedNotes["fields"] = [];
  const free: string[] = [];
  if (!raw) return { fields, freeText: "" };

  // Packed notes start with a field and carry at least two. Anything else is a
  // person's own note and is shown exactly as typed.
  const lines = raw.split(/\r?\n/);
  const packed = NOTE_LINE.test(lines[0]) && lines.filter(l => NOTE_LINE.test(l)).length >= 2;
  if (!packed) return { fields, freeText: raw };

  for (const line of lines) {
    const match = NOTE_LINE.exec(line);
    if (match) {
      fields.push({ key: match[1], label: humaniseKey(match[1]), value: match[2].trim() });
    } else if (fields.length) {
      const last = fields[fields.length - 1];
      fields[fields.length - 1] = { ...last, value: `${last.value}\n${line}`.trim() };
    } else {
      free.push(line);
    }
  }
  return { fields: fields.filter(f => f.value), freeText: free.join("\n").trim() };
}

export interface LeadView {
  service: string;
  message: string;
  details: LeadField[];
  notes: string;
}

/** Everything the detail page shows, already filtered to what is filled in. */
export function buildLeadView(lead: Lead): LeadView {
  const service = text(lead.serviceInterest);
  const company = text(lead.companyName);
  const parsed = parseLeadNotes(lead.notes);

  const details: LeadField[] = [];
  for (const spec of FIELD_SPECS) {
    const value = specValue(lead, spec);
    if (value) details.push({ label: spec.label, value, wide: spec.wide });
  }

  const messageParts = [text(lead.projectDescription)];
  const extra: LeadField[] = [];
  for (const f of parsed.fields) {
    const lower = f.key.toLowerCase();
    if (MESSAGE_KEY.test(lower)) { messageParts.push(f.value); continue; }
    // Already shown from its own column — don't say it twice.
    if (lower.includes("service") && f.value === service) continue;
    if (lower.includes("company") && f.value === company) continue;
    if (details.some(d => d.label === f.label && d.value === f.value)) continue;
    extra.push({ label: f.label, value: f.value, wide: f.value.length > 60 });
  }

  return {
    service,
    message: messageParts.filter(Boolean).join("\n\n"),
    details: [...details, ...extra],
    notes: parsed.freeText,
  };
}

/** UK mobile/landline -> E.164 so wa.me and tel: behave on a phone. */
export function waNumber(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1);
  if (digits.startsWith("0")) return `44${digits.slice(1)}`;
  if (digits.startsWith("44")) return digits;
  return digits || null;
}
