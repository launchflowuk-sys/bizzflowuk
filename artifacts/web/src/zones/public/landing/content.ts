/**
 * Copy for the paid-search landing page.
 *
 * Kept out of the components so the wording can be reviewed and edited without reading JSX, and so
 * the page has one obvious place to look when a claim needs changing.
 *
 * Rule for anything added here: it must be true and checkable. No job counts, no years-trading, no
 * "trusted by hundreds" — the client has no evidence for those yet, and a claim a visitor can't
 * verify does more damage than the empty space it filled. Every promise below is either already on
 * the approved ad copy (15-year guarantee, free survey, 24-hour written quote, Essex coverage) or
 * is general trade fact that holds regardless of the operator.
 */

export interface ServiceVariant {
  h1: string;
  intro: string;
  service: string;
}

/**
 * Message match for paid search.
 *
 * One landing page serving seven ad groups would show "Rendering across Grays" to somebody who
 * searched "pebble dash removal" — a mismatch the visitor feels immediately, and one Google scores
 * against you through landing-page relevance, which feeds Quality Score and therefore the price of
 * every click.
 *
 * The key is a path segment (/free-quote/k-rend), not a query string. The public site is server
 * rendered and its HTML is render-cached by path — a ?query variant would serve whichever HTML was
 * cached first and then rewrite the headline during hydration, which is both a mismatch and a
 * visible flash on the largest element of the page. As a path it is part of routing and of the
 * cache key, so server and client agree on the first paint.
 *
 * An unknown or absent key falls back to the generic wording, so a mistyped ad URL degrades quietly
 * instead of breaking.
 */
export const SERVICE_VARIANTS: Record<string, ServiceVariant> = {
  silicone: {
    h1: "Silicone render across Grays & south Essex — free quote within 24 hours",
    intro: "Self-cleaning, weatherproof silicone render fitted by a local team and backed by a written 15-year guarantee. We survey your property free, then send a fixed written price.",
    service: "Silicone Render",
  },
  monocouche: {
    h1: "Monocouche render across Grays & south Essex — free quote within 24 hours",
    intro: "Through-coloured monocouche render, so chips and scratches stay invisible. Single-coat, durable and low-maintenance — surveyed free, priced in writing.",
    service: "Monocouche Render",
  },
  "k-rend": {
    h1: "K Rend specialists in Grays & south Essex — free quote within 24 hours",
    intro: "Textured, hard-wearing K Rend installed by a local team. Free survey, a fixed written price within 24 hours, and a guarantee in writing.",
    service: "K Rend",
  },
  ewi: {
    h1: "External wall insulation in Grays & south Essex — free quote within 24 hours",
    intro: "Cut your heating bills and improve your EPC rating with external wall insulation, finished in render. Free survey, fixed written price, no obligation.",
    service: "External Wall Insulation",
  },
  "pebble-dash": {
    h1: "Pebbledash removal across Grays & south Essex — free quote within 24 hours",
    intro: "Remove dated pebbledash and replace it with a smooth, modern render finish. Removal, prep and finish handled end to end, priced in writing after a free survey.",
    service: "Pebble Dash Removal",
  },
  repairs: {
    h1: "Render repairs across Grays & south Essex — free quote within 24 hours",
    intro: "Cracked or failing render repaired and colour-matched before water gets behind it. Fast local response, free survey, fixed written price.",
    service: "Render Repairs",
  },
};

export function readServiceVariant(key?: string): Partial<ServiceVariant> {
  return (key && SERVICE_VARIANTS[key]) || {};
}

export const SERVICE_OPTIONS: readonly string[] = [
  "Silicone Render", "Monocouche Render", "K Rend", "External Wall Insulation",
  "Render Repairs", "Pebble Dash Removal", "Not sure — please advise",
];

export interface ServiceBlurb {
  name: string;
  body: string;
  best: string;
}

/**
 * Used when the tenant hasn't published services yet. The moment real services exist in the
 * dashboard they take over, because they'll carry the operator's own wording.
 */
export const SERVICE_BLURBS: readonly ServiceBlurb[] = [
  {
    name: "Silicone render",
    body: "A flexible, breathable topcoat that sheds water and resists cracking as the building moves. The silicone in the mix stops dirt keying into the surface, so rain takes most of it back off.",
    best: "Best for: a long-lasting, low-maintenance finish in a colour of your choosing.",
  },
  {
    name: "Monocouche render",
    body: "Through-coloured, so the colour runs all the way through rather than sitting on top. A chip or a scrape shows the same shade underneath instead of a pale scar.",
    best: "Best for: a traditional scraped-texture finish that stays looking even.",
  },
  {
    name: "K Rend",
    body: "A silicone-based system with a textured finish and a strong track record on UK housing. Hard-wearing, and forgiving on walls that aren't perfectly flat.",
    best: "Best for: texture, durability, and a well-known name behind the product.",
  },
  {
    name: "External wall insulation",
    body: "Insulation board fixed to the outside of the wall, then meshed, basecoated and rendered over. The wall gets warmer, the heating works less hard, and the house gets a new face at the same time.",
    best: "Best for: solid-wall homes that are expensive to heat.",
  },
  {
    name: "Pebbledash removal",
    body: "The old dash is taken back, the wall made good, and a smooth modern render built up in its place. The prep is most of the work and it's where the finish is won or lost.",
    best: "Best for: dated 60s and 70s frontages that drag the whole house down.",
  },
  {
    name: "Render repairs",
    body: "Cracked, hollow or blown render cut out, made good and colour-matched into the surrounding finish before water gets behind it and makes it a bigger job.",
    best: "Best for: catching a small problem while it's still small.",
  },
];

