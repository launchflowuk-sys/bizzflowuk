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

/** Per-town copy: real local ground conditions and access notes, not one paragraph
 *  with the place name swapped. Written as what is commonly found and what we check
 *  for, never as survey fact. */
const KD_AREAS = [
  {
    name: "Grays",
    slug: "grays",
    description: "Landscaping and groundworks across Grays, from the town centre terraces to the wider estates.",
    content: "Grays has some of the oldest housing stock in Thurrock, and gardens here have usually been worked on more than once. Under a tired lawn or a cracked patio we routinely find old concrete bases, buried paths, redundant drainage runs and the remains of a previous build-up that was never taken out.\nThat matters for pricing. It is the reason we quote on what is actually under your garden rather than on a rate per square metre, and the reason our quote states the depth we are digging to and the sub-base we are laying.\nAccess is the other Grays constant. On the terraced streets there is often no side gate, which means barrowing through the house or working from the front, and on some plots a mini digger simply will not fit. We work that out on the site visit, because it changes the labour more than most people expect.",
    seoTitle: "Landscaping & Groundworks in Grays | KD Essex",
    seoDescription: "Landscaping and groundworks across Grays, from the town centre terraces to the wider estates.",
  },
  {
    name: "Tilbury",
    slug: "tilbury",
    description: "Landscaping and groundworks in Tilbury, where drainage design matters more than anywhere else we work.",
    content: "Tilbury sits low and close to the river, and the water table can be high. That single fact drives most of what we design here.\nA soakaway only works if the ground beneath it will actually take water away. In low-lying parts of Tilbury it often will not, so before we price drainage we check whether a soakaway is viable at all, and if it is not we look at routing surface water elsewhere. Getting that wrong is how a new patio ends up with standing water on it every winter.\nFor paving and driveways we tend to build a slightly deeper, more free-draining sub-base and set the falls carefully, so water is moving away from the property rather than sitting on the surface.",
    seoTitle: "Landscaping & Groundworks in Tilbury | KD Essex",
    seoDescription: "Landscaping and groundworks in Tilbury, where drainage design matters more than anywhere else we work.",
  },
  {
    name: "Chafford Hundred",
    slug: "chafford-hundred",
    description: "Landscaping and groundworks in Chafford Hundred, built around the access constraints of the estates.",
    content: "Chafford Hundred is modern estate housing, and it comes with a very consistent set of problems: enclosed rear gardens, tight or non-existent side access, and levels that step down or up away from the house.\nIn practice that usually means a mini digger or barrow work rather than anything larger, and it means muck-away is a real line on the quote rather than an afterthought. We would rather price that honestly at the start than discover it on day one.\nThe estates were built on former quarry land, so the ground can change over a short distance. We check what we are digging into before committing to a build-up.",
    seoTitle: "Landscaping & Groundworks in Chafford Hundred | KD Essex",
    seoDescription: "Landscaping and groundworks in Chafford Hundred, built around the access constraints of the estates.",
  },
  {
    name: "South Ockendon",
    slug: "south-ockendon",
    description: "Landscaping and groundworks in South Ockendon, from the older village plots to the post-war estates.",
    content: "South Ockendon is a mix. The older properties around the village tend to have longer, wider plots with room to work and space for a machine, while the post-war estates are tighter and more uniform.\nGround is often clay-bearing, which moves seasonally. Clay shrinks in a dry summer and swells again in winter, and that movement is unkind to anything laid on a thin base. It is one of the clearest arguments for a properly compacted sub-base rather than a thin one.\nWhere a garden has an obvious slope we will usually talk to you about terracing rather than trying to fight the levels with a single flat surface.",
    seoTitle: "Landscaping & Groundworks in South Ockendon | KD Essex",
    seoDescription: "Landscaping and groundworks in South Ockendon, from the older village plots to the post-war estates.",
  },
  {
    name: "Aveley",
    slug: "aveley",
    description: "Landscaping and groundworks in Aveley, covering the village and the surrounding estates.",
    content: "Aveley covers everything from older village properties to newer housing, so there is no single answer to what is under the garden.\nNearer the main road corridors we sometimes come across made ground, which is material that has been brought in and levelled at some point in the past rather than being undisturbed subsoil. Made ground can be perfectly fine to build on, but it needs to be compacted properly and it is worth knowing about before you commit to a price.\nAs everywhere, we dig a trial hole where there is any doubt. It costs an hour and it saves an argument.",
    seoTitle: "Landscaping & Groundworks in Aveley | KD Essex",
    seoDescription: "Landscaping and groundworks in Aveley, covering the village and the surrounding estates.",
  },
  {
    name: "Purfleet",
    slug: "purfleet",
    description: "Landscaping and groundworks in Purfleet, including the riverside and former industrial plots.",
    content: "Purfleet has chalk beneath much of it and a long industrial history along the riverside, which means the ground can be genuinely unpredictable from one plot to the next.\nChalk drains well, which is helpful, but made ground on former industrial land can hide anything from old hardstanding to buried services. We take that seriously: we ask what you know about the plot, we look before we dig, and if we find something that changes the job we stop and re-price it in writing rather than pressing on.\nNone of that is a reason to avoid the work. It is a reason to have someone doing the groundworks who is not treating it as a formality before the nice part.",
    seoTitle: "Landscaping & Groundworks in Purfleet | KD Essex",
    seoDescription: "Landscaping and groundworks in Purfleet, including the riverside and former industrial plots.",
  },
  {
    name: "West Thurrock",
    slug: "west-thurrock",
    description: "Landscaping and groundworks in West Thurrock, domestic gardens and mixed-use plots.",
    content: "West Thurrock sits on chalk with a great deal of former industrial and commercial land around it, and that shows up in the ground.\nMade ground is common, and so are buried surprises. Our approach is the same as in Purfleet: establish what we are digging into first, and price the build-up rather than just the finish.\nChalk substrate is generally good news for drainage, which can make a soakaway a realistic option here where it would not be down on the low-lying ground nearer the river.",
    seoTitle: "Landscaping & Groundworks in West Thurrock | KD Essex",
    seoDescription: "Landscaping and groundworks in West Thurrock, domestic gardens and mixed-use plots.",
  },
  {
    name: "Corringham",
    slug: "corringham",
    description: "Landscaping and groundworks in Corringham, where plots are larger and levels usually need work.",
    content: "Corringham plots tend to be more generous than the ones nearer Grays, which opens up what is possible: proper terracing, retaining, a garden that works as more than one space.\nIt also means levels. A larger garden with a fall across it needs regrading or terracing rather than a single slab, and a retaining wall holding back real weight needs a footing sized for the job and drainage behind it. Both of those are groundworks, and both are where a garden either lasts or does not.\nGround is often clay, so seasonal movement is worth designing around rather than ignoring.",
    seoTitle: "Landscaping & Groundworks in Corringham | KD Essex",
    seoDescription: "Landscaping and groundworks in Corringham, where plots are larger and levels usually need work.",
  },
  {
    name: "Stanford-le-Hope",
    slug: "stanford-le-hope",
    description: "Landscaping and groundworks in Stanford-le-Hope, covering both the higher ground and the marsh edge.",
    content: "Stanford-le-Hope varies more than most places we cover. Move a few streets and you go from decent free-draining ground to the low ground nearer the marshes where drainage becomes the whole conversation.\nSo the honest answer to what a patio costs here is that it depends which end of town you are at. On the lower ground we check soakaway viability before designing anything, and we would rather tell you a soakaway is not the answer than install one that fails quietly.\nOn the higher ground it is a more straightforward job and we will say so.",
    seoTitle: "Landscaping & Groundworks in Stanford-le-Hope | KD Essex",
    seoDescription: "Landscaping and groundworks in Stanford-le-Hope, covering both the higher ground and the marsh edge.",
  },
  {
    name: "Chadwell St Mary",
    slug: "chadwell-st-mary",
    description: "Landscaping and groundworks in Chadwell St Mary, mostly post-war housing with workable gardens.",
    content: "Chadwell St Mary sits on higher ground above the river, and the post-war housing here generally came with sensible garden sizes, which makes it good ground for a full redesign rather than a patch.\nThe ground tends to be clay-bearing. That is entirely workable, but it moves with the seasons, so we build the base to cope with it rather than laying onto whatever is there.\nAccess is usually better than in central Grays, which often means a machine can get round the side and the dig-out costs less in labour.",
    seoTitle: "Landscaping & Groundworks in Chadwell St Mary | KD Essex",
    seoDescription: "Landscaping and groundworks in Chadwell St Mary, mostly post-war housing with workable gardens.",
  },
  {
    name: "Orsett",
    slug: "orsett",
    description: "Landscaping and groundworks in Orsett, where larger plots and heavy clay make levels the main job.",
    content: "Orsett has some of the largest gardens we work in, and heavy clay under a lot of them.\nBig plots almost always mean levels. Regrading, terracing and retaining are the work here, and they are groundworks before they are landscaping. Get the levels and the drainage right and the finish looks after itself; get them wrong and no quality of paving will save it.\nClay also means we pay attention to where water goes. On a large garden that is a design decision made early, not a fix applied at the end.",
    seoTitle: "Landscaping & Groundworks in Orsett | KD Essex",
    seoDescription: "Landscaping and groundworks in Orsett, where larger plots and heavy clay make levels the main job.",
  },
  {
    name: "East Tilbury",
    slug: "east-tilbury",
    description: "Landscaping and groundworks in East Tilbury, including the Bata estate and the low-lying ground.",
    content: "East Tilbury is low-lying, close to the marshes, and drainage is the first thing we look at rather than the last.\nAs in Tilbury, a soakaway is only worth installing if the ground will genuinely take the water. We check that before we design anything, because a soakaway that cannot discharge is money spent on a problem you still have.\nThe Bata estate properties have their own character and their own layouts, and we are happy to work with that rather than imposing something generic on them.",
    seoTitle: "Landscaping & Groundworks in East Tilbury | KD Essex",
    seoDescription: "Landscaping and groundworks in East Tilbury, including the Bata estate and the low-lying ground.",
  },
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
