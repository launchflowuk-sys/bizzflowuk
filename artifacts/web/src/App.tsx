import { lazy, Suspense, useState } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe, setAuthTokenGetter, setUnauthorizedHandler, setTenantIdGetter, useResolveTenantDomain } from "@workspace/api-client-react";
import { AuthProvider, useAuthCtx, getStoredToken, clearStoredToken, getActiveTenantId } from "@/lib/auth";

import NotFound from "@/pages/not-found";
import { BpsLoader } from "@/components/BpsLoader";
import "@/zones/public/bizzflow/bizzflow.css";
import "@/zones/public/bizzflow/bizzflow-overrides.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Wire the API client to read our JWT on every request
setAuthTokenGetter(() => Promise.resolve(getStoredToken()));
setTenantIdGetter(() => getActiveTenantId());

// A stored token the server no longer accepts (expired, or signed with a previous
// SESSION_SECRET) used to leave the app permanently half-signed-in: isSignedIn is only
// "a token string exists in localStorage", never "the server agrees", so the dashboard shell
// rendered while every request 401'd and the login form was unreachable. Drop the dead token
// and send the user back to sign in.
setUnauthorizedHandler(() => {
  if (!getStoredToken()) return;
  clearStoredToken();
  const signInPath = `${basePath}/sign-in`;
  if (window.location.pathname !== signInPath) window.location.replace(signInPath);
});

