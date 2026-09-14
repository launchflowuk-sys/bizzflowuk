/**
 * BPS Plumbing & Heating — migrated site content.
 *
 * Source: the live WordPress site at bpsplumbingandheating.com (Rank Math
 * sitemap, 47 URLs, read September 2026). Structure, service list, area pages
 * and article topics are his. The prose has been rewritten — the original was
 * keyword-stuffed ("Essex Boiler Installation Specialists"), repeated the same
 * three paragraphs across pages, and addressed the reader inconsistently.
 *
 * ⚠ DISCONTINUED — deliberately not migrated. Brandon confirmed BPS no longer
 * offers these, and the old pages still rank for them:
 *   - underfloor heating
 *   - power flushing
 * The old URLs should 301 to /services once DNS moves.
 *
 * ⚠ CLAIMS carried over from his own site, not invented here, but each should be
 * confirmed before promotion: the 10-year warranty on new boilers, Gas Safe
 * registration, 24/7 availability, and the gas-safety pricing and lead times.
 */

export type BpsService = {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  content: string;
  /** The "what's included" tick boxes. Rendered as a checklist on the service page. */
  benefits: string[];
  processSteps?: Array<{ title: string; description: string }>;
};

export const BPS_SERVICES: BpsService[] = [
  {
    name: "Boiler Installation",
    slug: "boiler-installation",
    tagline: "A new boiler, sized for your home and explained before we start",
    description:
      "New boiler installations across Grays, Thurrock and south Essex, fitted by Gas Safe registered engineers and covered by a 10-year warranty.",
    content:
      "Most people only buy two or three boilers in a lifetime, so the job of the person quoting is to explain the choice rather than push the biggest unit on the van.\n\nWe size the boiler to the property — the number of bathrooms, the radiators, the water pressure you actually have — and tell you plainly where the money makes a difference and where it does not. You get the quote in writing with the model named, so you can compare it against anyone else's.\n\nOn the day we protect the floors, take the old unit away, fit the new one, balance the system and then sit down and show you how the controls work before we leave.",
    benefits: [
      "Gas Safe registered engineers",
      "10-year warranty on new boiler installations",
      "LPG, natural gas and electric",
      "Written fixed quote with the model named",
      "Old boiler removed and disposed of",
      "Controls explained before we leave",
    ],
    processSteps: [
      { title: "Survey", description: "We look at the property, the existing system and your hot water demand." },
      { title: "Fixed quote", description: "One written price with the boiler model named. No day-rate surprises." },
      { title: "Installation", description: "Usually one day. Floors protected, old unit taken away." },
      { title: "Handover", description: "System balanced, controls explained, warranty registered." },
    ],
  },
  {
    name: "Boiler Repair",
    slug: "boiler-repair",
    tagline: "No heating or hot water? Fixed price, no hidden costs",
    description:
      "Fixed-price boiler repairs covering the call-out, all labour and parts. Most faults are diagnosed and fixed on the first visit.",
    content:
      "A boiler repair should not be an open cheque. Ours is a fixed price that covers the call-out, the labour and the parts, so the number you are told is the number you pay.\n\nWe carry the parts that fail most often, which is why the majority of repairs finish on the first visit. If a part has to be ordered we tell you the cost and the wait before we order it.\n\nIf the unit is genuinely beyond economic repair we will say so, and show you the arithmetic rather than simply quoting for a replacement.",
    benefits: [
      "Fixed price covering call-out, labour and parts",
      "No hidden costs",
      "Emergency call-outs available",
      "Common parts carried on the van",
      "All major makes and models",
      "An honest repair-or-replace answer",
    ],
  },
  {
    name: "Boiler Servicing",
    slug: "boiler-servicing",
    tagline: "An annual service that keeps the warranty valid",
    description:
      "Annual boiler servicing for almost any make, with a written record of everything tested. Required by most manufacturers to keep your warranty valid.",
    content:
      "Nearly every boiler warranty requires an annual service, and a missed one is the usual reason a manufacturer refuses a claim years later. It is the cheapest insurance in the house.\n\nA service is not just a glance and a sticker. We inspect the boiler and its controls, check the flue and the combustion, look for corrosion and leaks, test the safety devices and check the pressure — then give you a written record of what was tested and anything worth watching.\n\nIf something is beginning to fail we would rather tell you in September than have you ring us in January.",
    benefits: [
      "Gas Safe registered heating engineers",
      "Safety inspection of the boiler and its controls",
      "Flue and combustion check",
      "Check for corrosion and leaks",
      "Operating pressure tested and adjusted",
      "Written record of everything tested",
      "Keeps the manufacturer's warranty valid",
    ],
  },
  {
    name: "Central Heating Installation",
    slug: "central-heating-installation",
    tagline: "The whole system, not just the box on the wall",
    description:
      "Complete central heating systems — boiler, radiators, pipework and controls — installed across Essex by Gas Safe registered engineers.",
    content:
      "A new heating system is the boiler, the radiators, the pipework and the controls working as one thing. Replacing only the boiler on tired pipework is how people end up with a new unit and the same cold back bedroom.\n\nWe design the system around the property: radiator sizes worked out room by room, pipework replaced where it needs to be, and controls you will actually use.\n\nEverything is balanced at the end so the far end of the house heats at the same rate as the near end.",
    benefits: [
      "A-rated boiler with a 10-year warranty",
      "Radiators sized room by room",
      "New pipework where the old is undersized",
      "Thermostats and controls set up with you",
      "System power-balanced on completion",
      "Gas Safe registered installation",
    ],
  },
  {
    name: "Central Heating Repairs",
    slug: "central-heating-repairs",
    tagline: "Cold rooms, noisy pipes and pressure that will not hold",
    description:
      "Repairs to heating systems across Essex — cold radiators, failing pumps and valves, pressure loss and the faults that come back.",
    content:
      "Heating faults are rarely where they appear to be. A cold radiator upstairs is often a valve downstairs, and pressure that drops every week is a leak somewhere, not a boiler that needs topping up.\n\nWe trace the cause rather than treat the symptom — pumps, motorised valves, thermostats, sludge, airlocks and the slow leaks that hide under floors.\n\nIf you have had the same fault fixed twice already, that is exactly the sort of job worth calling us about.",
    benefits: [
      "Cold radiators and uneven heating",
      "Pump, valve and thermostat faults",
      "Pressure loss and leak tracing",
      "Noisy pipework and kettling",
      "Available 7 days a week",
      "Reliable, five-star rated service",
    ],
  },
  {
    name: "Radiator Repairs & Installation",
    slug: "radiator-repairs",
    tagline: "Repaired, replaced or moved — with the room warm at the end",
    description:
      "Radiator repair, replacement and relocation, including advice on the right size and position for each room.",
    content:
      "A radiator that never gets hot at the bottom, one that has to be bled every fortnight, or one that is simply in the wrong place for the furniture — all fixable, and none of them a reason to replace a whole system.\n\nWe will advise on the size and position for the room before anything is fitted, because an undersized radiator in a cold room is a problem no amount of turning up the thermostat solves.\n\nWork is guaranteed, and we will tell you when a repair is the sensible answer rather than a replacement.",
    benefits: [
      "Advice on choice, position and size",
      "Repair, replacement or relocation",
      "Experienced, insured Gas Safe registered engineers",
      "Radiator panels, towel rails and column radiators",
      "One-year guarantee covering labour",
      "Same-day service where possible",
    ],
  },
  {
    name: "Bathroom Installation",
    slug: "bathroom-installation",
    tagline: "From the first idea to the final seal",
    description:
      "Complete bathroom installation across Essex — design, plumbing, tiling and finish, handled by one team from start to finish.",
    content:
      "A new bathroom should be a good experience, not six weeks of chasing four different trades. We handle the whole job, so there is one person to ask and one standard of finish.\n\nThat covers the design, the pipework, the tiling and the electrics, whether you are replacing like for like or changing the layout entirely.\n\nWe tidy every evening. It is a small thing, and it is the thing customers mention most.",
    benefits: [
      "Baths and roll-top baths",
      "Toilets and comfort-height toilets",
      "Showers, shower screens and walk-in cubicles",
      "Heated towel rails",
      "Full tiling and flooring",
      "Layout changes and full re-pipes",
      "One team from first visit to final seal",
    ],
  },
  {
    name: "Toilet Repairs",
    slug: "toilet-repairs",
    tagline: "Leaking, running or blocked — usually sorted the same day",
    description:
      "Toilet repair and replacement across Essex, including leaks, blockages, running cisterns and failed flush mechanisms.",
    content:
      "A running toilet wastes more water than most people expect, and a leaking one will quietly ruin a floor before it ever becomes obvious.\n\nWe repair cisterns, flush mechanisms, seals and pan connections, clear blockages properly rather than shifting them down the pipe, and replace the unit when the repair genuinely is not worth it.\n\nMost toilet jobs are same-day.",
    benefits: [
      "Same-day service where available",
      "Leaks, blockages and running cisterns",
      "Flush mechanisms and seals replaced",
      "Full toilet replacement",
      "Guarantee on repairs performed",
      "Clear pricing before we start",
    ],
  },
  {
    name: "Leaks & Blockages",
    slug: "leaks-blockages",
    tagline: "Found, fixed, and left dry",
    description:
      "Leak detection and blockage clearing across Essex — tracing the source without pulling the house apart.",
    content:
      "The difficult part of a leak is rarely the repair. It is finding it without lifting every floorboard in the house.\n\nWe trace leaks properly, including the slow ones behind walls and under floors that show up as a damp patch two rooms away, and we clear blockages at the cause rather than pushing them further along the pipe.\n\nIf water is actively coming in, ring rather than filling in a form — that is what the phone is for.",
    benefits: [
      "Leak tracing without unnecessary damage",
      "Burst and weeping pipework",
      "Sink, bath and shower blockages",
      "Slow leaks behind walls and under floors",
      "Emergency call-outs",
      "Made good after the repair",
    ],
  },
  {
    name: "Drainage Solutions",
    slug: "drainage-solutions",
    tagline: "Blockages, overflows and floods, at a price agreed first",
    description:
      "Drain unblocking and drainage repairs across Essex, with fixed prices agreed before the work starts.",
    content:
      "Blocked drains are unpleasant and they rarely happen at a convenient hour. We clear them at a price agreed before we start, so the bill does not grow with the time on site.\n\nWhere a drain keeps blocking there is usually a reason — a collapsed section, roots, or a fall that was never right. We would rather find that than keep coming back to clear the same pipe.",
    benefits: [
      "Blockages, overflows and flooding",
      "Fixed price agreed before we start",
      "Free, no-obligation quote",
      "Recurring blockages investigated properly",
      "A long-lasting solution, not a temporary clear",
    ],
  },
  {
    name: "Gas Installation",
    slug: "gas-installation",
    tagline: "Meters and gas appliances installed, moved or removed",
    description:
      "Gas meter installation, relocation and removal, plus gas appliance connection, by Gas Safe registered engineers.",
    content:
      "Gas work is the part of a job where there is no room for improvisation. Meter moves, new supplies, appliance connections and decommissioning are all Gas Safe work and all documented.\n\nCommon reasons people call: a house extension, a meter in an awkward or unsafe position, a new appliance that needs a supply, or a property being demolished and needing the supply decommissioned.\n\nWe manage the job end to end, including the parts that involve your supplier.",
    benefits: [
      "Gas meter installation, removal and relocation",
      "New gas supplies for extensions",
      "Appliance connection and commissioning",
      "Decommissioning for demolition",
      "End-to-end project management",
      "Gas Safe registered throughout",
    ],
  },
  {
    name: "Gas Safety Certificates",
    slug: "gas-safety-certificates",
    tagline: "Landlord certificates, sent to you the same day",
    description:
      "Landlord gas safety certificates (CP12) across Essex. Every gas appliance checked by a Gas Safe registered engineer, certificate issued electronically.",
    content:
      "If you let a property, the law requires every gas appliance and flue to be checked every twelve months by a Gas Safe registered engineer, and a copy of the record given to your tenants within 28 days. You keep the record for two years.\n\nWe check each appliance, note anything that needs attention, and send the certificate electronically as soon as it is signed off — so you are not waiting on the post or chasing a paper copy at renewal.\n\nIf you manage several properties, tell us and we will keep the renewal dates together so they do not creep up on you.",
    benefits: [
      "Gas Safe registered engineers",
      "Every appliance and flue checked",
      "Digitally issued certificates, same day",
      "Additional appliances charged at a flat rate",
      "Full boiler service available alongside",
      "Renewal reminders for multiple properties",
    ],
    processSteps: [
      { title: "Book", description: "Give us the address and how many gas appliances are in the property." },
      { title: "Check", description: "Each appliance and flue tested by a Gas Safe registered engineer." },
      { title: "Certificate", description: "Issued electronically the same day, ready to forward to your tenant." },
      { title: "Reminder", description: "We flag the renewal before the twelve months are up." },
    ],
  },
];

