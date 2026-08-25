import { db } from "@workspace/db";
import { tenantsTable, tenantSettingsTable, servicesTable, areasTable, faqsTable, usersTable, userTenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
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

/** PROVISIONAL — confirm against what the client actually delivers before launch.
 *  priceGuide is intentionally absent: publishing ranges the client has not agreed
 *  would be as wrong as inventing a phone number. Drafts are in the plan doc. */
const KD_SERVICES = [
  {
    name: "Patios & Paving",
    slug: "patios-paving",
    heroImageUrl: "/kd-essex/patios-paving.webp",
    tagline: "Natural stone, porcelain and block, laid on a proper base.",
    description: "Patio and paving installation across Thurrock and South Essex, with the full build-up written into every quote.",
    content: "A patio is only as good as what is underneath it. Most of the failures we get called out to look at are not failures of the slab at all: the base was too shallow, it was never compacted properly, or nobody set a fall so the water had nowhere to go.\nWe dig out to depth, lay a geotextile membrane, then build a compacted MOT Type 1 sub-base in layers rather than in one go, because a single deep layer never compacts through. On top of that goes the laying course and your chosen finish, set to a fall of roughly 1:80 so surface water runs away from the house.\nOn material, the honest position is that porcelain is the lowest-maintenance surface we lay: it does not take up stains, it does not need sealing, and the colour does not shift. Natural stone has a depth of character porcelain cannot match, but sandstone and limestone are porous and will want sealing. Concrete block is the most forgiving underfoot and the easiest to lift and relay if a service ever needs digging up.\nEvery quote states the excavation depth, the sub-base depth and the material, so you have something specific to compare against the other prices you have been given. Most quotes do not do that, which is exactly why comparing them is so hard.",
    seoTitle: "Patios & Paving in Thurrock & Essex | KD Essex",
    seoDescription: "Patio and paving installation across Grays, Thurrock and South Essex. Porcelain, natural stone and block, with the sub-base depth and full build-up written into every quote.",
    benefits: ["Excavated and compacted to a stated depth", "Geotextile membrane under the sub-base", "Falls set so water runs away from the house", "Edge restraints so the perimeter cannot creep", "Full written specification with the quote", "Site cleared down at the end of each day"],
    processSteps: [
      { title: "Site visit and levels", description: "We measure up, check the levels, and look at where water currently goes and where it needs to go instead." },
      { title: "Written quote", description: "A fixed price setting out the excavation depth, the sub-base, the laying course and the finish." },
      { title: "Excavate and cart away", description: "Dig out to depth, remove the spoil, and check what is underneath before anything goes back in." },
      { title: "Membrane and sub-base", description: "Geotextile membrane, then MOT Type 1 compacted in layers with a plate or roller." },
      { title: "Lay, point and clean down", description: "Slabs laid to falls on a full bed, then pointed, washed down and the site cleared." },
    ],
  },
  {
    name: "Driveways",
    slug: "driveways",
    heroImageUrl: "/kd-essex/driveways.webp",
    tagline: "Block paving and resin, built to take the weight.",
    description: "Driveway installation in Thurrock and South Essex, built to the sub-base depth a vehicle actually needs.",
    content: "Driveways fail because the base was built for a footpath. A car is not a person: it concentrates weight through four small contact patches, and it does it in the same four places every day. That is why sunken tyre tracks are the single most common driveway problem we are asked to put right.\nWe dig deeper for a driveway than we would for a patio, compact the sub-base in layers, and set edge restraints all the way round so the surface cannot spread sideways under load. Where the drive meets the road or the garage threshold, the detail at that junction matters more than anything in the middle.\nThere is a drainage rule worth knowing before you plan anything. Since 2008, a new or replacement driveway over five square metres that drains towards the highway needs planning permission unless it is built in a permeable material or drains to a soakaway or border on your own land. Permeable block paving is the usual answer and it is what we would normally recommend. We will tell you where you stand before you commit.\nIf the job needs a dropped kerb, that is a separate council application and we can talk you through it.",
    seoTitle: "Driveways in Thurrock & Essex | KD Essex",
    seoDescription: "Driveway installation across Grays, Thurrock and South Essex. Permeable block paving and resin, built to a vehicle-rated sub-base depth with drainage designed in.",
    benefits: ["Vehicle-rated sub-base depth, stated on the quote", "Permeable build-up so you stay the right side of the drainage rules", "Edge restraints on every perimeter", "Falls and drainage designed in, not added later", "Clean junction detail at the road and the threshold", "Dropped kerb applications explained"],
    processSteps: [
      { title: "Survey and levels", description: "We check levels, the threshold height, where water currently runs, and whether a dropped kerb is needed." },
      { title: "Written quote", description: "Fixed price stating the excavation depth, sub-base, edge detail and surface material." },
      { title: "Excavate and prepare", description: "Dig out to depth, remove spoil, and lay a geotextile membrane over the formation." },
      { title: "Sub-base and edgings", description: "MOT Type 1 compacted in layers, with edge restraints haunched in concrete." },
      { title: "Surface and compact", description: "Blocks laid, cut in, jointed and vibrated, or resin laid to a prepared base." },
    ],
  },
  {
    name: "Fencing",
    slug: "fencing",
    heroImageUrl: "/kd-essex/garden-walls-retaining.webp",
    tagline: "Posts set properly so the panels stay put.",
    description: "Fence supply and installation across Thurrock and South Essex, from panels to closeboard.",
    content: "Fences fail at the post, not the panel. A panel that blows out in a gale is almost always telling you the post was not deep enough, or it was set in soft ground with too little concrete around it.\nWe set posts to depth in concrete, check the line and the levels before anything else goes up, and use gravel boards so the timber that meets the ground is the part you can replace cheaply rather than the panel itself.\nOn material, closeboard is the most robust option and can be repaired board by board. Lap panels are the most economical and perfectly good in a sheltered garden. Concrete posts and gravel boards cost more at the outset and outlast timber by years, which usually makes them the cheaper choice over the life of the fence.\nOne practical point worth raising early: boundaries. We will happily talk through where a fence should sit, but who owns which boundary is a legal question, not a landscaping one, and worth checking with your deeds before we start.",
    seoTitle: "Fencing in Thurrock & Essex | KD Essex",
    seoDescription: "Fence supply and installation across Grays, Thurrock and South Essex. Closeboard, lap and panel fencing with posts set to depth in concrete.",
    benefits: ["Posts set to depth in concrete", "Line and levels checked before panels go up", "Gravel boards so ground contact is replaceable", "Concrete or timber posts as you prefer", "Old fence removed and taken away", "Heights checked against permitted development"],
    processSteps: [
      { title: "Measure and agree the line", description: "We measure the run, agree where the fence sits, and flag anything worth checking on your deeds." },
      { title: "Written quote", description: "Fixed price covering post type, panel type, gravel boards and removal of the old fence." },
      { title: "Remove and dig out", description: "Old fence and posts out, including concrete footings, and away." },
      { title: "Set posts", description: "Posts set to depth in concrete, lined and levelled, and left to go off before loading." },
      { title: "Panels and clear down", description: "Gravel boards and panels fitted, capping where specified, and the site swept." },
    ],
  },
  {
    name: "Turfing & Artificial Grass",
    slug: "turfing-artificial-grass",
    heroImageUrl: "/kd-essex/garden-a.webp",
    tagline: "Prepared ground, not turf rolled onto old lawn.",
    description: "Real turf and artificial grass installation across Thurrock and South Essex, with the ground prepared properly first.",
    content: "Turf laid over unprepared ground goes patchy within a season. The roots need something to grow into, and rolling fresh turf onto compacted clay or the remains of an old lawn gives them nothing.\nFor real turf we strip what is there, cultivate and level the ground, work in a bed of topsoil or turf dressing, and lay the rolls tight and staggered so the joints knit rather than open up. Watering in the first fortnight matters more than anything we do, and we will tell you exactly what is needed.\nArtificial grass is a groundworks job wearing a landscaping hat. Under it goes a compacted stone base, a weed membrane and a laying course, because water has to get through and away rather than sitting under the surface. Skimp on that and you get a lawn that smells and holds puddles. Done properly it drains freely and stays flat.\nWhich you should choose comes down to use rather than taste. Dogs, heavy shade and a garden used year-round tend to point towards artificial. If you want something that changes with the seasons and feeds wildlife, real turf every time.",
    seoTitle: "Turfing & Artificial Grass in Thurrock & Essex | KD Essex",
    seoDescription: "Real turf and artificial grass installation across Grays, Thurrock and South Essex, with the ground stripped, levelled and prepared before anything is laid.",
    benefits: ["Existing surface stripped and taken away", "Ground cultivated and levelled before laying", "Topsoil or dressing worked in for real turf", "Compacted, free-draining base under artificial grass", "Weed membrane and secured edges", "Aftercare explained so the first fortnight goes right"],
    processSteps: [
      { title: "Strip and clear", description: "Old lawn or surface lifted and carted away, and the ground assessed underneath." },
      { title: "Level and prepare", description: "Ground cultivated and graded, with topsoil for turf or a compacted stone base for artificial." },
      { title: "Membrane and edges", description: "Weed membrane laid and edge restraints fixed so the surface cannot creep." },
      { title: "Lay and finish", description: "Turf laid tight and staggered, or artificial grass cut in, joined and sand-dressed." },
      { title: "Aftercare", description: "We walk you through watering and first cuts, which is where most new lawns are won or lost." },
    ],
  },
  {
    name: "Garden Walls & Retaining",
    slug: "garden-walls-retaining",
    heroImageUrl: "/kd-essex/garden-b.webp",
    tagline: "Foundations first, then the brickwork.",
    description: "Garden walls, sleeper walls and structural retaining across Thurrock and South Essex.",
    content: "There is a real difference between a garden wall and a retaining wall, and it is worth being clear which one you need. A garden wall holds itself up. A retaining wall holds back ground, and ground is heavy, saturated and constantly pushing.\nRetaining walls lean or fail for two reasons: the footing was too small for the load, or there was nowhere for water to go behind it. Water builds up behind a wall and the pressure it creates is what pushes it over. We size the footing for the height and the load, and we build in drainage behind the wall along with weep holes through it, so the pressure never gets a chance to build.\nFor material, brick and block suit formal gardens and match most houses. Sleepers are quicker, cheaper and well suited to a terraced or planted scheme. Gabions work well where the look suits and drainage is a particular concern, because they drain through by design.\nOne thing worth flagging early: a retaining wall over about a metre, or one holding back ground near a boundary or a structure, can need building control involvement or engineered design. We would rather raise that at the quote than halfway through.",
    seoTitle: "Garden Walls & Retaining Walls in Thurrock & Essex | KD Essex",
    seoDescription: "Garden walls, sleeper walls and structural retaining across Grays, Thurrock and South Essex. Footings sized for the load and drainage built in behind.",
    benefits: ["Footings sized for the height and the load", "Drainage and weep holes behind every retaining wall", "Brick, block, sleeper or gabion", "Movement joints where the run needs them", "Coping and capping detailed properly", "We flag where building control may be needed"],
    processSteps: [
      { title: "Assess the load", description: "We look at height, ground conditions and what the wall is actually holding back before quoting." },
      { title: "Written quote", description: "Fixed price stating the footing size, the wall construction and the drainage detail." },
      { title: "Excavate and pour footings", description: "Trench dug to a firm bearing and concrete poured to the stated depth and width." },
      { title: "Build and drain", description: "Wall built up, with drainage medium and weep holes behind it as the courses go in." },
      { title: "Backfill and cap", description: "Backfilled in layers, capped or coped, and the ground made good." },
    ],
  },
  {
    name: "Groundworks",
    slug: "groundworks",
    heroImageUrl: "/kd-essex/groundworks.webp",
    tagline: "Excavation, levels and access — the work before the work.",
    description: "Site clearance, excavation, levelling and sub-base preparation across Thurrock and South Essex.",
    content: "This is the part most landscapers subcontract out. We do it ourselves, which means there is no gap between trades and nobody to blame if the levels are wrong.\nGroundworks covers clearance, excavation, muck-away, levelling, terracing and preparing sub-bases for whatever goes on top. On a domestic job it is usually the least visible part of the budget and the part that decides whether everything above it lasts.\nIt also carries the genuine unknowns. Buried concrete, old foundations, redundant drainage, unmarked services, made ground and unexpected water are not always visible before we dig. Around Grays we find old bases under later landscaping regularly; on former industrial land near Purfleet and West Thurrock, made ground is common. Our commitment is simple: if we find something that materially changes the job, we stop, explain it and re-price it in writing before continuing. You are free to accept, look at alternatives, or stop and pay only for what has been done.\nAccess shapes the price more than most people expect. A garden a machine can reach costs less to dig out than one where everything has to be barrowed through a house, and we will tell you which yours is at the site visit.",
    seoTitle: "Groundworks in Thurrock & Essex | KD Essex",
    seoDescription: "Groundworks across Grays, Thurrock and South Essex. Site clearance, excavation, muck-away, levelling, terracing and compacted sub-base preparation.",
    benefits: ["Excavation, muck-away and disposal", "Levelling, regrading and terracing", "Sub-bases prepared and compacted in layers", "Existing services identified and worked around", "Access assessed honestly before quoting", "Unknowns re-priced in writing, never assumed"],
    processSteps: [
      { title: "Site assessment", description: "We look at access, levels, what you know about the plot, and where water currently goes." },
      { title: "Trial hole where needed", description: "Where there is doubt about what is underneath, we dig and look rather than guess." },
      { title: "Written quote", description: "Fixed price for the work we can see, with the approach to unknowns spelled out." },
      { title: "Excavate and cart away", description: "Dig out to the required formation and remove spoil, keeping the site workable." },
      { title: "Compact and hand over", description: "Formation compacted and levels checked, ready for whatever is being built on top." },
    ],
  },
  {
    name: "Drainage & Soakaways",
    slug: "drainage-soakaways",
    heroImageUrl: "/kd-essex/drainage-soakaways.webp",
    tagline: "For gardens that hold water after every downpour.",
    description: "Land drainage, soakaways and surface water solutions across Thurrock and South Essex.",
    content: "A garden that holds water is telling you one of three things: the ground is compacted, the levels send water to the wrong place, or there is nowhere for it to go. The fix is completely different in each case, which is why we diagnose before we quote rather than defaulting to a soakaway.\nCompaction is common on newer estates where construction traffic has run over the garden. The answer is usually breaking up the pan and improving the ground rather than installing drainage at all. Levels are often a simple regrade. Genuine drainage problems need land drains, a soakaway, or a connection routed away from the property.\nSoakaways deserve a word of caution locally. A soakaway only works if the ground beneath it will actually take water away, and on the low-lying ground around Tilbury and East Tilbury it frequently will not, particularly where the water table sits high. We test before we design. Installing a soakaway into ground that cannot discharge is money spent on a problem you still have, and we would rather tell you that than take the job.\nWhere a soakaway is viable, it should sit at least five metres from a building and be sized for the area it is draining rather than dug to a standard hole.",
    seoTitle: "Drainage & Soakaways in Thurrock & Essex | KD Essex",
    seoDescription: "Garden drainage and soakaways across Grays, Thurrock and South Essex. We diagnose the cause and test whether a soakaway will actually work before designing anything.",
    benefits: ["Cause diagnosed before anything is quoted", "Percolation checked before a soakaway is designed", "Land drains, soakaways and surface water routing", "Soakaways sized for the area they serve", "Water directed away from the property and boundaries", "Honest answers where drainage is not the real problem"],
    processSteps: [
      { title: "Diagnose", description: "We work out whether you have a compaction problem, a levels problem or a genuine drainage problem." },
      { title: "Test the ground", description: "Where a soakaway is being considered, we check the ground will actually take the water first." },
      { title: "Written quote", description: "Fixed price for the solution that fits the cause, with the reasoning explained." },
      { title: "Excavate and install", description: "Drains laid to fall in a permeable surround, or a soakaway built and sized to the area." },
      { title: "Reinstate and test", description: "Ground made good, and the system checked under water before we leave." },
    ],
  },
  {
    name: "Dropped Kerbs",
    slug: "dropped-kerbs",
    heroImageUrl: "/kd-essex/dropped-kerbs.webp",
    tagline: "Vehicle crossovers, start to finish.",
    description: "Dropped kerb and vehicle crossover installation across Thurrock and South Essex.",
    content: "A dropped kerb, or vehicle crossover, is the section of footway strengthened and lowered so you can legally drive from the road onto your property. Driving over a standard kerb without one is an offence, and it damages the footway and any services beneath it.\nThe important thing to know is the order of events: council approval comes first, and the work cannot start without it. The council will assess visibility, the width of the crossing, how close you are to a junction, and whether there is enough depth on your property to park clear of the footway. They will also check for services, street furniture, trees and drainage covers in the way.\nWe can talk you through the application and what the council will be looking for, and once approval is granted we carry out the crossover and tie it into your driveway. In many boroughs the work has to be done by an approved contractor, so it is worth confirming that locally before you commit to anyone.\nThe other thing worth doing at the same time is thinking about drainage. A new driveway feeding onto a crossover should not be sending its surface water onto the highway, which brings the permeable paving rules into play.",
    seoTitle: "Dropped Kerbs in Thurrock & Essex | KD Essex",
    seoDescription: "Dropped kerb and vehicle crossover installation across Grays, Thurrock and South Essex, including guidance through the council application.",
    benefits: ["Application process explained before you commit", "Crossover built to the council's specification", "Services, covers and street furniture accounted for", "Kerbs, footway and thresholds tied in properly", "Driveway drainage considered so water stays off the highway", "Reinstatement finished to highway standards"],
    processSteps: [
      { title: "Check feasibility", description: "We look at visibility, width, parking depth and what sits in the footway before you spend anything." },
      { title: "Council application", description: "You apply to the council; we explain what they will assess and what is likely to come back." },
      { title: "Approval and scheduling", description: "Once granted, the work is scheduled around any highway requirements and permits." },
      { title: "Construct the crossover", description: "Footway excavated, kerbs dropped, base strengthened and the surface reinstated to specification." },
      { title: "Tie in the driveway", description: "The crossing is tied into your drive with the levels and drainage working together." },
    ],
  },
];

/** Per-service FAQs — the questions people actually search before buying. */
const KD_SERVICE_FAQS: Record<string, Array<{ question: string; answer: string }>> = {
  "patios-paving": [
    { question: "How deep should the base under a patio be?", answer: "For a domestic patio we normally build 100-150mm of compacted MOT Type 1 over a geotextile membrane, with a 30-40mm laying course on top. A driveway needs more because it carries vehicle weight. Whatever we are building to, the depth is written on your quote." },
    { question: "How long does a patio take?", answer: "A typical domestic patio is three to five working days depending on size, access and how much spoil has to come out. Access is usually the bigger factor: barrowing everything through a house adds a day or more compared with a side gate a machine can get through." },
    { question: "Do I need planning permission for a patio?", answer: "Usually not. The thing to watch is drainage rather than planning: if you are creating a large area of hard surface, the water needs somewhere to go on your own property rather than running onto a neighbour or the highway." },
    { question: "Porcelain or natural stone?", answer: "Porcelain if you want low maintenance and colour that stays put; it does not stain and does not need sealing. Natural stone if you want character and do not mind sealing it. We will lay either and we are not tied to a supplier, so the recommendation is not a sales pitch." },
    { question: "Will you take the old patio away?", answer: "Yes. Breaking out and carting away the old surface is included as a visible line on your quote rather than hidden in the total, so you can see what that part costs." },
  ],
  "driveways": [
    { question: "Do I need planning permission for a driveway?", answer: "Only if it is over five square metres and drains towards the road in a non-permeable material. Build it in permeable paving, or drain it to a soakaway or a border on your own land, and it falls under permitted development. We will confirm which applies to your drive before you commit to anything." },
    { question: "How long does a driveway take?", answer: "Most domestic driveways are four to seven working days. A dropped kerb, if you need one, is separate work and depends on the council's timetable rather than ours." },
    { question: "Block paving or resin?", answer: "Block is easier to repair, and if a service ever has to be dug up you lift the blocks and relay them. Resin gives a smoother, more contemporary surface with no joints for weeds, but a repair is more visible. Both need the same quality of base underneath." },
    { question: "Why do driveways sink in tyre tracks?", answer: "Almost always a sub-base that was too shallow or was compacted in one thick layer instead of several thin ones. It shows in the wheel lines first because that is where the load repeats. It is a base problem, not a paving problem, which is why relaying the surface alone does not fix it." },
    { question: "Can you match an existing driveway?", answer: "Often, yes, though block colours do change over the years and a new section rarely matches a weathered one exactly. We will be straight with you about how close it will get before you decide." },
  ],
  "fencing": [
    { question: "How deep should fence posts go?", answer: "As a rule of thumb, roughly a quarter to a third of the post above ground goes below it, in concrete. For a standard 6ft fence that means around 600mm in the ground. Softer or wetter ground wants more, not less." },
    { question: "How high can a fence be without permission?", answer: "Generally up to 2m, and up to 1m where the boundary adjoins a highway used by vehicles. There are exceptions for listed buildings and some conservation areas. If your plans are near the limit we will say so before we build it." },
    { question: "Whose fence is it?", answer: "Your deeds or title plan decide that, not us. It is worth checking before work starts, particularly if the fence is coming down and going back on a slightly different line." },
    { question: "Concrete or timber posts?", answer: "Concrete posts cost more up front and last considerably longer, and if a panel is damaged you replace just the panel. Timber looks better and costs less at the outset. In an exposed garden we would usually suggest concrete." },
    { question: "Can you fence a sloping garden?", answer: "Yes. It is either stepped, where each panel stays level and the fence drops in steps, or raked, where the panels follow the slope. Stepping is more common and usually cheaper; we will show you what each looks like on your ground." },
  ],
  "turfing-artificial-grass": [
    { question: "How long before I can walk on new turf?", answer: "Keep off it as much as possible for the first two to three weeks while it roots, and water it generously in that window. After the first cut it will take normal use." },
    { question: "Does artificial grass drain?", answer: "It does if the base is right. The backing is perforated, but the water still has to get away through the stone base beneath it. A poorly built base is the reason some artificial lawns hold water and start to smell." },
    { question: "Is artificial grass good with dogs?", answer: "Generally yes, and it is one of the most common reasons people choose it. It needs rinsing through occasionally, and the base needs to drain freely, which comes back to how it was built." },
    { question: "When is the best time to lay turf?", answer: "Autumn and spring are ideal because the ground is warm and damp. Summer turfing is perfectly possible but the watering commitment is much higher, and we would rather tell you that than take the job and let it fail." },
    { question: "Can you lay turf over an existing lawn?", answer: "We would not. Turf laid on top of an old lawn sits on a layer of dying grass and compacted soil and rarely roots properly. Stripping it is a day's work that decides whether the lawn is still good in three years." },
  ],
  "garden-walls-retaining": [
    { question: "How high can I build a garden wall?", answer: "Generally up to 2m under permitted development, or 1m where it adjoins a highway used by vehicles. A retaining wall is a different question, because it is structural: over about a metre it may need building control involvement or a designed footing." },
    { question: "Why do retaining walls lean?", answer: "Water and weight. Ground behind a wall holds water, and saturated ground is far heavier and pushes far harder than dry ground. Without drainage behind the wall the pressure has nowhere to go, and the wall moves. It is almost never the brickwork that was at fault." },
    { question: "Sleepers or brick?", answer: "Sleepers are faster and cheaper and suit a planted, terraced garden. Brick or block suits a formal garden and lasts longer. Both need a proper footing and drainage behind them if they are retaining anything." },
    { question: "Do I need a footing for a low garden wall?", answer: "Yes, even a low freestanding wall wants a concrete footing on firm ground. Walls built straight onto topsoil crack as the ground moves seasonally, which on Thurrock clay it certainly will." },
    { question: "Can you build up to my boundary?", answer: "Usually, but where a wall is on or near a boundary, or where excavation goes close to a neighbour's foundation, the Party Wall Act may apply. We will tell you if we think it does so you can deal with it properly rather than retrospectively." },
  ],
  "groundworks": [
    { question: "What counts as groundworks in a garden?", answer: "Anything below the finished surface: clearance, excavation, muck-away, levelling, terracing, drainage runs and the sub-base under paving or a driveway. If it is out of sight when the job is finished, it is probably groundworks." },
    { question: "What happens if you find something unexpected?", answer: "We stop and tell you. Buried concrete, old drainage and made ground are common round here. You get an explanation and a revised price in writing before anything continues, and you can accept it, look at alternatives, or stop and pay only for the work done." },
    { question: "Where does the soil go?", answer: "Off site to a licensed facility, and it is a visible line on your quote rather than buried in the total. Muck-away is a real cost that surprises people, so we would rather you saw it." },
    { question: "Can you get a digger into my garden?", answer: "Depends entirely on access. A side gate wide enough for a mini digger changes the labour cost significantly. Where a machine cannot get in it is hand dig and barrow, which is slower and dearer, and we will price it honestly rather than discovering it on day one." },
    { question: "Do you check for underground services?", answer: "We take reasonable care to identify and avoid them, and we ask what you know about the plot. Garden lighting, irrigation, private drains and supplies to outbuildings are frequently unmarked, so anything you can tell us helps." },
  ],
  "drainage-soakaways": [
    { question: "Why does my garden hold water?", answer: "Usually compacted ground, a levels problem, or nowhere for the water to go. On newer estates it is very often compaction from construction traffic, and that is fixed by breaking up the ground rather than by installing drainage." },
    { question: "Will a soakaway work in my garden?", answer: "Only if the ground beneath it can take the water away. On low-lying ground near the river, and where the water table is high, often it cannot. We test before designing, because an installed soakaway that cannot discharge leaves you with the same puddle and a smaller bank balance." },
    { question: "How far from the house should a soakaway be?", answer: "At least five metres from a building as a general rule, and clear of foundations, boundaries and other services. It also needs sizing for the area it drains rather than being dug to a standard size." },
    { question: "Can you drain water into the road or a sewer?", answer: "Not without permission, and connecting surface water to a foul sewer is not allowed. Surface water should be dealt with on your own land wherever it can be, which is what a soakaway or a border is for." },
    { question: "Is my neighbour's water my problem?", answer: "Water running naturally downhill onto your land is generally not something you can require a neighbour to stop, but water they have actively redirected is a different matter. We can usually design something that protects your ground either way." },
  ],
  "dropped-kerbs": [
    { question: "Do I need council permission for a dropped kerb?", answer: "Yes, always. The footway is highway land, so it is not yours to alter. The council assesses visibility, crossing width, proximity to junctions, and whether you can park clear of the footway. Work cannot begin before approval." },
    { question: "How long does the whole process take?", answer: "The construction is usually only a few days. The application is the long part and depends entirely on the council's timetable, so it is worth starting that early if you are planning a new driveway." },
    { question: "Can a dropped kerb application be refused?", answer: "It can. Common reasons are poor visibility, being too close to a junction or crossing, insufficient depth on the property to park clear of the footway, or services and street furniture in the way. We will give you an honest read before you apply." },
    { question: "What if there is a manhole or a tree in the way?", answer: "Both are common obstacles. Covers can sometimes be adjusted with the utility's agreement, and trees are usually a firm refusal since councils rarely remove street trees for a crossover. Better to know before applying." },
    { question: "Does my driveway need doing at the same time?", answer: "Not necessarily, but it usually makes sense. The levels at the threshold and the drainage have to work together, and doing it as one job avoids paying twice for the same set-up." },
  ],
};

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

    // Per-service FAQs, linked to the rows we just created.
    const created = await db.select({ id: servicesTable.id, slug: servicesTable.slug })
      .from(servicesTable).where(eq(servicesTable.tenantId, tenantId));
    const serviceFaqRows = created.flatMap(sv =>
      (KD_SERVICE_FAQS[sv.slug] || []).map((f, i) => ({
        tenantId, serviceId: sv.id, question: f.question, answer: f.answer,
        global: false, sortOrder: (i + 1) * 10,
      })));
    if (serviceFaqRows.length > 0) await db.insert(faqsTable).values(serviceFaqRows as any);

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
      KD_FAQS.map((f, i) => ({ tenantId, ...f, sortOrder: (i + 1) * 10 })),
    );

    logger.info("KD Essex tenant seeded — contact details and photos still required before launch");
  } catch (err) {
    // Never let a seed failure stop the server booting; the other tenants must stay up.
    logger.error({ err }, "KD Essex seed failed");
  }
}

