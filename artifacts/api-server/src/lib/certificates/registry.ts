import { z } from "zod/v4";

/**
 * Certificate type registry.
 *
 * A certificate type is data, never a branch on tenant. There is no
 * `if (tenant.slug === 'bps')` anywhere in this engine — a tenant enables the
 * types it needs and the engine does not know who they are. That rule is what
 * stopped one client's copy leaking onto another client's site, and it applies
 * here from the first type.
 *
 * Adding EICR, EPC, PAT or legionella is an entry in this file plus a PDF
 * template. If it ever needs more than that, the abstraction is wrong and should
 * be fixed before another type is added.
 */

/** Per-appliance checks. Nullable tri-state: pass / fail / not applicable. */
const applianceSchema = z.object({
  /**
   * A stable id the client mints and keeps across saves.
   *
   * Appliances are replaced wholesale on every save, so the primary key is not
   * stable and photographs keyed to it would silently detach. This is what
   * they hang off instead.
   */
  clientKey: z.string().max(64).optional().nullable(),
  location: z.string().min(1, "Every appliance needs a location"),
  applianceType: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  isLandlordOwned: z.boolean().default(true),
  wasInspected: z.boolean().default(true),

  flueFlowPass: z.boolean().nullable().optional(),
  safetyDevicesPass: z.boolean().nullable().optional(),
  ventilationPass: z.boolean().nullable().optional(),
  visualConditionPass: z.boolean().nullable().optional(),
  gasTightnessPass: z.boolean().nullable().optional(),
  combustionReading: z.string().optional(),
  operatingPressure: z.string().optional(),

  defects: z.string().optional(),
  actionTaken: z.string().optional(),
  safeToUse: z.boolean().nullable().optional(),
});

export type CertificateApplianceInput = z.infer<typeof applianceSchema>;

/**
 * The groups the picker shows before the form list.
 *
 * Named for the trade rather than for us, and matching what a gas engineer
 * already sees in the app they are coming from.
 */
export const CERTIFICATE_CATEGORIES = [
  "Plumbing & Gas", "Oil", "Electrical", "Fire Safety", "Solar", "Checklists",
] as const;
export type CertificateCategory = (typeof CERTIFICATE_CATEGORIES)[number];

export type CertificateType = {
  key: string;
  /** Shown in the dashboard and on the PDF. */
  label: string;
  shortLabel: string;
  /** Which group this sits under in the picker. */
  category: CertificateCategory;
  /** Used to build the reference, e.g. BPS-GS-0001. */
  referenceCode: string;
  /**
   * How long the record is valid, in months. Ignored when `expires` is false.
   */
  validMonths: number;
  /**
   * Does this record lapse at all?
   *
   * False for the ones that are a statement about work done on a date rather
   * than a permission that runs out — a warning notice, a commissioning
   * record, a purge record. Those get no expiry date and never appear in the
   * renewal sweep.
   */
  expires: boolean;
  /** Days before expiry that a renewal lead is raised. */
  renewalWindowDays: number;
  /** Statutory deadline for getting a copy to the occupier, in days. Null if none. */
  deliveryDeadlineDays: number | null;
  /** How long the recipient must retain it, in months. Informational, shown on the PDF. */
  retentionMonths: number | null;
  /** Does this type record individual appliances? */
  usesAppliances: boolean;
  /** Validates the type-specific `data` payload. */
  dataSchema: z.ZodTypeAny;
  /** Legal note printed on the certificate footer. */
  footerNote?: string;
};

const gasSafety: CertificateType = {
  key: "gas_safety",
  label: "Landlord/Homeowner Gas Safety Record",
  shortLabel: "Gas Safety",
  category: "Plumbing & Gas",
  referenceCode: "GS",
  validMonths: 12,
  expires: true,
  renewalWindowDays: 60,
  // A copy must reach existing tenants within 28 days of the check.
  deliveryDeadlineDays: 28,
  // The landlord keeps the record for two years.
  retentionMonths: 24,
  usesAppliances: true,
  dataSchema: z.object({
    /** Free text for anything the prescribed fields do not cover. */
    notes: z.string().optional(),
    /** Recorded because the engineer attests to it, not because we check it. */
    installationPipeworkPass: z.boolean().nullable().optional(),
    emergencyControlAccessible: z.boolean().nullable().optional(),
    coAlarmFitted: z.boolean().nullable().optional(),
    coAlarmInDate: z.boolean().nullable().optional(),
  }),
  footerNote:
    "This record is issued by the Gas Safe registered engineer named above, who is responsible for the checks it describes. A copy must be given to existing tenants within 28 days of the check, and to new tenants at the start of their tenancy. The landlord must retain it for two years.",
};