// ---------------------------------------------------------------------------
// Login form
// ---------------------------------------------------------------------------
export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const { signIn } = useAuthCtx();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login failed"); return; }
      signIn(data.token);
      setLocation(redirectTo || "/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bf min-h-[100dvh] flex flex-col" style={{ background: "#fff" }}>
      {/* The site's own header, so signing in feels like the same product
          rather than a separate admin tool bolted on the side.

          `width: 100%` is load-bearing. `.header` carries `margin: auto`, and an
          auto inline margin on a flex item stops it stretching and shrinks it to
          its content — so the brand and the button bunched up in the middle of
          the page instead of sitting at opposite ends. Same trap as the hero. */}
      <header className="header" style={{ width: "100%" }}>
        <a className="brand" href={basePath || "/"} aria-label="BizzFlowUK home">
          <img src="/bizzflow/brand/bizzflowuk-symbol-transparent.png" alt="" className="brand-icon" />
          <span>bizzflow<span className="brand-uk">UK</span></span>
        </a>
        <a className="button small dark" href={basePath || "/"}>
          Back to site <span>↗</span>
        </a>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 pt-[6vh] pb-20">
        {/* No card and no shadow. The page is already white; a white box
            floating on it would only be its own border, and the fields are the
            only boxes the screen needs. */}
        <form onSubmit={handleSubmit} className="w-full max-w-[420px]">
          <p className="eyebrow"><span className="mini-line" /> WELCOME BACK</p>
          <h1 style={{ fontSize: "clamp(34px,4.4vw,43px)", lineHeight: 1.1, letterSpacing: "-1.7px", fontWeight: 650, margin: "14px 0 0" }}>
            Your business,<br /><span className="teal">right where you left it.</span>
          </h1>
          <p style={{ marginTop: "14px", color: "var(--muted)", fontSize: "16px", lineHeight: 1.6 }}>
            Sign in to your workspace.
          </p>

          {error && (
            <div role="alert" style={{
              marginTop: "26px", padding: "13px 16px", borderRadius: "8px",
              background: "#fbe9e7", color: "#8c2f22", fontSize: "14px", fontWeight: 500,
            }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: "30px", display: "grid", gap: "18px" }}>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>Email address</span>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" placeholder="you@yourbusiness.co.uk"
                className="bf-input"
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>Password</span>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required autoComplete="current-password" placeholder="••••••••"
                className="bf-input"
              />
            </label>
          </div>

          <button type="submit" disabled={loading} className="button teal-bg" style={{ marginTop: "26px", width: "100%", justifyContent: "center" }}>
            {loading ? "Signing in…" : <>Sign in <span>↗</span></>}
          </button>

          <p style={{ marginTop: "26px", fontSize: "14px", color: "var(--muted)" }}>
            New here? <a href={`${basePath}/signup`} className="teal" style={{ fontWeight: 600 }}>Create your workspace</a>
          </p>
        </form>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zone lazy imports
// ---------------------------------------------------------------------------
const AcceptInvitePage = lazy(() => import("@/zones/admin/AcceptInvitePage"));
const DashboardApp = lazy(() => import("@/zones/dashboard/DashboardApp"));
const PortalApp = lazy(() => import("@/zones/portal/PortalApp"));
const AdminApp = lazy(() => import("@/zones/admin/AdminApp"));
const PublicSiteApp = lazy(() => import("@/zones/public/TenantSiteRouter"));
const BizzFlowHome = lazy(() => import("@/zones/public/bizzflow/BizzFlowHome"));
const BizzFlowDemo = lazy(() => import("@/zones/public/bizzflow/BizzFlowDemo"));
const SignUpPage = lazy(() => import("@/zones/public/bizzflow/SignUpPage"));

/**
 * Which tenant's branding the loader may show, resolved before any tenant data has
 * loaded. Matches the custom domain first, then the platform path (/site/:slug) so
 * a tenant is branded correctly while it is still being reviewed pre-launch.
 *
 * Anything unrecognised gets the unbranded loader below — showing one tenant's logo
 * to another tenant's visitor is worse than showing no logo at all, and a hostname
 * fallthrough is exactly how AMO Rendering's mark ended up spinning on every other
 * tenant's site.
 */
function loaderTenant(): "amo-services" | "amo-rendering" | "kd-essex" | "bps" | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  const path = window.location.pathname;
  const match = (domain: string, slug: string) => host.includes(domain) || path.startsWith(`/site/${slug}`);

  // BPS was missing entirely: tenant #4 has a logo and was still getting the
  // grey generic spinner on the site its owner is about to show customers.
  if (match("bpsplumbingandheating", "bps")) return "bps";
  if (match("amoservices", "amo-services")) return "amo-services";
  if (match("kdessexlandscapes", "kd-essex")) return "kd-essex";
  if (match("amorendering", "amo-rendering")) return "amo-rendering";
  return null;
}

function ZoneLoader() {
  const tenant = loaderTenant();

  // KD Essex — the brand mark fills with colour from the bottom up, the way the
  // ground itself gets built. Both layers are masked to the mark's own alpha, so
  // the colour is confined to the letterforms with no rectangle bleeding behind
  // them. Reduced motion gets the finished, filled mark and no animation.
  if (tenant === "kd-essex") {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="kd-loader" role="img" aria-label="Loading">
          <span className="kd-loader-base" />
          <span className="kd-loader-fill" />
        </div>
      </div>
    );
  }

  // BPS — the blue mark holds still and only the flame moves.
  if (tenant === "bps") return <BpsLoader />;

  if (tenant === "amo-services") {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-6">
          <img src="/amo-services/amo-services-logo.webp" alt="Loading" className="w-44 object-contain animate-pulse" />
          <div className="flex gap-2">
            {[0, 1, 2].map(i => (
              <span key={i} className="w-2.5 h-2.5 rounded-full animate-bounce" style={{ backgroundColor: "#7DB93F", animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }
  // AMO Rendering — its own spinning ring, now only when we know it IS AMO Rendering.
  if (tenant === "amo-rendering") {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <img src="/amo-logo-icon.webp" alt="Loading" className="w-16 h-16 object-contain" />
          <svg className="absolute inset-0 w-24 h-24 animate-spin" viewBox="0 0 96 96" fill="none">
            <circle cx="48" cy="48" r="44" stroke="#1F8CFF" strokeWidth="4" strokeLinecap="round" strokeDasharray="69 207"/>
          </svg>
        </div>
      </div>
    );
  }

  // Unknown tenant, or a platform zone (dashboard, portal, admin) — unbranded.
  return (
    <div className="flex h-screen items-center justify-center bg-white">
      <svg className="w-12 h-12" viewBox="0 0 48 48" fill="none" role="img" aria-label="Loading">
        <circle cx="24" cy="24" r="20" stroke="#E5E7EB" strokeWidth="3"/>
        <circle
          cx="24" cy="24" r="20"
          stroke="#9CA3AF" strokeWidth="3" strokeLinecap="round" strokeDasharray="34 92"
          className="motion-safe:animate-spin"
          style={{ transformOrigin: "center", animationDuration: "900ms" }}
        />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Role router — redirect after sign-in
// ---------------------------------------------------------------------------
function RoleRouter() {
  const { data: user, isLoading } = useGetMe();
  if (isLoading) return <div className="flex h-screen items-center justify-center text-slate-400 text-sm">Loading…</div>;
  if (!user) return <Redirect to="/sign-in" />;
  if (user.role === "SUPER_ADMIN") return <Redirect to="/admin" />;
  if (user.role === "TENANT_ADMIN" || user.role === "STAFF") return <Redirect to="/dashboard" />;
  return <Redirect to="/portal" />;
}

// ---------------------------------------------------------------------------
// Domain-based tenant routing
// ---------------------------------------------------------------------------
function DomainRouteGuard({ children }: { children: React.ReactNode }) {
  const hostname = window.location.hostname;
  // Falls back to the platform's own domain when the build-time var is absent, matching the
  // PUBLIC_BASE_URL || "https://bizzflowuk.com" convention already used across the API.
  // Without a default this evaluated to "", so the platform domain was NOT recognised as a known
  // host: every visitor to bizzflowuk.com fired resolve-domain against its own hostname, logged a
  // 404 in the console, and — because the guard renders <ZoneLoader/> while that request is in
  // flight — waited on a round-trip that could only ever fail before anything painted.
  const platformDomain = import.meta.env.VITE_PLATFORM_DOMAIN || "bizzflowuk.com";
  const isKnownHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === platformDomain ||
    hostname === `www.${platformDomain}` ||
    /^\d+\.\d+\.\d+\.\d+$/.test(hostname);

  const { data, isLoading, isError } = useResolveTenantDomain(
    { host: hostname },
    { query: { enabled: !isKnownHost, retry: false, staleTime: Infinity, gcTime: Infinity } as any }
  );

  if (!isKnownHost && isLoading) return <ZoneLoader />;
  const slug = (data as any)?.slug;
  if (!isKnownHost && !isError && slug) {
    return (
      <Suspense fallback={<ZoneLoader />}>
        <PublicSiteApp forcedSlug={slug} forcedBase="" />
      </Suspense>
    );
  }
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------------
/**
 * The platform's public homepage.
 *
 * A signed-in visitor still goes straight to their own workspace — that
 * redirect predates this page and is the reason anyone with an account never
 * sees marketing copy on the way in. Everyone else gets the BizzFlowUK site.
 *
 * The placeholder that used to live here (a dark slab with a headline and a
 * sign-in button) is gone.
 */
function LandingPage() {
  const { isSignedIn } = useAuthCtx();
  if (isSignedIn) return <RoleRouter />;
  return <BizzFlowHome />;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
function AppRoutes() {
  const { isSignedIn } = useAuthCtx();
  return (
    <DomainRouteGuard>
      <Suspense fallback={<ZoneLoader />}>
        <Switch>
          <Route path="/" component={LandingPage} />
          {/* Public: the invite token is the credential, so this must sit outside the signed-in gate. */}
          {/* A signed-in visitor has a workspace already; send them to it
              rather than offering to create a second one. */}
          <Route path="/signup">{() => isSignedIn ? <RoleRouter /> : <SignUpPage />}</Route>
          <Route path="/demo" component={BizzFlowDemo} />
          {/* The reference published the demo at /demo.html and links to it may
              already be out there. An alias, not a second implementation — the
              view query string is carried across so a shared deep link lands on
              the right screen. */}
          <Route path="/demo.html">
            {() => <Redirect to={`/demo${window.location.search}`} replace />}
          </Route>
          <Route path="/accept-invite" component={AcceptInvitePage} />
          <Route path="/sign-in">{() => isSignedIn ? <RoleRouter /> : <LoginForm />}</Route>
          <Route path="/dashboard/*?" component={DashboardApp} />
          <Route path="/portal/*?" component={PortalApp} />
          <Route path="/admin/*?" component={AdminApp} />
          <Route path="/site/:tenantSlug/*?">{() => <PublicSiteApp />}</Route>
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </DomainRouteGuard>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <AppRoutes />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
      <Toaster />
    </WouterRouter>
  );
}

export default App;
