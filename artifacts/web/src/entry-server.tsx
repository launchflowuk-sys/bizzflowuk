import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider, dehydrate } from "@tanstack/react-query";
import { Router as WouterRouter } from "wouter";
import {
  setBaseUrl,
  getGetPublicSiteQueryOptions,
  getListPublicServicesQueryOptions,
  getGetPublicServiceQueryOptions,
  getListPublicAreasQueryOptions,
  getGetPublicAreaQueryOptions,
  getBrowsePublicGalleryQueryOptions,
  getListPublicReviewsQueryOptions,
  getListPublicCaseStudiesQueryOptions,
  getGetPublicCaseStudyQueryOptions,
  getListPublicFaqsQueryOptions,
  getBrowsePublicBlogQueryOptions,
  getGetPublicBlogPostQueryOptions,
  getListPublicPriceItemsQueryOptions,
} from "@workspace/api-client-react";
import TenantSiteRouter from "./zones/public/TenantSiteRouter";

export interface RenderResult {
  html: string;
  dehydratedState: unknown;
}

// Mirrors the <Switch>/<Route> table in PublicSiteApp.tsx — every route that needs data beyond
// the site-wide tenant/settings query (prefetched for every route below) needs an entry here so
// its real content renders on the first pass instead of falling back to a loading spinner.
// Static-only routes (quote, contact, visualiser, terms, privacy) need nothing beyond that.
const ROUTE_PREFETCHERS: Array<{
  pattern: RegExp;
  prefetch: (tenantSlug: string, match: RegExpMatchArray, queryClient: QueryClient) => Promise<unknown>;
}> = [
  { pattern: /^\/services\/([^/]+)\/?$/, prefetch: (t, m, qc) => qc.prefetchQuery(getGetPublicServiceQueryOptions(t, m[1])) },
  { pattern: /^\/services\/?$/, prefetch: (t, _m, qc) => qc.prefetchQuery(getListPublicServicesQueryOptions(t)) },
  { pattern: /^\/areas\/([^/]+)\/?$/, prefetch: (t, m, qc) => qc.prefetchQuery(getGetPublicAreaQueryOptions(t, m[1])) },
  { pattern: /^\/areas\/?$/, prefetch: (t, _m, qc) => qc.prefetchQuery(getListPublicAreasQueryOptions(t)) },
  { pattern: /^\/gallery\/?$/, prefetch: (t, _m, qc) => qc.prefetchQuery(getBrowsePublicGalleryQueryOptions(t)) },
  { pattern: /^\/case-studies\/([^/]+)\/?$/, prefetch: (t, m, qc) => qc.prefetchQuery(getGetPublicCaseStudyQueryOptions(t, m[1])) },
  { pattern: /^\/case-studies\/?$/, prefetch: (t, _m, qc) => qc.prefetchQuery(getListPublicCaseStudiesQueryOptions(t)) },
  { pattern: /^\/reviews\/?$/, prefetch: (t, _m, qc) => qc.prefetchQuery(getListPublicReviewsQueryOptions(t)) },
  { pattern: /^\/faqs\/?$/, prefetch: (t, _m, qc) => qc.prefetchQuery(getListPublicFaqsQueryOptions(t)) },
  { pattern: /^\/blog\/([^/]+)\/?$/, prefetch: (t, m, qc) => qc.prefetchQuery(getGetPublicBlogPostQueryOptions(t, m[1])) },
  { pattern: /^\/blog\/?$/, prefetch: (t, _m, qc) => qc.prefetchQuery(getBrowsePublicBlogQueryOptions(t)) },
];

/**
 * Renders one public-site page to a complete HTML string for a given tenant + path, with all
 * the same data the browser would fetch client-side, prefetched into the QueryClient's cache
 * before the (single, synchronous) render — useQuery only reads from cache during SSR, it
 * doesn't fetch on its own, so every query a route needs has to be prefetched explicitly first.
 */
export async function renderPublicPage(opts: {
  tenantSlug: string;
  path: string;
  origin: string;
  apiBaseUrl: string;
}): Promise<RenderResult> {
  const { tenantSlug, path, origin, apiBaseUrl } = opts;
  setBaseUrl(apiBaseUrl);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const pathOnly = path.split("?")[0];
  // Site query + price-items are prefetched for every route: the nav renders a calculator link
  // whenever the tenant has published price items, so both templates read price-items on all
  // pages — prefetching everywhere keeps the SSR nav identical to the hydrated one.
  const prefetches: Promise<unknown>[] = [
    queryClient.prefetchQuery(getGetPublicSiteQueryOptions(tenantSlug)),
    queryClient.prefetchQuery(getListPublicPriceItemsQueryOptions(tenantSlug)),
  ];
  for (const route of ROUTE_PREFETCHERS) {
    const match = pathOnly.match(route.pattern);
    if (match) {
      prefetches.push(route.prefetch(tenantSlug, match, queryClient));
      break;
    }
  }
  await Promise.all(prefetches);

  const tree = (
    <QueryClientProvider client={queryClient}>
      <WouterRouter ssrPath={path}>
        <TenantSiteRouter forcedSlug={tenantSlug} forcedBase="" forcedOrigin={origin} ssrPath={path} />
      </WouterRouter>
    </QueryClientProvider>
  );

  const html = renderToString(tree);
  const dehydratedState = dehydrate(queryClient);
  return { html, dehydratedState };
}
