import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * A pending invitation for someone to set their own password and take ownership of an account.
 *
 * Before this existed, creating a login meant putting a plaintext password into a Coolify
 * environment variable and redeploying the server — so onboarding a client required infrastructure
 * access, and the operator handled the client's password. Nobody should have to see a password
 * that isn't theirs.
 *
 * Only a SHA-256 hash of the token is stored. The raw token is returned to the inviting admin
 * exactly once, at creation, and cannot be recovered afterwards — a leaked database gives no
 * usable invite links. Single use (`acceptedAt`) and time-limited (`expiresAt`).
 */
export const userInvitesTable = pgTable("user_invites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdBy: integer("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("user_invites_user_id_idx").on(table.userId),
]);

export const insertUserInviteSchema = createInsertSchema(userInvitesTable).omit({ id: true, createdAt: true });
export type InsertUserInvite = z.infer<typeof insertUserInviteSchema>;
export type UserInvite = typeof userInvitesTable.$inferSelect;
