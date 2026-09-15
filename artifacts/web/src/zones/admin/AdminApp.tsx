import { useAuthCtx, getStoredToken, beginSupportSession } from "@/lib/auth";
import { InviteUserPanel } from "./InviteUserPanel";
import { useGetMe, useGetPlatformStats, useListTenants, useCreateTenant, useGetTenant, useUpdateTenant, useDeleteTenant, useSuspendTenant, useGetTenantStats, useListUsers, useUpdateUser } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { Switch, Route, Link, useLocation, Redirect } from "wouter";

import { useQueryClient } from "@tanstack/react-query";
import { getListTenantsQueryKey, getListUsersQueryKey } from "@workspace/api-client-react";

/**
 * The platform admin zone — built for a phone first.
 *
 * This is the screen the platform owner actually uses, and he uses it from a
 * van, not a desk. A 192px sidebar on a 390px screen leaves under 200px for the
 * content, which is why every page here used to wrap its heading over four
 * lines and push its cards off the right edge.
 *
 * So the navigation changes shape rather than just shrinking:
 *   - phone: a compact top bar for identity and sign-out, and a fixed BOTTOM
 *     tab bar for navigation, where a thumb already is. Four destinations fit
 *     exactly, so there is no hamburger and no drawer state to get stuck open.
 *   - md and up: the original left sidebar, unchanged.
 *
 * Tables get the same treatment. A six-column table inside `overflow-x-auto` is
 * technically scrollable and practically unusable on a phone, so below `lg`
 * each row renders as a card instead — same data, same actions, no sideways
 * scrolling.
 */

const ROLES = ["SUPER_ADMIN", "TENANT_ADMIN", "STAFF", "CUSTOMER"] as const;

/**
 * A two-line fetch for the handful of admin routes that post-date the
 * generated API client.
 *
 * Deliberately local rather than importing the dashboard's `tradeApi`: that
 * would pull the dashboard's chunk into the admin bundle for the sake of one
 * function.
 */
async function adminRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null);
  // `reason` as well as `error`: the sync route reports its failure that way,
  // and swallowing it left the panel saying "Request failed (500)" when the
  // server had already explained exactly what was wrong.
  if (!res.ok) {
    const p = payload as any;
    throw new Error(p?.error || p?.reason || `Request failed (${res.status})`);
  }
  return payload as T;
}

