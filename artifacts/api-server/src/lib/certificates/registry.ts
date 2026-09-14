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

export type CertificateType = {
  key: string;
  /** Shown in the dashboard and on the PDF. */
  label: string;
  shortLabel: string;
  /** Used to build the reference, e.g. BPS-GS-0001. */
  referenceCode: string;
  /** How long the certificate is valid, in months. */
  validMonths: number;
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
  label: "Landlord Gas Safety Record",
  shortLabel: "Gas Safety",
  referenceCode: "GS",
  validMonths: 12,
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
  label: "Annual Boiler Service Record",
  shortLabel: "Boiler Service",
  referenceCode: "BS",
  validMonths: 12,
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

const REGISTRY: Record<string, CertificateType> = {
  [gasSafety.key]: gasSafety,
  [boilerService.key]: boilerService,
};

export function getCertificateType(key: string): CertificateType | null {
  return REGISTRY[key] ?? null;
}

export function listCertificateTypes(): CertificateType[] {
  return Object.values(REGISTRY);
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
export function computeExpiry(checkedAt: string, validMonths: number): string {
  const d = new Date(`${checkedAt}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + validMonths);
  // A check on the 31st with a shorter target month rolls forward; step back so
  // the certificate never lasts longer than the type allows.
  return d.toISOString().slice(0, 10);
}
