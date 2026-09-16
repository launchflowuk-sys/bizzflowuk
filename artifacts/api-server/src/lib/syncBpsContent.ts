import { db } from "@workspace/db";
import { tenantsTable, tenantSettingsTable, servicesTable, areasTable, blogPostsTable, faqsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { logger } from "./logger";
import { BPS_SERVICES, BPS_AREAS } from "./bpsContent";
import { BPS_POSTS } from "./bpsPosts";

/**
 * Brings the BPS tenant up to the migrated site content.
 *
 * The tenant seed only runs when the tenant row is missing, so it cannot reach a
 * tenant already created with the earlier placeholder content. This reconciles
 * instead, and is safe to run on every boot:
 *
 *  - inserts anything missing, keyed on slug
 *  - backfills a row that is still bare (no benefits, no description) but never
 *    overwrites a row someone has edited from the dashboard
 *  - removes only the specific placeholder slugs this code originally created,
 *    listed explicitly rather than "anything not in the new list", so a service
 *    added from the dashboard is never deleted
 */

const SLUG = "bps";

/**
 * A starting set of questions, in the client's own terms.
 *
 * Deliberately the ones a homeowner actually asks before ringing -- what it
 * costs, how fast someone comes, repair or replace -- rather than questions
 * about the business. Every answer stays inside what the client already claims
 * on his own site: nothing here invents a guarantee, a price or a response time.
 */
const BPS_FAQS = [
  {
    q: "Do you cover my area?",
    a: "We are based in Grays and cover Thurrock and south Essex, including Romford, Hornchurch, Basildon and Brentwood. If you are nearby but unsure, call us with your postcode. For urgent jobs, we will tell you honestly how quickly we can reach you.",
  },
  {
    q: "How much does a new boiler cost?",
    a: "It depends on the boiler, where it is going and what the system needs. We survey the property, talk you through the options and put a fixed written quote in front of you before any work starts. The quote is free and there is no obligation.",
  },
  {
    q: "Can you help if my boiler has stopped working?",
    a: "Yes. Tell us what the boiler is doing -- no heating, no hot water, a pressure drop, an error code -- and we will diagnose it and explain the fix and the cost before we carry it out.",
  },
  {
    q: "Should I repair or replace my boiler?",
    a: "Often a repair is the sensible answer, and we will say so. If a boiler is old enough that repairs are going to keep coming, we will tell you that too, with the numbers, so you can decide rather than be sold to.",
  },
  {
    q: "Are you Gas Safe registered?",
    a: "Yes. Every gas appliance we work on is handled by a Gas Safe registered engineer, and our workmanship is insured. Ask to see the card on the day -- a good engineer expects to be asked.",
  },
];

/** Placeholder slugs from the first seed, superseded by the migrated content. */
const RETIRED_SERVICE_SLUGS = ["central-heating", "bathrooms", "emergency-plumbing"];
const RETIRED_AREA_SLUGS = [
  "thurrock", "tilbury", "chafford-hundred",
  "south-ockendon", "corringham", "stanford-le-hope",
];

export async function syncBpsContent(): Promise<void> {
  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, SLUG)).limit(1);
  if (!tenant) return;
  const tid = tenant.id;

  let added = 0, filled = 0, removed = 0;

  /**
   * The hero photograph moves from the team-and-van shot to the boiler.
   *
   * The homepage now leads on boiler installations and repairs, and a hero has
   * one job: show the visitor the thing they came for. Two lads in front of a
   * van is a good photograph and it is about the business; somebody whose
   * heating has stopped at seven in the morning came to see a boiler.
   *
   * GUARDED, and this is the point: it only moves the image if it is still the
   * exact file the original seed set. The moment anyone changes it from the
   * dashboard, this leaves it alone forever. A boot task that overwrites an
   * edit every restart is worse than no boot task.
   *
   * The team photograph is not deleted -- it is still in public/ and still the
   * right picture for the About page.
   */
  const SEEDED_HERO = "/bps-team-van-hero.webp";
  const BOILER_HERO = "/bps-boiler-hero.webp";
  const [currentSettings] = await db.select().from(tenantSettingsTable)
    .where(eq(tenantSettingsTable.tenantId, tid)).limit(1);
  if (currentSettings?.heroImageUrl === SEEDED_HERO) {
    await db.update(tenantSettingsTable)
      .set({ heroImageUrl: BOILER_HERO, aboutImageUrl: currentSettings.aboutImageUrl ?? SEEDED_HERO })
      .where(eq(tenantSettingsTable.tenantId, tid));
    logger.info({ tenantId: tid }, "BPS hero moved to the boiler photograph; team photo kept for About");
  }

  /**
   * Questions the homepage can answer.
   *
   * The FAQ section renders nothing without them, and this tenant had none --
   * so the page had a hole where the reassurance belongs, and no FAQPage
   * structured data for Google either.
   *
   * Inserted ONLY when the tenant has no global FAQs at all. The moment anyone
   * adds or edits one from the dashboard this never touches them again: these
   * are a starting point, not a source of truth.
   */
  const existingFaqs = await db.select().from(faqsTable)
    .where(and(eq(faqsTable.tenantId, tid), eq(faqsTable.global, true))).limit(1);
  if (!existingFaqs.length) {
    await db.insert(faqsTable).values(BPS_FAQS.map((f, i) => ({
      tenantId: tid, question: f.q, answer: f.a, global: true, sortOrder: i + 1,
    })));
    logger.info({ tenantId: tid, count: BPS_FAQS.length }, "BPS starter FAQs added");
  }

  // ── Services ──────────────────────────────────────────────────────────────
  const existingServices = await db.select().from(servicesTable).where(eq(servicesTable.tenantId, tid));
  const serviceBySlug = new Map(existingServices.map(s => [s.slug, s]));

  for (const [i, s] of BPS_SERVICES.entries()) {
    const row = serviceBySlug.get(s.slug);
    if (!row) {
      await db.insert(servicesTable).values({
        tenantId: tid,
        name: s.name,
        slug: s.slug,
        tagline: s.tagline,
        description: s.description,
        content: s.content,
        heroImageUrl: s.heroImageUrl ?? null,
        benefits: s.benefits,
        processSteps: s.processSteps ?? [],
        published: true,
        sortOrder: i + 1,
      });
      added++;
      continue;
    }
    // Only fill a row that never received the richer content.
    const bare = !row.content && (!Array.isArray(row.benefits) || row.benefits.length === 0);
    if (bare) {
      await db.update(servicesTable)
        .set({ tagline: s.tagline, description: s.description, content: s.content, heroImageUrl: s.heroImageUrl ?? null, benefits: s.benefits, processSteps: s.processSteps ?? [], sortOrder: i + 1 })
        .where(eq(servicesTable.id, row.id));
      filled++;
    }
  }

  const retiredServices = existingServices.filter(s => RETIRED_SERVICE_SLUGS.includes(s.slug));
  if (retiredServices.length) {
    await db.delete(servicesTable).where(and(
      eq(servicesTable.tenantId, tid),
      inArray(servicesTable.slug, RETIRED_SERVICE_SLUGS),
    ));
    removed += retiredServices.length;
  }

  // ── Areas ─────────────────────────────────────────────────────────────────
  const existingAreas = await db.select().from(areasTable).where(eq(areasTable.tenantId, tid));
  const areaBySlug = new Map(existingAreas.map(a => [a.slug, a]));

  for (const [i, a] of BPS_AREAS.entries()) {
    const row = areaBySlug.get(a.slug);
    if (!row) {
      await db.insert(areasTable).values({
        tenantId: tid, name: a.name, slug: a.slug, county: a.county,
        description: a.description, content: a.content, published: true, sortOrder: i + 1,
      });
      added++;
      continue;
    }
    if (!row.content) {
      await db.update(areasTable)
        .set({ description: row.description || a.description, content: a.content, county: row.county || a.county, sortOrder: i + 1 })
        .where(eq(areasTable.id, row.id));
      filled++;
    }
  }

  const retiredAreas = existingAreas.filter(a => RETIRED_AREA_SLUGS.includes(a.slug));
  if (retiredAreas.length) {
    await db.delete(areasTable).where(and(
      eq(areasTable.tenantId, tid),
      inArray(areasTable.slug, RETIRED_AREA_SLUGS),
    ));
    removed += retiredAreas.length;
  }

  // ── Blog ──────────────────────────────────────────────────────────────────
  // Inserted only where the slug is absent, so an edited or deleted post stays
  // deleted rather than reappearing on the next deploy.
  const existingPosts = await db.select().from(blogPostsTable).where(eq(blogPostsTable.tenantId, tid));
  const postSlugs = new Set(existingPosts.map(p => p.slug));

  const now = Date.now();
  for (const [i, p] of BPS_POSTS.entries()) {
    if (postSlugs.has(p.slug)) continue;
    await db.insert(blogPostsTable).values({
      tenantId: tid,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.content,
      published: true,
      // Spread the dates backwards so the index isn't fifteen posts stamped
      // with the same minute, which reads as a dump rather than a blog.
      publishedAt: new Date(now - i * 7 * 24 * 60 * 60 * 1000),
      authorName: tenant.name,
      readTime: p.readTime,
      seoTitle: p.seoTitle ?? p.title,
      seoDescription: p.seoDescription ?? p.excerpt,
    });
    added++;
  }

  if (added || filled || removed) {
    logger.info({ added, filled, removed }, "BPS content synced from the migrated site");
  }
}
