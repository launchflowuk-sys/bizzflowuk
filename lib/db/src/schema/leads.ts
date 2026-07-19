import { pgTable, text, serial, timestamp, integer, pgEnum, jsonb, boolean, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const leadStatusEnum = pgEnum("lead_status", ["New", "Contacted", "Survey Booked", "Quote Sent", "Won", "Lost"]);
export const leadSourceEnum = pgEnum("lead_source", ["Website", "Referral", "Google", "Facebook", "Instagram", "Other", "Cost Calculator"]);

/** A single line the visitor picked in the public cost calculator, stored on the lead so
 *  "Convert to Quote" can pre-fill the quote's line items without any re-keying. */
export type EstimateItem = { name: string; quantity: number; unit: string; unitPrice: string; lineTotal: string };

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  postcode: text("postcode"),
  serviceInterest: text("service_interest"),
  propertyType: text("property_type"),
  propertyTypeOther: text("property_type_other"),
  existingSurface: text("existing_surface"),
  desiredFinish: text("desired_finish"),
  timeframe: text("timeframe"),
  photoUrls: jsonb("photo_urls").$type<string[]>().default([]),
  reference: text("reference"),
  preferredContactMethod: text("preferred_contact_method"),
  bestTimeToContact: text("best_time_to_contact"),
  areaToRender: text("area_to_render"),
  areaToRenderOther: text("area_to_render_other"),
  numberOfStoreys: text("number_of_storeys"),
  wallArea: text("wall_area"),
  currentCondition: jsonb("current_condition").$type<string[]>().default([]),
  preferredColour: text("preferred_colour"),
  preferredColourOther: text("preferred_colour_other"),
  requiresInsulation: text("requires_insulation"),
  insulationThickness: text("insulation_thickness"),
  insulationMaterial: text("insulation_material"),
  accessConditions: jsonb("access_conditions").$type<string[]>().default([]),
  propertyStatus: text("property_status"),
  companyName: text("company_name"),
  // Construction (AMO Services) fields — nullable, populated only for construction-industry tenants.
  clientType: text("client_type"),                 // Residential | Commercial | Institutional
  projectDescription: text("project_description"), // free-text description of the works
  planningStatus: text("planning_status"),          // planning / building-regs status
  hasDrawings: text("has_drawings"),                // Yes | No | Not sure
  urgency: text("urgency"),                          // Emergency | Planned (electrical work)
  consentAgreed: boolean("consent_agreed").notNull().default(false),
  // Cost-calculator output — structured line items + total, so a lead from the calculator
  // converts straight into a quote with its items pre-filled (see /leads/:id/convert-quote).
  estimateItems: jsonb("estimate_items").$type<EstimateItem[]>(),
  estimateTotal: numeric("estimate_total", { precision: 10, scale: 2 }),
  status: leadStatusEnum("status").notNull().default("New"),
  source: leadSourceEnum("source").default("Website"),
  assignedToId: integer("assigned_to_id").references(() => usersTable.id),
  budget: text("budget"),
  notes: text("notes"),
  lostReason: text("lost_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("leads_tenant_id_idx").on(table.tenantId),
  index("leads_assigned_to_id_idx").on(table.assignedToId),
]);

export const leadNotesTable = pgTable("lead_notes", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().references(() => leadsTable.id),
  authorId: integer("author_id").references(() => usersTable.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("lead_notes_lead_id_idx").on(table.leadId),
  index("lead_notes_author_id_idx").on(table.authorId),
]);

export const insertLeadSchema = createInsertSchema(leadsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;

export const insertLeadNoteSchema = createInsertSchema(leadNotesTable).omit({ id: true, createdAt: true });
export type InsertLeadNote = z.infer<typeof insertLeadNoteSchema>;
export type LeadNote = typeof leadNotesTable.$inferSelect;