/**
 * Deliberately low legal risk, and here to prove the engine: adding it required
 * only this entry. If a third type needs engine changes, stop and fix the
 * abstraction first.
 */
const boilerService: CertificateType = {
  key: "boiler_service",
  label: "Boiler Service Record",
  shortLabel: "Boiler Service",
  category: "Plumbing & Gas",
  referenceCode: "BS",
  validMonths: 12,
  expires: true,
  renewalWindowDays: 45,
  deliveryDeadlineDays: null,
  retentionMonths: null,
  usesAppliances: true,
  dataSchema: z.object({
    notes: z.string().optional(),
    systemPressure: z.string().optional(),
    filterFitted: z.boolean().nullable().optional(),
    inhibitorLevelOk: z.boolean().nullable().optional(),
  }),
  footerNote:
    "This record describes an annual service carried out by the engineer named above. Retain it to support any manufacturer warranty claim.",
};


/**
 * The rest of the Plumbing & Gas list.
 *
 * A NOTE THAT MATTERS: these are the records a gas engineer issues, and
 * several of them carry legal weight. The engine captures and renders what an
 * engineer attests to; it does not check any of it, and it is not a
 * substitute for the prescribed wording where a scheme mandates one. Brandon
 * should compare the output against what he issues today before relying on it
 * for anything statutory -- particularly the warning notice, which is the one
 * that matters in an incident.
 */

const gasWarningNotice: CertificateType = {
  key: "gas_warning_notice",
  label: "Gas Warning Notice",
  shortLabel: "Warning Notice",
  category: "Plumbing & Gas",
  referenceCode: "GWN",
  // Does not lapse. An appliance stops being unsafe when it is repaired or
  // replaced, not on a date, and putting an expiry on this would both state
  // something untrue and drop it into the renewal sweep.
  validMonths: 0,
  expires: false,
  renewalWindowDays: 0,
  deliveryDeadlineDays: null,
  retentionMonths: null,
  usesAppliances: true,
  dataSchema: z.object({
    notes: z.string().optional(),
    /** Immediately Dangerous / At Risk / Not to Current Standards. */
    riskCategory: z.enum(["ID", "AR", "NCS"]).optional(),
    applianceDisconnected: z.boolean().nullable().optional(),
    gasSupplyTurnedOff: z.boolean().nullable().optional(),
    warningLabelAttached: z.boolean().nullable().optional(),
    customerAdvised: z.boolean().nullable().optional(),
    /** Recorded because RIDDOR/supplier reporting can follow from it. */
    reportedToGasEmergencyService: z.boolean().nullable().optional(),
  }),
  footerNote:
    "This notice records that the appliance or installation described above was found to be unsafe on the date shown. It does not expire and is not a certificate of safety. The appliance must not be used until it has been made safe by a Gas Safe registered engineer.",
};

const gasBreakdownService: CertificateType = {
  key: "gas_breakdown",
  label: "Gas Breakdown/Service Record",
  shortLabel: "Breakdown",
  category: "Plumbing & Gas",
  referenceCode: "GBS",
  validMonths: 0,
  expires: false,
  renewalWindowDays: 0,
  deliveryDeadlineDays: null,
  retentionMonths: null,
  usesAppliances: true,
  dataSchema: z.object({
    notes: z.string().optional(),
    faultReported: z.string().optional(),
    faultFound: z.string().optional(),
    partsFitted: z.string().optional(),
    workCompleted: z.boolean().nullable().optional(),
    furtherWorkNeeded: z.string().optional(),
  }),
  footerNote:
    "This record describes a breakdown or service visit carried out by the engineer named above on the date shown.",
};

