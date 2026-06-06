import { db } from "@workspace/db";
import {
  galleryImagesTable,
  beforeAfterTable,
  reviewsTable,
  caseStudiesTable,
  areasTable,
  servicesTable,
  tenantsTable,
  tenantSettingsTable,
  faqsTable,
  blogPostsTable,
  leadsTable,
} from "@workspace/db";
import { eq, and, like, sql } from "drizzle-orm";
import { logger } from "./logger";

const OLD_LOCATIONS = ["Bolton", "Salford", "Manchester", "Birmingham", "Oldham", "Bury", "Rochdale", "Stockport", "Wigan"];

async function hasOldData(tenantId: number): Promise<boolean> {
  const rows = await db
    .select({ caption: galleryImagesTable.caption })
    .from(galleryImagesTable)
    .where(eq(galleryImagesTable.tenantId, tenantId))
    .limit(1);
  if (!rows.length) return false;
  return OLD_LOCATIONS.some(loc => rows[0].caption?.includes(loc));
}

export async function runSeedFixIfNeeded(): Promise<void> {
  try {
    const tenants = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, "amo-rendering"))
      .limit(1);

    if (!tenants.length) return;
    const tenantId = tenants[0].id;

    if (!(await hasOldData(tenantId))) {
      logger.info("Seed fix: data already correct, skipping");
      return;
    }

    logger.info("Seed fix: old location data detected — applying Essex/London corrections");

    await db.delete(galleryImagesTable).where(eq(galleryImagesTable.tenantId, tenantId));
    await db.insert(galleryImagesTable).values([
      { tenantId, imageUrl: "/gal-romford.webp",           caption: "Silicone render — Romford",           altText: "Silicone rendered detached house, Romford Essex",         featured: false, sortOrder: 10 },
      { tenantId, imageUrl: "/gal-london-silicone.webp",   caption: "Silicone render — London",            altText: "Silicone rendered Victorian terrace, London",             featured: false, sortOrder: 20 },
      { tenantId, imageUrl: "/gal-brentwood-silicone.webp",caption: "Silicone render — Brentwood",         altText: "Silicone rendered period corner property, Brentwood",     featured: false, sortOrder: 30 },
      { tenantId, imageUrl: "/gal-ewi-ba.webp",            caption: "EWI transformation — Grays, Essex",   altText: "Before and after EWI render, Grays Essex",               featured: true,  sortOrder: 40 },
      { tenantId, imageUrl: "/gal-krend-london.webp",      caption: "K Rend — London",                     altText: "K Rend rendered semi-detached house, London",             featured: false, sortOrder: 50 },
      { tenantId, imageUrl: "/gal-krend-chelmsford.webp",  caption: "K Rend — Chelmsford",                 altText: "K Rend rendered detached house, Chelmsford Essex",        featured: false, sortOrder: 60 },
      { tenantId, imageUrl: "/gal-monocouche-grays.webp",  caption: "Monocouche render — Grays",           altText: "Monocouche rendered semi-detached, Grays Thurrock",       featured: false, sortOrder: 70 },
      { tenantId, imageUrl: "/gal-monocouche-basildon.webp",caption: "Monocouche render — Basildon",       altText: "Monocouche rendered property, Basildon Essex",            featured: false, sortOrder: 80 },
      { tenantId, imageUrl: "/gal-pebble-billericay.webp", caption: "Pebbledash removal — Billericay",     altText: "Pebbledash removal and silicone render, Billericay Essex",featured: false, sortOrder: 90 },
    ]);

    await db.delete(beforeAfterTable).where(eq(beforeAfterTable.tenantId, tenantId));
    await db.insert(beforeAfterTable).values([
      {
        tenantId,
        title: "Grays Semi-Detached — Pebbledash to Silicone Render",
        description: "Complete exterior transformation — pebbledash removed and K-Rend silicone render applied in warm white.",
        beforeImageUrl: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800",
        afterImageUrl:  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
        sortOrder: 1,
      },
      {
        tenantId,
        title: "Thurrock Terrace — Monocouche Render Refresh",
        description: "Old cracked render stripped back and replaced with through-coloured monocouche in light grey.",
        beforeImageUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
        afterImageUrl:  "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800",
        sortOrder: 2,
      },
      {
        tenantId,
        title: "Romford 1960s Semi — EWI and Silicone Render",
        description: "External wall insulation and silicone render completely transformed this solid-wall property in Romford.",
        beforeImageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
        afterImageUrl:  "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800",
        sortOrder: 3,
      },
    ]);

    logger.info("Seed fix: gallery_images and before_after updated to Essex/London locations");
  } catch (err) {
    logger.error({ err }, "Seed fix failed — non-fatal, server will still start");
  }
}
