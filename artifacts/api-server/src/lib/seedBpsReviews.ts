import { db, reviewsTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Brandon's real reviews, brought in by hand.
 *
 * Google's Place Details API returns at most FIVE reviews and chooses which
 * five itself. BPS has far more than that, and the twenty-four that Google
 * will not hand over are worth more to him than anything we could write. So
 * they were transcribed from his listing and his Facebook page, verbatim.
 *
 * Every one of these is a real review a real customer left in public. Nothing
 * here is invented, reworded or padded. Two things were left out on purpose:
 *
 *   - Three critical reviews (one Google, two Facebook). Shoji's call, and the
 *     site does not claim to show every review or compute a rating from these,
 *     so nothing on the page is made untrue by their absence. If a star average
 *     is ever shown, it must come from Google's own figure for the whole place
 *     -- which is already synced into tenant_settings -- and never from these
 *     rows, or it would be an average of the good ones only.
 *
 *   - Nothing was shortened. A few of these are genuinely one line long, which
 *     is how they were written.
 *
 * WHY THIS IS A SEED AND NOT A ONE-OFF SCRIPT. It runs on boot and is
 * idempotent on the same fingerprint the admin importer uses (name + the first
 * sixty characters), so a redeploy cannot duplicate them and a review deleted
 * on purpose in the dashboard... would come back. That last part is the real
 * trade-off: this is a one-time backfill, and once Brandon starts curating
 * these himself it should be deleted. There is a note on the call site saying
 * exactly that.
 */

type SeedReview = {
  reviewerName: string;
  rating: number;
  platform: string;
  sourceCreatedAt: string | null;
  content: string;
};

const BPS_REVIEWS: SeedReview[] = [
  {
    reviewerName: "Gary Mccrudden",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2026-02-15",
    content: "Brandon came on time carry out the repairs to highest standard great price highly recommended this company.. Gary McCrudden",
  },
  {
    reviewerName: "Guilherme Forton Viotti",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2026-01-15",
    content: "very professional, great service",
  },
  {
    reviewerName: "Sarah Rydings",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2026-01-15",
    content: "I wouldnt use anyone else!",
  },
  {
    reviewerName: "Yetunde Akinbolagbe",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2025-12-15",
    content: "Brandon came over to look at a job and was fast and efficient ! We will definitely be calling on him again for future work!",
  },
  {
    reviewerName: "James Cadman",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2025-10-15",
    content: "Everything you'd want - prompt, kept to promised arrival time and was friendly and informative throughout",
  },
  {
    reviewerName: "Lucy Pitt",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2025-09-15",
    content: "As usual, Brandon was quick to identify the problem following a small leak in my loft and replaced the faulty valve and the water tank. He is my go to for any plumbing needs as he is responds quickly and is very reliable.",
  },
  {
    reviewerName: "Neil Stevenson",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2025-09-15",
    content: "Brilliant service, outcome and cost - would highly recommend Brandon & Mike of BPS, thanks",
  },
  {
    reviewerName: "Chris Barrow",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2025-09-15",
    content: "Very rapid response and excellent customer service.",
  },
  {
    reviewerName: "Masum Alamin",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2025-09-15",
    content: "Excellent service from Brandon. Had a few plumbing issues at home, made an appointment with Brandon, soon came and had the job done efficiently and was very tidy after the job was done. Will be using them again",
  },
  {
    reviewerName: "Alyn Such",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2025-09-15",
    content: "The plumber (mike) arrived within the specified time window and completed the repair to the pipework professionally and left the work area clean and tidy. Double checking to make sure everything was fine. Very satisfied",
  },
  {
    reviewerName: "AB GB",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2025-09-15",
    content: "I am a returning customer for BPS Plumbing. Brandon is a person who provides service that is reliable and the quality of the job is impeccable. He is understanding and helpful with advice and tips. I will highly recommend BPS Plumbing and I am sure anyone who receives the service, they will too.",
  },
  {
    reviewerName: "K “Happytravelling”",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2025-09-15",
    content: "I was really pleased with BPS plumbing , I have called them out twice now and both times they have come out really quickly and fixed the issues. Highly recommend Brandon and his team .",
  },
  {
    reviewerName: "mark plair",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2025-09-15",
    content: "Fantastic job done by Scot , highly recommend this company, a great price as well , all round great service.",
  },
  {
    reviewerName: "Maria Alford",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2025-09-15",
    content: "Prompt and friendly service. Very happy with the work carried out.",
  },
  {
    reviewerName: "Jojo W",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2025-09-15",
    content: "Fantastic service, quick, knowledgeable and reliable. Would 100% recommend",
  },
  {
    reviewerName: "Monsuru Ajadi (Mr Mons.)",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2025-09-15",
    content: "Prompt response, good service, excellence customer care",
  },
  {
    reviewerName: "Lizzie Pratt",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2025-09-15",
    content: "5* for BPS Plumbing & Heating!! Brandon & Michael were reliable, efficient and worked to a high standard. They left the house clean & tidy.\nThese guys are a credit to the Company.",
  },
  {
    reviewerName: "Keith Marsden",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2025-09-15",
    content: "We have used the company before and were happy to get them to replace defective taps and install a TRV. They are always punctual tidy friendly and helpful.",
  },
  {
    reviewerName: "Outlaw 118",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2024-09-15",
    content: "Top job, turned up on time, and messaged beforehand with ETA. Did a good job, neat tidy everything 100%, number saved for future reference. Recommended.",
  },
  {
    reviewerName: "Zoë Heyes",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2024-09-15",
    content: "Brandon is professional and reliable. Replaced & installed the shower pump. All working very well. 1st class service & I highly recommend him and his company.",
  },
  {
    reviewerName: "Deepak Shetty",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2023-09-15",
    content: "Excellent service from Brandon..highly recommended",
  },
  {
    reviewerName: "Andre Newby",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2022-09-15",
    content: "Brandon came to our house to fix a broken toilet it was quick and had it back running in no time great service would recommend.",
  },
  {
    reviewerName: "H Coman",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2022-09-15",
    content: "Brandon and team installed our new bathroom and we're very happy with it. They worked to a high standard, were well organised and tidied up after themselves each day.",
  },
  {
    reviewerName: "James Sykes",
    rating: 5,
    platform: "Google",
    sourceCreatedAt: "2022-09-15",
    content: "Brandon responded to an online search (very professional website) after about 2 hours.\nArranged visit, assessed problem returned later in the day Sorted Excellent\nAlso very professional throughout and his van is clean Highly Recommended",
  },
  {
    reviewerName: "Rae Walters",
    rating: 5,
    platform: "Facebook",
    sourceCreatedAt: "2020-08-26",
    content: "Amazing super fast service when we needed it most. Thanks so much Brandon",
  },
  {
    reviewerName: "Carly Knott",
    rating: 5,
    platform: "Facebook",
    sourceCreatedAt: "2020-03-09",
    content: "Highly recommended, after being without heating and hot water for over 2 weeks and messed around by another plumber (who was quoting the earth and got nothing fixed!) Brandon came in and fixed the problem straight away and advised that it wasn't going to be expensive at all! He was also very friendly, helpful and informative. I wouldn't use anyone now to do my plumbing!",
  },
  {
    reviewerName: "Hannah Godfrey",
    rating: 5,
    platform: "Facebook",
    sourceCreatedAt: "2020-03-03",
    content: "Reliable , professional , great customer service .\nWould not hesitate to use again and highly recommend BPS plumbing & heating .",
  },
  {
    reviewerName: "Louisa Page",
    rating: 5,
    platform: "Facebook",
    sourceCreatedAt: "2020-02-27",
    content: "Brilliant service!! Very friendly and reliable!!\nCouldn't recommend them enough!! Nothing was to much to ask and answered any queries I had!! AMAZING!!!",
  },
  {
    reviewerName: "Sam Fraser",
    rating: 5,
    platform: "Facebook",
    sourceCreatedAt: "2020-02-27",
    content: "Excellent service and price wouldn't use anyone else",
  },
];

/** Same key the admin importer uses, so the two can never disagree. */
function fingerprint(name: string, content: string): string {
  return `${name.trim().toLowerCase()}|${content.trim().toLowerCase().slice(0, 60)}`;
}

export async function seedBpsReviewsIfMissing(): Promise<void> {
  try {
    const [tenant] = await db.select({ id: tenantsTable.id })
      .from(tenantsTable).where(eq(tenantsTable.slug, "bps")).limit(1);
    if (!tenant) return;

    const existing = await db.select({
      name: reviewsTable.reviewerName,
      content: reviewsTable.content,
    }).from(reviewsTable).where(eq(reviewsTable.tenantId, tenant.id));

    const seen = new Set(existing.map(r => fingerprint(r.name ?? "", r.content ?? "")));

    const toInsert = BPS_REVIEWS
      .filter(r => !seen.has(fingerprint(r.reviewerName, r.content)))
      .map(r => ({
        tenantId: tenant.id,
        reviewerName: r.reviewerName,
        content: r.content,
        rating: r.rating,
        platform: r.platform,
        sourceCreatedAt: r.sourceCreatedAt ? new Date(r.sourceCreatedAt) : null,
        // Already public where they were written, so hiding them by default
        // would only mean nobody notices the import worked.
        published: true,
      }));

    if (!toInsert.length) return;

    await db.insert(reviewsTable).values(toInsert);
    logger.info({ tenantId: tenant.id, inserted: toInsert.length }, "BPS reviews backfilled");
  } catch (err) {
    // Never block boot for this. A missing backfill is a quiet page section;
    // a crashed container is the whole platform.
    logger.error({ err }, "BPS review backfill failed");
  }
}
