import { useParams } from "wouter";
import { useGetPublicSite } from "@workspace/api-client-react";
import PublicSiteApp from "./PublicSiteApp";
import ConstructionSiteApp from "./ConstructionSiteApp";

/**
 * Picks the public-site template for a tenant by industry. The site query is
 * prefetched during SSR (entry-server.tsx) and cached client-side, so this adds
 * no extra request — and both render paths hydrate consistently because the
 * same cached tenant row drives the branch on server and client.
 */
export default function TenantSiteRouter(props: { forcedSlug?: string; forcedBase?: string; forcedOrigin?: string; ssrPath?: string } = {}) {
  const params = useParams<{ tenantSlug: string }>();
  const tenantSlug = props.forcedSlug || params.tenantSlug || "";
  const { data, isLoading } = useGetPublicSite(tenantSlug);
  const industry = (data as any)?.tenant?.industry;

  // Brief blank while the tenant row loads on a cold client visit — rendering a
  // template before we know the industry would flash the wrong design entirely.
  if (isLoading && !data) return null;

  if (industry === "construction") return <ConstructionSiteApp {...props} />;
  return <PublicSiteApp {...props} />;
}
