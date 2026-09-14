import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { tenantsTable, tenantSettingsTable, usersTable, userTenantsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { signAuthToken } from "../middlewares/auth";
import { publicFormRateLimiter } from "../middlewares/rateLimit";
import { logger } from "../lib/logger";

const router = Router();

/**
 * Self-service signup.
 *
 * Creates a tenant and its first admin in one step, so getting a business onto
 * the platform no longer needs someone with database access. That was the actual
 * problem: every new tenant required a developer to seed an account by hand.
 *
 * Deliberately narrow: it creates a business and the person who owns it, and
 * nothing else. No billing, no plan selection, no invitations — those are
 * separate decisions that should not be buried inside a signup form.
 */

/** Industries that have a public site template. Anything else gets the default. */
const INDUSTRIES = [
  { key: "plumbing", label: "Plumbing & heating" },
  { key: "construction", label: "Construction & building" },
  { key: "landscaping", label: "Landscaping & groundworks" },
  { key: "rendering", label: "Rendering & external walls" },
  { key: "other", label: "Something else" },
] as const;

const signupSchema = z.object({
  businessName: z.string().trim().min(2, "Tell us the business name").max(120),
  industry: z.string().optional(),
  firstName: z.string().trim().min(1, "We need your first name").max(60),
  lastName: z.string().trim().max(60).optional().default(""),
  email: z.string().trim().toLowerCase().email("That does not look like an email address"),
  phone: z.string().trim().max(40).optional(),
  // Long beats complex: a 10-character passphrase is stronger and easier to
  // remember than eight characters of punctuation nobody can recall on a van.
  password: z.string().min(10, "Use at least 10 characters — a short phrase works well").max(200),
});

/** "Brandon's Plumbing & Heating Ltd." -> "brandons-plumbing-heating-ltd" */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "business";
}

/** Reserved words and existing tenants both have to be avoided. */
const RESERVED = new Set([
  "admin", "api", "dashboard", "site", "www", "app", "assets", "static",
  "login", "signup", "auth", "internal", "health", "pay", "calendar", "storage",
]);

async function uniqueSlug(base: string): Promise<string> {
  let candidate = RESERVED.has(base) ? `${base}-co` : base;
  for (let n = 0; n < 40; n++) {
    const [taken] = await db.select({ id: tenantsTable.id })
      .from(tenantsTable).where(eq(tenantsTable.slug, candidate)).limit(1);
    if (!taken) return candidate;
    candidate = `${base}-${n + 2}`;
  }
  // Fall back to something that cannot collide rather than failing the signup.
  return `${base}-${Date.now().toString(36)}`;
}

/** Reference prefix from the business name: "BPS Plumbing" -> "BPS". */
function refPrefix(name: string): string {
  const words = name.replace(/[^A-Za-z ]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "INV";
  const initials = words.slice(0, 3).map(w => w[0]).join("").toUpperCase();
  return initials.length >= 2 ? initials : words[0].slice(0, 3).toUpperCase();
}

router.get("/signup/industries", (_req, res) => {
  res.json(INDUSTRIES);
});

router.post("/signup", publicFormRateLimiter, async (req: any, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Some details need another look",
        fields: Object.fromEntries(parsed.error.issues.map(i => [String(i.path[0] ?? "form"), i.message])),
      });
      return;
    }
    const input = parsed.data;

    // Email is the login, so it has to be unique across the whole platform.
    const [existing] = await db.select({ id: usersTable.id })
      .from(usersTable).where(sql`lower(${usersTable.email}) = ${input.email}`).limit(1);
    if (existing) {
      res.status(409).json({
        error: "There is already an account with that email address.",
        fields: { email: "Already registered — sign in instead, or use another address." },
      });
      return;
    }

    const industry = INDUSTRIES.some(i => i.key === input.industry) && input.industry !== "other"
      ? input.industry!
      : "rendering"; // the default public template

    const slug = await uniqueSlug(slugify(input.businessName));

    const [tenant] = await db.insert(tenantsTable).values({
      name: input.businessName,
      slug,
      industry,
      plan: "trial",
      email: input.email,
      phone: input.phone || null,
      country: "GB",
    }).returning();

    await db.insert(tenantSettingsTable).values({
      tenantId: tenant.id,
      email: input.email,
      phone: input.phone || null,
      quoteRefPrefix: refPrefix(input.businessName),
    });

    const [user] = await db.insert(usersTable).values({
      tenantId: tenant.id,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName || "",
      role: "TENANT_ADMIN",
      passwordHash: await bcrypt.hash(input.password, 10),
    }).returning();

    // The membership row is what lets one person hold several businesses later.
    await db.insert(userTenantsTable).values({
      userId: user.id, tenantId: tenant.id, role: "TENANT_ADMIN",
    }).onConflictDoNothing();

    logger.info({ tenantId: tenant.id, slug }, "New tenant signed up");

    // Signed in immediately — making somebody sign in again right after creating
    // an account is a step that exists only for the developer's convenience.
    res.status(201).json({
      token: signAuthToken(user.id),
      user: { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, tenantId: tenant.id },
      tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug, industry: tenant.industry },
      siteUrl: `/site/${tenant.slug}`,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Something went wrong creating the account. Please try again." });
  }
});

export default router;
export { slugify, refPrefix };
