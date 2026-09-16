/**
 * What Google and WhatsApp see when they look at the marketing site.
 *
 * WHAT WAS THERE BEFORE. index.html carried a title, a description and three
 * og: tags, and that was the lot. No canonical, so every ad click with a ?utm_
 * on it read as a separate page and split the ranking signal. No og:image, so
 * pasting bizzflowuk.com into WhatsApp — which is how a trade actually shares
 * anything — produced a grey box with no picture. No structured data at all,
 * so nothing was eligible for a rich result.
 *
 * The title was the other problem: "The Platform for Home Improvement
 * Businesses" is what we call ourselves, not what anybody types into Google. A
 * plumber searches for job management software, not for a platform.
 *
 * React 19 hoists title/meta/link/script rendered anywhere in the tree into
 * <head>, in both client and server rendering, so this is plain JSX and needs
 * no DOM poking. The tags in index.html carry `data-default-seo` and act as the
 * fallback until this mounts.
 */

import { useEffect } from "react";

const ORIGIN = "https://bizzflowuk.com";
const OG_IMAGE = `${ORIGIN}/og-bizzflowuk.png`;

const TITLE = "Job management software for UK trades | BizzFlowUK";
const DESCRIPTION =
  "Website, quotes, invoices, scheduling and card payments in one place for UK plumbers, builders, renderers and landscapers. £99 a month, first 7 days free.";

/** Renders a schema.org block. */
function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export default function BizzFlowSeo({ faqs }: { faqs: ReadonlyArray<{ q: string; a: string }> }) {
  /**
   * Drop index.html's fallback tags once we have rendered the real ones.
   *
   * They exist for the very first paint, before any JavaScript has run. Left in
   * place they sit alongside these as a second og:title and a second
   * description, and a crawler reading two of each has to guess which we meant.
   * Same removal the tenant sites do.
   */
  useEffect(() => {
    document.querySelectorAll("[data-default-seo]").forEach(el => el.remove());
  }, []);

  /**
   * The canonical drops the query string.
   *
   * Every ad click arrives carrying ?gclid= or a utm_ set. Without this, Google
   * treats each of those as its own URL and the one page we want ranked
   * competes against a dozen copies of itself.
   */
  const canonical = `${ORIGIN}${typeof window !== "undefined" ? window.location.pathname.replace(/\/+$/, "") : ""}` || ORIGIN;

  return (
    <>
      <title>{TITLE}</title>
      <meta name="description" content={DESCRIPTION} />
      <link rel="canonical" href={canonical} />
      <meta name="robots" content="index, follow, max-image-preview:large" />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="BizzFlowUK" />
      <meta property="og:title" content={TITLE} />
      <meta property="og:description" content={DESCRIPTION} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="The BizzFlowUK dashboard, showing a trade business's revenue, jobs and schedule for the day." />
      <meta property="og:locale" content="en_GB" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={TITLE} />
      <meta name="twitter:description" content={DESCRIPTION} />
      <meta name="twitter:image" content={OG_IMAGE} />

      {/* The browser chrome on a phone, so the address bar matches the site. */}
      <meta name="theme-color" content="#0E7C66" />

      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "BizzFlowUK",
        url: ORIGIN,
        logo: `${ORIGIN}/favicon.svg`,
        image: OG_IMAGE,
        description: DESCRIPTION,
        // The trading company behind the product. Naming it is what lets Google
        // connect this site to the business rather than treating it as an
        // anonymous page.
        parentOrganization: { "@type": "Organization", name: "LaunchFlow UK Limited" },
        areaServed: { "@type": "Country", name: "United Kingdom" },
        address: { "@type": "PostalAddress", addressCountry: "GB", addressRegion: "Essex" },
      }} />

      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "BizzFlowUK",
        applicationCategory: "BusinessApplication",
        applicationSubCategory: "Field service management",
        operatingSystem: "Web browser, iOS, Android",
        url: ORIGIN,
        description: DESCRIPTION,
        // The price is on the page in plain sight; saying it here is what can
        // put "£99/month" under the search result instead of nothing.
        offers: {
          "@type": "Offer",
          price: "99",
          priceCurrency: "GBP",
          category: "subscription",
          availability: "https://schema.org/InStock",
          url: `${ORIGIN}/signup`,
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price: "99",
            priceCurrency: "GBP",
            unitCode: "MON",
            billingDuration: 1,
          },
        },
        // No aggregateRating. We have four businesses on the platform and no
        // collected reviews of the software itself; inventing one is a manual
        // action waiting to happen.
      }} />

      {/*
        Built from the same FAQS array the page renders, never a second copy.
        Google requires the marked-up answer to match the visible answer word
        for word, and two hand-maintained lists drift the first time one is
        edited - which is exactly how sites earn a structured-data penalty.
      */}
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map(f => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }} />
    </>
  );
}
