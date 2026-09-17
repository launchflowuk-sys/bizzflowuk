import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { tenantsTable, tenantSettingsTable, usersTable, userTenantsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { signAuthToken } from "../middlewares/auth";
import { publicFormRateLimiter } from "../middlewares/rateLimit";
import { logger } from "../lib/logger";
import { firePlatformEmail, appBaseUrl } from "../lib/platformMail";

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

/**
 * The one list of business types — signup and the platform console both read it
 * from GET /signup/industries, so a new niche is added here and nowhere else.
 *
 * `template` marks the types that have their own public site design. Everything
 * else gets the default site; most of those businesses keep their own website
 * and send enquiries in through the WordPress connector anyway.
 */
const INDUSTRIES = [
  { key: "plumbing", label: "Plumbing & heating", template: true },
  { key: "construction", label: "Construction & building", template: true },
  { key: "landscaping", label: "Landscaping & groundworks", template: true },
  { key: "rendering", label: "Rendering & external walls", template: true },
  { key: "cleaning", label: "Cleaning & facilities management", template: false },
  { key: "training", label: "Training & education", template: false },
  { key: "windows", label: "Windows, doors & glazing", template: false },
  { key: "roofing", label: "Roofing", template: false },
  { key: "electrical", label: "Electrical", template: false },
  { key: "general", label: "Something else", template: false },
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

    const industry = INDUSTRIES.some(i => i.key === input.industry)
      ? input.industry!
      : "general"; // served by the default public template

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

    /**
     * Tell someone. Both directions.
     *
     * Until this existed a signup was invisible: a row appeared in the database
     * and that was the whole event. Nobody was told a business had joined, and
     * the business was told nothing either - no confirmation that the account
     * they had just typed a password into was real.
     *
     * Fired, not awaited. A slow mail server must not hold up the response that
     * carries their login token.
     */
    const fullName = [input.firstName, input.lastName].filter(Boolean).join(" ");
    const industryLabel = INDUSTRIES.find(i => i.key === industry)?.label ?? industry;

    firePlatformEmail({
      subject: `New trial: ${input.businessName}`,
      heading: "Somebody just signed up",
      intro: `${fullName} created an account for ${input.businessName}.`,
      preheader: `${input.businessName} - ${industryLabel}`,
      // Reply goes to the person who signed up, not to our own mailbox.
      replyTo: input.email,
      rows: [
        ["Business", input.businessName],
        ["Trade", industryLabel],
        ["Name", fullName],
        ["Email", input.email],
        ["Phone", input.phone || "not given"],
        ["Their site", `${appBaseUrl()}/site/${slug}`],
      ],
      button: { label: "Open the admin console", url: `${appBaseUrl()}/admin` },
    });

    firePlatformEmail({
      to: input.email,
      subject: `${input.businessName} is set up on BizzFlowUK`,
      heading: `Welcome, ${input.firstName}.`,
      intro: `${input.businessName} is live. Your seven-day trial has started - there is nothing to pay and no card on file.`,
      preheader: "Your account is ready. Here is where to start.",
      bodyHtml: [
        `<p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:15px;color:#334155">`,
        `The quickest way to see what it does is to put one real job through it:`,
        `</p>`,
        `<ol style="margin:0 0 18px 18px;padding:0;font-family:Arial,sans-serif;font-size:15px;color:#334155;line-height:1.7">`,
        `<li>Add a customer and raise a quote.</li>`,
        `<li>Turn the accepted quote into a job in the diary.</li>`,
        `<li>Invoice it when it is done.</li>`,
        `</ol>`,
        `<p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:15px;color:#334155">`,
        `Your website is already built and online at `,
        `<a href="${appBaseUrl()}/site/${slug}" style="color:#0E7C66">${appBaseUrl().replace(/^https?:\/\//, "")}/site/${slug}</a>.`,
        ` Change the wording, prices and photos from Your website in the dashboard.`,
        `</p>`,
        `<p style="margin:0;font-family:Arial,sans-serif;font-size:15px;color:#334155">`,
        `Reply to this email if you get stuck - it comes straight to us.`,
        `</p>`,
      ].join(""),
      button: { label: "Open your dashboard", url: `${appBaseUrl()}/dashboard` },
    });

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


/**
 * Sign in to the public demo workspace.
 *
 * Hands any visitor a session for ONE specific tenant: the one whose slug is
 * `demo` and whose plan is `demo`. Both conditions are checked, so this can
 * never become a way into a paying business even if a slug is reused by mistake.
 *
 * Handing out a login sounds alarming and is not, because the demo tenant is an
 * ordinary tenant: every tenant filter in the codebase applies to it exactly as
 * it does to BPS. A demo visitor sees Oak & Stone's fictional data for the same
 * reason BPS cannot see AMO's. Everything inside it is invented, and
 * `scripts/seed-demo-tenant.cjs` rebuilds it, so anything a visitor types is
 * temporary.
 *
 * This is why the demo is the real dashboard rather than a mock-up: a prospect
 * sees the product they will actually get.
 */
router.post("/public/demo-login", publicFormRateLimiter, async (req: any, res) => {
  try {
    const [tenant] = await db.select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(and(eq(tenantsTable.slug, "demo"), eq(tenantsTable.plan, "demo")))
      .limit(1);
    if (!tenant) { res.status(404).json({ error: "The demo is not available right now." }); return; }

    const [user] = await db.select({ id: usersTable.id, email: usersTable.email, role: usersTable.role })
      .from(usersTable).where(eq(usersTable.tenantId, tenant.id)).limit(1);
    if (!user) { res.status(404).json({ error: "The demo is not available right now." }); return; }

    res.json({ token: signAuthToken(user.id), demo: true });
  } catch (err) {
    req.log.error(err, "Demo login failed");
    res.status(500).json({ error: "The demo is not available right now." });
  }
});

export default router;
export { slugify, refPrefix };
