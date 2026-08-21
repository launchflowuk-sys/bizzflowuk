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
    heroImageUrl: "/kd-essex/garden-walls-retaining.webp",
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
    heroImageUrl: "/kd-essex/garden-b.webp",
    tagline: "Foundations first, then the brickwork.",
    description: "Garden walls, sleeper walls and structural retaining.",
    content: "Retaining walls hold back real weight. They need a footing sized for the job and drainage behind them, or they lean. We build both properly.",
    benefits: ["Footings sized for the load", "Drainage behind the wall", "Sleepers, block or brick"],
    processSteps: [],
  },
  {
    name: "Groundworks",
    slug: "groundworks",
    heroImageUrl: "/kd-essex/groundworks.webp",
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

/**
 * Standard UK consumer-contractor boilerplate, written to fit this business.
 * NOT legal advice: the client should read it and, ideally, have it checked before
 * launch. Deliberately references the contact page rather than naming an address,
 * because the trading address has not been supplied.
 */
const KD_PRIVACY = "We are KD Essex Landscaping & Groundworks. This policy explains what we do with your personal information when you enquire, ask for a quote, or have work carried out. It is written to meet UK GDPR and the Data Protection Act 2018.\n## What we collect\n- Your name, email address, telephone number and the address of the property the work relates to.\n- Details of the job you are enquiring about, including any photographs or documents you choose to upload.\n- Records of our correspondence with you, quotes issued, work carried out and payments.\n- Basic technical information about your visit to this website, such as pages viewed. Analytics and advertising cookies are only set if you accept them in the cookie banner.\n## Why we use it, and our lawful basis\n- To respond to your enquiry and prepare a quote. Our lawful basis is that these are steps taken at your request before entering into a contract.\n- To carry out the work, arrange access, order materials and invoice you. Our lawful basis is performance of our contract with you.\n- To keep records for tax, accounting and guarantee purposes. Our lawful basis is our legal obligation, and our legitimate interest in being able to honour a guarantee.\n- To send you marketing, only where you have asked us to. Our lawful basis is your consent, which you can withdraw at any time.\n## Photographs of your property\nPhotographs you send us are used to prepare your quote and to plan the work. We will not publish a photograph of your property, or use it in our portfolio or advertising, unless you have given us permission to do so.\n## Who we share it with\nWe do not sell your information to anyone. We share it only where we need to:\n- Our email provider, so that we can correspond with you.\n- Our payment provider, if you choose to pay online. Card details are handled by them and are never stored by us.\n- Suppliers, and any subcontractor working on your job, limited to what they need in order to do it.\n- HMRC, our accountant, or our insurer, where we are required to share it or need to make a claim.\n- Google, if you have accepted analytics or advertising cookies.\n## How long we keep it\nWe keep enquiry records for two years from our last contact with you. Where we have carried out work, we keep the job and payment records for six years after the end of the tax year in which the work was completed, as tax law requires, and for as long as any guarantee remains in force.\n## Your rights\nUnder UK data protection law you have the right to ask us for a copy of your information, to have it corrected or erased, to restrict or object to how we use it, and to receive it in a portable format. Where we rely on your consent, you can withdraw that consent at any time. To exercise any of these rights, please contact us using the details on our contact page.\nIf you are unhappy with how we have handled your information, you can complain to the Information Commissioner's Office at ico.org.uk, or by calling 0303 123 1113. We would ask that you raise it with us first, so that we have the chance to put it right.\n## Cookies\nCookies that are strictly necessary to make this website work are always set. Analytics and advertising cookies are only set after you accept them in the banner, and you can change your mind at any time by clearing this site's data in your browser.\n## Changes to this policy\nIf we change this policy we will update this page, so please check it from time to time.";

const KD_TERMS = "These terms apply to work carried out by KD Essex Landscaping & Groundworks. They sit alongside your written quote. Where the quote says something different from these terms, the quote applies.\n## Quotations\n- A quote is valid for 30 days from the date we issue it.\n- Quotes are based on the information, measurements and photographs available to us at the time, and on the ground being as expected.\n- Where we have quoted without visiting, the price is subject to confirmation once we have seen the site.\n- The quote sets out the build-up we are pricing, including sub-base depths and materials. If you are comparing quotes, compare that specification too.\n## Ground conditions and things we cannot see\nGroundwork carries genuine unknowns. Buried concrete, old foundations, redundant drainage, services, contaminated ground, made ground and unexpected water are not always visible before we dig. If we find something that materially changes the work, we will stop, explain the position, and give you a revised price in writing before continuing. You are free to accept it, ask us for alternatives, or end the contract and pay only for the work done up to that point.\n## Underground services\nWe will take reasonable care to identify and avoid underground services. Please tell us about anything you know of, such as garden lighting, irrigation, a private drain, or a supply to an outbuilding, as these are frequently unmarked.\n## Your right to cancel\nIf you are a consumer, and the contract was agreed away from our business premises or at a distance, you have the right to cancel within 14 days without giving a reason. If you ask us to start work within that period and you then cancel, you must pay for the work already carried out and for materials already ordered. If the work is fully completed within the 14 days at your request, the right to cancel is lost.\n## Access, preparation and site\n- Please make sure we have access on the agreed dates, including any access needed for a machine or for deliveries.\n- Please move or protect anything valuable, fragile or personal from the working area beforehand.\n- We will keep the site tidy and clear down at the end of each working day.\n- We will be considerate towards your neighbours, but some noise, dust and disruption is unavoidable.\n## Payment\nPayment terms are set out in your quote. We will not ask you for payment for work that has not been carried out, unless the quote says otherwise and you have agreed to it. Materials ordered specifically for your job are chargeable once they have been ordered.\n## Timescales\nWe will give you an expected start date and duration, and keep you informed. Dates are estimates. Weather, ground conditions and supplier delays can move them, and we are not liable for delays outside our reasonable control.\n## Materials\nNatural stone, timber and planting vary in colour, marking and size. Samples and photographs show a representative example, not an exact match. Some settling, weathering and colour change is normal and is not a defect.\n## Guarantee\nWe guarantee our workmanship for the period stated in your quote. The guarantee covers defects in the work we carried out. It does not cover damage caused by third parties, alterations made by others, misuse, neglect, ground movement outside our control, or normal wear, weathering and settlement. Manufacturers' warranties on materials are passed on to you and are subject to their own terms.\n## If something goes wrong\nPlease tell us as soon as possible so that we can come and look at it. Nothing in these terms affects your statutory rights, including your rights under the Consumer Rights Act 2015 that work be carried out with reasonable care and skill.\n## Liability\nWe do not exclude or limit our liability for death or personal injury caused by our negligence, for fraud, or for anything else that cannot lawfully be excluded. Otherwise, our liability is limited to the value of the contract, and we are not liable for indirect or consequential loss.\n## Governing law\nThese terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction.";

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
      // "|" marks the line break in the static half of the hero headline. The
      // rotating "In <town>" line is appended by the template from the tenant's areas.
      heroHeadline: "From the ground up|Landscaping &|Groundworks",
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
      privacyContent: KD_PRIVACY,
      termsContent: KD_TERMS,
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
