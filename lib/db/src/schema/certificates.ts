import { pgTable, text, serial, timestamp, integer, boolean, jsonb, date, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";
import { customersTable } from "./customers";
import { projectsTable } from "./projects";

/**
 * Compliance certificates — one engine, many types.
 *
 * The first type is the Landlord Gas Safety Record (CP12), but nothing here is
 * gas-specific. The primitive is: a dated document, issued by a qualified
 * person, delivered to a customer, that expires and must be renewed. That is
 * identically EICR, EPC, PAT testing, legionella, fire alarm and annual boiler
 * services — so a second type is a registry entry and a template, not a project.
 *
 * `type` and `status` are plain text, never pgEnum: adding a certificate type
 * must never require ALTER TYPE ... ADD VALUE, which cannot run inside a
 * transaction on some Postgres versions and aborts drizzle's whole batch.
 *
 * Type-specific fields live in `data` (jsonb, validated by a zod schema per type
 * in the API). Only what the engine itself needs — dates, status, references —
 * gets a real column. The leads table is the cautionary tale: every new industry
 * widened it and its notification field list is now over forty lines.
 */
export const certificatesTable = pgTable("certificates", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),

  /** Registry key, e.g. 'gas_safety' | 'eicr' | 'boiler_service'. */
  type: text("type").notNull(),
  /** Per-tenant human reference, e.g. BPS-GS-0001. */
  reference: text("reference").notNull(),
  /** draft | issued | superseded | void */
  status: text("status").notNull().default("draft"),

  customerId: integer("customer_id").references(() => customersTable.id),
  projectId: integer("project_id").references(() => projectsTable.id),
  /** The property this certificate is for, once one is known. Free-text
   *  propertyAddress below stays authoritative for records that predate it. */
  propertyId: integer("property_id"),
  /** Brought in from a previous system or a paper file rather than issued here.
   *  Its PDF is whatever was uploaded, and its contents were never validated by
   *  this engine — renewals still work from the expiry date either way. */
  imported: boolean("imported").notNull().default(false),
  importedNote: text("imported_note"),

  propertyAddress: text("property_address").notNull(),
  propertyPostcode: text("property_postcode"),
  /** The landlord may not be the paying customer — both are required on the record. */
  landlordName: text("landlord_name"),
  landlordAddress: text("landlord_address"),
  /** Where the copy must go within 28 days of the check. */
  tenantContactName: text("tenant_contact_name"),
  tenantContactEmail: text("tenant_contact_email"),

  // The attestation. Snapshotted at issue so a later profile edit cannot
  // retrospectively rewrite who signed a legal record.
  engineerUserId: integer("engineer_user_id").references(() => usersTable.id),
  engineerName: text("engineer_name"),
  engineerRegNo: text("engineer_reg_no"),

  checkedAt: date("checked_at").notNull(),
  expiresAt: date("expires_at").notNull(),

  outcome: text("outcome"),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),

  pdfPath: text("pdf_path"),
  pdfSha256: text("pdf_sha256"),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  supersededById: integer("superseded_by_id"),
  /** Idempotency latch for the renewal sweep. */
  renewalNotifiedAt: timestamp("renewal_notified_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("certificates_tenant_id_idx").on(table.tenantId),
  index("certificates_renewal_idx").on(table.tenantId, table.expiresAt),
  index("certificates_customer_idx").on(table.customerId),
]);

/**
 * One row per appliance checked. A gas safety record covers N appliances each
 * with its own pass/fail detail, which is a child table rather than more columns
 * on the parent.
 *
 * Every check is a nullable boolean on purpose: true / false / not applicable
 * are three different answers, and "not tested" must never render as "failed".
 */
export const certificateAppliancesTable = pgTable("certificate_appliances", {
  id: serial("id").primaryKey(),
  certificateId: integer("certificate_id").notNull().references(() => certificatesTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),

  location: text("location").notNull(),
  applianceType: text("appliance_type"),
  make: text("make"),
  model: text("model"),
  isLandlordOwned: boolean("is_landlord_owned").notNull().default(true),
  wasInspected: boolean("was_inspected").notNull().default(true),

  flueFlowPass: boolean("flue_flow_pass"),
  safetyDevicesPass: boolean("safety_devices_pass"),
  ventilationPass: boolean("ventilation_pass"),
  visualConditionPass: boolean("visual_condition_pass"),
  gasTightnessPass: boolean("gas_tightness_pass"),
  combustionReading: text("combustion_reading"),
  operatingPressure: text("operating_pressure"),

  defects: text("defects"),
  actionTaken: text("action_taken"),
  safeToUse: boolean("safe_to_use"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("certificate_appliances_certificate_id_idx").on(table.certificateId),
]);

export const insertCertificateSchema = createInsertSchema(certificatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Certificate = typeof certificatesTable.$inferSelect;

export const insertCertificateApplianceSchema = createInsertSchema(certificateAppliancesTable).omit({ id: true, createdAt: true });
export type InsertCertificateAppliance = z.infer<typeof insertCertificateApplianceSchema>;
export type CertificateAppliance = typeof certificateAppliancesTable.$inferSelect;

/** A certificate that has been issued is a legal record and must not change. */
export const IMMUTABLE_CERTIFICATE_STATUSES = ["issued", "superseded", "void"] as const;
