import { Router } from "express";
import { db } from "@workspace/db";
import {
  tenantsTable, tenantSettingsTable, servicesTable, areasTable,
  galleryImagesTable, beforeAfterTable, reviewsTable, caseStudiesTable,
  faqsTable, blogPostsTable, blogCategoriesTable
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { maskSecrets } from "../lib/settingsHelpers";

const router = Router();

async function getTenantBySlug(slug: string) {
  const tenants = await db.select().from(tenantsTable).where(and(eq(tenantsTable.slug, slug), sql`${tenantsTable.suspended} = false`)).limit(1);
  return tenants[0] ?? null;
}

router.get("/public/resolve-domain", async (req, res) => {
  try {
    const host = req.query.host as string;
    if (!host) { res.status(400).json({ error: "host query param required" }); return; }
    const tenants = await db
      .select({ slug: tenantsTable.slug })
      .from(tenantsTable)
      .where(and(eq(tenantsTable.customDomain, host), sql`${tenantsTable.suspended} = false`))
      .limit(1);
    if (!tenants.length) { res.status(404).json({ error: "Domain not found" }); return; }
    res.json({ slug: tenants[0].slug });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Full public site data bundle
router.get("/public/:tenantSlug/site", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const tid = tenant.id;
    const [settings] = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tid)).limit(1);
    const services = await db.select().from(servicesTable).where(and(eq(servicesTable.tenantId, tid), sql`${servicesTable.published} = true`)).orderBy(servicesTable.sortOrder);
    const reviews = await db.select().from(reviewsTable).where(and(eq(reviewsTable.tenantId, tid), sql`${reviewsTable.featured} = true`, sql`${reviewsTable.published} = true`)).limit(6);
    const caseStudies = await db.select().from(caseStudiesTable).where(and(eq(caseStudiesTable.tenantId, tid), sql`${caseStudiesTable.published} = true`)).limit(3);
    const beforeAfter = await db.select().from(beforeAfterTable).where(eq(beforeAfterTable.tenantId, tid)).limit(4);
    const faqs = await db.select().from(faqsTable).where(and(eq(faqsTable.tenantId, tid), sql`${faqsTable.global} = true`)).orderBy(faqsTable.sortOrder).limit(10);
    res.json({ tenant, settings: maskSecrets(settings) ?? null, featuredServices: services.filter(s => s.featured), featuredReviews: reviews, recentCaseStudies: caseStudies, featuredBeforeAfter: beforeAfter, globalFaqs: faqs });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Services
router.get("/public/:tenantSlug/services", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const services = await db.select().from(servicesTable).where(and(eq(servicesTable.tenantId, tenant.id), sql`${servicesTable.published} = true`)).orderBy(servicesTable.sortOrder);
    res.json(services);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/public/:tenantSlug/services/:slug", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const service = await db.select().from(servicesTable).where(and(eq(servicesTable.tenantId, tenant.id), eq(servicesTable.slug, req.params.slug), sql`${servicesTable.published} = true`)).limit(1);
    if (!service.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(service[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Areas
router.get("/public/:tenantSlug/areas", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const areas = await db.select().from(areasTable).where(and(eq(areasTable.tenantId, tenant.id), sql`${areasTable.published} = true`)).orderBy(areasTable.sortOrder);
    res.json(areas);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/public/:tenantSlug/areas/:slug", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const area = await db.select().from(areasTable).where(and(eq(areasTable.tenantId, tenant.id), eq(areasTable.slug, req.params.slug), sql`${areasTable.published} = true`)).limit(1);
    if (!area.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(area[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Gallery
router.get("/public/:tenantSlug/gallery", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const images = await db.select().from(galleryImagesTable).where(eq(galleryImagesTable.tenantId, tenant.id)).orderBy(galleryImagesTable.sortOrder);
    res.json(images);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Before/After
router.get("/public/:tenantSlug/before-after", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const items = await db.select().from(beforeAfterTable).where(eq(beforeAfterTable.tenantId, tenant.id)).orderBy(beforeAfterTable.sortOrder);
    res.json(items);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Reviews
router.get("/public/:tenantSlug/reviews", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const reviews = await db.select().from(reviewsTable).where(and(eq(reviewsTable.tenantId, tenant.id), sql`${reviewsTable.published} = true`)).orderBy(sql`${reviewsTable.createdAt} desc`);
    res.json(reviews);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Case Studies
router.get("/public/:tenantSlug/case-studies", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const studies = await db.select().from(caseStudiesTable).where(and(eq(caseStudiesTable.tenantId, tenant.id), sql`${caseStudiesTable.published} = true`)).orderBy(sql`${caseStudiesTable.createdAt} desc`);
    res.json(studies);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/public/:tenantSlug/case-studies/:slug", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const study = await db.select().from(caseStudiesTable).where(and(eq(caseStudiesTable.tenantId, tenant.id), eq(caseStudiesTable.slug, req.params.slug), sql`${caseStudiesTable.published} = true`)).limit(1);
    if (!study.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(study[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// FAQs
router.get("/public/:tenantSlug/faqs", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const faqs = await db.select().from(faqsTable).where(and(eq(faqsTable.tenantId, tenant.id), sql`${faqsTable.global} = true`)).orderBy(faqsTable.sortOrder);
    res.json(faqs);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

// Blog
router.get("/public/:tenantSlug/blog", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const posts = await db.select().from(blogPostsTable).where(and(eq(blogPostsTable.tenantId, tenant.id), sql`${blogPostsTable.published} = true`)).orderBy(sql`${blogPostsTable.publishedAt} desc`);
    res.json(posts);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

router.get("/public/:tenantSlug/blog/:slug", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const post = await db.select().from(blogPostsTable).where(and(eq(blogPostsTable.tenantId, tenant.id), eq(blogPostsTable.slug, req.params.slug), sql`${blogPostsTable.published} = true`)).limit(1);
    if (!post.length) { res.status(404).json({ error: "Not found" }); return; }
    res.json(post[0]);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

export default router;
