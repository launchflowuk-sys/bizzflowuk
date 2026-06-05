import { Switch, Route, useLocation, Link } from "wouter";
import { useUser, SignIn, UserButton } from "@clerk/react";
import { useGetMe, useGetDashboardStats, useGetRecentActivity, useGetLeadPipeline, useListLeads, useCreateLead, useGetLead, useUpdateLead, useDeleteLead, useListLeadNotes, useCreateLeadNote, useListQuotes, useGetQuote, useListProjects, useGetProject, useUpdateProject, useListCustomers, useGetCustomer, useListGalleryImages, useListReviews, useListCaseStudies, useListServices, useListAreas, useListFaqs, useListBlogPosts, useListVisualiserRequests, useListContactMessages, useListTeamMembers, useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListLeadsQueryKey, getListQuotesQueryKey, getListProjectsQueryKey } from "@workspace/api-client-react";

function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    'New': 'bg-blue-100 text-blue-700', 'Contacted': 'bg-indigo-100 text-indigo-700',
    'Survey Booked': 'bg-purple-100 text-purple-700', 'Quote Sent': 'bg-amber-100 text-amber-700',
    'Won': 'bg-green-100 text-green-700', 'Lost': 'bg-red-100 text-red-700',
    'Draft': 'bg-slate-100 text-slate-700', 'Sent': 'bg-blue-100 text-blue-700',
    'Accepted': 'bg-green-100 text-green-700', 'Rejected': 'bg-red-100 text-red-700',
    'In Progress': 'bg-blue-100 text-blue-700', 'Completed': 'bg-green-100 text-green-700',
    'Enquiry': 'bg-slate-100 text-slate-700', 'Scheduled': 'bg-purple-100 text-purple-700',
    'Quote Approved': 'bg-teal-100 text-teal-700',
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-700'}`}>{status}</span>;
}