/** His real target towns, from the area pages on the live site. */
export const BPS_AREAS: Array<{ name: string; slug: string; county: string; description: string; content: string }> = [
  {
    name: "Grays",
    slug: "grays",
    county: "Essex",
    description: "Our home town. Most Grays jobs are seen the same day, and emergencies usually within the hour.",
    content:
      "BPS is based in Grays, so this is the area we reach fastest. Boiler installations and repairs, heating, bathrooms, leaks and landlord gas safety certificates — all covered, and most jobs seen the same day.\n\nA lot of the housing around Grays is older stock with systems that have been added to over the years. That is worth knowing before anyone quotes you for a full replacement you may not need.",
  },
  {
    name: "Romford",
    slug: "romford",
    county: "Essex",
    description: "Full plumbing and heating cover across Romford, including emergency call-outs.",
    content:
      "We work across Romford and the surrounding area for boiler work, heating repairs, bathrooms and landlord certificates.\n\nIf you are a landlord with several properties around Romford, we can keep the gas safety renewals on one schedule rather than chasing each one separately.",
  },
  {
    name: "Hornchurch",
    slug: "hornchurch",
    county: "Essex",
    description: "Boiler installation, servicing and repairs throughout Hornchurch and Elm Park.",
    content:
      "Hornchurch is well within our patch for both planned work and emergencies. Boiler installations, annual services, heating faults, bathrooms and certificates.\n\nCall if you need a same-day visit and we will tell you honestly whether we can get to you today rather than booking you in and hoping.",
  },
  {
    name: "Basildon",
    slug: "basildon",
    county: "Essex",
    description: "Planned installations and heating work across Basildon — call to check timings for urgent jobs.",
    content:
      "We cover Basildon for boiler installations, central heating work, bathrooms and landlord gas safety certificates.\n\nBasildon is at the wider edge of our area, so for a genuine emergency it is worth ringing first — we will be straight with you about how quickly we can get there.",
  },
  {
    name: "Brentwood",
    slug: "brentwood",
    county: "Essex",
    description: "Boilers, heating and bathrooms across Brentwood and the surrounding villages.",
    content:
      "Brentwood and the villages around it are covered for planned work: boiler installations and servicing, heating systems, bathrooms and certificates.\n\nAs with Basildon, ring first for anything urgent so we can give you a realistic time rather than a hopeful one.",
  },
];
