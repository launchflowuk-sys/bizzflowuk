import {
  db,
  leadsTable, leadNotesTable,
  quotesTable, quoteItemsTable,
  paymentLinksTable,
  projectsTable, projectUpdatesTable,
  sentEmailsTable,
  customersTable, contactMessagesTable, portalMessagesTable, reviewsTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";

/**
 * Deep-delete helpers. None of the schema's foreign keys declare ON DELETE behaviour, so a bare
 * `db.delete(parent)` throws an FK violation (→ HTTP 500) the moment the row has any children —
 * which is almost always. Each helper removes true children and UNLINKS (nulls) soft references
 * that must survive their parent (a paid quote must not vanish because its lead was tidied away).
 *
 * All take an ids array so single-row and bulk deletes share one code path. Callers MUST pass only
 * ids already verified to belong to the requesting tenant — these helpers do no tenant filtering.
 * Everything runs in one transaction: a failure part-way never leaves half-deleted rows.
 */

export async function deleteLeadsDeep(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await db.transaction(async (tx) => {
    await tx.delete(leadNotesTable).where(inArray(leadNotesTable.leadId, ids));
    // Quotes + email history outlive the lead — unlink, don't destroy.
    await tx.update(quotesTable).set({ leadId: null }).where(inArray(quotesTable.leadId, ids));
    await tx.update(sentEmailsTable).set({ leadId: null }).where(inArray(sentEmailsTable.leadId, ids));
    await tx.delete(leadsTable).where(inArray(leadsTable.id, ids));
  });
}

export async function deleteQuotesDeep(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await db.transaction(async (tx) => {
    await tx.delete(quoteItemsTable).where(inArray(quoteItemsTable.quoteId, ids));
    // Payment records and converted projects are financial/operational history — unlink only.
    await tx.update(paymentLinksTable).set({ quoteId: null }).where(inArray(paymentLinksTable.quoteId, ids));
    await tx.update(projectsTable).set({ quoteId: null }).where(inArray(projectsTable.quoteId, ids));
    await tx.delete(quotesTable).where(inArray(quotesTable.id, ids));
  });
}

export async function deleteProjectsDeep(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await db.transaction(async (tx) => {
    await tx.delete(projectUpdatesTable).where(inArray(projectUpdatesTable.projectId, ids));
    await tx.delete(projectsTable).where(inArray(projectsTable.id, ids));
  });
}

export async function deleteCustomersDeep(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await db.transaction(async (tx) => {
    // portal_messages.customerId is NOT NULL → these rows cannot be unlinked, only removed.
    await tx.delete(portalMessagesTable).where(inArray(portalMessagesTable.customerId, ids));
    await tx.update(contactMessagesTable).set({ customerId: null }).where(inArray(contactMessagesTable.customerId, ids));
    await tx.update(quotesTable).set({ customerId: null }).where(inArray(quotesTable.customerId, ids));
    await tx.update(projectsTable).set({ customerId: null }).where(inArray(projectsTable.customerId, ids));
    await tx.update(reviewsTable).set({ customerId: null }).where(inArray(reviewsTable.customerId, ids));
    await tx.delete(customersTable).where(inArray(customersTable.id, ids));
  });
}