const NAV = [
  { path: "/admin", label: "Overview", long: "Overview", icon: "M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6V11h-6v9Zm0-16v5h6V4h-6Z" },
  { path: "/admin/tenants", label: "Tenants", long: "Tenants", icon: "M4 20V9l8-5 8 5v11h-6v-6H10v6H4Z" },
  { path: "/admin/tenants/new", label: "Add", long: "Add Tenant", icon: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" },
  { path: "/admin/users", label: "Users", long: "Users", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z" },
];

/**
 * Active when it is the exact route, or a child of it.
 *
 * The two tenant entries overlap as strings, so they are handled explicitly:
 * "Add" must not stay lit while viewing an existing tenant, and "Tenants" must
 * not light up on the new-tenant form.
 */
function isActive(path: string, current: string): boolean {
  if (path === "/admin") return current === "/admin";
  if (path === "/admin/tenants") return current.startsWith("/admin/tenants") && current !== "/admin/tenants/new";
  return current === path || current.startsWith(path + "/");
}

function SignOutButton({ compact = false }: { compact?: boolean }) {
  const { signOut } = useAuthCtx();
  if (compact) {
    return (
      <button onClick={signOut} className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors">
        Sign out
      </button>
    );
  }
  return (
    <button onClick={signOut} className="w-full text-left px-3 py-2 rounded-md text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
      Sign out
    </button>
  );
}

/** Desktop only. Hidden below md, where the bottom bar takes over. */
function AdminSidebar({ currentPath }: { currentPath: string }) {
  return (
    <aside className="hidden md:flex w-48 flex-shrink-0 bg-slate-900 min-h-screen flex-col">
      <div className="p-4 border-b border-slate-800">
        <div className="font-bold text-white text-sm">BizzFlow</div>
        <div className="text-xs text-brand-400 font-medium mt-0.5">Super Admin</div>
      </div>
      <nav className="flex-1 p-3">
        {NAV.map(n => (
          <Link
            key={n.path}
            href={n.path}
            className={`flex items-center px-3 py-2 rounded-md text-xs font-medium mb-0.5 transition-colors ${
              isActive(n.path, currentPath) ? "bg-brand-500 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            {n.long}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <SignOutButton />
      </div>
    </aside>
  );
}

/** Phone only: identity and sign-out, so the bottom bar stays purely navigation. */
function AdminTopBar() {
  return (
    <header className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between bg-slate-900 px-4">
      <div className="min-w-0">
        <div className="font-bold text-white text-sm leading-tight">BizzFlow</div>
        <div className="text-[11px] text-brand-400 font-medium leading-tight">Super Admin</div>
      </div>
      <SignOutButton compact />
    </header>
  );
}

/**
 * Phone only. Fixed to the bottom because that is where a thumb rests, and
 * padded for the iPhone home indicator so the labels are not sitting under it.
 */
function AdminBottomNav({ currentPath }: { currentPath: string }) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-slate-800 bg-slate-900"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV.map(n => {
        const active = isActive(n.path, currentPath);
        return (
          <Link
            key={n.path}
            href={n.path}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
              active ? "text-brand-400" : "text-slate-400"
            }`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor"><path d={n.icon} /></svg>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * One heading treatment for every page, so nothing wraps into a four-line
 * column again. The back link sits on its own row above the title rather than
 * competing with it for horizontal space.
 */
function PageHeader({ title, back, badge, action }: {
  title: string;
  back?: { href: string; label: string };
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-600">
          <span aria-hidden="true">&larr;</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 min-w-0 break-words">{title}</h1>
        {badge}
        {action && <div className="ml-auto">{action}</div>}
      </div>
    </div>
  );
}

function StatusBadge({ suspended }: { suspended?: boolean }) {
  return suspended
    ? <span className="shrink-0 text-xs text-red-700 bg-red-50 rounded-full px-2 py-0.5 font-medium">Suspended</span>
    : <span className="shrink-0 text-xs text-green-700 bg-green-50 rounded-full px-2 py-0.5 font-medium">Active</span>;
}

/** Shared page padding — tighter on a phone, where 24px a side is real estate. */
const PAGE = "px-4 py-5 sm:p-6";

/**
 * `text-base` on phones is not a style choice: iOS Safari zooms the entire page
 * in whenever a focused input is under 16px, and it never zooms back out.
 */
const FIELD = "w-full rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

function AdminOverview() {
  const { data: stats, isLoading } = useGetPlatformStats();
  const s = stats as any;
  return (
    <div className={`${PAGE} space-y-5 sm:space-y-6`}>
      <PageHeader title="Platform Overview" />
      {isLoading ? <div className="text-center py-12 text-slate-400">Loading...</div> : (
        // Two up on a phone rather than one, so all three stay in view without
        // scrolling; the third spans both columns to fill the row.
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: 'Total Tenants', value: s?.tenants, color: 'text-blue-600', bg: 'bg-blue-50', span: false },
            { label: 'Total Leads', value: s?.leads, color: 'text-brand-600', bg: 'bg-brand-50', span: false },
            { label: 'Total Projects', value: s?.projects, color: 'text-green-600', bg: 'bg-green-50', span: true },
          ].map(card => (
            <div key={card.label} className={`rounded-xl ${card.bg} p-4 sm:p-6 border border-slate-200 ${card.span ? 'col-span-2 sm:col-span-1' : ''}`}>
              <div className={`text-3xl sm:text-4xl font-bold ${card.color}`}>{card.value ?? '-'}</div>
              <div className="text-xs sm:text-sm text-slate-600 mt-1 font-medium">{card.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TenantsPage() {
  const { data: tenants, isLoading } = useListTenants();
  const suspendMutation = useSuspendTenant();
  const deleteMutation = useDeleteTenant();
  const qc = useQueryClient();
  const handleSuspend = async (id: number, suspended: boolean) => {
    await suspendMutation.mutateAsync({ id, data: { suspended } } as any);
    qc.invalidateQueries({ queryKey: getListTenantsQueryKey() });
  };
  const handleDelete = async (id: number) => {
    if (!confirm('Delete this tenant? This cannot be undone.')) return;
    await deleteMutation.mutateAsync({ id });
    qc.invalidateQueries({ queryKey: getListTenantsQueryKey() });
  };
  const list = (tenants as any[]) || [];

  return (
    <div className={`${PAGE} space-y-4`}>
      <PageHeader
        title="Tenants"
        action={<Link href="/admin/tenants/new" className="inline-flex h-9 items-center rounded-md bg-brand-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-brand-400">+ Add</Link>}
      />

      {isLoading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">Loading...</div> : (
        <>
          {/* Phone: one card per tenant. A six-column table does not belong here. */}
          <div className="space-y-3 lg:hidden">
            {list.map((t: any) => (
              <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/admin/tenants/${t.id}`} className="font-semibold text-slate-900 hover:text-brand-600 min-w-0 break-words">{t.name}</Link>
                  <StatusBadge suspended={t.suspended} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <code className="bg-slate-100 rounded px-1.5 py-0.5">{t.slug}</code>
                  <span className="capitalize">{t.plan}</span>
                </div>
                {t.customDomain && <div className="text-xs text-slate-500 break-all">{t.customDomain}</div>}
                <div className="flex gap-2 pt-1">
                  <button onClick={() => handleSuspend(t.id, !t.suspended)} className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    {t.suspended ? 'Activate' : 'Suspend'}
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-xs font-medium text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: the table, unchanged. */}
          <div className="hidden lg:block rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Slug</th>
                  <th className="px-4 py-3 text-left">Custom Domain</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3"><Link href={`/admin/tenants/${t.id}`} className="font-medium text-slate-900 hover:text-brand-600">{t.name}</Link></td>
                      <td className="px-4 py-3"><code className="text-xs bg-slate-100 rounded px-1.5 py-0.5">{t.slug}</code></td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{t.customDomain || <span className="text-slate-300">&mdash;</span>}</td>
                      <td className="px-4 py-3 capitalize text-slate-600">{t.plan}</td>
                      <td className="px-4 py-3"><StatusBadge suspended={t.suspended} /></td>
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => handleSuspend(t.id, !t.suspended)} className="text-xs text-slate-500 hover:text-brand-600 underline">{t.suspended ? 'Activate' : 'Suspend'}</button>
                        <button onClick={() => handleDelete(t.id)} className="text-xs text-slate-500 hover:text-red-600 underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NewTenantPage() {
  const createMutation = useCreateTenant();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ name: '', slug: '', industry: 'rendering', plan: 'starter', primaryColor: '#007F72', email: '', phone: '', address: '', city: '', customDomain: '' });
  const [error, setError] = useState('');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await createMutation.mutateAsync({ data: form } as any);
      qc.invalidateQueries({ queryKey: getListTenantsQueryKey() });
      setLocation('/admin/tenants');
    } catch (err: any) {
      setError(err.message || 'Failed to create tenant');
    }
  };
  const f = (key: string, label: string, type = 'text', placeholder?: string, inputMode?: any, autoComplete?: string) => (
    <div key={key}><label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input type={type} inputMode={inputMode} autoComplete={autoComplete} placeholder={placeholder} className={FIELD} value={(form as any)[key]} onChange={e => setForm({...form, [key]: e.target.value})}/></div>
  );
  return (
    <div className={`${PAGE} max-w-xl space-y-5`}>
      <PageHeader title="New Tenant" back={{ href: "/admin/tenants", label: "Tenants" }} />
      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
        {f('name', 'Business Name *')}
        {f('slug', 'URL Slug * (e.g. amo-rendering)')}
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
          <select className={FIELD} value={form.industry} onChange={e => setForm({...form, industry: e.target.value})}>
            {['rendering','roofing','landscaping','plastering','driveway','painting','windows','general'].map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Plan</label>
          <select className={FIELD} value={form.plan} onChange={e => setForm({...form, plan: e.target.value})}>
            <option value="starter">Starter</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
          </select>
        </div>
        {f('email', 'Email', 'email', undefined, 'email', 'email')}
        {f('phone', 'Phone', 'tel', undefined, 'tel', 'tel')}
        {f('address', 'Address')}
        {f('city', 'City')}
        {f('customDomain', 'Custom Domain (optional)', 'text', 'e.g. www.mybusiness.co.uk')}
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Primary Colour</label>
          <input type="color" className="h-10 w-24 rounded-md border border-slate-300 px-1 py-1" value={form.primaryColor} onChange={e => setForm({...form, primaryColor: e.target.value})}/></div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={createMutation.isPending} className="w-full inline-flex h-11 items-center justify-center rounded-md bg-brand-500 text-sm font-semibold text-white hover:bg-brand-400 disabled:opacity-50">
          {createMutation.isPending ? 'Creating...' : 'Create Tenant'}
        </button>
      </form>
    </div>
  );
}

/** Label above value, so a long email can never collide with its own label. */
function Detail({ label, value, breakAll = false }: { label: string; value: React.ReactNode; breakAll?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-slate-900 ${breakAll ? 'break-all' : 'break-words'}`}>{value}</div>
    </div>
  );
}

function TenantDetailPage({ id }: { id: number }) {
  const { data: tenant, isLoading } = useGetTenant(id);
  const { data: stats } = useGetTenantStats(id);
  const suspendMutation = useSuspendTenant();
  const updateMutation = useUpdateTenant();
  const qc = useQueryClient();
  const t = tenant as any;
  const s = stats as any;
  const [customDomain, setCustomDomain] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);
  const [domainSaved, setDomainSaved] = useState(false);
  const [billing, setBilling] = useState<null | { mode: string; price: string; note: string }>(null);
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingSaved, setBillingSaved] = useState(false);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [placeBusy, setPlaceBusy] = useState<null | "save" | "sync">(null);
  const [placeResult, setPlaceResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [savedPlaceId, setSavedPlaceId] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [reviewSummary, setReviewSummary] = useState<{ rating: string | null; count: number | null; syncedAt: string | null } | null>(null);
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessResult, setAccessResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleResult, setSampleResult] = useState<{ ok: boolean; text: string } | null>(null);

  // These live on tenant_settings, which GET /tenants/:id does not return.
  useEffect(() => {
    let cancelled = false;
    adminRequest<any>("GET", `/tenants/${id}/settings`)
      .then(r => {
        if (cancelled) return;
        setSavedPlaceId(r?.googlePlaceId ?? null);
        setReviewSummary({ rating: r?.googleRating ?? null, count: r?.googleReviewCount ?? null, syncedAt: r?.googleReviewsSyncedAt ?? null });
      })
      .catch(() => { /* the panel still works; it just starts empty */ });
    return () => { cancelled = true; };
  }, [id]);

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"/></div>;
  if (!t) return <div className="p-8 text-center text-slate-500">Tenant not found</div>;

  const currentDomain = customDomain || t.customDomain || '';

  const handleSaveDomain = async () => {
    setSavingDomain(true);
    try {
      await updateMutation.mutateAsync({ id, data: { customDomain: currentDomain } } as any);
      setDomainSaved(true);
      setTimeout(() => setDomainSaved(false), 2000);
    } finally {
      setSavingDomain(false);
    }
  };

  // Local edits if there are any, otherwise whatever the tenant currently has.
  const b = billing ?? {
    mode: t.billingMode || 'self_serve',
    price: t.billingPriceGbp != null ? String(t.billingPriceGbp) : '',
    note: t.billingNote || '',
  };

  /**
   * Google reviews for a tenant we cannot log in as.
   *
   * Saving the Place ID and pulling the reviews are one action from here: the
   * only way to know a Place ID is the RIGHT one is to fetch with it, and
   * waiting for the nightly sweep to find out it was wrong is how a business
   * goes live with an empty reviews section.
   */
  const currentPlaceId = placeId ?? (savedPlaceId || '');

  const handleSavePlaceId = async () => {
    setPlaceBusy("save");
    setPlaceResult(null);
    try {
      await adminRequest("PATCH", `/tenants/${id}/settings`, { googlePlaceId: currentPlaceId });
      const sync = await adminRequest<{ ok: boolean; reason?: string; imported?: number; rating?: number; reviewCount?: number }>(
        "POST", `/tenants/${id}/sync-google-reviews`);
      setPlaceResult(sync.ok
        ? { ok: true, text: `Pulled ${sync.imported ?? 0} review${sync.imported === 1 ? '' : 's'}. Google shows ${sync.rating ?? '?'} from ${sync.reviewCount ?? '?'} ratings.` }
        : { ok: false, text: sync.reason || 'Google would not accept that Place ID.' });
    } catch (err: any) {
      setPlaceResult({ ok: false, text: err?.message || 'Could not save.' });
    } finally {
      setPlaceBusy(null);
    }
  };

  const handleSyncReviews = async () => {
    setPlaceBusy("sync");
    setPlaceResult(null);
    try {
      const sync = await adminRequest<{ ok: boolean; reason?: string; imported?: number; rating?: number; reviewCount?: number }>(
        "POST", `/tenants/${id}/sync-google-reviews`);
      setPlaceResult(sync.ok
        ? { ok: true, text: `Pulled ${sync.imported ?? 0} review${sync.imported === 1 ? '' : 's'}. Google shows ${sync.rating ?? '?'} from ${sync.reviewCount ?? '?'} ratings.` }
        : { ok: false, text: sync.reason || 'Sync failed.' });
    } catch (err: any) {
      setPlaceResult({ ok: false, text: err?.message || 'Sync failed.' });
    } finally {
      setPlaceBusy(null);
    }
  };

  /**
   * Reviews Google will not give us, and Facebook never will.
   *
   * The API caps at five, so a business with dozens shows five. The rest are
   * transcribed and pasted here. Verbatim — a reworded review is not that
   * person's review.
   */
  const handleImportReviews = async () => {
    setImportBusy(true);
    setImportResult(null);
    try {
      const parsed = JSON.parse(importText);
      const reviews = Array.isArray(parsed) ? parsed : parsed?.reviews;
      if (!Array.isArray(reviews)) throw new Error('Expected a JSON array of reviews.');
      const r = await adminRequest<{ inserted: number; skipped: number; problems: string[] }>(
        'POST', `/tenants/${id}/reviews/import`, { reviews });
      const bits = [`Added ${r.inserted}`];
      if (r.skipped) bits.push(`${r.skipped} already there`);
      if (r.problems?.length) bits.push(`${r.problems.length} skipped: ${r.problems[0]}`);
      setImportResult({ ok: true, text: bits.join(' · ') });
      if (r.inserted) setImportText('');
    } catch (err: any) {
      setImportResult({ ok: false, text: err?.message || 'Could not import.' });
    } finally {
      setImportBusy(false);
    }
  };

  /**
   * Go and work inside their dashboard for a bit.
   *
   * The support tool: their screens, their data, scoped to this one business,
   * expiring on its own in an hour. Nothing is left behind afterwards, which
   * is the difference between this and the permanent grant below.
   */
  const handleImpersonate = async () => {
    setAccessBusy(true);
    setAccessResult(null);
    try {
      const r = await adminRequest<{ token: string; tenant: { name: string } }>(
        'POST', `/tenants/${id}/impersonate`);
      beginSupportSession(r.token);
      // A full load rather than a client-side route change: every cached query
      // in memory belongs to the previous identity, and carrying one into a
      // customer's workspace would show them somebody else's figures.
      window.location.href = '/dashboard';
    } catch (err: any) {
      setAccessResult({ ok: false, text: err?.message || 'Could not start the session.' });
      setAccessBusy(false);
    }
  };

  /**
   * Sample data for a walkthrough, and taking it out again.
   *
   * Safe on a live tenant: every seeded row is flagged, so removal targets
   * exactly those rows and cannot reach a real customer or invoice.
   */
  const handleSampleData = async (action: "add" | "remove") => {
    if (action === "remove" && !confirm("Remove all the sample data from this business? Their real customers, jobs and invoices are not touched.")) return;
    setSampleBusy(true);
    setSampleResult(null);
    try {
      if (action === "add") {
        const r = await adminRequest<{ message: string; counts: Record<string, number> }>(
          "POST", `/tenants/${id}/sample-data`);
        setSampleResult({ ok: true, text: r.message });
      } else {
        const r = await adminRequest<{ removed: number }>("DELETE", `/tenants/${id}/sample-data`);
        setSampleResult({ ok: true, text: `${r.removed} sample records removed.` });
      }
    } catch (err: any) {
      setSampleResult({ ok: false, text: err?.message || "That did not work." });
    } finally {
      setSampleBusy(false);
    }
  };

  const handleSaveBilling = async () => {
    setSavingBilling(true);
    try {
      const price = b.price.trim();
      await updateMutation.mutateAsync({ id, data: {
        billingMode: b.mode,
        // Empty means "the standard price", which is null rather than 0 —
        // a 0 here would render as "£0 a month" on their billing screen.
        billingPriceGbp: price === '' ? null : price,
        billingNote: b.note.trim() || null,
      } } as any);
      setBillingSaved(true);
      setTimeout(() => setBillingSaved(false), 2000);
    } finally {
      setSavingBilling(false);
    }
  };

  return (
    <div className={`${PAGE} space-y-5 sm:space-y-6 max-w-3xl`}>
      <PageHeader
        title={t.name}
        back={{ href: "/admin/tenants", label: "Tenants" }}
        badge={<StatusBadge suspended={t.suspended} />}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {[{label:'Leads',value:s?.leads},{label:'Projects',value:s?.projects}].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">{c.value ?? '-'}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3 text-sm">
        <h2 className="font-semibold text-slate-900">Details</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Detail label="Slug" value={<code className="font-mono text-xs">{t.slug}</code>} />
          <Detail label="Industry" value={<span className="capitalize">{t.industry}</span>} />
          <Detail label="Plan" value={<span className="capitalize">{t.plan}</span>} />
          <Detail label="City" value={t.city || '-'} />
          <Detail label="Phone" value={t.phone ? <a href={`tel:${t.phone}`} className="text-brand-600">{t.phone}</a> : '-'} />
          <Detail label="Created" value={t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB') : '-'} />
          {/* Full width: an email is the one field that reliably overflows. */}
          <div className="col-span-2">
            <Detail label="Email" breakAll value={t.email ? <a href={`mailto:${t.email}`} className="text-brand-600">{t.email}</a> : '-'} />
          </div>
        </div>
      </div>

      {/* Getting into their dashboard without asking for their password. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">Support</h2>
        <p className="text-xs text-slate-500">
          Opens their dashboard as them &mdash; same screens, same data, scoped to this business
          only. The platform console is closed while you are in it. It ends by itself after an
          hour, or when you press Leave on the banner, and leaves nothing behind.
        </p>
        <p className="text-xs text-amber-700">
          Their live workspace: real customers, real invoices. Anything you change, they keep.
        </p>
        <button
          type="button"
          onClick={handleImpersonate}
          disabled={accessBusy}
          className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {accessBusy ? 'Opening…' : `Log in as ${t.name}`}
        </button>
        {accessResult && !accessResult.ok && (
          <p className="text-xs text-red-600">{accessResult.text}</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">Sample Data</h2>
        <p className="text-xs text-slate-500">
          Fills this business with believable made-up customers, jobs, invoices and enquiries so
          every screen has something on it for a walkthrough. Work appears in this week&rsquo;s diary,
          invoices in every state including one overdue, and money in and out.
        </p>
        <p className="text-xs text-slate-500">
          Every sample record is flagged, so removing it takes out exactly those and leaves their
          real customers, jobs and invoices alone.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => handleSampleData("add")} disabled={sampleBusy}
            className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {sampleBusy ? "Working…" : "Add sample data"}
          </button>
          <button type="button" onClick={() => handleSampleData("remove")} disabled={sampleBusy}
            className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold text-slate-500 hover:text-red-600 disabled:opacity-50">
            Remove it
          </button>
        </div>
        {sampleResult && (
          <p className={`text-xs ${sampleResult.ok ? "text-green-700" : "text-red-600"}`}>{sampleResult.text}</p>
        )}
      </div>

      {/* Custom Domain section */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Custom Domain</h2>
        <p className="text-xs text-slate-500">
          Point the tenant&rsquo;s own domain to this site. The domain must resolve to this server&rsquo;s IP
          <strong> and</strong> be added to the hosting platform&rsquo;s domain list &mdash; DNS alone is not enough,
          and a domain saved here that is not routed will simply 404.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="www.mybusiness.co.uk"
            className="flex-1 min-w-0 rounded-md border border-slate-300 px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={customDomain || t.customDomain || ''}
            onChange={e => setCustomDomain(e.target.value)}
          />
          <button
            onClick={handleSaveDomain}
            disabled={savingDomain}
            className="inline-flex h-11 sm:h-9 shrink-0 items-center justify-center rounded-md bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-400 disabled:opacity-50"
          >
            {savingDomain ? 'Saving…' : domainSaved ? '✓ Saved' : 'Save'}
          </button>
        </div>
        {currentDomain && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 sm:p-4 space-y-3">
            <p className="text-slate-500 text-xs font-medium">DNS &mdash; add one of these records at your domain registrar:</p>
            {[
              { type: 'A', name: currentDomain.replace(/^www\./, '') || '@', value: '<your-server-ip>' },
              { type: 'CNAME', name: 'www', value: window.location.hostname },
            ].map((rec, i) => (
              <div key={rec.type}>
                {i === 1 && <div className="text-xs text-slate-400 mb-2">&mdash; or &mdash;</div>}
                <div className="grid grid-cols-[3.5rem_1fr] gap-x-3 gap-y-1 text-xs">
                  <span className="text-slate-400">Type</span><span className="font-mono text-blue-600">{rec.type}</span>
                  <span className="text-slate-400">Name</span><span className="font-mono text-slate-700 break-all">{rec.name}</span>
                  <span className="text-slate-400">Value</span><span className="font-mono text-slate-700 break-all">{rec.value}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/*
        Google reviews.
        ---------------
        Their reviews live where their customers put them. This is here rather
        than only in the tenant's own settings because onboarding happens before
        they have ever logged in — and we do not have, and should not have,
        their password.
      */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Google reviews</h2>
        <p className="text-xs text-slate-500">
          Paste the Google Place ID from their Business Profile. Saving pulls their reviews
          straight away so you can see it worked — Google returns the headline rating and
          total, but only five individual reviews. That is their limit, not ours.
        </p>

        <input
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ChIJ…"
          className={`${FIELD} font-mono`}
          value={currentPlaceId}
          onChange={e => setPlaceId(e.target.value)}
        />

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleSavePlaceId}
            disabled={placeBusy !== null || !currentPlaceId.trim()}
            className="inline-flex h-11 sm:h-9 items-center justify-center rounded-md bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-400 disabled:opacity-50"
          >
            {placeBusy === "save" ? 'Saving and pulling…' : 'Save and pull reviews'}
          </button>
          <button
            type="button"
            onClick={handleSyncReviews}
            disabled={placeBusy !== null || !savedPlaceId}
            className="inline-flex h-11 sm:h-9 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {placeBusy === "sync" ? 'Pulling…' : 'Pull again'}
          </button>
        </div>

        {placeResult && (
          <p className={`text-sm ${placeResult.ok ? 'text-green-700' : 'text-red-600'}`}>
            {placeResult.ok ? '✓ ' : ''}{placeResult.text}
          </p>
        )}

        {/* What is already stored, so the panel says something before you touch it. */}
        {!placeResult && reviewSummary?.syncedAt && (
          <p className="text-xs text-slate-500">
            Currently showing {reviewSummary.rating ?? '?'} from {reviewSummary.count ?? '?'} ratings,
            last pulled {new Date(reviewSummary.syncedAt).toLocaleDateString('en-GB')}.
          </p>
        )}

        <div className="pt-4 border-t border-slate-200 space-y-3">
          <h3 className="font-medium text-slate-900 text-sm">Import the rest by hand</h3>
          <p className="text-xs text-slate-500">
            Google only ever returns five. Paste the others here as JSON &mdash; an array of
            <code className="mx-1 bg-slate-100 rounded px-1">{'{reviewerName, rating, content, platform, sourceCreatedAt}'}</code>
            &mdash; transcribed word for word. Pasting the same list twice adds nothing.
          </p>
          <textarea
            rows={5}
            spellCheck={false}
            placeholder='[{"reviewerName": "Jane Smith", "rating": 5, "content": "…", "platform": "Facebook", "sourceCreatedAt": "2020-03-09"}]'
            className={`${FIELD} font-mono text-xs`}
            value={importText}
            onChange={e => setImportText(e.target.value)}
          />
          <button
            type="button"
            onClick={handleImportReviews}
            disabled={importBusy || !importText.trim()}
            className="inline-flex h-11 sm:h-9 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {importBusy ? 'Importing…' : 'Import reviews'}
          </button>
          {importResult && (
            <p className={`text-sm ${importResult.ok ? 'text-green-700' : 'text-red-600'}`}>
              {importResult.ok ? '✓ ' : ''}{importResult.text}
            </p>
          )}
        </div>
      </section>

      {/*
        Billing arrangement.
        ---------------------
        The platform sells one plan at £99 through Stripe Checkout. Anyone on a
        negotiated deal — a different price, or a bundle we invoice directly —
        must NOT be shown that button, or their dashboard will happily take a
        second payment from someone already paying us more.
      */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <h2 className="font-semibold text-slate-900">Billing arrangement</h2>

        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">How they pay</span>
          <select
            className={FIELD}
            value={b.mode}
            onChange={e => setBilling({ ...b, mode: e.target.value })}
          >
            <option value="self_serve">Standard — they subscribe themselves through Stripe</option>
            <option value="managed">Managed — we invoice them directly, no button shown</option>
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">Monthly price (£)</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="99 — leave empty for the standard price"
            className={FIELD}
            value={b.price}
            onChange={e => setBilling({ ...b, price: e.target.value })}
          />
          <span className="block text-xs text-slate-500 mt-1">
            Shown on their billing screen. It never charges anything — what a standard
            tenant is actually charged comes from the Stripe price.
          </span>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">What it covers</span>
          <textarea
            rows={3}
            placeholder="e.g. £100 Google Ads management and £65 for BizzFlowUK and the website."
            className={FIELD}
            value={b.note}
            onChange={e => setBilling({ ...b, note: e.target.value })}
          />
          <span className="block text-xs text-slate-500 mt-1">
            They see this, so write it the way you would say it to them.
          </span>
        </label>

        <button
          type="button"
          onClick={handleSaveBilling}
          disabled={savingBilling}
          className="inline-flex h-11 sm:h-9 items-center justify-center rounded-md bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-400 disabled:opacity-50"
        >
          {savingBilling ? 'Saving…' : billingSaved ? '✓ Saved' : 'Save billing'}
        </button>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <a href={`/site/${t.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-11 sm:h-9 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">View Public Site</a>
        <button onClick={async () => { await suspendMutation.mutateAsync({ id, data: { suspended: !t.suspended } } as any); qc.invalidateQueries(); }} className={`inline-flex h-11 sm:h-9 items-center justify-center rounded-md px-4 text-sm font-medium text-white ${t.suspended ? 'bg-green-600 hover:bg-green-500' : 'bg-amber-600 hover:bg-amber-500'}`}>
          {t.suspended ? 'Activate Tenant' : 'Suspend Tenant'}
        </button>
      </div>
    </div>
  );
}

function UsersPage() {
  const { data: users, isLoading } = useListUsers();
  const { data: tenants } = useListTenants();
  const updateMutation = useUpdateUser();
  const qc = useQueryClient();
  const [saving, setSaving] = useState<number | null>(null);
  const tenantList = (tenants as any[]) || [];

  const handleUpdate = async (id: number, role: string, tenantId: number | null) => {
    setSaving(id);
    try {
      await updateMutation.mutateAsync({ id, data: { role: role as any, tenantId } });
      qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } finally {
      setSaving(null);
    }
  };

  const list = (users as any[]) || [];

  return (
    <div className={`${PAGE} space-y-4`}>
      <PageHeader title="Users" />
      <InviteUserPanel tenants={tenantList} onCreated={() => qc.invalidateQueries({ queryKey: getListUsersQueryKey() })} />

      {isLoading ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">Loading...</div> : (
        <>
          <div className="space-y-3 lg:hidden">
            {list.map((u: any) => (
              <UserCard key={u.id} user={u} tenants={tenantList} saving={saving === u.id} onSave={(role, tenantId) => handleUpdate(u.id, role, tenantId)} />
            ))}
          </div>

          <div className="hidden lg:block rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Tenant</th>
                  <th className="px-4 py-3 text-left">Joined</th>
                  <th className="px-4 py-3 text-left">Save</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((u: any) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      tenants={tenantList}
                      saving={saving === u.id}
                      onSave={(role, tenantId) => handleUpdate(u.id, role, tenantId)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Phone equivalent of UserRow — same two controls, same save. */
function UserCard({ user, tenants, saving, onSave }: { user: any; tenants: any[]; saving: boolean; onSave: (role: string, tenantId: number | null) => void }) {
  const [role, setRole] = useState(user.role);
  const [tenantId, setTenantId] = useState<string>(user.tenantId?.toString() || '');
  const select = "w-full rounded-md border border-slate-300 px-2 py-2 text-base sm:text-sm focus:outline-none focus:ring-1 focus:ring-brand-500";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="min-w-0">
        <div className="font-medium text-slate-900 break-all">{user.email}</div>
        <div className="text-xs text-slate-500">
          {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'No name'}
          {user.createdAt ? ` · joined ${new Date(user.createdAt).toLocaleDateString('en-GB')}` : ''}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block min-w-0">
          <span className="block text-xs text-slate-500 mb-1">Role</span>
          <select value={role} onChange={e => setRole(e.target.value)} className={select}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="block text-xs text-slate-500 mb-1">Tenant</span>
          <select value={tenantId} onChange={e => setTenantId(e.target.value)} className={select}>
            <option value="">&mdash; none &mdash;</option>
            {tenants.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      </div>
      <button
        disabled={saving}
        onClick={() => onSave(role, tenantId ? Number(tenantId) : null)}
        className="w-full inline-flex h-10 items-center justify-center rounded-md bg-brand-500 px-3 text-sm font-medium text-white hover:bg-brand-400 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

function UserRow({ user, tenants, saving, onSave }: { user: any; tenants: any[]; saving: boolean; onSave: (role: string, tenantId: number | null) => void }) {
  const [role, setRole] = useState(user.role);
  const [tenantId, setTenantId] = useState<string>(user.tenantId?.toString() || '');
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 text-slate-900">{user.email}</td>
      <td className="px-4 py-3 text-slate-600">{[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}</td>
      <td className="px-4 py-3">
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          value={tenantId}
          onChange={e => setTenantId(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 max-w-[140px]"
        >
          <option value="">&mdash; none &mdash;</option>
          {tenants.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </td>
      <td className="px-4 py-3 text-slate-400 text-xs">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-GB') : '—'}</td>
      <td className="px-4 py-3">
        <button
          disabled={saving}
          onClick={() => onSave(role, tenantId ? Number(tenantId) : null)}
          className="inline-flex h-7 items-center rounded bg-brand-500 px-3 text-xs font-medium text-white hover:bg-brand-400 disabled:opacity-50"
        >
          {saving ? '…' : 'Save'}
        </button>
      </td>
    </tr>
  );
}

export default function AdminApp() {
  const { isSignedIn } = useAuthCtx();
  const { data: me } = useGetMe();
  const [location] = useLocation();
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (me && me.role !== 'SUPER_ADMIN') return <div className="flex h-screen items-center justify-center p-6 text-center text-slate-500">Access denied. Super Admin required.</div>;
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar currentPath={location}/>
      {/* min-w-0 stops a wide desktop table from forcing the whole shell sideways. */}
      <div className="flex-1 min-w-0 flex flex-col">
        <AdminTopBar />
        {/*
          Bottom padding clears the fixed phone nav plus the home indicator.
          An inline style is used because the value has to be a calc() over
          env(), which a utility class cannot express; md:pb-0 cannot override
          an inline style, so the padding is simply harmless on desktop where
          there is no bottom bar.
        */}
        <main className="flex-1 min-w-0" style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}>
          <Switch>
            <Route path="/admin" component={AdminOverview}/>
            <Route path="/admin/tenants" component={TenantsPage}/>
            <Route path="/admin/tenants/new" component={NewTenantPage}/>
            <Route path="/admin/tenants/:id" component={({ params: p }) => <TenantDetailPage id={Number(p.id)}/>}/>
            <Route path="/admin/users" component={UsersPage}/>
          </Switch>
        </main>
      </div>
      <AdminBottomNav currentPath={location}/>
    </div>
  );
}
