import { db } from "@workspace/db";
import { tenantsTable, tenantSettingsTable, servicesTable, areasTable, faqsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

/**
 * One-time bootstrap for KD Essex Landscaping & Groundworks (landscaping industry, tenant #3).
 * Idempotent: keyed on the tenant slug — if the row exists nothing runs, so dashboard edits
 * are never overwritten.
 *
 * ⚠ PLACEHOLDER CONTENT — READ BEFORE LAUNCH.
 * As of seeding, the client had not supplied his trading address, phone number, email,
 * registered company name/number, real service list or photographs (see
 * docs/plans/kd-essex-onboarding.md § "Outstanding client facts"). Rather than invent them:
 *
 *  - Contact fields are left NULL. The template renders conditionally, so they simply don't
 *    appear until they're filled in from the dashboard. An invented phone number on a live
 *    site is worse than a missing one.
 *  - Services are the standard trade categories from the market research and are PROVISIONAL —
 *    confirm with the client and delete anything he doesn't actually do before going live.
 *  - No reviews and no case studies are seeded: the business genuinely has zero. Seeding fake
 *    social proof would put false AggregateRating schema on the site.
 *  - No stats, no "established" year, no accreditation claims.
 *
 * Areas are real Thurrock/South Essex towns, so those are safe.
 */

const SLUG = "kd-essex";
const BRAND_GREEN = "#6B8E4E";      // logo green
const BRAND_GREEN_DEEP = "#5D7B45"; // AA-contrast sibling used by the template

/** PROVISIONAL — confirm against what the client actually delivers before launch. */
const KD_SERVICES = [
  {
    name: "Patios & Paving",
    slug: "patios-paving",
    heroImageUrl: "/kd-essex/patios-paving.webp",
    tagline: "Natural stone, porcelain and block, laid on a proper base.",
    description: "Patio and paving installation with a full, published build-up — excavation, compacted sub-base, laying course and finish.",
    content: "A patio is only as good as what's underneath it. We excavate to depth, lay and compact a Type 1 sub-base in layers, and set the falls so water runs away from the house rather than sitting on the slabs.\nYou get the build-up in writing with your quote, so you can compare it against the other prices you've been given.",
    benefits: ["Excavated and compacted to depth", "Full written specification", "Falls set for drainage", "Site left clean each day"],
    processSteps: [
      { title: "Site visit and levels", description: "We measure up, check the levels and look at where the water currently goes." },
      { title: "Written quote", description: "A fixed price with the build-up and materials spelled out." },
      { title: "Excavate and base", description: "Dig out, membrane, then sub-base compacted in layers." },
      { title: "Lay and point", description: "Slabs laid to falls, then pointed and cleaned down." },
    ],
  },
  {
    name: "Driveways",
    slug: "driveways",
    heroImageUrl: "/kd-essex/driveways.webp",
    tagline: "Block paving and resin, built to take the weight.",
    description: "Driveway installation with the sub-base depth a vehicle actually needs.",
    content: "Driveways fail because the base was built for a footpath. We dig deeper, compact properly, and deal with drainage so you're not left with standing water or sunken tyre tracks.\nWhere a dropped kerb is needed we can handle that side too.",
    benefits: ["Vehicle-rated sub-base depth", "Drainage designed in", "Edge restraints throughout", "Dropped kerbs arranged"],
    processSteps: [],
  },
  {
    name: "Fencing",
    slug: "fencing",
    heroImageUrl: "/kd-essex/garden-b.webp",
    tagline: "Posts set properly so the panels stay put.",
    description: "Fence supply and installation, from panels to closeboard.",
    content: "Most fences fail at the post. We set posts to depth in concrete and check the line and levels before anything else goes up.",
    benefits: ["Posts concreted to depth", "Line and levels checked", "Old fence removed and taken away"],
    processSteps: [],
  },
  {
    name: "Turfing & Artificial Grass",
    slug: "turfing-artificial-grass",
    heroImageUrl: "/kd-essex/garden-a.webp",
    tagline: "Prepared ground, not turf rolled onto old lawn.",
    description: "Real turf and artificial grass installation with proper ground preparation.",
    content: "Turf laid over unprepared ground goes patchy within a season. We strip, level, and prepare the ground first — and for artificial grass, build the base and drainage so it doesn't hold water.",
    benefits: ["Ground stripped and levelled", "Base and drainage for artificial", "Waste taken away"],
    processSteps: [],
  },
  {
    name: "Garden Walls & Retaining",
    slug: "garden-walls-retaining",
    heroImageUrl: "/kd-essex/garden-walls-retaining.webp",
    tagline: "Foundations first, then the brickwork.",
    description: "Garden walls, sleeper walls and structural retaining.",
    content: "Retaining walls hold back real weight. They need a footing sized for the job and drainage behind them, or they lean. We build both properly.",
    benefits: ["Footings sized for the load", "Drainage behind the wall", "Sleepers, block or brick"],
    processSteps: [],
  },
  {
    name: "Groundworks",
    slug: "groundworks",
    tagline: "Excavation, levels and access — the work before the work.",
    description: "Site clearance, excavation, levelling and sub-base preparation.",
    content: "Clearance, excavation, muck-away, levelling and terracing. This is the part most landscapers subcontract out; doing it ourselves means no gap between trades and nobody to blame when the levels are wrong.",
    benefits: ["Excavation and muck-away", "Levelling and terracing", "Sub-bases prepared and compacted", "Mini digger access considered"],
    processSteps: [],
  },
  {
    name: "Drainage & Soakaways",
    slug: "drainage-soakaways",
    heroImageUrl: "/kd-essex/drainage-soakaways.webp",
    tagline: "For gardens that hold water after every downpour.",
    description: "Land drainage, soakaways and surface water solutions.",
    content: "Standing water is usually a levels problem, a compaction problem, or nowhere for the water to go. We work out which before quoting, then design the drainage around it.",
    benefits: ["Cause diagnosed before quoting", "Land drains and soakaways", "Surface water routed away from the house"],
    processSteps: [],
  },
  {
    name: "Dropped Kerbs",
    slug: "dropped-kerbs",
    heroImageUrl: "/kd-essex/dropped-kerbs.webp",
    tagline: "Vehicle crossovers, start to finish.",
    description: "Dropped kerb and vehicle crossover installation.",
    content: "A dropped kerb needs council approval before any work starts. We can talk you through the application and carry out the crossover once it's granted.",
    benefits: ["Application process explained", "Crossover built to council spec", "Driveway tied in"],
    processSteps: [],
  },
];

/** Real Thurrock and South Essex towns — safe to seed. */
const KD_AREAS = [
  { name: "Grays", slug: "grays" },
  { name: "Tilbury", slug: "tilbury" },
  { name: "Chafford Hundred", slug: "chafford-hundred" },
  { name: "South Ockendon", slug: "south-ockendon" },
  { name: "Aveley", slug: "aveley" },
  { name: "Purfleet", slug: "purfleet" },
  { name: "West Thurrock", slug: "west-thurrock" },
  { name: "Corringham", slug: "corringham" },
  { name: "Stanford-le-Hope", slug: "stanford-le-hope" },
  { name: "Chadwell St Mary", slug: "chadwell-st-mary" },
  { name: "Orsett", slug: "orsett" },
  { name: "East Tilbury", slug: "east-tilbury" },
];

/** Neutral, genuinely useful questions — no claims about the business. */
const KD_FAQS = [
  { question: "How deep should the base under a patio be?", answer: "For a domestic patio, typically 100–150mm of compacted MOT Type 1 over a geotextile membrane, with a 30–40mm laying course on top. A driveway needs more, because it carries vehicle weight. We put the depth we're building to in writing on every quote." },
  { question: "Do you take a deposit?", answer: "Payment terms are agreed before work starts and set out in your written quote." },
  { question: "Do I need planning permission?", answer: "Most garden landscaping doesn't. Dropped kerbs need council approval, and driveways over five square metres need permeable paving or drainage to a soakaway rather than to the road. We'll flag anything that applies to your job." },
  { question: "Can you quote from photos?", answer: "Often, yes — for smaller and more straightforward work. Send photos with your enquiry and we'll tell you whether we can price it as-is or need to come and see it." },
  { question: "My garden holds water after it rains. Can that be fixed?", answer: "Usually. It's normally compacted ground, a levels problem, or simply nowhere for the water to go. We work out which one it is before quoting, because the fix is different in each case." },
  { question: "Do you clear away the waste?", answer: "Yes. Muck-away and waste removal are included as a line on your quote so you can see what it costs rather than finding out later." },
];

export async function seedKdEssexIfMissing(): Promise<void> {
  try {
    const existing = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.slug, SLUG)).limit(1);
    if (existing.length > 0) return;

    logger.info("Seeding KD Essex tenant (first boot with this code)");

    const [tenant] = await db.insert(tenantsTable).values({
      name: "KD Essex Landscaping & Groundworks",
      slug: SLUG,
      industry: "landscaping",
      primaryColor: BRAND_GREEN,
      logoUrl: "/kd-essex/kd-essex-logo.webp",
      city: "Grays",
      country: "UK",
      description:
        "Landscaping and groundworks across Thurrock and South Essex — from excavation, drainage and levels through to patios, driveways, fencing and planting.",
      // customDomain intentionally unset: kdessexlandscapes.co.uk was still in registrar review.
      // Set it here (or in the dashboard) once DNS points at the server and the domain is added
      // in Coolify, or the Host-header lookup will resolve a domain that isn't serving yet.
    }).returning({ id: tenantsTable.id });

    const tenantId = tenant.id;

    await db.insert(tenantSettingsTable).values({
      tenantId,
      logoUrl: "/kd-essex/kd-essex-logo.webp",
      faviconUrl: "/kd-essex/kd-essex-logo-320.webp",
      primaryColor: BRAND_GREEN,
      secondaryColor: BRAND_GREEN_DEEP,
      // "|" marks the line break for the two-tone hero headline (ink above, green below).
      heroHeadline: "Landscaping &|Groundworks",
      heroSubheadline: "Expert solutions. Lasting results.",
      // Drop the supplied hero photograph at this path in the web package's public dir
      // (same convention as /amo-services/*). Left set so the layout is complete the moment
      // the file lands; the hero degrades to a copy-only panel until then.
      heroImageUrl: "/kd-essex/kd-essex-hero-home.webp",
      aboutText:
        "KD Essex Landscaping & Groundworks covers Thurrock and South Essex, taking on both sides of a garden project: the excavation, drainage and levels underneath, and the paving, fencing and planting on top.\nMost quotes tell you about the finish and stay quiet about the build-up. Ours sets out the depths and materials in writing, so you have something real to compare against the other prices you've been given.",
      // ⚠ phone / email / address deliberately NULL until the client supplies them.
      seoTitle: "KD Essex Landscaping & Groundworks | Thurrock & Essex",
      seoDescription:
        "Landscaping and groundworks across Thurrock and South Essex. Patios, driveways, fencing, turfing, drainage and excavation — with the sub-base build-up written into every quote.",
      ctaText: "Get a free quote",
      trustBadges: ["Free written quote", "Full build-up specified", "Site left clean daily", "Photos welcome with enquiries"],
      showReviews: true,
      showGallery: true,
      showBlog: false,
      showBeforeAfter: true,
      quoteRefPrefix: "KD",
    });

    await db.insert(servicesTable).values(
      KD_SERVICES.map((s, i) => ({
        tenantId,
        ...s,
        published: true,
        featured: i < 6,
        sortOrder: (i + 1) * 10,
      })),
    );

    await db.insert(areasTable).values(
      KD_AREAS.map((a, i) => ({
        tenantId,
        ...a,
        county: "Essex",
        published: true,
        sortOrder: (i + 1) * 10,
      })),
    );

    await db.insert(faqsTable).values(
      KD_FAQS.map((f, i) => ({ tenantId, ...f, published: true, sortOrder: (i + 1) * 10 })),
    );

    logger.info("KD Essex tenant seeded — contact details and photos still required before launch");
  } catch (err) {
    // Never let a seed failure stop the server booting; the other tenants must stay up.
    logger.error({ err }, "KD Essex seed failed");
  }
}
