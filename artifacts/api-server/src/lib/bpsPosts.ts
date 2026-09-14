/**
 * BPS Plumbing & Heating — blog content.
 *
 * The 15 article topics are the ones already on his WordPress site (they are
 * sensible, high-intent questions people actually search). The copy is
 * rewritten: the originals were padded to length, repeated the same call to
 * action four times per page, and hedged every answer. These lead with the
 * answer, then explain it.
 *
 * Rendered through the shared blog module (blog/BlogSections.tsx), so these use
 * the same template as every other tenant on the platform.
 */

export type BpsPost = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  readTime: number;
  seoTitle?: string;
  seoDescription?: string;
};

export const BPS_POSTS: BpsPost[] = [
  {
    title: "How long does a boiler last?",
    slug: "how-long-does-a-boiler-last",
    excerpt: "Most domestic boilers last 10 to 15 years. Here is what decides whether yours is at the top or the bottom of that range.",
    readTime: 4,
    seoDescription: "How long a boiler lasts, what shortens its life, and the signs it is coming to the end. From Gas Safe engineers in Grays, Essex.",
    content:
      "Most modern domestic boilers last between 10 and 15 years. A well-installed, well-serviced boiler in a clean system will reach the top of that range. A cheap unit fitted to sludged pipework and never serviced will not see ten.\n\n## What actually shortens a boiler's life\n\nThe biggest factor is not the brand — it is the system around it. Debris and sludge circulating through the heat exchanger will wear it out years early. That is what a system flush and a magnetic filter are for, and why a good installer insists on both.\n\nThe second factor is servicing. A boiler that is checked annually gets small faults caught while they are small. One that is ignored until it stops usually stops expensively.\n\nThe third is sizing. A boiler that is too big for the property short-cycles — firing up and shutting down constantly — and that cycling is hard wear.\n\n## Signs yours is near the end\n\n- Repairs are becoming a yearly event rather than a rarity\n- Parts are getting harder to source\n- It is noticeably noisier than it was\n- Your heating bills are climbing with no change in how you use it\n- The pressure needs topping up regularly\n\n## Repair or replace?\n\nA rough rule: if a single repair costs more than a third of a replacement and the boiler is past ten years old, replacement is usually the better spend. Under ten years and with parts available, repair almost always wins.\n\nIf you are unsure, ask whoever is quoting to show you the arithmetic rather than simply telling you it needs replacing.",
  },
  {
    title: "How often should a boiler be serviced?",
    slug: "how-often-should-a-boiler-be-serviced",
    excerpt: "Once a year, every year — and not only because the manufacturer says so. Here is what a service actually covers.",
    readTime: 3,
    seoDescription: "How often to service a boiler, what is checked during a service, and why skipping one can invalidate your warranty.",
    content:
      "Once a year. Almost every manufacturer requires it, and a missed service is the most common reason a warranty claim is refused years later.\n\n## Why the warranty point matters\n\nBoiler warranties often run to 10 years, but they are conditional. If you claim in year seven and cannot show an unbroken service history, the manufacturer can decline. The service costs far less than the repair you would then be funding yourself.\n\n## What a proper service covers\n\n- A safety inspection of the boiler and its controls\n- Flue and combustion checks\n- A check for corrosion and leaks\n- Testing the safety devices\n- Checking and adjusting the operating pressure\n- A written record of what was tested\n\nIf an engineer is in and out in ten minutes with no paperwork, you have not had a service.\n\n## When to book it\n\nLate summer or early autumn. Two reasons: engineers are less stretched than they are in January, and if something needs attention you find out before the first cold week rather than during it.\n\n## Landlords\n\nA gas safety check and a boiler service are not the same thing. The safety check is a legal requirement every 12 months; the service is what keeps the appliance working and the warranty intact. Many landlords book both together, which is usually the cheapest way to do it.",
  },
  {
    title: "How long does a boiler service take?",
    slug: "how-long-does-a-boiler-service-take",
    excerpt: "Around 30 to 45 minutes for a straightforward service. Considerably longer is not a bad sign.",
    readTime: 3,
    seoDescription: "How long a boiler service takes, what the engineer is doing, and what to have ready before they arrive.",
    content:
      "A standard annual service takes roughly 30 to 45 minutes. If the engineer is there longer it usually means they have found something worth looking at properly, which is the point of the visit.\n\n## What is happening in that time\n\nThe engineer will run the boiler and check how it is firing, take combustion readings at the flue, inspect the heat exchanger and burner, check seals and connections for corrosion or leaks, test the safety devices and check the system pressure.\n\nThen the paperwork — a written record of what was tested and anything that needs watching.\n\n## What to have ready\n\n- Clear access to the boiler, including anything stored in front of it\n- The service record or warranty paperwork if you have it\n- Any previous engineer's notes\n\nIf the boiler is in a loft or a cupboard behind boxes, clearing it beforehand saves time you are otherwise paying for.\n\n## A ten-minute 'service' is not one\n\nIf someone is in and out in ten minutes without taking a combustion reading or leaving paperwork, that is not a service, whatever the invoice says. It is worth knowing the difference — particularly if you are relying on that record for a warranty claim later.",
  },
  {
    title: "How long does it take to fit a boiler?",
    slug: "how-long-does-it-take-to-fit-a-boiler",
    excerpt: "A straight swap is usually one day. Moving the boiler or changing system type takes two or three.",
    readTime: 3,
    seoDescription: "How long a boiler installation takes, from a straight swap to a full system change, and what affects the timing.",
    content:
      "A like-for-like replacement in the same position is usually a single day. Anything that involves moving the boiler or changing the type of system takes longer.\n\n## Rough timings\n\n- **Straight swap, same position:** one day\n- **Moving the boiler to another wall or room:** one to two days\n- **Conventional to combi conversion:** two to three days\n- **Full system replacement with radiators:** three days or more\n\n## What adds time\n\nMoving the flue, upgrading the gas supply, running new pipework and removing an old cylinder and tanks all add hours. So does a system that needs flushing properly before a new boiler goes anywhere near it — and skipping that to save half a day is a false economy that shortens the life of the new unit.\n\n## What you should expect on the day\n\nFloors and carpets protected before anything starts. The old unit removed and taken away. The system balanced at the end rather than left for you to notice cold radiators a week later. And someone showing you how the controls work before they leave.\n\nIf a quote is materially cheaper than the others, it is worth asking which of those steps has been left out.",
  },
  {
    title: "What size boiler do I need?",
    slug: "what-size-boiler-do-i-need",
    excerpt: "Bigger is not better. An oversized boiler costs more to buy, more to run, and wears out sooner.",
    readTime: 4,
    seoDescription: "How boiler size is worked out, why oversizing is a common and costly mistake, and what to ask whoever is quoting.",
    content:
      "Boiler output is measured in kilowatts, and the right figure comes from your property rather than a rule of thumb.\n\n## What the size depends on\n\n- The number of radiators and their sizes\n- The number of bathrooms and how often they are used at once\n- The insulation, glazing and age of the building\n- Your incoming water pressure and flow rate\n\nA three-bedroom house with one bathroom has very different demand from a three-bedroom house with two bathrooms and a rainfall shower.\n\n## Why oversizing is the common mistake\n\nAn oversized boiler short-cycles: it fires, heats quickly, shuts off, then repeats. That constant cycling is inefficient and it wears components faster. You pay more upfront, more monthly, and replace it sooner.\n\nIt happens because oversizing is the safe option for an installer — nobody complains that their house is warm. You are the one carrying the cost.\n\n## What to ask\n\nAsk whoever is quoting how they arrived at the output figure. A proper answer refers to your radiators, your bathrooms and your water flow rate. \"That's what we usually fit\" is not sizing.\n\nIf you have low incoming water pressure, that also affects whether a combi is right for you at all — worth establishing before anyone orders a boiler.",
  },
  {
    title: "What is a combi boiler?",
    slug: "what-is-a-combi-boiler",
    excerpt: "One unit that does heating and hot water on demand, with no cylinder or tanks. Excellent for most homes — not all.",
    readTime: 4,
    seoDescription: "What a combi boiler is, how it differs from a system boiler, and when it is and is not the right choice.",
    content:
      "A combi — short for combination — boiler heats your radiators and produces hot water on demand from a single unit. No hot water cylinder, no cold tank in the loft.\n\n## The advantages\n\n- No cylinder or tanks, so you get the airing cupboard and loft space back\n- Hot water on demand, with no waiting for a tank to reheat\n- No heat lost from a cylinder standing hot all day\n- Generally cheaper and quicker to install\n\n## Where a combi struggles\n\nA combi heats water as it passes through, so its hot water output is limited by flow rate. Run two showers at once and both will suffer.\n\nIf your home has two or more bathrooms in regular simultaneous use, or your incoming mains pressure is poor, a system boiler with a cylinder is usually the better answer — even though a combi is the fashionable one.\n\n## Combi or system?\n\nAs a rough guide: one bathroom, good mains pressure, combi. Two or more bathrooms used at the same time, or weak mains, system boiler with an unvented cylinder.\n\nThe honest test is your water flow rate, which takes an engineer about two minutes to measure. Anyone quoting for a combi without checking it is guessing.",
  },
  {
    title: "Why is my boiler making a noise?",
    slug: "why-is-my-boiler-making-a-noise",
    excerpt: "Banging, whistling and gurgling each point at different faults. Here is how to tell them apart.",
    readTime: 4,
    seoDescription: "What different boiler noises mean — kettling, banging, gurgling and humming — and which ones need an engineer now.",
    content:
      "Boilers are not silent, but a new noise is always worth paying attention to. The type of noise narrows it down considerably.\n\n## Kettling — whistling or rumbling\n\nSounds like a kettle coming to the boil. Usually limescale or sludge on the heat exchanger causing water to overheat locally. Common in hard water areas. It wears the heat exchanger, so it is worth dealing with rather than living with.\n\n## Banging or clunking\n\nOften air in the system, or pipework expanding against a joist or clip. Bleeding the radiators sometimes solves it. If it started suddenly and is loud, get it looked at.\n\n## Gurgling\n\nUsually trapped air, low pressure, or a partially frozen condensate pipe in cold weather. The frozen pipe is a common January call-out and is often fixable without an engineer — though it will keep happening until the pipe is lagged properly.\n\n## Humming or vibrating\n\nFrequently the pump — either failing, or set too high. Sometimes loose mountings.\n\n## Which noises mean stop now\n\nAny loud bang on ignition, or a noise that comes with a smell of gas, means turn the boiler off and call a Gas Safe registered engineer. If you smell gas, call the National Gas Emergency Service on **0800 111 999** first.",
  },
  {
    title: "How to detect a gas leak",
    slug: "how-to-detect-a-gas-leak",
    excerpt: "The smell is the obvious sign, but it is not the only one. What to look for, and exactly what to do.",
    readTime: 3,
    seoDescription: "How to spot a gas leak in your home, the warning signs beyond smell, and the steps to take immediately.",
    content:
      "Natural gas has no smell of its own. The distinctive rotten-egg odour is an additive, put there specifically so leaks are noticeable.\n\n## Signs of a gas leak\n\n- That sulphur or rotten-egg smell\n- A hissing or whistling near a pipe or appliance\n- Orange or yellow flames on a gas hob instead of crisp blue\n- Black or sooty marks around an appliance\n- Excessive condensation on windows\n- Feeling unusually tired, dizzy or sick indoors, better when you leave\n\nThat last one matters. It can indicate carbon monoxide, which has no smell at all — which is why a working CO alarm is not optional.\n\n## What to do right now\n\n1. Do not touch light switches or electrical appliances, and do not use a lighter or a match\n2. Open doors and windows\n3. Turn the gas off at the meter if you can reach it safely\n4. Get everyone out\n5. From outside, call the **National Gas Emergency Service on 0800 111 999** — free, 24 hours\n\nDo not try to find the leak yourself and do not attempt a repair. Only a Gas Safe registered engineer may work on gas.\n\n## Preventing it\n\nAnnual servicing and, for landlords, the yearly gas safety check. Most leaks develop slowly at joints and connections, which is precisely what an annual inspection is looking for.",
  },
  {
    title: "Will a new boiler save me money?",
    slug: "will-a-new-boiler-save-me-money",
    excerpt: "Usually yes — but the honest answer depends on what you are replacing and how long you plan to stay.",
    readTime: 4,
    seoDescription: "Whether a new boiler saves money, realistic payback periods, and when replacing is not worth it yet.",
    content:
      "If you are replacing a boiler that is 15 years old or more, almost certainly yes. If yours is eight years old and working, probably not enough to justify it yet.\n\n## Where the saving comes from\n\nOlder non-condensing boilers ran at around 60–70% efficiency — for every pound of gas, 30–40p went out of the flue. A modern A-rated condensing boiler runs above 90%.\n\nOn a typical home that difference is meaningful, though the exact figure depends on your gas use, how you heat the house and how well insulated it is. Be sceptical of anyone quoting you a precise annual saving without asking about any of that.\n\n## Payback\n\nWith an old inefficient boiler, people often see payback over several years rather than several months. Add the repairs you are no longer paying for on an ageing unit and it shortens.\n\n## When it is not worth it yet\n\n- Your boiler is under ten years old and serviced\n- It is running without regular faults\n- You are moving within a year or two\n\n## What makes more difference than people expect\n\nControls. A modern thermostat with proper zoning and scheduling often saves more, for far less money, than the boiler swap itself. Insulation likewise. If someone quotes for a boiler without mentioning either, they are selling a boiler rather than solving your heating bill.",
  },
  {
    title: "Ways to increase your boiler's lifespan",
    slug: "ways-to-increase-your-boilers-lifespan",
    excerpt: "Six things that genuinely add years, and one that matters more than the rest put together.",
    readTime: 3,
    seoDescription: "Practical ways to make a boiler last longer — servicing, system water quality, filters, pressure and controls.",
    content:
      "A boiler is a machine that runs for thousands of hours a year. How it is looked after decides whether you get ten years out of it or fifteen.\n\n## 1. Service it annually\n\nThe single biggest factor, and the one that also protects the warranty. Small faults get caught while they are small.\n\n## 2. Keep the system water clean\n\nThis is the one that matters more than the rest put together. Sludge and debris circulating through the heat exchanger are what kill boilers early. A proper flush at installation and a magnetic filter afterwards make a real difference.\n\n## 3. Check the pressure\n\nMost systems sit between 1 and 1.5 bar cold. If you are topping it up often, you have a leak — find it rather than keep refilling.\n\n## 4. Bleed the radiators\n\nAir in the system makes the boiler work harder for less heat. Once a year is usually enough.\n\n## 5. Run it in summer\n\nTurn the heating on for a few minutes every month or so through summer. It stops the pump and valves seizing, which is why so many boilers fail the first cold week of October.\n\n## 6. Lag the condensate pipe\n\nIf the condensate pipe runs outside, insulate it. A frozen condensate is one of the most common January breakdowns and one of the easiest to prevent.",
  },
  {
    title: "The benefits of a boiler service",
    slug: "benefits-of-a-boiler-service",
    excerpt: "Warranty, safety, efficiency and fewer breakdowns — what you are actually buying for the price of a service.",
    readTime: 3,
    seoDescription: "The real benefits of an annual boiler service, from warranty protection to carbon monoxide safety.",
    content:
      "An annual service is an easy thing to skip when the boiler seems fine. Here is what you are actually paying for.\n\n## It keeps the warranty valid\n\nMost boiler warranties require annual servicing. Skip one and a manufacturer can decline a claim years later. The service costs a fraction of the repair you would then be funding.\n\n## It is a safety check\n\nA service includes combustion checks and an inspection for leaks and corrosion. Faulty gas appliances can produce carbon monoxide, which you cannot smell or see. This is the check that finds it.\n\n## It keeps efficiency up\n\nA boiler that is not burning cleanly uses more gas for the same heat. That shows up on the bill quietly, month after month.\n\n## It catches faults early\n\nMost boiler failures give warning — a worn seal, a sticking valve, pressure that will not hold. A service finds them in September rather than you finding them in January.\n\n## It is the cheapest thing in the house to do\n\nRelative to a breakdown call-out in mid-winter, or a refused warranty claim on a heat exchanger, an annual service is a small, predictable cost. That is the whole argument.",
  },
  {
    title: "Is boiler breakdown cover worth it?",
    slug: "is-boiler-breakdown-cover-worth-it",
    excerpt: "It depends on the age of your boiler and your appetite for a surprise bill. An honest look at both sides.",
    readTime: 4,
    seoDescription: "Whether boiler breakdown cover is worth the monthly cost, what the policies usually exclude, and the alternatives.",
    content:
      "Breakdown cover is insurance, and like all insurance it is good value for some people and poor value for others.\n\n## When it makes sense\n\n- Your boiler is older and repairs are becoming likely\n- A sudden few-hundred-pound bill would genuinely hurt\n- You are a landlord and cannot leave a tenant without heating\n- You would rather pay a predictable monthly amount than an unpredictable annual one\n\n## When it does not\n\n- Your boiler is nearly new and still under manufacturer warranty — you may be paying twice for the same protection\n- You could absorb a repair bill without difficulty\n- The policy excludes most of what is actually likely to fail\n\n## Read the exclusions first\n\nThis is where the value is decided. Common ones:\n\n- Boilers over a certain age\n- Pre-existing faults\n- Systems without a service history\n- Parts no longer manufactured\n- An excess on every claim\n\nA policy that excludes boilers over 12 years old is of limited use if yours is 11.\n\n## The alternative\n\nSome people put the equivalent monthly amount aside and use a local engineer as needed. That works well if you are disciplined and your boiler is in decent health — and badly if it fails the month you started.\n\nWhichever you choose, annual servicing is not optional. Most policies require it anyway.",
  },
  {
    title: "Signs you should replace your plumbing",
    slug: "signs-you-should-replace-your-plumbing",
    excerpt: "Repeated leaks, discoloured water and dropping pressure are the system telling you something.",
    readTime: 4,
    seoDescription: "The warning signs that household plumbing needs replacing rather than repairing, and what pipe material means for lifespan.",
    content:
      "Pipework is out of sight, so most people only think about it when something goes wrong. A few signs suggest the problem is the system rather than the individual fault.\n\n## Repeated leaks in the same run\n\nOne leak is bad luck. Three in the same stretch of pipe means the pipe itself has reached the end, and each repair is buying a few months.\n\n## Discoloured water\n\nBrown or rusty water, particularly first thing in the morning, points to corrosion inside the pipes. If it clears after a few seconds it may be localised; if it does not, it is more widespread.\n\n## Pressure that keeps dropping\n\nFalling pressure across the whole house — not one tap — suggests corrosion narrowing the pipes, or a leak somewhere you have not found.\n\n## Age and material\n\n- **Copper:** 50 years or more\n- **Galvanised steel:** 40–60 years, and prone to internal corrosion late on\n- **Plastic (PEX):** 40 years or more\n\nIf your house still has galvanised steel supply pipes, they are likely near the end regardless of how they look.\n\n## Visible corrosion\n\nGreen or white deposits on copper, or flaking and pitting on steel, are worth showing an engineer.\n\n## What to do\n\nA full re-pipe is disruptive and rarely necessary all at once. More often it is done in sections, worst first. Ask for an assessment before agreeing to anything wholesale.",
  },
  {
    title: "Plumbing or drainage — what is the difference?",
    slug: "plumbing-or-drainage-difference",
    excerpt: "Plumbing brings clean water in. Drainage takes waste away. Knowing which you have saves time and money.",
    readTime: 3,
    seoDescription: "The difference between plumbing and drainage problems, and who is responsible for which part of the system.",
    content:
      "The distinction sounds academic until you are on the phone trying to describe a problem — and it decides who you should be calling.\n\n## Plumbing\n\nThe pipework bringing clean water into the property and distributing it: supply pipes, taps, showers, the boiler, radiators, cylinders and the connections to appliances. A plumbing fault usually shows as a leak, low pressure or no hot water.\n\n## Drainage\n\nEverything taking waste water away: waste pipes, soil stacks, gullies, underground drains and the connection to the sewer. A drainage fault usually shows as slow draining, a blockage, a smell or water backing up.\n\n## The quick test\n\n**Is water arriving where it should not be, or not arriving where it should?** That is plumbing. **Is water failing to leave?** That is drainage.\n\n## Who is responsible\n\nInside the property boundary, generally you. Beyond it, usually the water company — including many shared drains that were transferred to water companies in 2011. Before paying for major work on an underground drain, it is worth establishing which side of that line it falls on.\n\n## Overlap\n\nPlenty of jobs are both. A leaking toilet is plumbing at the cistern and drainage at the pan connection. Any competent plumbing and heating firm handles both, which saves you working out the answer yourself.",
  },
  {
    title: "A guide to new boiler installation",
    slug: "new-boiler-installation-guide",
    excerpt: "What happens, what it should cost you in disruption, and the questions worth asking before you sign.",
    readTime: 5,
    seoDescription: "A plain guide to having a new boiler installed — the survey, the quote, the day itself, and what to check before you pay.",
    content:
      "Replacing a boiler is one of the larger things you will pay for in a house, and most people do it rarely enough never to become confident about it. Here is the shape of a job done properly.\n\n## 1. The survey\n\nAnyone quoting should look at the property, not just ask how many bedrooms. They need the radiators, the bathrooms, the existing system, the flue route and your incoming water flow rate.\n\nA quote given over the phone without any of that is a guess.\n\n## 2. The quote\n\nIt should name the boiler model, state the warranty, and be a fixed price. Vague quotes with day rates and \"materials extra\" are where jobs grow.\n\nAsk what is included: system flush, magnetic filter, new controls, removal of the old unit, and making good afterwards.\n\n## 3. The day itself\n\nFloors and carpets protected first. Old boiler drained, disconnected and removed. New unit mounted, connected, flue fitted. System flushed and filter installed. Then filling, pressurising and balancing.\n\nMost straight swaps are one day. Conversions take two or three.\n\n## 4. Before they leave\n\n- The system balanced, so far radiators heat like near ones\n- Controls explained to you, not just left on the wall\n- The warranty registered with the manufacturer\n- Paperwork handed over, including the Building Regulations notification\n\n## Questions worth asking\n\n- How did you arrive at this size?\n- Is a flush and filter included?\n- Who registers the warranty?\n- What happens if something fails next winter?\n\nThe answers tell you a great deal about which quote is actually the cheapest.",
  },
];
