import {
  db, tenantsTable, tenantSettingsTable, usersTable, userTenantsTable,
  servicesTable, areasTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "../logger";
import { seedTenantSampleData } from "./tenantSampleData";

/**
 * LF Builders — the demo workspace.
 *
 * WHY THIS EXISTS AS A BOOT SEEDER. There has been a demo tenant in the code
 * for a while and a 261-line script to create it, and nobody ever ran that
 * script against production. So `POST /public/demo-login` answered "the demo
 * is not available right now", the Try the demo button fell through to its
 * fallback, and every visitor who pressed it landed on a hand-drawn mock-up
 * with different navigation and different words from the real product.
 *
 * That mock-up is the worst thing we could show a prospect: it looks like the
 * product and is not, so anyone who signs up afterwards finds something else.
 * The demo has to BE the dashboard.
 *
 * A seeder that runs on boot cannot be forgotten the way a script can. That is
 * the whole argument for it.
 *
 * Everything in here is invented. LF Builders is not a real company and no
 * real customer, address or phone number appears — the numbers are Ofcom's
 * reserved drama range, which cannot connect to anyone.
 */

const SLUG = "demo";
const NAME = "LF Builders";

const SERVICES = [
  {
    name: "Extensions", slug: "extensions",
    tagline: "Single and double storey, start to finish.",
    description: "Design, groundwork, build and finish — one team from the first drawing to the final coat.",
  },
  {
    name: "Loft Conversions", slug: "loft-conversions",
    tagline: "The room you already own.",
    description: "Dormers, hip-to-gable and Velux conversions, with the structural work and building control handled.",
  },
  {
    name: "Kitchens & Bathrooms", slug: "kitchens-bathrooms",
    tagline: "Fitted properly, finished properly.",
    description: "Full refits including the plumbing, the electrics and the tiling, by the people who started the job.",
  },
  {
    name: "Groundworks & Driveways", slug: "groundworks",
    tagline: "Everything below the pretty bit.",
    description: "Foundations, drainage, block paving and resin drives, dug and laid to last.",
  },
  {
    name: "Renovations", slug: "renovations",
    tagline: "Tired houses, brought back.",
    description: "Whole-house refurbishment, from a single tired room to a property stripped back to brick.",
  },
];

const AREAS = [
  { name: "Grays", slug: "grays", county: "Essex" },
  { name: "Thurrock", slug: "thurrock", county: "Essex" },
  { name: "Basildon", slug: "basildon", county: "Essex" },
  { name: "Romford", slug: "romford", county: "Essex" },
];

export async function seedDemoTenantIfMissing(): Promise<void> {
  try {
    const [existing] = await db.select({ id: tenantsTable.id, name: tenantsTable.name })
      .from(tenantsTable).where(eq(tenantsTable.slug, SLUG)).limit(1);

    if (existing) {
      // It may predate this seeder under its old name. Rename rather than
      // leave two ideas of what the demo is called.
      if (existing.name !== NAME) {
        await db.update(tenantsTable).set({ name: NAME }).where(eq(tenantsTable.id, existing.id));
        logger.info({ tenantId: existing.id }, "Demo tenant renamed to LF Builders");
      }
      // Top the data back up if a reset or a curious visitor emptied it.
      await seedTenantSampleData(existing.id).catch(() => { /* logged inside */ });
      return;
    }

    const [tenant] = await db.insert(tenantsTable).values({
      name: NAME,
      slug: SLUG,
      // `plan: demo` is the second half of the safety check everywhere else in
      // the codebase — the reset sweep will only touch a tenant whose slug AND
      // plan both say demo, so a paying business can never match.
      plan: "demo",
      industry: "construction",
      email: "hello@lfbuilders.example",
      phone: "01375 900900",
      city: "Grays, Essex",
      description: "Extensions, loft conversions and renovations across Essex.",
    }).returning();

    await db.insert(tenantSettingsTable).values({
      tenantId: tenant.id,
      primaryColor: "#0E7C66",
      heroHeadline: "Builders who turn up, and finish.",
      heroSubheadline: "Extensions, lofts and full renovations across Grays, Thurrock and south Essex. One team from the first drawing to the last coat of paint.",
      ctaText: "Get a price",
      aboutText: "LF Builders is a family firm working across Essex. The same people who quote your job are the people who build it.",
      phone: "01375 900900",
      email: "hello@lfbuilders.example",
      city: "Grays, Essex",
      serviceBase: "Grays",
      serviceArea: "Grays, Thurrock and south Essex",
      trustBadges: ["Fully insured", "Free written quotes", "Building control handled", "10-year workmanship guarantee"],
      showReviews: true,
      showBlog: true,
      // A demo that shows VAT and CIS is a better demo: those are the fields a
      // real builder looks for and not seeing them reads as "it cannot do it".
      vatRegistered: true,
      vatNumber: "GB100200300",
      cisRegistered: true,
      cisRate: "20",
      paymentDays: 14,
      bankAccountName: "LF Builders Ltd",
      bankName: "Example Bank",
      bankSortCode: "00-00-00",
      bankAccountNumber: "12345678",
      paymentInstructions: "Please quote the invoice number as your reference.",
      invoiceTerms: "Payment due within 14 days of the invoice date.",
    }).onConflictDoNothing();

    await db.insert(servicesTable).values(SERVICES.map((s, i) => ({
      tenantId: tenant.id, ...s, published: true, sortOrder: i + 1,
      // Renovations and kitchens do not come round again; a yearly check does.
      recursEveryMonths: null,
    })));

    await db.insert(areasTable).values(AREAS.map((a, i) => ({
      tenantId: tenant.id, ...a, published: true, sortOrder: i + 1,
    })));

    /**
     * The login the demo button uses.
     *
     * A real password is set rather than left null, because demo-login signs a
     * token for this user directly and a passwordless account that can be
     * signed into is a shape worth not having lying around.
     */
    const [user] = await db.insert(usersTable).values({
      email: "demo@bizzflowuk.com",
      firstName: "Lewis",
      lastName: "Fielding",
      role: "TENANT_ADMIN",
      tenantId: tenant.id,
      passwordHash: await bcrypt.hash(
        process.env["DEMO_PASSWORD"] || `demo-${Math.random().toString(36).slice(2)}`,
        10,
      ),
    }).returning();

    await db.insert(userTenantsTable)
      .values({ userId: user.id, tenantId: tenant.id, role: "TENANT_ADMIN" })
      .onConflictDoNothing();

    // The jobs, invoices, quotes, enquiries and expenses that make every screen
    // worth looking at. Same routine the admin console uses on a real tenant.
    await seedTenantSampleData(tenant.id);

    logger.info({ tenantId: tenant.id }, "Demo workspace seeded as LF Builders");
  } catch (err) {
    // Never block boot for the demo. A missing demo costs a sales click; a
    // container that will not start costs every tenant their business.
    logger.error({ err }, "Demo tenant seed failed");
  }
}
