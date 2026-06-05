import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetMe, setAuthTokenGetter } from "@workspace/api-client-react";

import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  variables: {
    colorPrimary: "hsl(24 98% 50%)",
  },
};

function AuthTokenSetup() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsub = addListener(({ user }) => {
      const uid = user?.id ?? null;
      if (prevRef.current !== undefined && prevRef.current !== uid) qc.clear();
      prevRef.current = uid;
    });
    return unsub;
  }, [addListener, qc]);
  return null;
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function RoleRouter() {
  const { data: user, isLoading } = useGetMe();
  if (isLoading) return <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">Loading...</div>;
  if (!user) return <Redirect to="/" />;
  if (user.role === 'SUPER_ADMIN') return <Redirect to="/admin" />;
  if (user.role === 'TENANT_ADMIN' || user.role === 'STAFF') return <Redirect to="/dashboard" />;
  return <Redirect to="/portal" />;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in"><RoleRouter /></Show>
      <Show when="signed-out"><LandingPage /></Show>
    </>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="font-bold text-xl tracking-tight">LaunchFlow</div>
        <div className="flex items-center gap-3">
          <a href={`${basePath}/sign-in`} className="text-sm text-slate-400 hover:text-white transition-colors">Sign in</a>
          <a href={`${basePath}/sign-up`} className="inline-flex h-9 items-center justify-center rounded-md bg-orange-500 px-4 text-sm font-medium text-white shadow hover:bg-orange-400 transition-colors">Get started</a>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto px-6 py-24 text-center space-y-8">
        <div className="inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs text-orange-400 font-medium">
          Built for home improvement professionals
        </div>
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
          The operating system<br />for home improvement<br />businesses
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
          Websites, CRM, quotes, projects, customer portal — everything a modern trades business needs, white-labelled and ready to go.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <a href={`${basePath}/sign-up`} className="inline-flex h-12 items-center justify-center rounded-md bg-orange-500 px-8 text-sm font-semibold text-white shadow-lg hover:bg-orange-400 transition-colors">
            Start free trial
          </a>
          <a href={`${basePath}/site/amo-rendering`} className="inline-flex h-12 items-center justify-center rounded-md border border-slate-700 bg-transparent px-8 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors">
            View demo site
          </a>
        </div>
        <div className="pt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
          {[
            { title: "Public Website", desc: "Professional tenant websites with services, gallery, blog, and lead capture — all managed from your dashboard." },
            { title: "CRM & Operations", desc: "Leads, quotes, projects, and customers in one place. Convert enquiries to invoices in seconds." },
            { title: "Customer Portal", desc: "Give your customers a self-service portal to track their project, view quotes, and send messages." },
          ].map(f => (
            <div key={f.title} className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-3">
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Lazy-loaded zone components
import { lazy, Suspense } from "react";
const DashboardApp = lazy(() => import("@/zones/dashboard/DashboardApp"));
const PortalApp = lazy(() => import("@/zones/portal/PortalApp"));
const AdminApp = lazy(() => import("@/zones/admin/AdminApp"));
const PublicSiteApp = lazy(() => import("@/zones/public/PublicSiteApp"));

function ZoneLoader() {
  return <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">Loading...</div>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <AuthTokenSetup />
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Suspense fallback={<ZoneLoader />}>
            <Switch>
              <Route path="/" component={HomeRedirect} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route path="/dashboard/*?" component={DashboardApp} />
              <Route path="/portal/*?" component={PortalApp} />
              <Route path="/admin/*?" component={AdminApp} />
              <Route path="/site/:tenantSlug/*?" component={PublicSiteApp} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
      <Toaster />
    </WouterRouter>
  );
}

export default App;