const serviceMaintenance: CertificateType = {
  key: "service_maintenance",
  label: "Service and Maintenance Record",
  shortLabel: "Service",
  category: "Plumbing & Gas",
  referenceCode: "SM",
  validMonths: 12,
  expires: true,
  renewalWindowDays: 45,
  deliveryDeadlineDays: null,
  retentionMonths: null,
  usesAppliances: true,
  dataSchema: z.object({
    notes: z.string().optional(),
    workCarriedOut: z.string().optional(),
    partsFitted: z.string().optional(),
    nextServiceDue: z.string().optional(),
  }),
  footerNote:
    "This record describes scheduled maintenance carried out by the engineer named above. Retain it to support any manufacturer warranty claim.",
};

const centralHeatingCommissioning: CertificateType = {
  key: "ch_commissioning",
  label: "Central Heating Commissioning Certificate",
  shortLabel: "CH Commissioning",
  category: "Plumbing & Gas",
  referenceCode: "CHC",
  // A statement about an installation on a date. Nothing to renew.
  validMonths: 0,
  expires: false,
  renewalWindowDays: 0,
  deliveryDeadlineDays: null,
  retentionMonths: null,
  usesAppliances: true,
  dataSchema: z.object({
    notes: z.string().optional(),
    systemFlushed: z.boolean().nullable().optional(),
    inhibitorAdded: z.boolean().nullable().optional(),
    inhibitorBrand: z.string().optional(),
    filterFitted: z.boolean().nullable().optional(),
    systemPressure: z.string().optional(),
    controlsExplainedToCustomer: z.boolean().nullable().optional(),
    manualsHandedOver: z.boolean().nullable().optional(),
  }),
  footerNote:
    "This certificate records the commissioning of the heating system described above. Keep it with the appliance documentation; a manufacturer warranty may depend on it.",
};

const unventedHotWater: CertificateType = {
  key: "unvented_hot_water",
  label: "Domestic Unvented Hot Water Commissioning/Inspection Record",
  shortLabel: "Unvented HW",
  category: "Plumbing & Gas",
  referenceCode: "UHW",
  validMonths: 12,
  expires: true,
  renewalWindowDays: 45,
  deliveryDeadlineDays: null,
  // Building Regulations Part G work; the householder keeps the record.
  retentionMonths: null,
  usesAppliances: true,
  dataSchema: z.object({
    notes: z.string().optional(),
    cylinderMake: z.string().optional(),
    cylinderCapacityLitres: z.string().optional(),
    expansionVesselChargePressure: z.string().optional(),
    tempReliefValveTested: z.boolean().nullable().optional(),
    expansionReliefValveTested: z.boolean().nullable().optional(),
    tundishDischargeCorrect: z.boolean().nullable().optional(),
    operatingTemperature: z.string().optional(),
  }),
  footerNote:
    "This record relates to an unvented hot water system. Work on these systems is notifiable under Building Regulations and must be carried out by a competent person holding the relevant qualification.",
};

const gasTestingPurging: CertificateType = {
  key: "gas_testing_purging",
  label: "Domestic Gas Testing & Purging",
  shortLabel: "Test & Purge",
  category: "Plumbing & Gas",
  referenceCode: "GTP",
  validMonths: 0,
  expires: false,
  renewalWindowDays: 0,
  deliveryDeadlineDays: null,
  retentionMonths: null,
  usesAppliances: false,
  dataSchema: z.object({
    notes: z.string().optional(),
    pipeworkMaterial: z.string().optional(),
    pipeworkSize: z.string().optional(),
    installationVolume: z.string().optional(),
    testPressure: z.string().optional(),
    stabilisationPeriod: z.string().optional(),
    testDuration: z.string().optional(),
    pressureDrop: z.string().optional(),
    testResultPass: z.boolean().nullable().optional(),
    purgedCorrectly: z.boolean().nullable().optional(),
  }),
  footerNote:
    "This record describes a tightness test and purge carried out on the date shown, in accordance with the current edition of IGEM/UP/1B.",
};

