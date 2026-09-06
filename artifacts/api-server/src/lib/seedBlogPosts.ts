import { db } from "@workspace/db";
import { tenantsTable, tenantSettingsTable, blogPostsTable, blogCategoriesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Opening blog content for the three live tenants.
 *
 * Idempotent in the way that matters: a tenant that already has ANY blog post is skipped
 * entirely, so this never overwrites something the client has written or edited from the
 * dashboard. It only ever fills an empty blog.
 *
 * Copy rules, learned the hard way on this platform:
 *  - No invented statistics, accreditations, guarantees or awards. Everything here is either a
 *    general fact about the trade, or a description of how the business already says it works.
 *  - No prices. Quoting a figure that the client then can't honour is worse than no figure.
 *  - UK English, UK regulation, UK terminology.
 *
 * Content is the markdown-lite that blog/BlogContent.tsx renders: ## and ### headings,
 * - bullets, 1. numbers, > pull quotes, **bold** and [links](…).
 */

type PostSeed = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  readTime: number;
  seoTitle: string;
  seoDescription: string;
};

type TenantBlogSeed = {
  slug: string;
  categoryName: string;
  categorySlug: string;
  posts: PostSeed[];
};

// ─────────────────────────────────────────────────────────────────────────────
// AMO RENDERING — rendering, Grays / Essex & East London
// ─────────────────────────────────────────────────────────────────────────────