function Sidebar({ currentPath }: { currentPath: string }) {
  const { data: me } = useGetMe();
  const nav = [
    { path: '/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { path: '/dashboard/leads', label: 'Leads', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    { path: '/dashboard/quotes', label: 'Quotes', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { path: '/dashboard/projects', label: 'Projects', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { path: '/dashboard/customers', label: 'Customers', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    null,
    { path: '/dashboard/gallery', label: 'Gallery', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { path: '/dashboard/reviews', label: 'Reviews', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
    { path: '/dashboard/case-studies', label: 'Case Studies', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    { path: '/dashboard/services', label: 'Services', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { path: '/dashboard/areas', label: 'Areas', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
    { path: '/dashboard/faqs', label: 'FAQs', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { path: '/dashboard/blog', label: 'Blog', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
    null,
    { path: '/dashboard/messages', label: 'Messages', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
    { path: '/dashboard/visualiser', label: 'Visualiser', icon: 'M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.893L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
    { path: '/dashboard/team', label: 'Team', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { path: '/dashboard/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  ];
  return (
    <aside className="w-56 flex-shrink-0 bg-slate-900 min-h-screen flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <div className="font-bold text-white text-sm">LaunchFlow</div>
        <div className="text-xs text-slate-400 mt-0.5 truncate">{me?.email}</div>
        <div className="text-xs text-orange-400 font-medium mt-0.5">{me?.role?.replace('_', ' ')}</div>
      </div>
      <nav className="flex-1 p-3 overflow-y-auto">
        {nav.map((item, i) => item === null ? <div key={i} className="my-2 border-t border-slate-800"/> : (
          <Link key={item.path} href={item.path} className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium mb-0.5 transition-colors ${currentPath === item.path ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon}/></svg>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-7 h-7' } }}/>
      </div>
    </aside>
  );
}

function DashboardHome() {
  const { data: stats } = useGetDashboardStats();
  const { data: activity } = useGetRecentActivity();
  const { data: pipeline } = useGetLeadPipeline();
  const s = stats as any;
  const p = pipeline as any[];
  const maxCount = p ? Math.max(...p.map((x: any) => Number(x.count)), 1) : 1;
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: s?.totalLeads, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'New Leads', value: s?.newLeads, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Active Projects', value: s?.activeProjects, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Completed', value: s?.completedProjects, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl ${card.bg} p-5 border border-slate-200`}>
            <div className={`text-3xl font-bold ${card.color}`}>{card.value ?? '-'}</div>
            <div className="text-xs text-slate-600 mt-1 font-medium">{card.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Lead Pipeline</h2>
          {p ? (
            <div className="space-y-2">
              {p.map((stage: any) => (
                <div key={stage.status} className="flex items-center gap-3">
                  <div className="text-xs text-slate-600 w-28 flex-shrink-0">{stage.status}</div>
                  <div className="flex-1 bg-slate-100 rounded-full h-5 relative overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${(Number(stage.count) / maxCount) * 100}%` }}/>
                  </div>
                  <div className="text-xs font-semibold text-slate-700 w-6 text-right">{stage.count}</div>
                </div>
              ))}
            </div>
          ) : <div className="text-slate-400 text-sm">Loading...</div>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {(activity as any[])?.slice(0,8).map((item: any, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${item.type === 'lead' ? 'bg-blue-500' : 'bg-green-500'}`}/>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 text-xs line-clamp-1">{item.description}</p>
                  <Badge status={item.status}/>
                </div>
              </div>
            ))}
            {!(activity as any[])?.length && <div className="text-slate-400 text-sm">No recent activity</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadsPage() {
  const { data: leads, isLoading } = useListLeads();
  const qc = useQueryClient();
  const deleteMutation = useDeleteLead();
  const [statusFilter, setStatusFilter] = useState('');
  const filtered = (leads as any[])?.filter((l: any) => !statusFilter || l.status === statusFilter);
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <Link href="/dashboard/leads/new" className="inline-flex h-9 items-center rounded-md bg-orange-500 px-4 text-sm font-medium text-white hover:bg-orange-400">+ New Lead</Link>
      </div>
      <div className="flex items-center gap-2">
        {['', 'New', 'Contacted', 'Survey Booked', 'Quote Sent', 'Won', 'Lost'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{s || 'All'}</button>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Contact</th><th className="text-left px-4 py-3">Service</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Source</th><th className="text-left px-4 py-3">Created</th><th className="px-4 py-3"/>
              </tr></thead>
              <tbody>
                {filtered?.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No leads found</td></tr> : filtered?.map((l: any) => (
                  <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900"><Link href={`/dashboard/leads/${l.id}`} className="hover:text-orange-600">{l.firstName} {l.lastName}</Link></td>
                    <td className="px-4 py-3 text-slate-600">{l.phone || l.email || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{l.serviceInterest || '-'}</td>
                    <td className="px-4 py-3"><Badge status={l.status}/></td>
                    <td className="px-4 py-3 text-slate-500">{l.source || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-GB') : '-'}</td>
                    <td className="px-4 py-3 text-right"><button onClick={async () => { if (confirm('Delete this lead?')) { await deleteMutation.mutateAsync({ id: l.id }); qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }); }}} className="text-xs text-red-500 hover:text-red-700">Delete</button></td>
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

function LeadDetailPage({ id }: { id: number }) {
  const { data: lead, isLoading } = useGetLead(id);
  const { data: notes } = useListLeadNotes(id);
  const updateMutation = useUpdateLead();
  const noteMutation = useCreateLeadNote();
  const qc = useQueryClient();
  const [noteContent, setNoteContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const l = lead as any;
  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/></div>;
  if (!l) return <div className="p-8 text-center text-slate-500">Lead not found</div>;
  const handleStatusChange = async (status: string) => {
    await updateMutation.mutateAsync({ id, data: { status } } as any);
    qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
  };
  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    await noteMutation.mutateAsync({ id, data: { content: noteContent } } as any);
    setNoteContent('');
    qc.invalidateQueries();
  };
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/leads" className="text-sm text-slate-500 hover:text-orange-500">&larr; Leads</Link>
        <h1 className="text-2xl font-bold text-slate-900">{l.firstName} {l.lastName}</h1>
        <Badge status={l.status}/>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Details</h2><button onClick={() => { setEditData(l); setEditing(true); }} className="text-xs text-orange-500 hover:text-orange-600">Edit</button></div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Email:</span> <span className="text-slate-900">{l.email || '-'}</span></div>
              <div><span className="text-slate-500">Phone:</span> <span className="text-slate-900">{l.phone || '-'}</span></div>
              <div><span className="text-slate-500">City:</span> <span className="text-slate-900">{l.city || '-'}</span></div>
              <div><span className="text-slate-500">Postcode:</span> <span className="text-slate-900">{l.postcode || '-'}</span></div>
              <div><span className="text-slate-500">Service:</span> <span className="text-slate-900">{l.serviceInterest || '-'}</span></div>
              <div><span className="text-slate-500">Source:</span> <span className="text-slate-900">{l.source || '-'}</span></div>
              <div className="col-span-2"><span className="text-slate-500">Address:</span> <span className="text-slate-900">{l.address || '-'}</span></div>
              {l.notes && <div className="col-span-2"><span className="text-slate-500">Notes:</span> <span className="text-slate-900">{l.notes}</span></div>}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="font-semibold text-slate-900">Notes</h2>
            <form onSubmit={handleNoteSubmit} className="flex gap-2">
              <input value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Add a note..." className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
              <button type="submit" disabled={noteMutation.isPending} className="inline-flex items-center rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50">Add</button>
            </form>
            <div className="space-y-3">
              {(notes as any[])?.map((n: any) => (
                <div key={n.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">{n.content}</p>
                  <p className="text-xs text-slate-400 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString('en-GB') : ''}</p>
                </div>
              ))}
              {!(notes as any[])?.length && <p className="text-sm text-slate-400">No notes yet</p>}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="font-semibold text-slate-900">Update Status</h2>
            {['New','Contacted','Survey Booked','Quote Sent','Won','Lost'].map(s => (
              <button key={s} onClick={() => handleStatusChange(s)} className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${l.status === s ? 'bg-orange-500 text-white font-medium' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}`}>{s}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuotesPage() {
  const { data: quotes, isLoading } = useListQuotes();
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Quotes</h1>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Reference</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Total</th><th className="text-left px-4 py-3">Created</th><th className="px-4 py-3"/>
              </tr></thead>
              <tbody>
                {!(quotes as any[])?.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No quotes yet</td></tr> : (quotes as any[])?.map((q: any) => (
                  <tr key={q.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900"><Link href={`/dashboard/quotes/${q.id}`} className="hover:text-orange-600">{q.reference}</Link></td>
                    <td className="px-4 py-3"><Badge status={q.status}/></td>
                    <td className="px-4 py-3 text-slate-700">£{Number(q.total).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-500">{q.createdAt ? new Date(q.createdAt).toLocaleDateString('en-GB') : '-'}</td>
                    <td className="px-4 py-3 text-right"><Link href={`/dashboard/quotes/${q.id}`} className="text-xs text-orange-500 hover:text-orange-600">View</Link></td>
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

function ProjectsPage() {
  const { data: projects, isLoading } = useListProjects();
  const [statusFilter, setStatusFilter] = useState('');
  const filtered = (projects as any[])?.filter((p: any) => !statusFilter || p.status === statusFilter);
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {['', 'Enquiry', 'Survey Booked', 'Quote Approved', 'Scheduled', 'In Progress', 'Completed'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{s || 'All'}</button>
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Title</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Location</th><th className="text-left px-4 py-3">Created</th><th className="px-4 py-3"/>
              </tr></thead>
              <tbody>
                {!filtered?.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No projects found</td></tr> : filtered.map((p: any) => (
                  <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900"><Link href={`/dashboard/projects/${p.id}`} className="hover:text-orange-600">{p.title}</Link></td>
                    <td className="px-4 py-3"><Badge status={p.status}/></td>
                    <td className="px-4 py-3 text-slate-600">{p.city || '-'}</td>
                    <td className="px-4 py-3 text-slate-500">{p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-GB') : '-'}</td>
                    <td className="px-4 py-3 text-right"><Link href={`/dashboard/projects/${p.id}`} className="text-xs text-orange-500">View</Link></td>
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

function CustomersPage() {
  const { data: customers, isLoading } = useListCustomers();
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Email</th><th className="text-left px-4 py-3">Phone</th><th className="text-left px-4 py-3">City</th><th className="text-left px-4 py-3">Portal</th>
              </tr></thead>
              <tbody>
                {!(customers as any[])?.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No customers yet</td></tr> : (customers as any[]).map((c: any) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.firstName} {c.lastName}</td>
                    <td className="px-4 py-3 text-slate-600">{c.email || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.city || '-'}</td>
                    <td className="px-4 py-3">{c.portalEnabled ? <span className="text-xs text-green-600 font-medium">Active</span> : <span className="text-xs text-slate-400">Inactive</span>}</td>
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

function GenericListPage({ title, hook, columns }: { title: string; hook: () => any; columns: Array<{label: string; key: string}> }) {
  const { data, isLoading } = hook();
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase">{columns.map(c => <th key={c.key} className="text-left px-4 py-3">{c.label}</th>)}</tr></thead>
              <tbody>
                {!(data as any[])?.length ? <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">No {title.toLowerCase()} yet</td></tr>
                : (data as any[]).map((item: any) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50">
                    {columns.map(c => <td key={c.key} className="px-4 py-3 text-slate-700 max-w-xs truncate">{c.key === 'published' || c.key === 'featured' ? (item[c.key] ? 'Yes' : 'No') : item[c.key] ?? '-'}</td>)}
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

function MessagesPage() {
  const { data: messages, isLoading } = useListContactMessages();
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
      <div className="space-y-3">
        {isLoading ? <div className="text-center py-12 text-slate-400">Loading...</div> : (messages as any[])?.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">No messages yet</div>
        ) : (messages as any[]).map((m: any) => (
          <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-medium text-slate-900">{m.senderName}</div>
              <div className="text-xs text-slate-400">{m.createdAt ? new Date(m.createdAt).toLocaleString('en-GB') : ''}</div>
            </div>
            {m.subject && <div className="text-sm font-medium text-slate-700">{m.subject}</div>}
            <p className="text-sm text-slate-600">{m.message}</p>
            <div className="flex gap-4 text-xs text-slate-400">
              {m.senderEmail && <span>Email: {m.senderEmail}</span>}
              {m.senderPhone && <span>Phone: {m.senderPhone}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPage() {
  const { data: settings, isLoading } = useGetSettings();
  const updateMutation = useUpdateSettings();
  const [form, setForm] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const s = settings as any;
  if (!form && s) setForm(s);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync({ data: form } as any);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };
  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/></div>;
  if (!form) return null;
  const field = (key: string, label: string, type = 'text') => (
    <div key={key}><label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input type={type} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form[key] || ''} onChange={e => setForm({...form, [key]: e.target.value})}/></div>
  );
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Branding</h2>
          {field('primaryColor', 'Primary Colour', 'color')}
          {field('logoUrl', 'Logo URL')}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Hero Section</h2>
          {field('heroHeadline', 'Hero Headline')}
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Hero Subheadline</label><textarea rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.heroSubheadline || ''} onChange={e => setForm({...form, heroSubheadline: e.target.value})}/></div>
          {field('ctaText', 'CTA Button Text')}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Contact Information</h2>
          {field('phone', 'Phone')}
          {field('email', 'Email')}
          {field('address', 'Address')}
          {field('city', 'City')}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Social Media</h2>
          {field('facebookUrl', 'Facebook URL')}
          {field('instagramUrl', 'Instagram URL')}
          {field('twitterUrl', 'Twitter/X URL')}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">SEO</h2>
          {field('seoTitle', 'SEO Title')}
          <div><label className="block text-sm font-medium text-slate-700 mb-1">SEO Description</label><textarea rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.seoDescription || ''} onChange={e => setForm({...form, seoDescription: e.target.value})}/></div>
          {field('googleAnalyticsId', 'Google Analytics ID')}
        </div>
        <div className="flex items-center gap-4">
          <button type="submit" disabled={updateMutation.isPending} className="inline-flex h-10 items-center rounded-md bg-orange-500 px-6 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">Saved successfully</span>}
        </div>
      </form>
    </div>
  );
}

export default function DashboardApp() {
  const { isSignedIn, isLoaded } = useUser();
  const [location] = useLocation();
  if (!isLoaded) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/></div>;
  if (!isSignedIn) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><SignIn routing="virtual"/></div>;
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar currentPath={location}/>
      <main className="flex-1 min-w-0 overflow-auto">
        <Switch>
          <Route path="/dashboard" component={DashboardHome}/>
          <Route path="/dashboard/leads" component={LeadsPage}/>
          <Route path="/dashboard/leads/:id" component={({ params: p }) => <LeadDetailPage id={Number(p.id)}/>}/>
          <Route path="/dashboard/quotes" component={QuotesPage}/>
          <Route path="/dashboard/projects" component={ProjectsPage}/>
          <Route path="/dashboard/customers" component={CustomersPage}/>
          <Route path="/dashboard/gallery" component={() => <GenericListPage title="Gallery" hook={useListGalleryImages} columns={[{label:'Caption',key:'caption'},{label:'Featured',key:'featured'},{label:'Created',key:'createdAt'}]}/>}/>
          <Route path="/dashboard/reviews" component={() => <GenericListPage title="Reviews" hook={useListReviews} columns={[{label:'Reviewer',key:'reviewerName'},{label:'Rating',key:'rating'},{label:'Featured',key:'featured'},{label:'Published',key:'published'}]}/>}/>
          <Route path="/dashboard/case-studies" component={() => <GenericListPage title="Case Studies" hook={useListCaseStudies} columns={[{label:'Title',key:'title'},{label:'Location',key:'location'},{label:'Published',key:'published'},{label:'Featured',key:'featured'}]}/>}/>
          <Route path="/dashboard/services" component={() => <GenericListPage title="Services" hook={useListServices} columns={[{label:'Name',key:'name'},{label:'Published',key:'published'},{label:'Featured',key:'featured'}]}/>}/>
          <Route path="/dashboard/areas" component={() => <GenericListPage title="Area Pages" hook={useListAreas} columns={[{label:'Name',key:'name'},{label:'County',key:'county'},{label:'Published',key:'published'}]}/>}/>
          <Route path="/dashboard/faqs" component={() => <GenericListPage title="FAQs" hook={useListFaqs} columns={[{label:'Question',key:'question'},{label:'Global',key:'global'}]}/>}/>
          <Route path="/dashboard/blog" component={() => <GenericListPage title="Blog Posts" hook={useListBlogPosts} columns={[{label:'Title',key:'title'},{label:'Published',key:'published'},{label:'Author',key:'authorName'}]}/>}/>
          <Route path="/dashboard/visualiser" component={() => <GenericListPage title="Visualiser Requests" hook={useListVisualiserRequests} columns={[{label:'Name',key:'firstName'},{label:'Email',key:'email'},{label:'Status',key:'status'}]}/>}/>
          <Route path="/dashboard/messages" component={MessagesPage}/>
          <Route path="/dashboard/team" component={() => <GenericListPage title="Team" hook={useListTeamMembers} columns={[{label:'Name',key:'firstName'},{label:'Role',key:'role'},{label:'Visible',key:'visible'}]}/>}/>
          <Route path="/dashboard/settings" component={SettingsPage}/>
        </Switch>
      </main>
    </div>
  );
}
