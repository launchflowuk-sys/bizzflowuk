import { Router } from "express";
import { db } from "@workspace/db";
import {
  tenantsTable, tenantSettingsTable, servicesTable, areasTable,
  galleryImagesTable, beforeAfterTable, reviewsTable, caseStudiesTable,
  faqsTable, blogPostsTable, blogCategoriesTable, priceItemsTable
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { publicSettingsOnly } from "../lib/settingsHelpers";

const router = Router();

async function getTenantBySlug(slug: string) {
  const tenants = await db.select().from(tenantsTable).where(and(eq(tenantsTable.slug, slug), sql`${tenantsTable.suspended} = false`)).limit(1);
  return tenants[0] ?? null;
}

router.get("/public/resolve-domain", async (req, res) => {
  try {
    const host = ((req.query.host as string) || "").replace(/:\d+$/, "").replace(/^www\./i, "");
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

/**
 * GET /public/robots.txt
 *
 * Same reasoning as sitemap.xml below — robots.txt needs a tenant-specific
 * absolute Sitemap: URL, which a static file baked at build time can't give
 * every custom domain. Falls back to a generic allow-all with no Sitemap
 * line for hosts that aren't a recognized tenant custom domain (e.g. the
 * platform's own domain).
 */
router.get("/public/robots.txt", async (req, res) => {
  try {
    const host = ((req.query.host as string) || (req.headers.host as string) || "").replace(/:\d+$/, "").replace(/^www\./i, "");
    const tenants = await db
      .select({ customDomain: tenantsTable.customDomain })
      .from(tenantsTable)
      .where(and(eq(tenantsTable.customDomain, host), sql`${tenantsTable.suspended} = false`))
      .limit(1);
    const sitemapLine = tenants.length ? `\nSitemap: https://${tenants[0].customDomain}/sitemap.xml\n` : "";
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(`User-agent: *\nAllow: /\n${sitemapLine}`);
  } catch (err) { req.log.error(err); res.status(500).send("User-agent: *\nAllow: /\n"); }
});

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function urlEntry(loc: string, lastmod?: Date | string | null): string {
  const lm = lastmod ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : "";
  return `  <url><loc>${escapeXml(loc)}</loc>${lm}</url>`;
}

/**
 * GET /public/sitemap.xml
 *
 * Resolves the requesting tenant by the Host header (same lookup as
 * resolve-domain) since each tenant's sitemap must only list that tenant's
 * own pages at their own custom domain — served at nginx's document root via
 * a path rewrite, see nginx.conf, so it lands at https://<domain>/sitemap.xml
 * where Google Search Console expects it.
 */
router.get("/public/sitemap.xml", async (req, res) => {
  try {
    const host = ((req.query.host as string) || (req.headers.host as string) || "").replace(/:\d+$/, "").replace(/^www\./i, "");
    const tenants = await db
      .select()
      .from(tenantsTable)
      .where(and(eq(tenantsTable.customDomain, host), sql`${tenantsTable.suspended} = false`))
      .limit(1);
    if (!tenants.length) { res.status(404).json({ error: "Domain not found" }); return; }
    const tenant = tenants[0];
    const tid = tenant.id;
    const base = `https://${tenant.customDomain}`;

    const [settings] = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tid)).limit(1);
    const services = await db.select().from(servicesTable).where(and(eq(servicesTable.tenantId, tid), sql`${servicesTable.published} = true`));
    const areas = await db.select().from(areasTable).where(and(eq(areasTable.tenantId, tid), sql`${areasTable.published} = true`));
    const caseStudies = await db.select().from(caseStudiesTable).where(and(eq(caseStudiesTable.tenantId, tid), sql`${caseStudiesTable.published} = true`));
    const posts = settings?.showBlog === false ? [] : await db.select().from(blogPostsTable).where(and(eq(blogPostsTable.tenantId, tid), sql`${blogPostsTable.published} = true`));

    const urls: string[] = [urlEntry(`${base}/`, tenant.updatedAt)];
    urls.push(urlEntry(`${base}/services`));
    urls.push(urlEntry(`${base}/areas`));
    if (settings?.showGallery !== false) urls.push(urlEntry(`${base}/gallery`));
    urls.push(urlEntry(`${base}/case-studies`));
    if (settings?.showReviews !== false) urls.push(urlEntry(`${base}/reviews`));
    urls.push(urlEntry(`${base}/faqs`));
    if (settings?.showBlog !== false) urls.push(urlEntry(`${base}/blog`));
    urls.push(urlEntry(`${base}/quote`));
    urls.push(urlEntry(`${base}/contact`));
    urls.push(urlEntry(`${base}/visualiser`));
    urls.push(urlEntry(`${base}/terms`));
    urls.push(urlEntry(`${base}/privacy`));

    for (const s of services) urls.push(urlEntry(`${base}/services/${s.slug}`, s.updatedAt));
    for (const a of areas) urls.push(urlEntry(`${base}/areas/${a.slug}`, a.updatedAt));
    for (const c of caseStudies) urls.push(urlEntry(`${base}/case-studies/${c.slug}`, c.updatedAt));
    for (const p of posts) urls.push(urlEntry(`${base}/blog/${p.slug}`, p.updatedAt ?? p.publishedAt));

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Internal server error" }); }
});

/**
 * GET /public/llms.txt
 *
 * Follows the llmstxt.org spec (H1 title, blockquote summary, optional detail
 * list, then ## sections of markdown links) so AI agents/crawlers get a
 * concise, accurate map of the tenant's real services and key pages — same
 * per-tenant Host-header resolution as robots.txt/sitemap.xml above, since a
 * static file baked at build time can't reflect each tenant's actual content.
 */
router.get("/public/llms.txt", async (req, res) => {
  try {
    const host = ((req.query.host as string) || (req.headers.host as string) || "").replace(/:\d+$/, "").replace(/^www\./i, "");
    const tenants = await db
      .select()
      .from(tenantsTable)
      .where(and(eq(tenantsTable.customDomain, host), sql`${tenantsTable.suspended} = false`))
      .limit(1);
    if (!tenants.length) { res.status(404).json({ error: "Domain not found" }); return; }
    const tenant = tenants[0];
    const tid = tenant.id;
    const base = `https://${tenant.customDomain}`;

    const [settings] = await db.select().from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tid)).limit(1);
    const services = await db.select().from(servicesTable).where(and(eq(servicesTable.tenantId, tid), sql`${servicesTable.published} = true`)).orderBy(servicesTable.sortOrder);
    const areas = await db.select().from(areasTable).where(and(eq(areasTable.tenantId, tid), sql`${areasTable.published} = true`)).orderBy(areasTable.sortOrder);

    const areaNames = areas.map(a => a.name).join(", ");
    const lines: string[] = [];
    lines.push(`# ${tenant.name}`);
    lines.push("");
    lines.push(`> ${settings?.aboutText || tenant.description || `${tenant.name} provides ${tenant.industry} services.`}`);
    lines.push("");
    if (areaNames || settings?.phone) {
      lines.push("Key details:");
      if (areaNames) lines.push(`- Serves: ${areaNames}`);
      if (settings?.phone) lines.push(`- Contact: ${settings.phone}${settings?.email ? ` / ${settings.email}` : ""}`);
      lines.push("");
    }
    lines.push("## Services");
    for (const s of services) lines.push(`- [${s.name}](${base}/services/${s.slug}): ${s.tagline || s.description || ""}`.trim());
    lines.push("");
    lines.push("## Key Pages");
    lines.push(`- [Get a Quote](${base}/quote): Request a free, no-obligation quote.`);
    lines.push(`- [Case Studies](${base}/case-studies): Completed project examples.`);
    lines.push(`- [FAQs](${base}/faqs): Common questions answered.`);
    lines.push(`- [Contact](${base}/contact): Get in touch.`);
    lines.push("");
    lines.push("## Optional");
    lines.push(`- [Terms & Conditions](${base}/terms)`);
    lines.push(`- [Privacy Policy](${base}/privacy)`);
    lines.push("");

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(lines.join("\n"));
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
    // Prefer reviews marked "featured", but a tenant with published reviews and none flagged
    // as featured yet would otherwise show zero social proof on the homepage — fall back to
    // the most recent published ones so cold ad traffic never lands on an empty trust section.
    let reviews = await db.select().from(reviewsTable).where(and(eq(reviewsTable.tenantId, tid), sql`${reviewsTable.featured} = true`, sql`${reviewsTable.published} = true`)).limit(6);
    if (!reviews.length) {
      reviews = await db.select().from(reviewsTable).where(and(eq(reviewsTable.tenantId, tid), sql`${reviewsTable.published} = true`)).orderBy(sql`${reviewsTable.createdAt} desc`).limit(6);
    }
    const caseStudies = await db.select().from(caseStudiesTable).where(and(eq(caseStudiesTable.tenantId, tid), sql`${caseStudiesTable.published} = true`)).limit(3);
    const beforeAfter = await db.select().from(beforeAfterTable).where(eq(beforeAfterTable.tenantId, tid)).limit(4);
    const faqs = await db.select().from(faqsTable).where(and(eq(faqsTable.tenantId, tid), sql`${faqsTable.global} = true`)).orderBy(faqsTable.sortOrder).limit(10);
    res.json({ tenant, settings: publicSettingsOnly(settings) ?? null, featuredServices: services.filter(s => s.featured), featuredReviews: reviews, recentCaseStudies: caseStudies, featuredBeforeAfter: beforeAfter, globalFaqs: faqs });
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

// Price items — powers the public cost calculator (published only, ordered)
router.get("/public/:tenantSlug/price-items", async (req, res) => {
  try {
    const tenant = await getTenantBySlug(req.params.tenantSlug);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }
    const items = await db.select().from(priceItemsTable).where(and(eq(priceItemsTable.tenantId, tenant.id), sql`${priceItemsTable.published} = true`)).orderBy(priceItemsTable.sortOrder);
    res.json(items);
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