const installationCommissioning: CertificateType = {
  key: "installation_record",
  label: "Installation/Commissioning/Decommissioning Record",
  shortLabel: "Installation",
  category: "Plumbing & Gas",
  referenceCode: "ICD",
  validMonths: 0,
  expires: false,
  renewalWindowDays: 0,
  deliveryDeadlineDays: null,
  retentionMonths: null,
  usesAppliances: true,
  dataSchema: z.object({
    notes: z.string().optional(),
    /** Which of the three this visit was. */
    workType: z.enum(["installation", "commissioning", "decommissioning"]).optional(),
    applianceRemoved: z.boolean().nullable().optional(),
    gasSupplyCapped: z.boolean().nullable().optional(),
    flueTestedSatisfactory: z.boolean().nullable().optional(),
    buildingRegsNotified: z.boolean().nullable().optional(),
    notificationNumber: z.string().optional(),
  }),
  footerNote:
    "This record describes installation, commissioning or decommissioning work carried out by the engineer named above on the date shown.",
};

const commercialCatering: CertificateType = {
  key: "commercial_catering",
  label: "Commercial Catering Inspection Record",
  shortLabel: "Catering",
  category: "Plumbing & Gas",
  referenceCode: "CCI",
  validMonths: 12,
  expires: true,
  renewalWindowDays: 60,
  deliveryDeadlineDays: null,
  retentionMonths: 24,
  usesAppliances: true,
  dataSchema: z.object({
    notes: z.string().optional(),
    ventilationInterlockFitted: z.boolean().nullable().optional(),
    ventilationInterlockTested: z.boolean().nullable().optional(),
    extractionAdequate: z.boolean().nullable().optional(),
    airSupplyAdequate: z.boolean().nullable().optional(),
    gasInterlockTested: z.boolean().nullable().optional(),
    coMonitorFitted: z.boolean().nullable().optional(),
  }),
  footerNote:
    "This record relates to commercial catering gas appliances and the associated ventilation. It is issued by the Gas Safe registered engineer named above, who holds the relevant commercial catering competencies.",
};

const ALL_TYPES: CertificateType[] = [
  gasSafety,
  boilerService,
  gasWarningNotice,
  gasBreakdownService,
  serviceMaintenance,
  centralHeatingCommissioning,
  unventedHotWater,
  gasTestingPurging,
  installationCommissioning,
  commercialCatering,
];

const REGISTRY: Record<string, CertificateType> = Object.fromEntries(
  ALL_TYPES.map(t => [t.key, t]),
);

export function getCertificateType(key: string): CertificateType | null {
  return REGISTRY[key] ?? null;
}

export function listCertificateTypes(): CertificateType[] {
  return ALL_TYPES;
}

export { applianceSchema };

/** Body accepted when creating or updating a draft certificate. */
export const certificateInputSchema = z.object({
  type: z.string().min(1),
  customerId: z.number().int().optional().nullable(),
  projectId: z.number().int().optional().nullable(),

  propertyAddress: z.string().min(1, "A property address is required"),
  propertyPostcode: z.string().optional(),
  landlordName: z.string().optional(),
  landlordAddress: z.string().optional(),
  tenantContactName: z.string().optional(),
  tenantContactEmail: z.string().email().optional().or(z.literal("")),

  engineerName: z.string().optional(),
  engineerRegNo: z.string().optional(),

  /** ISO date. Expiry is derived from the type, never sent by the client. */
  checkedAt: z.string().min(1, "The date of the check is required"),

  outcome: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  appliances: z.array(applianceSchema).optional(),
});

export type CertificateInput = z.infer<typeof certificateInputSchema>;

/** Expiry is always derived, so a client can never post itself a longer validity. */
/**
 * When this record runs out, or null if it never does.
 *
 * The month arithmetic is CLAMPED, and that is not cosmetic. The previous
 * version carried a comment saying it stepped back from a short month and then
 * did not do it: setUTCMonth on 31 August plus six months lands on 3 March,
 * because 31 February rolls forward. A gas safety record dated 29 February
 * came out valid until 1 March the following year rather than 28 February.
 *
 * That is a legal document claiming validity for longer than the law allows,
 * on the one kind of paperwork where the date is the whole point.
 */
export function computeExpiry(checkedAt: string, validMonths: number): string | null {
  if (!validMonths) return null;

  const [y, m, d] = checkedAt.split("-").map(Number);
  const targetIndex = (m - 1) + validMonths;
  const targetYear = y + Math.floor(targetIndex / 12);
  const targetMonth = ((targetIndex % 12) + 12) % 12;
  // Day 0 of the following month is the last day of this one.
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
