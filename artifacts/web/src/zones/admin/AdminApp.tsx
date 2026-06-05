import { useUser, SignIn, UserButton } from "@clerk/react";
import { useGetMe, useGetPlatformStats, useListTenants, useCreateTenant, useGetTenant, useUpdateTenant, useDeleteTenant, useSuspendTenant, useGetTenantStats } from "@workspace/api-client-react";
import { useState } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getListTenantsQueryKey } from "@workspace/api-client-react";

function AdminSidebar({ currentPath }: { currentPath: string }) {
  const nav = [
    { path: '/admin', label: 'Overview' },
    { path: '/admin/tenants', label: 'Tenants' },
    { path: '/admin/tenants/new', label: 'Add Tenant' },
  ];
  return (
    <aside className="w-48 flex-shrink-0 bg-slate-900 min-h-screen flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <div className="font-bold text-white text-sm">LaunchFlow</div>
        <div className="text-xs text-orange-400 font-medium mt-0.5">Super Admin</div>
      </div>
      <nav className="flex-1 p-3">
        {nav.map(n => (
          <Link key={n.path} href={n.path} className={`flex items-center px-3 py-2 rounded-md text-xs font-medium mb-0.5 transition-colors ${currentPath === n.path ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{n.label}</Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <UserButton appearance={{ elements: { avatarBox: 'w-7 h-7' } }}/>
      </div>
    </aside>
  );
}

function AdminOverview() {
  const { data: stats, isLoading } = useGetPlatformStats();
  const s = stats as any;
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Platform Overview</h1>
      {isLoading ? <div className="text-center py-12 text-slate-400">Loading...</div> : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Tenants', value: s?.tenants, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Total Leads', value: s?.leads, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Total Projects', value: s?.projects, color: 'text-green-600', bg: 'bg-green-50' },
          ].map(card => (
            <div key={card.label} className={`rounded-xl ${card.bg} p-6 border border-slate-200`}>
              <div className={`text-4xl font-bold ${card.color}`}>{card.value ?? '-'}</div>
              <div className="text-sm text-slate-600 mt-1 font-medium">{card.label}</div>
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
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Tenants</h1>
        <Link href="/admin/tenants/new" className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add Tenant</Link>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Slug</th><th className="text-left px-4 py-3">Industry</th><th className="text-left px-4 py-3">Plan</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Created</th><th className="px-4 py-3"/>
              </tr></thead>
              <tbody>
                {!(tenants as any[])?.length ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No tenants yet</td></tr>
                : (tenants as any[]).map((t: any) => (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/admin/tenants/${t.id}`} className="hover:text-orange-600">{t.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{t.slug}</td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{t.industry}</td>
                    <td className="px-4 py-3 text-slate-600 capitalize">{t.plan}</td>
                    <td className="px-4 py-3">
                      {t.suspended ? <span className="text-xs font-medium text-red-600 bg-red-50 rounded-full px-2 py-0.5">Suspended</span> : <span className="text-xs font-medium text-green-600 bg-green-50 rounded-full px-2 py-0.5">Active</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB') : '-'}</td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <a href={`/site/${t.slug}`} target="_blank" className="text-xs text-blue-500 hover:text-blue-700">View Site</a>
                      <button onClick={() => handleSuspend(t.id, !t.suspended)} className={`text-xs ${t.suspended ? 'text-green-500 hover:text-green-700' : 'text-amber-500 hover:text-amber-700'}`}>{t.suspended ? 'Activate' : 'Suspend'}</button>
                      <button onClick={() => handleDelete(t.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function NewTenantPage() {
  const createMutation = useCreateTenant();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ name: '', slug: '', industry: 'rendering', plan: 'starter', primaryColor: '#f97316', email: '', phone: '', address: '', city: '' });
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
  const f = (key: string, label: string, type = 'text') => (
    <div key={key}><label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input type={type} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={(form as any)[key]} onChange={e => setForm({...form, [key]: e.target.value})}/></div>
  );
  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/tenants" className="text-sm text-slate-500 hover:text-orange-500">&larr; Tenants</Link>
        <h1 className="text-2xl font-bold text-slate-900">New Tenant</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-slate-200 p-6">
        {f('name', 'Business Name *')}
        {f('slug', 'URL Slug * (e.g. amo-rendering)')}
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
          <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.industry} onChange={e => setForm({...form, industry: e.target.value})}>
            {['rendering','roofing','landscaping','plastering','driveway','painting','windows','general'].map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Plan</label>
          <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={form.plan} onChange={e => setForm({...form, plan: e.target.value})}>
            <option value="starter">Starter</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
          </select>
        </div>
        {f('email', 'Email')}
        {f('phone', 'Phone')}
        {f('address', 'Address')}
        {f('city', 'City')}
        <div><label className="block text-sm font-medium text-slate-700 mb-1">Primary Colour</label>
          <input type="color" className="h-10 w-24 rounded-md border border-slate-300 px-1 py-1" value={form.primaryColor} onChange={e => setForm({...form, primaryColor: e.target.value})}/></div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={createMutation.isPending} className="w-full inline-flex h-10 items-center justify-center rounded-md bg-orange-500 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">
          {createMutation.isPending ? 'Creating...' : 'Create Tenant'}
        </button>
      </form>
    </div>
  );
}

function TenantDetailPage({ id }: { id: number }) {
  const { data: tenant, isLoading } = useGetTenant(id);
  const { data: stats } = useGetTenantStats(id);
  const suspendMutation = useSuspendTenant();
  const qc = useQueryClient();
  const t = tenant as any;
  const s = stats as any;
  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/></div>;
  if (!t) return <div className="p-8 text-center text-slate-500">Tenant not found</div>;
  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href="/admin/tenants" className="text-sm text-slate-500 hover:text-orange-500">&larr; Tenants</Link>
        <h1 className="text-2xl font-bold text-slate-900">{t.name}</h1>
        {t.suspended ? <span className="text-xs text-red-600 bg-red-50 rounded-full px-2 py-0.5 font-medium">Suspended</span> : <span className="text-xs text-green-600 bg-green-50 rounded-full px-2 py-0.5 font-medium">Active</span>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[{label:'Leads',value:s?.leads},{label:'Projects',value:s?.projects}].map(c => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-3xl font-bold text-slate-900">{c.value ?? '-'}</div>
            <div className="text-xs text-slate-500 font-medium mt-1">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 text-sm">
        <h2 className="font-semibold text-slate-900">Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div><span className="text-slate-500">Slug:</span> <code className="text-slate-900 font-mono text-xs">{t.slug}</code></div>
          <div><span className="text-slate-500">Industry:</span> <span className="text-slate-900 capitalize">{t.industry}</span></div>
          <div><span className="text-slate-500">Plan:</span> <span className="text-slate-900 capitalize">{t.plan}</span></div>
          <div><span className="text-slate-500">Email:</span> <span className="text-slate-900">{t.email || '-'}</span></div>
          <div><span className="text-slate-500">Phone:</span> <span className="text-slate-900">{t.phone || '-'}</span></div>
          <div><span className="text-slate-500">City:</span> <span className="text-slate-900">{t.city || '-'}</span></div>
          <div><span className="text-slate-500">Created:</span> <span className="text-slate-900">{t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB') : '-'}</span></div>
        </div>
      </div>
      <div className="flex gap-3">
        <a href={`/site/${t.slug}`} target="_blank" className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">View Public Site</a>
        <button onClick={async () => { await suspendMutation.mutateAsync({ id, data: { suspended: !t.suspended } } as any); qc.invalidateQueries(); }} className={`inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-white ${t.suspended ? 'bg-green-500 hover:bg-green-400' : 'bg-amber-500 hover:bg-amber-400'}`}>
          {t.suspended ? 'Activate Tenant' : 'Suspend Tenant'}
        </button>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const { isSignedIn, isLoaded } = useUser();
  const { data: me } = useGetMe();
  const [location] = useLocation();
  if (!isLoaded) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/></div>;
  if (!isSignedIn) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><SignIn/></div>;
  if (me && me.role !== 'SUPER_ADMIN') return <div className="flex h-screen items-center justify-center text-slate-500">Access denied. Super Admin required.</div>;
  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar currentPath={location}/>
      <main className="flex-1 min-w-0 overflow-auto">
        <Switch>
          <Route path="/admin" component={AdminOverview}/>
          <Route path="/admin/tenants" component={TenantsPage}/>
          <Route path="/admin/tenants/new" component={NewTenantPage}/>
          <Route path="/admin/tenants/:id" component={({ params: p }) => <TenantDetailPage id={Number(p.id)}/>}/>
        </Switch>
      </main>
    </div>
  );
}
