import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { reviewsTable, tenantSettingsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "../logger";

/**
 * Pull a tenant's Google Business reviews onto their own site.
 *
 * A trade's reviews live where customers put them — on Google — and their
 * website shows nothing. Asking the owner to retype them is both tedious and
 * dishonest: a retyped review is not a review. Pulling them means the site
 * shows what Google shows.
 *
 * Two hard limits from Google, both worth knowing before anyone is disappointed:
 *
 *  1. **Place Details returns at most FIVE reviews.** Google chooses which.
 *     There is no parameter, no paging and no paid tier that returns more
 *     through this API. A business with 200 reviews still gets five.
 *  2. Google's terms allow caching a Place ID indefinitely, but other place
 *     content only briefly. These rows are therefore a refreshable cache, not
 *     a permanent copy, and the sync runs daily to keep them current.
 *
 * The headline rating and total count ARE for the whole place, so a site can
 * honestly say "4.9 from 213 reviews" while showing five of them.
 */

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places";

/** Only what is needed. Google bills by the fields requested. */
const FIELD_MASK = [
  "id",
  "displayName",
  "rating",
  "userRatingCount",
  "googleMapsUri",
  "reviews.name",
  "reviews.rating",
  "reviews.text",
  "reviews.originalText",
  "reviews.relativePublishTimeDescription",
  "reviews.publishTime",
  "reviews.authorAttribution",
].join(",");

export type GoogleSyncResult = {
  ok: boolean;
  reason?: string;
  rating?: number | null;
  reviewCount?: number | null;
  imported?: number;
};

/**
 * A stable identity for a review.
 *
 * Google's `reviews.name` is a resource path that has proven to change between
 * responses, so it cannot be relied on as a key. Author plus publish time is
 * stable for the same review and distinct between different ones.
 */
function reviewKey(author: string, publishTime: string): string {
  return "g_" + createHash("sha1").update(`${author}|${publishTime}`).digest("hex").slice(0, 24);
}

export async function syncGoogleReviews(tenantId: number): Promise<GoogleSyncResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { ok: false, reason: "GOOGLE_PLACES_API_KEY is not set" };

  const [settings] = await db.select({ placeId: tenantSettingsTable.googlePlaceId })
    .from(tenantSettingsTable).where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);
  const placeId = settings?.placeId?.trim();
  if (!placeId) return { ok: false, reason: "No Google Place ID set for this business" };

  const res = await fetch(`${PLACES_ENDPOINT}/${encodeURIComponent(placeId)}?languageCode=en-GB`, {
    headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.warn({ tenantId, status: res.status, detail: detail.slice(0, 300) }, "Google Places request failed");
    return { ok: false, reason: `Google refused the request (${res.status})` };
  }

  const place = await res.json() as any;
  const reviews: any[] = Array.isArray(place?.reviews) ? place.reviews : [];
  let imported = 0;

  for (const r of reviews) {
    const author = r?.authorAttribution?.displayName?.trim();
    const publishTime = r?.publishTime;
    // Google returns a rating with no text fairly often. A star with no words
    // is not worth a card on a website.
    const content = (r?.originalText?.text ?? r?.text?.text ?? "").trim();
    if (!author || !publishTime || !content) continue;

    const externalId = reviewKey(author, publishTime);
    const values = {
      tenantId,
      reviewerName: author,
      rating: Math.round(Number(r.rating) || 5),
      content,
      platform: "Google",
      platformUrl: place?.googleMapsUri ?? null,
      photoUrl: r?.authorAttribution?.photoUri ?? null,
      externalId,
      sourceCreatedAt: new Date(publishTime),
      syncedAt: new Date(),
      // Pulled reviews are published by default — they are already public on
      // Google, so hiding them by default would only mean nobody ever notices
      // the feature worked.
      published: true,
    };

    await db.insert(reviewsTable).values(values).onConflictDoUpdate({
      target: [reviewsTable.tenantId, reviewsTable.externalId],
      /**
       * The index this infers against is PARTIAL:
       *
       *   CREATE UNIQUE INDEX reviews_tenant_external_idx
       *     ON reviews (tenant_id, external_id) WHERE external_id IS NOT NULL;
       *
       * Postgres will not match an ON CONFLICT to a partial index unless the
       * same predicate is repeated here. Without it every insert failed with
       * "there is no unique or exclusion constraint matching the ON CONFLICT
       * specification" — so no Google review has ever been imported for any
       * tenant, and the nightly sweep swallowed it per-tenant as a logged
       * error nobody was reading.
       *
       * The predicate has to stay in step with migration 0043.
       */
      targetWhere: sql`${reviewsTable.externalId} is not null`,
      set: {
        reviewerName: values.reviewerName,
        rating: values.rating,
        content: values.content,
        photoUrl: values.photoUrl,
        platformUrl: values.platformUrl,
        syncedAt: values.syncedAt,
      },
    });
    imported += 1;
  }

  const rating = Number.isFinite(Number(place?.rating)) ? Number(place.rating) : null;
  const count = Number.isFinite(Number(place?.userRatingCount)) ? Number(place.userRatingCount) : null;

  await db.update(tenantSettingsTable).set({
    googleRating: rating !== null ? String(rating) : null,
    googleReviewCount: count,
    googleReviewsSyncedAt: new Date(),
  }).where(eq(tenantSettingsTable.tenantId, tenantId));

  logger.info({ tenantId, imported, rating, count }, "Google reviews synced");
  return { ok: true, rating, reviewCount: count, imported };
}

/** Every tenant that has a Place ID set. */
export async function syncAllGoogleReviews(reason: string): Promise<void> {
  if (!process.env.GOOGLE_PLACES_API_KEY) return;

  const rows = await db.select({ tenantId: tenantSettingsTable.tenantId })
    .from(tenantSettingsTable)
    .where(and(sql`${tenantSettingsTable.googlePlaceId} is not null`,
               sql`length(trim(${tenantSettingsTable.googlePlaceId})) > 0`));

  for (const row of rows) {
    try {
      await syncGoogleReviews(row.tenantId);
    } catch (err) {
      // One tenant's bad Place ID must never stop the others syncing.
      logger.error({ err, tenantId: row.tenantId, reason }, "Google review sync failed for tenant");
    }
  }
}

const DAY = 24 * 60 * 60 * 1000;
const FIRST_RUN_DELAY = 3 * 60 * 1000;
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Daily, in-process — the same reasoning as the automation sweep. An external
 * scheduled task is a step that has to be configured per environment, and until
 * someone does it the feature looks built and silently never runs.
 */
export function startGoogleReviewScheduler(): void {
  if (timer) return;
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    logger.info("Google review sync idle — GOOGLE_PLACES_API_KEY not set");
    return;
  }
  setTimeout(() => { void syncAllGoogleReviews("first run after boot"); }, FIRST_RUN_DELAY);
  timer = setInterval(() => { void syncAllGoogleReviews("daily"); }, DAY);
  logger.info("Google review scheduler started — daily");
}
