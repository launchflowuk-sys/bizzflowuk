import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * A pending request to set a new password after forgetting the old one.
 *
 * WHY THIS DID NOT EXIST. There was no way back into an account. A trade who
 * forgot their password had to contact us, and we had to reach into the
 * database by hand — which means the operator chooses a password for somebody
 * else and then has to tell them what it is. That is the exact problem
 * [[user_invites]] was built to solve for new accounts; existing accounts were
 * simply left without the equivalent.
 *
 * Deliberately the same shape as user_invites, because it is the same job with
 * a different trigger: prove you can read an inbox, then set your own password.
 * Same guarantees, for the same reasons:
 *
 *   - Only a SHA-256 hash of the token is stored, so a leaked database hands
 *     an attacker nothing usable. The raw token exists only in the email.
 *   - Single use (`usedAt`) so a link in a forwarded or archived email cannot
 *     be replayed.
 *   - Short-lived (`expiresAt`), because unlike an invitation this can be
 *     requested by anyone who knows an email address.
 *
 * `requestedIp` is recorded for one reason: if somebody is hammering the
 * endpoint against a real user's address, the trail should say so.
 */
export const passwordResetsTable = pgTable("password_resets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  requestedIp: text("requested_ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("password_resets_user_id_idx").on(table.userId),
]);

export const insertPasswordResetSchema = createInsertSchema(passwordResetsTable).omit({ id: true, createdAt: true });
export type InsertPasswordReset = z.infer<typeof insertPasswordResetSchema>;
export type PasswordReset = typeof passwordResetsTable.$inferSelect;
