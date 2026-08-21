# AMO Rendering — campaign rebuild, August 2026

Built against live account state pulled 19 Aug 2026 (account `2078060180`,
campaign `24044145596`). Everything below was verified against the API or the
live site, not the Ads UI.

---

## 0. Do this before anything else

**All seven ads are PAUSED.** Campaign is ENABLED on £15/day with seven ENABLED
ad groups and seven APPROVED but PAUSED ads. It has served nothing since 14 Aug.
Confirmed live via `campaign_and_resource_get`, 19 Aug.

Fix in the UI — **never through the API**. Any API edit to an ad deletes it and
recreates it paused, and wipes its performance history. This has already been
learned twice on this account.

> Campaign → Ads tab → select all → Edit → Enable.

Ad IDs, if you need to confirm: House Rendering `820938174178` · Silicone
`820895560554` · Monocouche `820939262533` · K-Rend `821010795767` · EWI
`820939241956` · Pebble Dash `820939283653` · Repairs `820938704548`.

---

## What is already right

Verified, leave alone:

| Setting | State |
|---|---|
| Display Network | off |
| Search partners | off |
| Location targeting | PRESENCE — "people in", not "interested in" |
| Bidding | Manual CPC, £2.50 (£2.00 Repairs) |
| Language | English |
| Negative list | ~91 phrase negatives, good coverage |
| Conversion tracking | `AW-789899807 / luoSCOq8vtIcEJ_U0_gC`, live on `/free-quote` |

The landing page was loaded and checked on 19 Aug: gtag present, conversion
send-to string present, `noindex, follow` correct, forms rendering.

**Not yet proven:** that the conversion actually *fires on submit*. The tag is on
the page; nobody has completed a real submission since the tag went live. Do one
end-to-end test submission and confirm it lands in Ads before spending the credit.

---

## Structure — three campaigns, not one

Split so budget can move on evidence. That is the only reason to split.

| Campaign | Ad groups | Daily budget | Why separate |
|---|---|---|---|
| **AMO - Rendering Core** | Rendering Grays, House Rendering | £18 | The money terms. Highest intent, highest value jobs. |
| **AMO - Rendering Systems** | Silicone, Monocouche, K-Rend | £10 | People who already know what they want. Cheaper, converts well. |
| **AMO - Repairs** | Render Repairs, Pebble Dash Removal | £7 | Small urgent jobs. Cheap clicks that would otherwise eat the core budget. |

### The new ad group: "Rendering Grays"

This did not exist before and is the biggest change. Until this week the business
had no verified Google presence and an Edgware address, so geo-modified terms were
not worth bidding on. With the GBP verified against a Grays address they now are —
and they are the cheapest high-intent terms in the account.

### EWI is deliberately dropped

External Wall Insulation is not in these files. EWI searches in the UK are
dominated by people hunting ECO4 and government grant funding — the existing
negative list is already full of `eco4`, `grant`, `free insulation` for exactly
this reason. It is a bad use of a limited credit. Add it back once the core
campaigns have a known cost per enquiry to compare against.

---

## Two things the verified GBP now unlocks

**1. Location assets.** Link the GBP to the Ads account and attach location
assets to all three campaigns. The ad then shows the Grays address and distance.
For a local trade this is one of the largest CTR levers available, and it was
impossible before verification.

> Admin → Linked accounts → Business Profile → link → then Assets → Location.

**2. Call conversions — this is the real gap.** The only conversion currently
tracked is a form submit. Most rendering enquiries are phone calls. Right now
those are invisible, which means the first campaign may have produced enquiries
that were never counted.

- Attach the existing call asset (`01375506071`, already approved at account level).
- Turn on **calls from ads** as a conversion, minimum 60 seconds.
- Add **calls from the website** via a Google forwarding number on `/free-quote`.

Until this is on, cost per enquiry is being measured with one eye shut.

---

## Import order

Google Ads Editor. Keywords first, then ads. Review the proposed-changes screen —
it is the only preview you get.

1. `negative-keywords.txt` → shared library list → attach to all three campaigns
2. `keywords.csv`
3. `responsive-search-ads.csv`
4. Post, then **enable the ads in the UI**

New RSAs import paused. Enabling them is a manual step, every time.

---

## After launch

- **Search terms report weekly** for the first month. Every junk term becomes a
  negative. Note: the Supermetrics trial expired 17 Aug 2026, so this now has to
  be exported from the Ads UI rather than pulled through the API.
- **Cost per enquiry is the number.** Cost per click is vanity.
- Do not judge anything on fewer than ~100 clicks.
- Do not change bids and ad copy in the same week — you lose attribution.
- Any ad group that spends 20 clicks with zero enquiries gets paused and read,
  not given more budget.

---

## Capacity

Mark is one operator. Ad spend that outruns his ability to quote and do the work
turns the best part of the offer into the worst part of the experience. Agree a
ceiling on concurrent jobs before raising budget.