export interface BuildStep {
  stage: string;
  title: string;
  body: string;
}

/**
 * What actually happens to the wall.
 *
 * This section exists because the client has no job photography yet. Rather than leave a hole where
 * proof should be, it answers the question a homeowner asks next — "what am I actually paying for?"
 * — and it does that with drawn diagrams rather than pictures, so it stands up on its own and keeps
 * standing up once real photos appear above it.
 */
export const BUILD_STEPS: readonly BuildStep[] = [
  {
    stage: "01",
    title: "Prep",
    body: "Old coatings off, loose material cut back, cracks opened and filled. Beads set to the reveals and corners so the edges finish straight.",
  },
  {
    stage: "02",
    title: "Basecoat & mesh",
    body: "A basecoat goes on with fibreglass mesh bedded into it. The mesh is what spreads movement across the wall instead of letting it concentrate into a crack.",
  },
  {
    stage: "03",
    title: "Primer",
    body: "A tinted primer evens out suction across the wall so the topcoat pulls at the same rate everywhere and dries to one consistent colour.",
  },
  {
    stage: "04",
    title: "Topcoat",
    body: "The finish coat, applied and textured in one pass per elevation so there's no join line where one day's work meets the next.",
  },
];

export interface GuaranteePoint {
  title: string;
  body: string;
}

export const GUARANTEE_POINTS: readonly GuaranteePoint[] = [
  {
    title: "15 years, in writing",
    body: "Written cover on every silicone render system we install, handed over with the job rather than promised on the phone.",
  },
  {
    title: "A fixed price, not an estimate",
    body: "The figure on your quote is the figure you pay. If we find something behind the old render that changes the job, you hear about it before we carry on, not after.",
  },
  {
    title: "No deposit before we start",
    body: "You see the survey and the written price first, and decide in your own time. There's no obligation and nobody will chase you.",
  },
];

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Shown only while the tenant has no FAQs of their own published. These are the questions that
 * actually arrive before a render job, in roughly the order they arrive in.
 */
export const DEFAULT_FAQS: readonly FaqItem[] = [
  {
    question: "How much does it cost to render a house?",
    answer: "It comes down to the size of the property, the state of the walls underneath and the system you go for — which is why nobody honest can price it down the phone. We survey the property free, measure it up properly, and send a fixed written price within 24 hours. There's no obligation to go ahead.",
  },
  {
    question: "How long will the job take?",
    answer: "Most houses take somewhere around one to two weeks on site, though that moves with the size of the property and the weather. Render needs to go on and cure in the right conditions, so we'd rather lose a day than rush a coat. Your survey will give you a realistic window before you commit.",
  },
  {
    question: "Will I need scaffolding?",
    answer: "For anything above single storey, yes. It's the only safe way to work an elevation properly, and it's included in your quote rather than added later as an extra.",
  },
  {
    question: "Do I need planning permission?",
    answer: "For a straightforward re-render on most houses, no. It's different if you're in a conservation area, the property is listed, or you're adding external wall insulation that changes the thickness of the walls. We check this at the survey and tell you straight if it applies to you.",
  },
  {
    question: "Can you render straight over pebbledash?",
    answer: "Sometimes, if it's sound and well-keyed. Often it's better taken off, because rendering over a failing surface only buys you a few years before the whole lot comes away together. We'll tell you honestly which one your wall needs, even when it's the cheaper answer.",
  },
  {
    question: "Will the new render crack?",
    answer: "Render cracks for two reasons — the building moves, or the prep was rushed. Mesh bedded into the basecoat handles the first by spreading movement across the wall instead of letting it gather in one line. The second is down to whoever does the work, which is why we spend more time on prep than on the finish coat.",
  },
  {
    question: "What's the difference between silicone and monocouche?",
    answer: "Silicone is a flexible topcoat over a basecoat, and it sheds dirt and water well, which keeps it looking clean. Monocouche is through-coloured, so damage doesn't show a pale patch underneath. Silicone tends to suit modern smooth finishes, monocouche suits a traditional scraped texture. We'll walk you through both at the survey against your actual wall.",
  },
  {
    question: "Do you work through the winter?",
    answer: "We work most of the year, but render can't go on in frost or be rained on before it's set. If the forecast is against us we'll say so and move you rather than put a coat on that won't last.",
  },
  {
    question: "What happens to my garden and driveway?",
    answer: "Everything gets sheeted before a bag is opened, and we clear up at the end of each day rather than leaving it to the last one. Plants, windows, paths and cars are covered as a matter of course.",
  },
];

export const AREAS_COVERED: readonly string[] = [
  "Grays", "Thurrock", "Tilbury", "Chafford Hundred", "South Ockendon", "Aveley",
  "Basildon", "Stanford-le-Hope", "Corringham", "Purfleet", "Rainham", "Upminster",
];