/**
 * Give KD Essex its own dashboard login.
 *
 * Deliberately NOT part of seedKdEssexIfMissing: that function returns early once the tenant row
 * exists, and it already does on production — so anything added inside it would never run again.
 * This is keyed on the user instead, and is called separately on boot.
 *
 * Scoped to the KD Essex tenant only. The user_tenants row grants exactly one business, so this
 * login can never switch into AMO Rendering or AMO Services: POST /auth/switch-tenant checks
 * membership and 403s without it.
 *
 * Never overwrites an existing user — no password, role or tenant reassignment on an account that
 * is already there, so a routine deploy cannot lock the client out of their own dashboard. To
 * reset the password later, clear the row or add a deliberate recovery path; do not make this
 * function mutate it.
 */
export async function ensureKdEssexAdmin(): Promise<void> {
  try {
    const [tenant] = await db.select({ id: tenantsTable.id }).from(tenantsTable).where(eq(tenantsTable.slug, SLUG)).limit(1);
    if (!tenant) return;

    const email = "info@kdessexlandscapes.co.uk";
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);

    let userId = existing?.id;
    if (!userId) {
      const password = process.env["KD_ADMIN_PASSWORD"];
      if (!password) {
        logger.warn(`${email} missing and KD_ADMIN_PASSWORD unset — KD Essex has no dashboard login yet`);
        return;
      }
      const hash = await bcrypt.hash(password, 12);
      await db.insert(usersTable)
        .values({ email, firstName: "KD Essex", lastName: "", role: "TENANT_ADMIN" as const, tenantId: tenant.id, passwordHash: hash })
        .onConflictDoNothing({ target: usersTable.email });
      const [created] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
      userId = created?.id;
      if (userId) logger.info(`${email} created as KD Essex TENANT_ADMIN`);
    }
    if (!userId) return;

    await db.insert(userTenantsTable)
      .values([{ userId, tenantId: tenant.id, role: "TENANT_ADMIN" as const }])
      .onConflictDoNothing();
  } catch (err) {
    logger.error({ err }, "KD Essex admin provisioning failed");
  }
}
