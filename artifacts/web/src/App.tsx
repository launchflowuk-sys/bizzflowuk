import { lazy, Suspense, useState } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe, setAuthTokenGetter, setUnauthorizedHandler, useResolveTenantDomain } from "@workspace/api-client-react";
import { AuthProvider, useAuthCtx, getStoredToken, clearStoredToken } from "@/lib/auth";

import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Wire the API client to read our JWT on every request
setAuthTokenGetter(() => Promise.resolve(getStoredToken()));

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
    <div className="min-h-[100dvh] flex bg-[#0A121C]">
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 bg-gradient-to-br from-[#0A121C] via-[#0d1a2e] to-[#0A121C] border-r border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[#1F8CFF]/8 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#1F8CFF]/5 rounded-full blur-[100px] translate-x-1/4 translate-y-1/4" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-9 h-9 rounded-lg bg-[#1F8CFF] flex items-center justify-center font-bold text-white text-sm">L</div>
            <span className="text-white font-bold text-xl tracking-tight">BizzFlow</span>
          </div>
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-[#1F8CFF]/10 border border-[#1F8CFF]/20 rounded-full px-4 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#1F8CFF]" />
              <span className="text-[#1F8CFF] text-xs font-semibold tracking-wider uppercase">Home Improvement Platform</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              The operating system for trades businesses
            </h1>
            <p className="text-slate-400 text-lg leading-relaxed max-w-md">
              Websites, CRM, quoting, project management, and customer portals — everything under your brand.
            </p>
          </div>
        </div>
        <div className="relative z-10 space-y-4">
          {[
            { icon: "🌐", label: "Professional public website", desc: "Full marketing site with services, gallery & lead capture" },
            { icon: "📋", label: "CRM & quote management", desc: "Convert leads to signed quotes in minutes" },
            { icon: "👤", label: "Customer portal", desc: "Self-service portal for project tracking & communication" },
          ].map((f) => (
            <div key={f.label} className="flex items-start gap-4 p-4 rounded-xl bg-white/3 border border-white/5">
              <span className="text-2xl mt-0.5">{f.icon}</span>
              <div>
                <div className="text-white font-semibold text-sm">{f.label}</div>
                <div className="text-slate-500 text-xs mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 bg-[#0A121C]">
        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <div className="w-8 h-8 rounded-lg bg-[#1F8CFF] flex items-center justify-center font-bold text-white text-xs">L</div>
          <span className="text-white font-bold text-lg tracking-tight">BizzFlow</span>
        </div>
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white">Sign in</h2>
            <p className="text-slate-400 text-sm mt-1">Enter your credentials to continue</p>
          </div>
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-red-400 text-sm">{error}</div>
          )}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Email address</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email" placeholder="you@example.com"
              className="w-full rounded-xl bg-[#1A2535] border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#1F8CFF] focus:ring-1 focus:ring-[#1F8CFF] transition"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-300">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required autoComplete="current-password" placeholder="••••••••"
              className="w-full rounded-xl bg-[#1A2535] border border-white/10 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#1F8CFF] focus:ring-1 focus:ring-[#1F8CFF] transition"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full rounded-xl bg-[#1F8CFF] hover:bg-[#1a7ae6] disabled:opacity-60 px-4 py-3 text-white font-semibold text-sm transition"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-8 text-center text-xs text-slate-600">© {new Date().getFullYear()} BizzFlow. All rights reserved.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zone lazy imports
// ---------------------------------------------------------------------------
const DashboardApp = lazy(() => import("@/zones/dashboard/DashboardApp"));
const PortalApp = lazy(() => import("@/zones/portal/PortalApp"));
const AdminApp = lazy(() => import("@/zones/admin/AdminApp"));
const PublicSiteApp = lazy(() => import("@/zones/public/TenantSiteRouter"));

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
function loaderTenant(): "amo-services" | "amo-rendering" | "kd-essex" | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  const path = window.location.pathname;
  const match = (domain: string, slug: string) => host.includes(domain) || path.startsWith(`/site/${slug}`);

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
function LandingPage() {
  const { isSignedIn } = useAuthCtx();
  if (isSignedIn) return <RoleRouter />;
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="font-bold text-xl tracking-tight">BizzFlow</div>
        <a href={`${basePath}/sign-in`} className="text-sm text-slate-400 hover:text-white transition-colors">Sign in</a>
      </nav>
      <div className="max-w-7xl mx-auto px-6 py-24 text-center space-y-8">
        <div className="inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs text-orange-400 font-medium">
          Built for home improvement professionals
        </div>
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
          The operating system<br />for home improvement<br />businesses
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          Websites, CRM, quotes, projects, customer portal — everything a modern trades business needs.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <a href={`${basePath}/sign-in`} className="inline-flex h-12 items-center justify-center rounded-md bg-orange-500 px-8 text-sm font-semibold text-white shadow-lg hover:bg-orange-400 transition-colors">Sign in</a>
          <a href={`${basePath}/site/amo-rendering`} className="inline-flex h-12 items-center justify-center rounded-md border border-slate-700 bg-transparent px-8 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors">View demo site</a>
        </div>
      </div>
    </div>
  );
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