const AMO_RENDERING: TenantBlogSeed = {
  slug: "amo-rendering",
  categoryName: "Rendering Guides",
  categorySlug: "rendering-guides",
  posts: [
    {
      title: "What Actually Drives the Cost of Rendering a House",
      slug: "what-drives-the-cost-of-rendering-a-house",
      excerpt: "Two quotes for the same house can differ by thousands, and it usually isn't the render. Here is what really moves the price, and the questions that tell you which quote is honest.",
      readTime: 7,
      seoTitle: "What Does It Cost to Render a House? | AMO Rendering",
      seoDescription: "The real cost drivers behind a rendering quote — access, preparation, wall condition, system choice and detailing — and how to compare two very different prices properly.",
      content: `Ask three renderers to price the same semi-detached house and you can easily get three numbers thousands of pounds apart. That does not automatically mean two of them are trying it on. More often it means they have priced three different jobs, and only one of them has looked properly at what is underneath.

Here is what actually moves the number.

## Access is the quiet one

Rendering is not really a wall job, it is a scaffold job with a wall job attached. A two-storey front elevation that opens straight onto a driveway is quick to reach. The same wall three feet from a boundary fence, over a conservatory roof, or on a corner plot with a public footpath, needs a different scaffold design, sometimes a licence, and more time to erect and strike.

If one quote is noticeably cheaper, the first question to ask is what scaffold it includes and who is paying for it. A price that assumes ladders on a two-storey elevation is not a cheaper price. It is a different, worse job.

## The state of what you already have

Fresh render onto sound masonry is straightforward. Most houses are not that.

- **Existing render that is blown or hollow** has to come off. Tapping a wall tells you a lot: a dull, hollow note means the render has lost its grip and rendering over it just buys you a few years.
- **Pebbledash** either comes off or gets built over. Both are legitimate; they cost very different amounts.
- **Damp, salts and staining** need the cause found first. Render is not a damp treatment and putting it over an unresolved problem traps the moisture rather than curing it.
- **Cracks** need reading before they are filled. Fine surface crazing is one thing; a stepped crack following the mortar joints is telling you something structural.

> A quote written without anyone tapping the walls is a guess with a number on it.

## Which system you choose

The three systems most Essex homes end up choosing between behave differently, and price differently.

- **Silicone render** is a thin-coat system over a basecoat and mesh. It is breathable, water-repellent and flexible, which is why it copes well with hairline movement. It is usually the choice where the finish and the long-term maintenance matter most.
- **Monocouche** is a through-coloured single-coat render, so a chip or scratch shows the same colour underneath rather than a pale scar.
- **K-Rend** is a well-known silicone-based range, applied as a system with its own detailing.

The material difference between them is real but rarely the biggest line on the quote. Preparation and access usually are.

## The detailing nobody mentions until it is missing

The parts of a render job that fail first are almost never the flat walls. They are the edges.

- Bellcast beads at the base, so water leaves the wall rather than tracking behind it
- Stop beads and movement joints where they are actually needed
- Window and door reveals finished properly, not bulked out
- Sills and drips that throw water clear
- Enough clearance above ground level, and render that does not bridge the damp-proof course

A quote that itemises beads, joints and reveals has been thought about. One that says "render to front elevation" and nothing else has not.

## Comparing two quotes properly

If you have prices in front of you, put them side by side and check the same five things:

1. **Scaffold** — included, and designed for this house?
2. **Preparation** — what is coming off, and what happens if more needs to?
3. **System** — which one, and how many coats?
4. **Detailing** — are beads, movement joints and reveals written down?
5. **Making good** — who reinstates the ground, and who takes the waste away?

Nine times out of ten, the cheaper quote is not cheaper. It is just shorter.

## Getting a straight answer for your house

The honest position is that nobody can price your property accurately from a postcode. What you can get quickly is a written quote based on photographs and a proper look, setting out exactly what is included so you can hold it up against anything else you have been given.

Send through a few photographs of each elevation, anywhere you have noticed cracking or damp, and a rough idea of the finish you want. You will get a clear breakdown back, and no pressure attached to it.`,
    },
    {
      title: "Silicone, Monocouche or K-Rend: Choosing the Right Render",
      slug: "silicone-monocouche-or-k-rend-choosing-the-right-render",
      excerpt: "Three systems, three different ways of behaving on a wall. A plain-English comparison of how each one handles weather, movement, colour and repairs — and which suits which house.",
      readTime: 8,
      seoTitle: "Silicone vs Monocouche vs K-Rend Render Compared | AMO Rendering",
      seoDescription: "How silicone, monocouche and K-Rend renders actually differ in breathability, flexibility, colour, cleaning and repair — and how to choose the right one for your property.",
      content: `Most people come to this decision having read a few product pages and come away no clearer. The marketing for all three sounds broadly identical: durable, weatherproof, low maintenance, beautiful finish.

So here is the version that is actually useful — how each one behaves once it is on your wall.

## Silicone render

Silicone render is a **thin-coat system**. A basecoat goes on with a reinforcing mesh embedded in it, then a thin silicone topcoat provides the colour and the texture.

**What it does well.** The silicone in the topcoat makes the surface water-repellent while still letting the wall breathe — water beads and runs off rather than soaking in, but moisture from inside the building can still escape. That combination is why it stays cleaner than older render types and why it copes with the damp end of a British winter.

The mesh matters more than people realise. It spreads small movements across the whole panel instead of letting them concentrate into a single crack, which is why silicone tends to be the most forgiving system on a house that has settled or been extended.

**Worth knowing.** It is a system, not a product. The basecoat, mesh, primer and topcoat are designed to work together, and skipping or substituting a layer is where problems start.

## Monocouche render

Monocouche means "one coat" — it is a through-coloured render applied in a single pass, then scraped back to a fine even texture.

**What it does well.** Because the colour runs all the way through, damage does not announce itself. A knock from a wheelbarrow or a scrape from a ladder shows the same colour underneath rather than a pale patch. That is a genuine advantage on ground-floor walls, garden walls and anywhere that takes knocks.

It is also a robust, well-proven mineral render with a long track record in the UK.

**Worth knowing.** It is less flexible than a mesh-reinforced silicone system, so movement joints and detailing have to be right. And the scraped texture is a distinctive look — some people love it, some do not. Look at a finished wall in daylight before committing.

## K-Rend

K-Rend is a brand rather than a category — a widely used silicone-based range with its own textures and detailing components.

**What it does well.** It is specified constantly across the UK, so the systems, beads and accessories are well understood and readily available. The textured finishes in the range are recognisable and hold up well.

**Worth knowing.** As with any branded system, the value is in it being installed as a complete system with the manufacturer's own components, rather than mixed with whatever is on the van.

## How to actually choose

Ignore the brochures for a moment and answer these instead.

### Is your house likely to move?

Extended, underpinned, settled, or built on Essex clay that shrinks and swells through the seasons? Lean towards a **mesh-reinforced silicone system**. Flexibility is worth more to you than anything else on the list.

### Do the walls take knocks?

Ground-floor frontages, garden walls, a driveway you reverse onto. **Monocouche** hides damage far better because there is no different colour underneath to reveal.

### Is the wall solid or cavity, and is there any damp history?

Breathability matters more on older solid-wall properties. Any system needs to let the wall dry outwards, and if there is existing damp, the cause gets fixed before anything goes over it.

### What do you want it to look like in ten years?

Silicone's water-repellency is the reason it tends to stay looking clean longest, particularly on shaded north-facing elevations where organic growth takes hold.

## What none of them will do

No render will fix rising damp, cure a leaking gutter, hide a structural crack or make an unventilated wall dry. Anyone offering render as a solution to those is selling you a cover, not a repair.

> The right render on a properly prepared wall lasts decades. The best render on a bad wall fails early, every time.

## Not sure which applies to you?

Send photographs of your elevations and mention anything you have noticed — cracking, damp patches, blown areas, previous repairs. You will get a straight recommendation for your property, in writing, with the reasoning included rather than just a system name and a price.`,
    },
    {
      title: "Pebbledash: Remove It, or Render Over It?",
      slug: "pebbledash-remove-it-or-render-over-it",
      excerpt: "The most common question we get, and the answer genuinely depends on what the pebbledash is doing. How to test yours, what each route involves, and when rendering over is the wrong call.",
      readTime: 6,
      seoTitle: "Pebbledash Removal vs Rendering Over | AMO Rendering",
      seoDescription: "Should you remove pebbledash or render over it? How to check whether yours is sound, what each option involves, and the situations where covering it stores up a problem.",
      content: `Pebbledash went onto an enormous number of British houses between the 1920s and the 1970s, and a lot of people have spent the years since wanting rid of it. The good news is you have options. The bad news is that the cheap option is not always available to you, and finding out which camp you are in takes five minutes with a knuckle.

## First, test what you have

Walk the elevation and tap it. Use your knuckles or the handle of a screwdriver, and cover the whole wall rather than one convenient patch at eye level.

- A **sharp, solid note** means the render is still bonded to the wall behind it.
- A **dull, hollow, drummy note** means it has let go. The pebbledash is hanging on rather than stuck on.

Then look at the edges and low level:

- Cracks wide enough to get a fingernail into
- Loose stones coming away when you brush a hand across
- Sections that have already fallen off, especially near the ground or under sills
- Green or black staining, which tells you water is sitting somewhere it should be running off

## Option one: render over the top

If the pebbledash is genuinely sound across the whole elevation, a system can be applied over it. The surface is prepared and keyed, a basecoat with mesh goes on to level and reinforce it, and the finish goes over that.

**Why people choose it.** It avoids the mess, the noise and the labour of removal, and there is no waste to take away. It is the quicker and less disruptive of the two routes.

**The condition.** Sound across the whole elevation, not sound in most places. Building over a hollow section means the new render is bonded to something that is already failing, and when the old layer eventually lets go it takes your new finish with it. That is a genuinely expensive way to save money.

## Option two: take it off

Removal takes the pebbledash back to the masonry underneath, which is then made good and rendered fresh.

**Why people choose it.** You start from a known surface. Any damage, previous patching or hidden damp is visible and can be dealt with properly. The wall thickness does not build up, so reveals, sills and drips keep their original proportions rather than getting swallowed.

**The reality.** It is dusty, noisy work and it generates a lot of waste. It takes longer and it costs more. And occasionally it uncovers something that needs attention before rendering — which is inconvenient, but a great deal better than sealing it in.

## When removal is not optional

Some situations make the decision for you:

- Large drummy or hollow areas anywhere on the elevation
- Pebbledash that has already come off in patches
- Signs of damp behind the existing finish
- Render bridging the damp-proof course, or sitting too close to ground level
- Cracking that follows a line rather than spreading as random crazing — that needs looking at properly before anything covers it

## What it looks like afterwards

Both routes end in the same place aesthetically: a flat, modern, even finish in the colour you choose. The difference is what is underneath and how long it lasts.

> Rendering over sound pebbledash is a sensible saving. Rendering over failing pebbledash is a deposit on doing the whole job again.

## Get yours checked properly

Tapping the wall yourself will tell you roughly which way this is going, but the edges, the base and the areas above head height are where the answer usually hides.

Send photographs of each elevation and anywhere you have spotted cracking, loose stones or staining, and mention anything you already know about the property's history. You will get a written recommendation covering which route your walls actually need, what it involves and what it costs — with no obligation to book anything.`,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// AMO SERVICES — construction, Grays / Essex & London
// ─────────────────────────────────────────────────────────────────────────────

const AMO_SERVICES: TenantBlogSeed = {
  slug: "amo-services",
  categoryName: "Building Guides",
  categorySlug: "building-guides",
  posts: [
    {
      title: "What a Proper Building Quote Should Contain",
      slug: "what-a-proper-building-quote-should-contain",
      excerpt: "A one-line price is not a quote, it is a hostage situation. What an itemised quotation should set out, why vague ones get more expensive, and the questions worth asking before you sign.",
      readTime: 7,
      seoTitle: "What Should Be in a Building Quote? | AMO Services",
      seoDescription: "How to read a builder's quotation — scope, specification, exclusions, provisional sums, payment stages and variations — and what to ask when a quote leaves them out.",
      content: `Almost every building dispute we have ever heard about starts in the same place: a quotation that was too short. Not dishonest, necessarily. Just vague enough that the customer and the builder walked away with two different jobs in their heads.

You cannot control how somebody writes their quote. You can absolutely control which one you accept.

## What should be written down

### The scope, in plain terms

What is being built, altered or removed, room by room or element by element. "Refurbish kitchen" is not a scope. "Remove existing units and floor covering, form new opening to dining room with steel to engineer's detail, first and second fix, plaster, supply and fit customer's units" is.

### The specification

Which materials, to what standard. Where the choice is yours, the quote should say so and carry an allowance rather than quietly assuming the cheapest option.

### What is excluded

This is the most useful paragraph in any quotation and the one most often missing. Decorating, floor coverings, appliances, skip hire, scaffolding, temporary accommodation, making good to neighbouring surfaces — every one of those is a common late surprise.

### Provisional sums, labelled as such

Some things genuinely cannot be priced until a floor comes up or a wall opens. That is fine and normal. What is not fine is burying it. A provisional sum should be named, given a figure, and explained.

### The programme

An expected start date and duration. Estimates are legitimate — weather and suppliers do not read schedules — but "a few weeks" is not a programme.

### Payment stages

Tied to work completed, not to dates in a calendar. A large payment before anyone has been on site is worth questioning.

### How variations get handled

The single most valuable clause in the document. If you change your mind, or the building springs a surprise, what is the process? The answer should be: priced in writing, agreed before it is carried out.

> If a change can be made without a written price, it can also be charged for without one.

## Reading three quotes that do not match

Rarely will three builders price identical scopes, which makes straight comparison difficult. Try this instead.

1. **Line the scopes up first, not the prices.** Note what each includes that the others do not.
2. **Find the gaps.** Something in the cheapest quote is usually missing rather than cheaper.
3. **Check the exclusions against your own expectations.** Were you assuming decoration was included?
4. **Look at the provisional sums.** A quote with none, on a job with genuine unknowns, is optimistic.
5. **Only then compare the totals.** By this point they usually make far more sense.

## Questions worth asking out loud

- Who is actually on site day to day, and who is my point of contact?
- Which parts are subcontracted?
- What happens if you open something up and find a problem?
- How is the site left at the end of each day?
- Do you handle the building-control side, and is that in the price?
- What is covered by your guarantee, and for how long?

None of these are awkward questions. A builder who is comfortable with their own pricing will answer all six without hesitating.

## Why the detailed quote is usually the cheaper one

It sounds backwards, but a quotation that takes the trouble to itemise is normally the one that ends up costing less. Everything has been thought about and priced once, rather than discovered halfway through and priced under pressure — when you have no leverage and a house full of scaffolding.

> The cheapest quote and the lowest final bill are very rarely the same piece of paper.

## Ask us for the itemised version

Whatever you end up deciding, ask for the detail. If a builder will not put the scope in writing, that tells you something before a single brick moves.

Send us your plans, drawings or simply photographs and a description of what you want to achieve, and you will get a written, itemised quotation setting out scope, specification and exclusions — something you can genuinely hold up against every other price you have been given.`,
    },
    {
      title: "How Long a Loft Conversion Really Takes",
      slug: "how-long-a-loft-conversion-really-takes",
      excerpt: "An honest week-by-week picture of a loft conversion — including the stages that happen before anyone appears on site, and the four things that most often add time.",
      readTime: 7,
      seoTitle: "How Long Does a Loft Conversion Take? | AMO Services",
      seoDescription: "A realistic loft conversion timeline stage by stage, what happens before work starts, which approvals are needed, and the four things that most commonly cause delays.",
      content: `"How long will it take?" is usually the second question, straight after price. The honest answer has two halves, and most people only ever hear about the second one.

## The half that happens before anyone turns up

Build work is the visible part. It is rarely the longest part.

**Design and drawings.** Somebody has to draw what you are building and work out how it holds up. On a conversion involving new floor joists, steels and a dormer, that means an architect or technician and a structural engineer.

**Building regulations.** A loft conversion is notifiable work. Structure, fire safety, escape routes, insulation, stairs and headroom all get checked and signed off. This is not optional and it is not a formality.

**Planning permission — sometimes.** Many conversions fall under permitted development, but not all. Conservation areas, flats, previous extensions that have used up your allowance, or anything unusually large can all mean a full application, which takes considerably longer.

**Party wall.** If you share a wall with a neighbour and the work affects it, the Party Wall etc. Act 1996 comes into play, and notice periods are fixed by law rather than by anybody's diary.

This first half commonly runs to a couple of months. It can be started long before you want work to begin, and pushing it forward is the single biggest thing within your control.

## The half you actually see

Once on site, a typical conversion runs roughly like this.

### Set up and access

Scaffold goes up, protection goes down through the house, and a route to the loft is established. Short, but it is when your home stops feeling entirely like yours.

### Structure

The real work. New floor structure to carry a habitable load, steels in, and — if you are having one — the dormer formed and made weathertight. This is the noisiest, most disruptive stage and the one most exposed to weather.

### Weathertight and openings

Roof windows in, dormer roofed and clad, the new space closed to the elements. A visible turning point: from here on, most work is inside.

### Staircase

Usually the moment the rest of the house notices, because it takes a bite out of the floor below. Position, headroom and fire separation were all decided at drawing stage — this is where those decisions become real.

### First fix

Electrics, plumbing, insulation and structural detailing, all before anything gets covered up. Inspections happen here.

### Plaster and second fix

Boarding, plastering, then sockets, radiators, lighting and doors.

### Decoration, flooring and handover

The finishing stage, plus final sign-off from building control.

Most straightforward conversions run **six to ten weeks on site**. Larger dormers, complex roofs, or awkward access push that out.

## The four things that add time

1. **Late decisions.** Every choice not made before it is needed becomes a pause. Windows, stairs, sanitaryware and flooring should be settled early.
2. **Weather during the roof stage.** Unavoidable and worth building into your expectations rather than your programme.
3. **Surprises in the existing structure.** Older properties hide altered joists, undersized timbers and previous DIY.
4. **Changing your mind mid-build.** Entirely your right — just understand that a change at second fix costs several times what the same change costs on a drawing.

> The projects that finish on time are the ones where every decision was made before the scaffold went up.

## Living through it

You can usually stay in the house. It is dusty, it is loud during structural work, and there will be days without water or power while things are connected. Plan around the noisy stages if you work from home.

## Get a realistic programme for your house

A timeline is only worth having if it is drawn against your actual roof, your actual access and your actual plans.

Send through your drawings if you have them, or photographs and a description if you do not, and you will get a written quotation with a stage-by-stage programme — including the approvals, so you can see the whole picture rather than just the weeks on site.`,
    },
    {
      title: "Living in Your House While It's Being Renovated",
      slug: "living-in-your-house-while-its-being-renovated",
      excerpt: "Staying put through a renovation saves a fortune and costs you something else entirely. What is genuinely manageable, what to move out of the way, and how to set up so it stays bearable.",
      readTime: 6,
      seoTitle: "Living Through a Home Renovation: A Practical Guide | AMO Services",
      seoDescription: "Practical advice on staying in your home during building work — dust, noise, cooking, utilities, pets, children and working from home — and when moving out is the better decision.",
      content: `Moving out for a renovation is expensive. Staying put is cheaper and, for most projects, entirely doable — as long as nobody is expecting it to feel normal.

Here is what it is actually like, and how to make it work.

## Decide honestly whether you should stay

Staying is usually fine for a kitchen, a bathroom, a single-room refit, a loft conversion or a rear extension where the existing house stays broadly intact.

Think harder about it if:

- The whole property is being rewired or replumbed, meaning extended periods without power or water
- You are having floors up across most of the ground floor
- Someone in the house has a respiratory condition — dust management helps but does not eliminate dust
- You have a newborn, or you work from home on video calls all day
- The kitchen and the only bathroom are both out at the same time

A short stay elsewhere during the worst two weeks is often a better answer than a full move or a miserable three months.

## Dust is the thing people underestimate

Not the noise. The dust.

Good practice means dust sheets, taped protection, zip doors on openings, and hoovering down at the end of each day. It makes an enormous difference and it still will not be perfect. Fine dust travels, and it will find its way into rooms nowhere near the work.

What helps:

- Empty the working area completely rather than covering things and hoping
- Take pictures and soft furnishings out of adjacent rooms too
- Keep wardrobes and drawers shut, and bag anything that matters
- Accept that a proper clean at the end is part of the job, not a failure along the way

## Set up a room that stays yours

Pick one room, ideally upstairs and away from the work, and keep it clear. Clean bedding, a kettle, somewhere to sit that has nothing to do with the project. When the rest of the house is a building site, having one door you can shut matters more than you would think.

## The kitchen question

If your kitchen is out, set up a temporary one early rather than improvising daily. A microwave, a kettle, a plug-in hob, a table and access to a sink somewhere. A utility room, garage or even a garden table under cover works fine. The households that struggle are the ones that never set anything up and ate takeaways for three weeks.

## Water, power and heating

Ask, at quotation stage, which days you will be without what. Isolations are usually short and planned, but knowing on Monday that Wednesday has no water is completely different from finding out at 9am on Wednesday.

## Children, pets and parking

- **Pets** need a plan. Doors get propped open and gates get left open. A day at a friend's or a shut door with a sign on it prevents a bad afternoon.
- **Children** cope better than adults with mess, and worse with early starts. Ask what time the team arrive.
- **Parking and deliveries** are worth agreeing with your neighbours in advance rather than apologising for afterwards. Materials arrive on lorries and skips need space.

## Tell your neighbours first

A short conversation before work starts is worth ten afterwards. Roughly how long, roughly what hours, and a phone number if something is genuinely a problem. Most neighbour disputes are about surprise rather than noise.

## What to expect from the people doing the work

Reasonable things to ask for, and to have agreed up front:

- Agreed working hours, and no early starts without warning
- Protected routes through the house
- Site cleared down at the end of each day
- One point of contact who actually answers the phone
- Notice before anything gets isolated

> The difference between a bearable renovation and a horrible one is almost entirely communication, not the amount of dust.

## Planning work around a house you're still living in

If you are weighing this up, tell us how the property is used — who is home during the day, whether anyone works from home, children, pets, and which rooms you cannot afford to lose at the same time.

We will build the programme around it and set out in writing which stages affect what, so you can decide what to stay through and what to plan around before anything starts.`,
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// KD ESSEX — landscaping & groundworks, Thurrock / South Essex
// ─────────────────────────────────────────────────────────────────────────────

const KD_ESSEX: TenantBlogSeed = {
  slug: "kd-essex",
  categoryName: "Landscaping Guides",
  categorySlug: "landscaping-guides",
  posts: [
    {
      title: "Why Patios Sink: The Part of the Job You Never See",
      slug: "why-patios-sink-the-part-of-the-job-you-never-see",
      excerpt: "A patio fails from underneath, months or years after the slabs went down. What a proper build-up looks like, why quotes rarely mention it, and the one question that tells you everything.",
      readTime: 7,
      seoTitle: "Why Patios Sink — Sub-Base and Build-Up Explained | KD Essex",
      seoDescription: "Patios and paving fail from underneath. What a correct sub-base build-up looks like, why cheap quotes leave it out, and how to compare landscaping quotes properly.",
      content: `A patio almost never fails because of the slabs. It fails because of what is underneath them, and by the time you can see the problem — a dip that holds water, a rocking slab, a joint that has opened up — the cause was buried a year or two earlier.

This is the part of the job you cannot inspect once it is finished, which is precisely why it is the part most worth asking about beforehand.

## What is actually under a patio

A patio that lasts is a stack of layers, each doing a specific job.

### Subgrade

The natural ground, once the topsoil and anything soft has been dug out and carted away. Topsoil holds organic matter and water, and it moves. Anything built on it moves with it.

### Geotextile membrane

A fabric layer between the subgrade and the sub-base. It stops the two mixing. Without it, on soft or clay ground, the stone gradually works down into the subsoil and the subsoil works up into the stone — and the layer you paid for slowly stops existing.

### Sub-base

Usually MOT Type 1, compacted in layers with a plate or roller. This is the structural layer, the part that spreads load and keeps everything above it stable. It is compacted in stages because a deep layer dumped in one go never compacts properly through its full depth.

### Laying course

Sharp sand or a full mortar bed, depending on the paving and how it is being laid. Thin, and about setting level, not about strength.

### The paving

The bit you actually chose.

## Where the corners get cut

Every failure has one of a handful of causes.

- **Not enough excavation.** Digging 100mm and laying on top means most of that stack never existed.
- **Sub-base too shallow, or not compacted.** Loose stone looks identical to compacted stone in a photograph. It behaves nothing like it.
- **No membrane.** Saves very little, costs the whole build-up over time on clay.
- **Spot bedding.** Five blobs of mortar under each slab instead of a full bed. Fast to lay, and the classic cause of rocking and cracked slabs, because the unsupported middle has nothing under it.
- **No falls.** Paving needs a slight slope so water runs off to somewhere sensible. Flat paving holds water, and standing water plus a British winter equals frost damage and green slime.

> A patio laid on 50mm of sand over undug ground can look flawless in the handover photograph and be visibly failing by the second winter.

## Why the quotes you are comparing look so different

Here is the uncomfortable truth about landscaping prices: the build-up is invisible, so it is the easiest place to save money without the customer noticing until long after the invoice is paid.

Two quotes for "60m² Indian sandstone patio" can be thousands apart and both technically describe the same finished surface. One has 150mm of compacted Type 1, a membrane and a full mortar bed. The other has a shovel of sand.

You cannot tell from the price. You can only tell by asking.

## The question that sorts it out

Ask every contractor quoting the same thing:

> "What's the build-up, and what depths are you working to?"

You are looking for actual numbers — excavation depth, sub-base depth, whether it is compacted in layers, whether a membrane is included, and how the paving is bedded. Anyone doing it properly will answer immediately, because they priced it.

Vagueness here is the answer.

## Ground that needs more

Some situations need more than a standard build-up, and a quote that does not mention them has not looked properly:

- Clay that shrinks and swells through the seasons
- Made ground, or a garden that has been filled and levelled at some point
- Anything near trees, where roots and moisture demand change the ground under you
- High water table or an area that already stays wet
- Patios doubling as a base for a hot tub, garden room or anything heavy

## Get the build-up in writing

The reason we put depths and materials into every quote is straightforward: it is the only way you can compare our price against anybody else's on equal terms. A finish is easy to photograph. A sub-base has to be described.

Send us the rough dimensions and a few photographs of the area, and mention anything you already know about the ground — where water sits, what was there before, whether it has ever been dug. You will get a written quote with the full build-up specified, and something solid to hold the other quotes against.`,
    },
    {
      title: "Choosing a Driveway That Lasts: Block, Resin or Concrete",
      slug: "choosing-a-driveway-that-lasts-block-resin-or-concrete",
      excerpt: "Each surface behaves differently under a car, in frost and after ten years. An honest comparison of block paving, resin-bound and concrete — including repairs, which nobody mentions.",
      readTime: 7,
      seoTitle: "Block Paving vs Resin vs Concrete Driveways Compared | KD Essex",
      seoDescription: "How block paving, resin-bound and concrete driveways compare on durability, drainage, maintenance and repairs — and how to choose the right one for your property.",
      content: `A driveway carries a tonne and a half of car, several times a day, through frost, heat and standing water, for decades. It is the hardest-working surface on your property, and it is usually chosen on looks.

Looks matter. But so does what happens in year eight.

## Block paving

Individual blocks laid on a compacted sub-base and a laying course, with the edges restrained and the joints filled with kiln-dried sand.

**Strengths.** The joints let it flex, so it handles ground movement better than a rigid surface — genuinely useful on Essex clay. Damage is local and repairable: lift the affected blocks, fix what is underneath, put them back. Keep some spares and a repair is almost invisible. It is available permeable, which matters for drainage and planning.

**Trade-offs.** Weeds and moss find the joints if the sand is not maintained. Blocks can sink or rock if the sub-base was skimped — the joints will not save a bad build-up. It benefits from occasional re-sanding and the odd wash.

**Suits.** Most homes, and anyone who wants a driveway that can be repaired rather than replaced.

## Resin-bound

Aggregate mixed with a clear resin and trowelled over a solid base — usually concrete or tarmac. Note the distinction: **resin-bound** is mixed and laid as one material, while **resin-bonded** is loose stone scattered onto adhesive. They are not the same, and bound is the one people generally mean.

**Strengths.** Smooth, seamless, no joints for weeds. Properly laid it is permeable, so water passes through rather than running off. Wide range of colours and aggregates.

**Trade-offs.** It is only ever as good as the base beneath it. If the concrete or tarmac underneath cracks or settles, the resin follows. Repairs are harder to hide — a patch rarely blends perfectly. And it must be laid in the right conditions; rushed installation in poor weather is a common cause of early problems.

**Suits.** Properties with a sound existing base, and anyone who wants a clean, modern, seamless surface.

## Concrete

A poured slab, reinforced, with movement joints formed in as it is laid.

**Strengths.** Extremely strong under load, which is why it is the usual answer where heavy vehicles are involved. Low maintenance. Can be finished in various textures and colours.

**Trade-offs.** Rigid, so it deals with ground movement by cracking — the joints control where. It is impermeable unless specifically designed otherwise, which brings drainage and planning into play. And repairs are genuinely difficult: a patch in a concrete slab always looks like a patch.

**Suits.** Heavy use, large vehicles, or where strength matters more than appearance.

## The planning point people miss

In England, laying **more than five square metres of impermeable surfacing** in a front garden needs planning permission — unless the water is directed to a permeable area within your own property, such as a border, a lawn or a soakaway.

Permeable block paving or properly laid resin-bound generally keeps you the right side of this. A solid concrete slab draining straight onto the pavement generally does not. Rules and local requirements vary, so it is always worth checking with your local council before committing.

This is not a technicality. It is also just sensible — water has to go somewhere, and "the highway" is not an answer.

## The question that actually decides it

Whichever surface you pick, it is sitting on a sub-base, and that is what determines whether it is still level in a decade.

> Every one of these three surfaces fails the same way: from underneath. The material on top decides how it looks. The build-up decides how long it looks that way.

Excavation depth, sub-base depth, compaction in layers, edge restraint, falls and drainage. Ask about those before you ask about colour.

## Think about year eight

Ask yourself how you want a repair to go. Block paving lifts and relays. Resin patches show. Concrete slabs are cut out. None of them is wrong — but it is worth deciding with your eyes open rather than discovering it after a trench for a new water main goes across the front.

## Get it priced properly

Tell us roughly how big the area is, what is there now, how many vehicles use it and whether water currently sits anywhere. Photographs help a great deal.

You will get a written quote setting out the full build-up, the drainage approach and where you stand on the planning side — so you can compare it honestly against anything else you have been quoted.`,
    },
    {
      title: "Where Does the Water Go? Garden Drainage Explained",
      slug: "where-does-the-water-go-garden-drainage-explained",
      excerpt: "A waterlogged lawn, a patio that stays wet and a puddle by the back door usually share one cause. How garden drainage actually works, and what genuinely fixes it.",
      readTime: 7,
      seoTitle: "Garden Drainage, Soakaways and Waterlogged Lawns | KD Essex",
      seoDescription: "Why gardens waterlog, how soakaways and land drainage work, what a percolation test tells you, and which drainage solution actually suits your ground conditions.",
      content: `Almost every waterlogged garden in South Essex comes down to the same short list of causes. And almost every failed attempt to fix one comes down to treating the symptom — the wet patch — rather than answering the only question that matters.

Where is the water supposed to go?

## Why your garden holds water

### The ground itself

Much of Thurrock and South Essex sits on clay. Clay does not drain. Water arrives faster than it can percolate away, so it sits on the surface, and the ground swells. In summer the same clay shrinks and cracks. Anything built on it has to account for that movement.

### Compaction

Ground that has been driven over, stored on, or worked during a wet build gets compressed. Compacted soil has had the air spaces squeezed out of it, and water cannot move through it. New-build gardens are frequent offenders — the garden was a site compound until quite recently.

### Levels running the wrong way

Patios, paths and driveways all need a slight fall away from the house. Where a surface has settled, or was laid flat, water runs back towards the building and sits at the lowest point. Which is often the back door.

### Nowhere for it to go

Rainwater downpipes discharging onto a lawn, or into a soakaway that silted up years ago. The water arrives, and then it stays.

## What actually fixes it

### Correcting levels and falls

Sometimes genuinely the whole answer. If a patio drains towards the house, no amount of drainage elsewhere solves the puddle by the door. Relaying to correct falls, and getting water to a place it can leave from, fixes the cause rather than managing it.

### Land drainage

Perforated pipe in a stone-filled trench, wrapped in geotextile, laid to a fall, collecting water from the surrounding ground and carrying it somewhere. Usually laid in a herringbone across a lawn.

The details are what make it work: enough fall, the right stone, membrane so the trench does not silt up, and — crucially — an outfall. A land drain that runs into nothing is a long thin puddle.

### Soakaways

A void, filled with stone or built from crates, wrapped in membrane, that holds water and lets it percolate into the ground.

The catch: a soakaway relies on the surrounding ground being able to absorb water. In heavy clay, a soakaway of the wrong size in the wrong place fills up and stays full. It has to be sized against the area it drains and against how fast that ground actually percolates, and it has to sit well away from foundations.

### Permeable surfacing

Rather than shedding water to somewhere else, a permeable driveway or patio lets it pass through into a stone reservoir underneath. It deals with the water where it lands, which also keeps you the right side of the planning rules on front-garden surfacing.

### Improving the soil

For a lawn that is simply compacted rather than genuinely undrained, decompaction, aeration, sand incorporation and reseeding can be enough. It is the least invasive route and worth establishing whether it applies before digging anything.

## The test that decides it

A **percolation test** — digging a hole, filling it with water and timing how fast it drops — tells you what your ground can actually absorb. It is a simple test and it separates a garden that needs a soakaway from a garden where a soakaway will never work.

> Installing a soakaway in clay without testing it first is the most common and most expensive drainage mistake we get called out to.

## What will not fix it

- A single French drain across a garden with nowhere to discharge to
- Topsoil and turf laid over compacted, undrained ground — greener for one season, identical by the next winter
- Connecting surface water into a foul drain, which is not permitted
- Discharging onto a neighbour's land, which causes a different and more expensive kind of problem

## Getting it right first time

Drainage is one of the few garden jobs where guessing is genuinely costly, because the work is buried and putting it right means digging it up again.

Tell us where the water sits, how long it stays after rain, what the ground was doing before, and where your downpipes currently discharge. Photographs during or just after heavy rain are far more useful than dry ones.

You will get a written quote setting out what is proposed, the depths and materials, and where the water is actually going — so the fix addresses the cause rather than moving the puddle somewhere else.`,
    },
  ],
};

const SEEDS: TenantBlogSeed[] = [AMO_RENDERING, AMO_SERVICES, KD_ESSEX];

/**
 * Fills an empty blog for each seeded tenant. Runs on every boot and does nothing at all once
 * posts exist — a tenant with even one post of their own is left completely alone.
 */
export async function seedBlogPostsIfMissing(): Promise<void> {
  for (const seed of SEEDS) {
    try {
      const [tenant] = await db
        .select({ id: tenantsTable.id, name: tenantsTable.name })
        .from(tenantsTable)
        .where(eq(tenantsTable.slug, seed.slug))
        .limit(1);

      if (!tenant) continue; // tenant not provisioned on this deployment

      const existing = await db
        .select({ id: blogPostsTable.id })
        .from(blogPostsTable)
        .where(eq(blogPostsTable.tenantId, tenant.id))
        .limit(1);

      if (existing.length > 0) continue; // never touch a blog the client has started using

      let categoryId: number | null = null;
      const [existingCat] = await db
        .select({ id: blogCategoriesTable.id })
        .from(blogCategoriesTable)
        .where(and(eq(blogCategoriesTable.tenantId, tenant.id), eq(blogCategoriesTable.slug, seed.categorySlug)))
        .limit(1);

      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        const [cat] = await db
          .insert(blogCategoriesTable)
          .values({ tenantId: tenant.id, name: seed.categoryName, slug: seed.categorySlug })
          .returning({ id: blogCategoriesTable.id });
        categoryId = cat?.id ?? null;
      }

      // Stagger publish dates a week apart so the index has a sensible order rather than three
      // posts sharing a timestamp and sorting arbitrarily.
      const now = Date.now();
      const week = 7 * 24 * 60 * 60 * 1000;

      await db.insert(blogPostsTable).values(
        seed.posts.map((p, i) => ({
          tenantId: tenant.id,
          categoryId,
          title: p.title,
          slug: p.slug,
          excerpt: p.excerpt,
          content: p.content,
          published: true,
          publishedAt: new Date(now - i * week),
          authorName: tenant.name,
          readTime: p.readTime,
          seoTitle: p.seoTitle,
          seoDescription: p.seoDescription,
        })),
      );

      // A tenant seeded with showBlog false (KD Essex was) would publish posts to a page its own
      // nav never links to, and the sitemap would omit them.
      await db
        .update(tenantSettingsTable)
        .set({ showBlog: true })
        .where(and(eq(tenantSettingsTable.tenantId, tenant.id), sql`${tenantSettingsTable.showBlog} = false`));

      logger.info({ tenant: seed.slug, posts: seed.posts.length }, "Seeded opening blog posts");
    } catch (err) {
      // A blog is never worth failing a boot over.
      logger.error({ err, tenant: seed.slug }, "Could not seed blog posts");
    }
  }
}
