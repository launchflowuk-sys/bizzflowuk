import { Switch, Route, useLocation, Link, useLocation as useWouterLocation, Redirect } from "wouter";
import { useAuthCtx } from "@/lib/auth";

import {
  useGetMe, useGetDashboardStats, useGetRecentActivity, useGetLeadPipeline,
  useListLeads, useGetLead, useUpdateLead, useDeleteLead, useListLeadNotes, useCreateLeadNote,
  useConvertLeadToQuote, useConvertLeadToProject,
  useListQuotes, useGetQuote, useUpdateQuote, useListQuoteItems, useCreateQuoteItem, useUpdateQuoteItem, useDeleteQuoteItem, useConvertQuoteToProject,
  useListProjects, useGetProject, useUpdateProject, useListProjectUpdates, useCreateProjectUpdate,
  useListCustomers, useGetCustomer,
  useListGalleryImages, useListReviews, useListCaseStudies, useListServices, useListAreas, useListFaqs, useListBlogPosts,
  useListVisualiserRequests, useListContactMessages, useListTeamMembers,
  useGetSettings, useUpdateSettings, useTestEmailSettings, useTestSmsSettings,
} from "@workspace/api-client-react";
import { getListLeadsQueryKey, getListQuotesQueryKey, getListProjectsQueryKey, getListQuoteItemsQueryKey, getListProjectUpdatesQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

function comingSoon() { alert("Coming soon — full CMS editing is on the roadmap."); }

function SignOutButton() {
  const { signOut } = useAuthCtx();
  return (
    <button onClick={signOut} className="w-full text-left px-3 py-2 rounded-md text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
      Sign out
    </button>
  );
}

function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    New: "bg-blue-100 text-blue-700", Contacted: "bg-indigo-100 text-indigo-700",
    "Survey Booked": "bg-purple-100 text-purple-700", "Quote Sent": "bg-amber-100 text-amber-700",
    Won: "bg-green-100 text-green-700", Lost: "bg-red-100 text-red-700",
    Draft: "bg-slate-100 text-slate-700", Sent: "bg-blue-100 text-blue-700",
    Accepted: "bg-green-100 text-green-700", Rejected: "bg-red-100 text-red-700",
    "In Progress": "bg-blue-100 text-blue-700", Completed: "bg-green-100 text-green-700",
    Enquiry: "bg-slate-100 text-slate-700", Scheduled: "bg-purple-100 text-purple-700",
    "Quote Approved": "bg-teal-100 text-teal-700",
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-slate-100 text-slate-700"}`}>{status}</span>;
}

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { path: "/dashboard/leads", label: "Leads", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { path: "/dashboard/quotes", label: "Quotes", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { path: "/dashboard/projects", label: "Projects", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { path: "/dashboard/customers", label: "Customers", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  null,
  { path: "/dashboard/gallery", label: "Gallery", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { path: "/dashboard/reviews", label: "Reviews", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
  { path: "/dashboard/case-studies", label: "Case Studies", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { path: "/dashboard/services", label: "Services", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  { path: "/dashboard/areas", label: "Areas", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
  { path: "/dashboard/faqs", label: "FAQs", icon: "M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { path: "/dashboard/blog", label: "Blog", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  null,
  { path: "/dashboard/messages", label: "Messages", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
  { path: "/dashboard/visualiser", label: "Visualiser", icon: "M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.893L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
  { path: "/dashboard/team", label: "Team", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { path: "/dashboard/settings", label: "Settings", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
];

function SidebarContent({ currentPath, onNavClick }: { currentPath: string; onNavClick?: () => void }) {
  const { data: me } = useGetMe();
  return (
    <>
      <div className="p-4 border-b border-slate-800 flex-shrink-0">
        <div className="font-bold text-white text-sm">LaunchFlow</div>
        <div className="text-xs text-slate-400 mt-0.5 truncate">{(me as any)?.email}</div>
        <div className="text-xs text-orange-400 font-medium mt-0.5">{(me as any)?.role?.replace("_", " ")}</div>
      </div>
      <nav className="flex-1 p-3 overflow-y-auto">
        {NAV_ITEMS.map((item, i) =>
          item === null ? <div key={i} className="my-2 border-t border-slate-800" /> : (
            <Link
              key={item.path}
              href={item.path}
              onClick={onNavClick}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-xs font-medium mb-0.5 transition-colors ${
                currentPath === item.path || (currentPath.startsWith(item.path + "/") && item.path !== "/dashboard")
                  ? "bg-orange-500 text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              {item.label}
            </Link>
          )
        )}
      </nav>
      <div className="p-4 border-t border-slate-800 flex-shrink-0">
        <SignOutButton />
      </div>
    </>
  );
}

function DashboardHome() {
  const { data: stats } = useGetDashboardStats();
  const { data: activity } = useGetRecentActivity();
  const { data: pipeline } = useGetLeadPipeline();
  const s = stats as any;
  const p = pipeline as unknown as any[];
  const maxCount = p ? Math.max(...p.map((x: any) => Number(x.count)), 1) : 1;

  const statCards = [
    { label: "Total Leads", value: s?.totalLeads, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", href: "/dashboard/leads" },
    { label: "New Leads", value: s?.newLeads, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100", href: "/dashboard/leads" },
    { label: "Active Projects", value: s?.activeProjects, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100", href: "/dashboard/projects" },
    { label: "Completed", value: s?.completedProjects, color: "text-green-600", bg: "bg-green-50", border: "border-green-100", href: "/dashboard/projects" },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map(card => (
          <Link key={card.label} href={card.href} className={`rounded-xl ${card.bg} p-4 sm:p-5 border ${card.border} block hover:shadow-md transition-shadow active:scale-95`}>
            <div className={`text-2xl sm:text-3xl font-bold ${card.color}`}>{card.value ?? "-"}</div>
            <div className="text-xs text-slate-600 mt-1 font-medium">{card.label}</div>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Lead Pipeline</h2>
          {p ? (
            <div className="space-y-2.5">
              {p.map((stage: any) => (
                <Link key={stage.status} href="/dashboard/leads" className="flex items-center gap-3 group">
                  <div className="text-xs text-slate-600 w-24 sm:w-28 flex-shrink-0 group-hover:text-orange-600 transition-colors">{stage.status}</div>
                  <div className="flex-1 bg-slate-100 rounded-full h-4 sm:h-5 relative overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${(Number(stage.count) / maxCount) * 100}%` }} />
                  </div>
                  <div className="text-xs font-semibold text-slate-700 w-6 text-right">{stage.count}</div>
                </Link>
              ))}
            </div>
          ) : <div className="text-slate-400 text-sm">Loading...</div>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Recent Activity</h2>
          <div className="space-y-2.5">
            {(activity as any[])?.slice(0, 8).map((item: any, i) => (
              <Link
                key={i}
                href={item.type === "lead" ? `/dashboard/leads/${item.id}` : `/dashboard/projects/${item.id}`}
                className="flex items-start gap-3 text-sm hover:bg-slate-50 rounded-lg px-2 py-1 -mx-2 transition-colors"
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${item.type === "lead" ? "bg-blue-500" : "bg-green-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 text-xs line-clamp-1">{item.description}</p>
                  <Badge status={item.status} />
                </div>
                <svg className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
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
  const [statusFilter, setStatusFilter] = useState("");
  const filtered = (leads as any[])?.filter((l: any) => !statusFilter || l.status === statusFilter);
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Leads</h1>
        <Link href="/dashboard/leads/new" className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ New</Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {["", "New", "Contacted", "Survey Booked", "Quote Sent", "Won", "Lost"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{s || "All"}</button>
        ))}
      </div>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {filtered?.length === 0 ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">No leads found</div> : filtered?.map((l: any) => (
              <Link key={l.id} href={`/dashboard/leads/${l.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300 transition-colors active:bg-slate-50">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-medium text-slate-900">{l.firstName} {l.lastName}</div>
                  <Badge status={l.status} />
                </div>
                <div className="text-xs text-slate-500 space-y-0.5">
                  <div>{l.phone || l.email || "-"}</div>
                  {l.serviceInterest && <div className="text-slate-400">{l.serviceInterest}</div>}
                  <div className="text-slate-400">{l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-GB") : ""}</div>
                </div>
              </Link>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Contact</th><th className="text-left px-4 py-3">Service</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Source</th><th className="text-left px-4 py-3">Created</th><th className="px-4 py-3" />
                </tr></thead>
                <tbody>
                  {filtered?.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No leads found</td></tr> : filtered?.map((l: any) => (
                    <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900"><Link href={`/dashboard/leads/${l.id}`} className="hover:text-orange-600">{l.firstName} {l.lastName}</Link></td>
                      <td className="px-4 py-3 text-slate-600">{l.phone || l.email || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{l.serviceInterest || "-"}</td>
                      <td className="px-4 py-3"><Badge status={l.status} /></td>
                      <td className="px-4 py-3 text-slate-500">{l.source || "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-GB") : "-"}</td>
                      <td className="px-4 py-3 text-right"><button onClick={async () => { if (confirm("Delete this lead?")) { await deleteMutation.mutateAsync({ id: l.id }); qc.invalidateQueries({ queryKey: getListLeadsQueryKey() }); } }} className="text-xs text-red-500 hover:text-red-700">Delete</button></td>
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

function LeadDetailPage({ id }: { id: number }) {
  const [, navigate] = useWouterLocation();
  const { data: lead, isLoading } = useGetLead(id);
  const { data: notes } = useListLeadNotes(id);
  const updateMutation = useUpdateLead();
  const noteMutation = useCreateLeadNote();
  const convertToQuote = useConvertLeadToQuote();
  const convertToProject = useConvertLeadToProject();
  const qc = useQueryClient();
  const [noteContent, setNoteContent] = useState("");
  const l = lead as any;
  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>;
  if (!l) return <div className="p-8 text-center text-slate-500">Lead not found</div>;
  const handleStatusChange = async (status: string) => {
    await updateMutation.mutateAsync({ id, data: { status } } as any);
    qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
  };
  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    await noteMutation.mutateAsync({ id, data: { content: noteContent } } as any);
    setNoteContent("");
    qc.invalidateQueries();
  };
  const handleConvertToQuote = async () => {
    if (!confirm("Convert this lead to a quote?")) return;
    const result = await convertToQuote.mutateAsync({ id } as any) as any;
    qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
    navigate(`/dashboard/quotes/${result.id}`);
  };
  const handleConvertToProject = async () => {
    if (!confirm("Convert this lead directly to a project?")) return;
    const result = await convertToProject.mutateAsync({ id } as any) as any;
    qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    navigate(`/dashboard/projects/${result.id}`);
  };
  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/dashboard/leads" className="text-sm text-slate-500 hover:text-orange-500">&larr; Leads</Link>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{l.firstName} {l.lastName}</h1>
        <Badge status={l.status} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
            <h2 className="font-semibold text-slate-900">Contact Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Email: </span><a href={`mailto:${l.email}`} className="text-orange-600 hover:underline break-all">{l.email || "-"}</a></div>
              <div><span className="text-slate-500">Phone: </span><a href={`tel:${l.phone}`} className="text-orange-600 hover:underline">{l.phone || "-"}</a></div>
              <div><span className="text-slate-500">City: </span><span className="text-slate-900">{l.city || "-"}</span></div>
              <div><span className="text-slate-500">Postcode: </span><span className="text-slate-900">{l.postcode || "-"}</span></div>
              <div className="sm:col-span-2"><span className="text-slate-500">Address: </span><span className="text-slate-900">{l.address || "-"}</span></div>
              <div><span className="text-slate-500">Service: </span><span className="text-slate-900">{l.serviceInterest || "-"}</span></div>
              <div><span className="text-slate-500">Source: </span><span className="text-slate-900">{l.source || "-"}</span></div>
              <div><span className="text-slate-500">Budget: </span><span className="text-slate-900">{l.budget || "-"}</span></div>
              <div><span className="text-slate-500">Created: </span><span className="text-slate-900">{l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-GB") : "-"}</span></div>
              {l.notes && <div className="sm:col-span-2"><span className="text-slate-500">Notes: </span><span className="text-slate-900">{l.notes}</span></div>}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
            <h2 className="font-semibold text-slate-900">Notes</h2>
            <form onSubmit={handleNoteSubmit} className="flex gap-2">
              <input value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Add a note..." className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <button type="submit" disabled={noteMutation.isPending} className="inline-flex items-center rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50">Add</button>
            </form>
            <div className="space-y-3">
              {(notes as any[])?.map((n: any) => (
                <div key={n.id} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-sm text-slate-700">{n.content}</p>
                  <p className="text-xs text-slate-400 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString("en-GB") : ""}</p>
                </div>
              ))}
              {!(notes as any[])?.length && <p className="text-sm text-slate-400">No notes yet</p>}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
            <h2 className="font-semibold text-slate-900">Update Status</h2>
            {["New", "Contacted", "Survey Booked", "Quote Sent", "Won", "Lost"].map(s => (
              <button key={s} onClick={() => handleStatusChange(s)} className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors ${l.status === s ? "bg-orange-500 text-white font-medium" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>{s}</button>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
            <h2 className="font-semibold text-slate-900">Actions</h2>
            <button onClick={handleConvertToQuote} disabled={convertToQuote.isPending} className="w-full rounded-md border border-orange-500 text-orange-600 px-3 py-2.5 text-sm font-medium hover:bg-orange-50 disabled:opacity-50">
              {convertToQuote.isPending ? "Converting..." : "→ Convert to Quote"}
            </button>
            <button onClick={handleConvertToProject} disabled={convertToProject.isPending} className="w-full rounded-md border border-slate-300 text-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
              {convertToProject.isPending ? "Converting..." : "→ Convert to Project"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuotesPage() {
  const { data: quotes, isLoading } = useListQuotes();
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Quotes</h1>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {!(quotes as any[])?.length ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">No quotes yet</div> : (quotes as any[]).map((q: any) => (
              <Link key={q.id} href={`/dashboard/quotes/${q.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300 transition-colors active:bg-slate-50">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="font-medium text-slate-900">{q.reference}</div>
                  <Badge status={q.status} />
                </div>
                <div className="text-xs text-slate-500 space-y-0.5">
                  <div className="font-semibold text-slate-700">£{Number(q.total || 0).toFixed(2)}</div>
                  {q.validUntil && <div>Valid until {new Date(q.validUntil).toLocaleDateString("en-GB")}</div>}
                  <div>{q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-GB") : ""}</div>
                </div>
              </Link>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Reference</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Total</th><th className="text-left px-4 py-3">Valid Until</th><th className="text-left px-4 py-3">Created</th><th className="px-4 py-3" />
                </tr></thead>
                <tbody>
                  {!(quotes as any[])?.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No quotes yet</td></tr> : (quotes as any[])?.map((q: any) => (
                    <tr key={q.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900"><Link href={`/dashboard/quotes/${q.id}`} className="hover:text-orange-600">{q.reference}</Link></td>
                      <td className="px-4 py-3"><Badge status={q.status} /></td>
                      <td className="px-4 py-3 text-slate-700">£{Number(q.total || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-slate-500">{q.validUntil ? new Date(q.validUntil).toLocaleDateString("en-GB") : "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-GB") : "-"}</td>
                      <td className="px-4 py-3 text-right"><Link href={`/dashboard/quotes/${q.id}`} className="text-xs text-orange-500 hover:text-orange-600">View</Link></td>
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

function QuoteDetailPage({ id }: { id: number }) {
  const [, navigate] = useWouterLocation();
  const { data: quote, isLoading } = useGetQuote(id);
  const { data: items } = useListQuoteItems(id);
  const updateMutation = useUpdateQuote();
  const createItem = useCreateQuoteItem();
  const updateItem = useUpdateQuoteItem();
  const deleteItem = useDeleteQuoteItem();
  const convertToProject = useConvertQuoteToProject();
  const qc = useQueryClient();
  const [newItem, setNewItem] = useState({ description: "", quantity: 1, unitPrice: "" });
  const q = quote as any;
  const lineItems = items as any[] || [];
  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>;
  if (!q) return <div className="p-8 text-center text-slate-500">Quote not found</div>;

  const subtotal = lineItems.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  const vat = subtotal * (Number(q.vatRate || 0) / 100);
  const total = subtotal + vat;

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.description || !newItem.unitPrice) return;
    const qty = Number(newItem.quantity);
    const price = Number(newItem.unitPrice);
    await createItem.mutateAsync({ id, data: { description: newItem.description, quantity: qty, unitPrice: price, total: qty * price, sortOrder: lineItems.length } } as any);
    setNewItem({ description: "", quantity: 1, unitPrice: "" });
    qc.invalidateQueries({ queryKey: getListQuoteItemsQueryKey(id) });
  };
  const handleStatusChange = async (status: string) => {
    await updateMutation.mutateAsync({ id, data: { status, total, subtotal, vatAmount: vat } } as any);
    qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
  };
  const handleConvertToProject = async () => {
    if (!confirm("Convert this quote to a project?")) return;
    const result = await convertToProject.mutateAsync({ id } as any) as any;
    qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    navigate(`/dashboard/projects/${result.id}`);
  };

  void updateItem;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/dashboard/quotes" className="text-sm text-slate-500 hover:text-orange-500">&larr; Quotes</Link>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{q.reference}</h1>
        <Badge status={q.status} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
            <h2 className="font-semibold text-slate-900">Line Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 text-xs text-slate-500 uppercase">
                  <th className="text-left pb-2">Description</th><th className="text-right pb-2 w-12">Qty</th><th className="text-right pb-2 w-20">Unit £</th><th className="text-right pb-2 w-20">Total £</th><th className="w-8 pb-2" />
                </tr></thead>
                <tbody>
                  {lineItems.map((item: any) => (
                    <tr key={item.id} className="border-b border-slate-50">
                      <td className="py-2 pr-4 text-slate-800">{item.description}</td>
                      <td className="py-2 text-right text-slate-600">{item.quantity}</td>
                      <td className="py-2 text-right text-slate-600">£{Number(item.unitPrice).toFixed(2)}</td>
                      <td className="py-2 text-right font-medium text-slate-800">£{Number(item.total).toFixed(2)}</td>
                      <td className="py-2 text-right"><button onClick={async () => { await deleteItem.mutateAsync({ id, itemId: item.id } as any); qc.invalidateQueries({ queryKey: getListQuoteItemsQueryKey(id) }); }} className="text-red-400 hover:text-red-600 text-xs">✕</button></td>
                    </tr>
                  ))}
                  {!lineItems.length && <tr><td colSpan={5} className="py-4 text-center text-slate-400 text-xs">No line items yet</td></tr>}
                </tbody>
              </table>
            </div>
            <form onSubmit={handleAddItem} className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              <input placeholder="Description" value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} className="flex-1 min-w-[120px] rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              <input type="number" placeholder="Qty" value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: Number(e.target.value) })} className="w-14 rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              <input type="number" placeholder="£ Unit" value={newItem.unitPrice} onChange={e => setNewItem({ ...newItem, unitPrice: e.target.value })} className="w-20 rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              <button type="submit" className="rounded bg-orange-500 px-3 py-1.5 text-sm text-white font-medium hover:bg-orange-400">Add</button>
            </form>
            <div className="border-t border-slate-100 pt-3 space-y-1 text-sm text-right">
              <div className="text-slate-600">Subtotal: <span className="font-medium text-slate-900">£{subtotal.toFixed(2)}</span></div>
              {Number(q.vatRate) > 0 && <div className="text-slate-600">VAT ({q.vatRate}%): <span className="font-medium text-slate-900">£{vat.toFixed(2)}</span></div>}
              <div className="text-base font-bold text-slate-900">Total: £{total.toFixed(2)}</div>
            </div>
          </div>
          {q.notes && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="font-semibold text-slate-900 mb-2">Notes</h2>
              <p className="text-sm text-slate-600">{q.notes}</p>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
            <h2 className="font-semibold text-slate-900">Update Status</h2>
            {["Draft", "Sent", "Accepted", "Rejected"].map(s => (
              <button key={s} onClick={() => handleStatusChange(s)} className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors ${q.status === s ? "bg-orange-500 text-white font-medium" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>{s}</button>
            ))}
          </div>
          {q.status === "Accepted" && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="font-semibold text-slate-900 mb-3">Actions</h2>
              <button onClick={handleConvertToProject} disabled={convertToProject.isPending} className="w-full rounded-md bg-orange-500 text-white px-3 py-2.5 text-sm font-medium hover:bg-orange-400 disabled:opacity-50">
                {convertToProject.isPending ? "Converting..." : "→ Convert to Project"}
              </button>
            </div>
          )}
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 text-sm space-y-2">
            <h2 className="font-semibold text-slate-900">Details</h2>
            <div className="text-slate-600">Created: <span className="text-slate-800">{q.createdAt ? new Date(q.createdAt).toLocaleDateString("en-GB") : "-"}</span></div>
            {q.sentAt && <div className="text-slate-600">Sent: <span className="text-slate-800">{new Date(q.sentAt).toLocaleDateString("en-GB")}</span></div>}
            {q.validUntil && <div className="text-slate-600">Valid until: <span className="text-slate-800">{new Date(q.validUntil).toLocaleDateString("en-GB")}</span></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectsPage() {
  const { data: projects, isLoading } = useListProjects();
  const [statusFilter, setStatusFilter] = useState("");
  const filtered = (projects as any[])?.filter((p: any) => !statusFilter || p.status === statusFilter);
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Projects</h1>
      <div className="flex flex-wrap gap-2">
        {["", "Enquiry", "Survey Booked", "Quote Approved", "Scheduled", "In Progress", "Completed"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{s || "All"}</button>
        ))}
      </div>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {!filtered?.length ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">No projects found</div> : filtered.map((p: any) => (
              <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300 transition-colors active:bg-slate-50">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="font-medium text-slate-900">{p.title}</div>
                  <Badge status={p.status} />
                </div>
                <div className="text-xs text-slate-500 space-y-0.5">
                  {[p.city, p.postcode].filter(Boolean).join(", ") && <div>{[p.city, p.postcode].filter(Boolean).join(", ")}</div>}
                  {p.scheduledStart && <div>Starts {new Date(p.scheduledStart).toLocaleDateString("en-GB")}</div>}
                </div>
              </Link>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Title</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Location</th><th className="text-left px-4 py-3">Start</th><th className="px-4 py-3" />
                </tr></thead>
                <tbody>
                  {!filtered?.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No projects found</td></tr> : filtered.map((p: any) => (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900"><Link href={`/dashboard/projects/${p.id}`} className="hover:text-orange-600">{p.title}</Link></td>
                      <td className="px-4 py-3"><Badge status={p.status} /></td>
                      <td className="px-4 py-3 text-slate-600">{[p.city, p.postcode].filter(Boolean).join(", ") || "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{p.scheduledStart ? new Date(p.scheduledStart).toLocaleDateString("en-GB") : "-"}</td>
                      <td className="px-4 py-3 text-right"><Link href={`/dashboard/projects/${p.id}`} className="text-xs text-orange-500">View</Link></td>
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

function ProjectDetailPage({ id }: { id: number }) {
  const { data: project, isLoading } = useGetProject(id);
  const { data: updates } = useListProjectUpdates(id);
  const updateMutation = useUpdateProject();
  const createUpdate = useCreateProjectUpdate();
  const qc = useQueryClient();
  const [updateForm, setUpdateForm] = useState({ title: "", content: "", visibleToCustomer: true });
  const p = project as any;
  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>;
  if (!p) return <div className="p-8 text-center text-slate-500">Project not found</div>;

  const handleStatusChange = async (status: string) => {
    await updateMutation.mutateAsync({ id, data: { status } } as any);
    qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
  };
  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateForm.content.trim()) return;
    await createUpdate.mutateAsync({ id, data: updateForm } as any);
    setUpdateForm({ title: "", content: "", visibleToCustomer: true });
    qc.invalidateQueries({ queryKey: getListProjectUpdatesQueryKey(id) });
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/dashboard/projects" className="text-sm text-slate-500 hover:text-orange-500">&larr; Projects</Link>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{p.title}</h1>
        <Badge status={p.status} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
            <h2 className="font-semibold text-slate-900">Project Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="sm:col-span-2"><span className="text-slate-500">Address: </span><span className="text-slate-900">{[p.address, p.city, p.postcode].filter(Boolean).join(", ") || "-"}</span></div>
              <div><span className="text-slate-500">Start: </span><span className="text-slate-900">{p.scheduledStart ? new Date(p.scheduledStart).toLocaleDateString("en-GB") : "-"}</span></div>
              <div><span className="text-slate-500">End: </span><span className="text-slate-900">{p.scheduledEnd ? new Date(p.scheduledEnd).toLocaleDateString("en-GB") : "-"}</span></div>
              <div><span className="text-slate-500">Completed: </span><span className="text-slate-900">{p.completedAt ? new Date(p.completedAt).toLocaleDateString("en-GB") : "-"}</span></div>
              {p.description && <div className="sm:col-span-2"><span className="text-slate-500">Description: </span><span className="text-slate-900">{p.description}</span></div>}
              {p.warrantyInfo && <div className="sm:col-span-2"><span className="text-slate-500">Warranty: </span><span className="text-slate-900">{p.warrantyInfo}</span></div>}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
            <h2 className="font-semibold text-slate-900">Timeline / Updates</h2>
            <form onSubmit={handleAddUpdate} className="space-y-2 border border-slate-200 rounded-lg p-4 bg-slate-50">
              <input placeholder="Update title (optional)" value={updateForm.title} onChange={e => setUpdateForm({ ...updateForm, title: e.target.value })} className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              <textarea rows={3} placeholder="What happened / what was done..." value={updateForm.content} onChange={e => setUpdateForm({ ...updateForm, content: e.target.value })} className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={updateForm.visibleToCustomer} onChange={e => setUpdateForm({ ...updateForm, visibleToCustomer: e.target.checked })} className="rounded" />
                  Visible to customer
                </label>
                <button type="submit" disabled={createUpdate.isPending} className="rounded bg-orange-500 px-4 py-1.5 text-sm text-white font-medium hover:bg-orange-400 disabled:opacity-50">Post Update</button>
              </div>
            </form>
            <div className="space-y-3">
              {(updates as any[])?.map((u: any) => (
                <div key={u.id} className="border-l-4 border-orange-300 pl-4 py-1">
                  {u.title && <p className="text-sm font-medium text-slate-800">{u.title}</p>}
                  <p className="text-sm text-slate-600">{u.content}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                    <span>{u.createdAt ? new Date(u.createdAt).toLocaleString("en-GB") : ""}</span>
                    {u.visibleToCustomer ? <span className="text-green-500">Visible to customer</span> : <span>Internal only</span>}
                  </div>
                </div>
              ))}
              {!(updates as any[])?.length && <p className="text-sm text-slate-400">No updates yet</p>}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
            <h2 className="font-semibold text-slate-900">Update Status</h2>
            {["Enquiry", "Survey Booked", "Quote Approved", "Scheduled", "In Progress", "Completed"].map(s => (
              <button key={s} onClick={() => handleStatusChange(s)} className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors ${p.status === s ? "bg-orange-500 text-white font-medium" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>{s}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomersPage() {
  const { data: customers, isLoading } = useListCustomers();
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Customers</h1>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <>
          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {!(customers as any[])?.length ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">No customers yet</div> : (customers as any[]).map((c: any) => (
              <Link key={c.id} href={`/dashboard/customers/${c.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300 transition-colors active:bg-slate-50">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="font-medium text-slate-900">{c.firstName} {c.lastName}</div>
                  {c.portalEnabled && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Portal</span>}
                </div>
                <div className="text-xs text-slate-500 space-y-0.5">
                  {c.email && <div>{c.email}</div>}
                  {c.phone && <div>{c.phone}</div>}
                  {c.city && <div>{c.city}</div>}
                </div>
              </Link>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Email</th><th className="text-left px-4 py-3">Phone</th><th className="text-left px-4 py-3">City</th><th className="text-left px-4 py-3">Portal</th><th className="px-4 py-3" />
                </tr></thead>
                <tbody>
                  {!(customers as any[])?.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No customers yet</td></tr> : (customers as any[]).map((c: any) => (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900"><Link href={`/dashboard/customers/${c.id}`} className="hover:text-orange-600">{c.firstName} {c.lastName}</Link></td>
                      <td className="px-4 py-3 text-slate-600">{c.email || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{c.phone || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{c.city || "-"}</td>
                      <td className="px-4 py-3">{c.portalEnabled ? <span className="text-xs text-green-600 font-medium">Active</span> : <span className="text-xs text-slate-400">Inactive</span>}</td>
                      <td className="px-4 py-3 text-right"><Link href={`/dashboard/customers/${c.id}`} className="text-xs text-orange-500">View</Link></td>
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

function CustomerDetailPage({ id }: { id: number }) {
  const { data: customer, isLoading } = useGetCustomer(id);
  const { data: allLeads } = useListLeads();
  const { data: allQuotes } = useListQuotes();
  const { data: allProjects } = useListProjects();
  const c = customer as any;
  const leads = (allLeads as any[])?.filter((l: any) => l.email === c?.email) || [];
  const quotes = (allQuotes as any[])?.filter((q: any) => q.customerId === id) || [];
  const projects = (allProjects as any[])?.filter((p: any) => p.customerId === id) || [];
  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>;
  if (!c) return <div className="p-8 text-center text-slate-500">Customer not found</div>;
  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/dashboard/customers" className="text-sm text-slate-500 hover:text-orange-500">&larr; Customers</Link>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{c.firstName} {c.lastName}</h1>
        {c.portalEnabled && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Portal Active</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
            <h2 className="font-semibold text-slate-900">Customer Info</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Email: </span><a href={`mailto:${c.email}`} className="text-orange-600 hover:underline break-all">{c.email || "-"}</a></div>
              <div><span className="text-slate-500">Phone: </span><a href={`tel:${c.phone}`} className="text-orange-600 hover:underline">{c.phone || "-"}</a></div>
              <div className="sm:col-span-2"><span className="text-slate-500">Address: </span><span className="text-slate-900">{[c.address, c.city, c.postcode].filter(Boolean).join(", ") || "-"}</span></div>
              {c.notes && <div className="sm:col-span-2"><span className="text-slate-500">Notes: </span><span className="text-slate-900">{c.notes}</span></div>}
            </div>
          </div>
          {leads.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="font-semibold text-slate-900 mb-3">Linked Leads ({leads.length})</h2>
              <div className="space-y-2">
                {leads.map((l: any) => (
                  <div key={l.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2 gap-2">
                    <span className="text-slate-700 truncate">{l.serviceInterest || "Lead"} — {l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-GB") : ""}</span>
                    <div className="flex items-center gap-2 flex-shrink-0"><Badge status={l.status} /><Link href={`/dashboard/leads/${l.id}`} className="text-xs text-orange-500">View</Link></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {quotes.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="font-semibold text-slate-900 mb-3">Quotes ({quotes.length})</h2>
              <div className="space-y-2">
                {quotes.map((q: any) => (
                  <div key={q.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2 gap-2">
                    <span className="text-slate-700 truncate">{q.reference} — £{Number(q.total || 0).toFixed(2)}</span>
                    <div className="flex items-center gap-2 flex-shrink-0"><Badge status={q.status} /><Link href={`/dashboard/quotes/${q.id}`} className="text-xs text-orange-500">View</Link></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {projects.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="font-semibold text-slate-900 mb-3">Projects ({projects.length})</h2>
              <div className="space-y-2">
                {projects.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2 gap-2">
                    <span className="text-slate-700 truncate">{p.title}</span>
                    <div className="flex items-center gap-2 flex-shrink-0"><Badge status={p.status} /><Link href={`/dashboard/projects/${p.id}`} className="text-xs text-orange-500">View</Link></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {leads.length === 0 && quotes.length === 0 && projects.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-slate-400 text-sm">No linked leads, quotes or projects yet</div>
          )}
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 text-sm space-y-2">
            <h2 className="font-semibold text-slate-900">Summary</h2>
            <div className="text-slate-600">Leads: <span className="font-medium text-slate-800">{leads.length}</span></div>
            <div className="text-slate-600">Quotes: <span className="font-medium text-slate-800">{quotes.length}</span></div>
            <div className="text-slate-600">Projects: <span className="font-medium text-slate-800">{projects.length}</span></div>
            <div className="text-slate-600">Member since: <span className="font-medium text-slate-800">{c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-GB") : "-"}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CmsStubBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-xs text-slate-500 hover:text-orange-600 transition-colors px-2 py-1 rounded hover:bg-orange-50">{label}</button>
  );
}

function GalleryPage() {
  const { data, isLoading } = useListGalleryImages();
  const rows = data as any[] || [];
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Gallery</h1>
        <button onClick={comingSoon} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add Image</button>
      </div>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {!rows.length ? <div className="p-8 text-center text-slate-400">No gallery images yet</div> : (
            <div className="divide-y divide-slate-100">
              {rows.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  {item.imageUrl && <img src={item.imageUrl} alt={item.altText || ""} className="w-12 h-12 object-cover rounded-lg flex-shrink-0 bg-slate-100" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.caption || "Untitled"}</p>
                    <p className="text-xs text-slate-400">{item.featured ? "Featured" : ""}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <CmsStubBtn label="Edit" onClick={comingSoon} />
                    <CmsStubBtn label="Delete" onClick={comingSoon} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewsPage() {
  const { data, isLoading } = useListReviews();
  const rows = data as any[] || [];
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Reviews</h1>
        <button onClick={comingSoon} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add</button>
      </div>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {!rows.length ? <div className="p-8 text-center text-slate-400">No reviews yet</div> : (
            <div className="divide-y divide-slate-100">
              {rows.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.reviewerName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-amber-500">{"★".repeat(item.rating || 5)}</span>
                      {item.featured && <span className="text-xs text-green-600 font-medium">Featured</span>}
                      {!item.published && <span className="text-xs text-slate-400">Draft</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <CmsStubBtn label="Edit" onClick={comingSoon} />
                    <CmsStubBtn label="Delete" onClick={comingSoon} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CaseStudiesPage() {
  const { data, isLoading } = useListCaseStudies();
  const rows = data as any[] || [];
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Case Studies</h1>
        <button onClick={comingSoon} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add</button>
      </div>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {!rows.length ? <div className="p-8 text-center text-slate-400">No case studies yet</div> : (
            <div className="divide-y divide-slate-100">
              {rows.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.location && <span className="text-xs text-slate-400">{item.location}</span>}
                      {item.featured && <span className="text-xs text-green-600 font-medium">Featured</span>}
                      {!item.published && <span className="text-xs text-slate-400">Draft</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <CmsStubBtn label="Edit" onClick={comingSoon} />
                    <CmsStubBtn label="Delete" onClick={comingSoon} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ServicesPage() {
  const { data, isLoading } = useListServices();
  const rows = data as any[] || [];
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Services</h1>
        <button onClick={comingSoon} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add</button>
      </div>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {!rows.length ? <div className="p-8 text-center text-slate-400">No services yet</div> : (
            <div className="divide-y divide-slate-100">
              {rows.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.featured && <span className="text-xs text-green-600 font-medium">Featured</span>}
                      {!item.published && <span className="text-xs text-slate-400">Draft</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <CmsStubBtn label="Edit" onClick={comingSoon} />
                    <CmsStubBtn label="Delete" onClick={comingSoon} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AreasPage() {
  const { data, isLoading } = useListAreas();
  const rows = data as any[] || [];
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Areas</h1>
        <button onClick={comingSoon} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add</button>
      </div>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {!rows.length ? <div className="p-8 text-center text-slate-400">No areas yet</div> : (
            <div className="divide-y divide-slate-100">
              {rows.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.county && <span className="text-xs text-slate-400">{item.county}</span>}
                      {!item.published && <span className="text-xs text-slate-400">Draft</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <CmsStubBtn label="Edit" onClick={comingSoon} />
                    <CmsStubBtn label="Delete" onClick={comingSoon} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FaqsPage() {
  const { data, isLoading } = useListFaqs();
  const rows = data as any[] || [];
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">FAQs</h1>
        <button onClick={comingSoon} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add</button>
      </div>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {!rows.length ? <div className="p-8 text-center text-slate-400">No FAQs yet</div> : (
            <div className="divide-y divide-slate-100">
              {rows.map((item: any) => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{item.question}</p>
                    {item.answer && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.answer}</p>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0 mt-0.5">
                    <CmsStubBtn label="Edit" onClick={comingSoon} />
                    <CmsStubBtn label="Delete" onClick={comingSoon} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BlogPage() {
  const { data, isLoading } = useListBlogPosts();
  const rows = data as any[] || [];
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Blog</h1>
        <button onClick={comingSoon} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ New Post</button>
      </div>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {!rows.length ? <div className="p-8 text-center text-slate-400">No blog posts yet</div> : (
            <div className="divide-y divide-slate-100">
              {rows.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.authorName && <span className="text-xs text-slate-400">by {item.authorName}</span>}
                      {!item.published && <span className="text-xs text-amber-600 font-medium">Draft</span>}
                      {item.published && <span className="text-xs text-green-600 font-medium">Published</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <CmsStubBtn label="Edit" onClick={comingSoon} />
                    <CmsStubBtn label="Delete" onClick={comingSoon} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessagesPage() {
  const { data: messages, isLoading } = useListContactMessages();
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Messages</h1>
      <div className="space-y-3">
        {isLoading ? <div className="text-center py-12 text-slate-400">Loading...</div> : (messages as any[])?.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">No messages yet</div>
        ) : (messages as any[]).map((m: any) => (
          <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="font-medium text-slate-900">{m.senderName || m.name || "Unknown"}</div>
              <div className="text-xs text-slate-400">{m.createdAt ? new Date(m.createdAt).toLocaleString("en-GB") : ""}</div>
            </div>
            {m.subject && <div className="text-sm font-medium text-slate-700">{m.subject}</div>}
            <p className="text-sm text-slate-600">{m.message}</p>
            <div className="flex gap-4 text-xs text-slate-400 flex-wrap">
              {(m.senderEmail || m.email) && <a href={`mailto:${m.senderEmail || m.email}`} className="text-orange-500 hover:underline">{m.senderEmail || m.email}</a>}
              {(m.senderPhone || m.phone) && <a href={`tel:${m.senderPhone || m.phone}`} className="text-orange-500 hover:underline">{m.senderPhone || m.phone}</a>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualiserPage() {
  const { data, isLoading } = useListVisualiserRequests();
  const rows = data as any[] || [];
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Visualiser Requests</h1>
        <button onClick={comingSoon} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add</button>
      </div>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {!rows.length ? <div className="p-8 text-center text-slate-400">No visualiser requests yet</div> : (
            <div className="divide-y divide-slate-100">
              {rows.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.name || "Unknown"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.email && <span className="text-xs text-slate-400 truncate">{item.email}</span>}
                      {item.status && <Badge status={item.status} />}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 flex-shrink-0 mr-1">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-GB") : ""}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <CmsStubBtn label="Edit" onClick={comingSoon} />
                    <CmsStubBtn label="Delete" onClick={comingSoon} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamPage() {
  const { data, isLoading } = useListTeamMembers();
  const rows = data as any[] || [];
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Team</h1>
        <button onClick={comingSoon} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add Member</button>
      </div>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {!rows.length ? <div className="p-8 text-center text-slate-400">No team members yet</div> : (
            <div className="divide-y divide-slate-100">
              {rows.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-orange-600">{(item.name || "?")[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400 truncate">{item.role || ""}{item.email ? ` · ${item.email}` : ""}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <CmsStubBtn label="Edit" onClick={comingSoon} />
                    <CmsStubBtn label="Delete" onClick={comingSoon} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsPage() {
  const { data: settings, isLoading } = useGetSettings();
  const updateMutation = useUpdateSettings();
  const testEmailMutation = useTestEmailSettings();
  const testSmsMutation = useTestSmsSettings();
  const [form, setForm] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [smtpPass, setSmtpPass] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [emailTestResult, setEmailTestResult] = useState<{ ok: boolean; error?: string | null } | null>(null);
  const [smsTestResult, setSmsTestResult] = useState<{ ok: boolean; error?: string | null } | null>(null);

  const s = settings as any;
  if (!form && s) setForm(s);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...form };
    if (smtpPass) payload.smtpPass = smtpPass;
    else delete payload.smtpPass;
    if (twilioAuthToken) payload.twilioAuthToken = twilioAuthToken;
    else delete payload.twilioAuthToken;
    await updateMutation.mutateAsync({ data: payload } as any);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestEmail = async () => {
    setEmailTestResult(null);
    const result = await testEmailMutation.mutateAsync();
    setEmailTestResult(result);
    setTimeout(() => setEmailTestResult(null), 8000);
  };

  const handleTestSms = async () => {
    setSmsTestResult(null);
    const result = await testSmsMutation.mutateAsync();
    setSmsTestResult(result);
    setTimeout(() => setSmsTestResult(null), 8000);
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>;
  if (!form) return null;

  const field = (key: string, label: string, type = "text", hint?: string) => (
    <div key={key}>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <input type={type} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form[key] ?? ""} onChange={e => setForm({ ...form, [key]: e.target.value })} />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-6">Settings</h1>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Custom Domain</h2>
          {field("customDomain", "Your Domain", "text", "e.g. www.amorendering.co.uk — add a CNAME DNS record pointing to bizzflowuk.com")}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Branding</h2>
          {field("primaryColor", "Primary Colour", "color")}
          {field("logoUrl", "Logo URL")}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Hero Section</h2>
          {field("heroHeadline", "Hero Headline")}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hero Subheadline</label>
            <textarea rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.heroSubheadline || ""} onChange={e => setForm({ ...form, heroSubheadline: e.target.value })} />
          </div>
          {field("ctaText", "CTA Button Text")}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Contact Information</h2>
          {field("phone", "Phone")}
          {field("email", "Public Email")}
          {field("address", "Address")}
          {field("city", "City")}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Email Notifications</h2>
          {field("adminNotificationEmail", "Admin Notification Email", "email", "Receives emails when a lead/quote/contact form is submitted")}
          {field("customerEmail", "Customer Confirmation Email", "email", "Shown to customers as your contact email in confirmation messages")}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">Email Server (SMTP)</h2>
            <p className="text-xs text-slate-500 mt-1">Connect your own mail server so notifications send from your domain.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-1 sm:col-span-2">
              {field("smtpHost", "Mail Server Host", "text", "e.g. mail.yourdomain.com or smtp.office365.com")}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Port</label>
              <input type="number" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.smtpPort ?? 587} onChange={e => setForm({ ...form, smtpPort: Number(e.target.value) })} />
              <p className="text-xs text-slate-400 mt-1">Usually 587 (STARTTLS) or 465 (SSL)</p>
            </div>
            <div className="flex items-center gap-3 sm:pt-6">
              <input type="checkbox" id="smtpSecure" className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" checked={!!form.smtpSecure} onChange={e => setForm({ ...form, smtpSecure: e.target.checked })} />
              <label htmlFor="smtpSecure" className="text-sm font-medium text-slate-700">Use SSL/TLS (port 465)</label>
            </div>
            <div>{field("smtpUser", "Username / Email", "email", "Usually your full email address")}</div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input type="password" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Leave blank to keep existing" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} autoComplete="new-password" />
              <p className="text-xs text-slate-400 mt-1">Leave blank to keep existing password</p>
            </div>
            <div className="col-span-1 sm:col-span-2">
              {field("smtpFrom", "From Address", "text", `e.g. AMO Rendering <info@amorendering.co.uk>`)}
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 flex-wrap">
            <button type="button" onClick={handleTestEmail} disabled={testEmailMutation.isPending} className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {testEmailMutation.isPending ? "Sending…" : "Send test email"}
            </button>
            {emailTestResult?.ok && <span className="text-sm text-green-600 font-medium">✓ Test email sent</span>}
            {emailTestResult && !emailTestResult.ok && <span className="text-sm text-red-600">{emailTestResult.error || "Failed to send"}</span>}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">SMS Notifications (Twilio)</h2>
            <p className="text-xs text-slate-500 mt-1">Get a text when a new lead, quote or contact comes in.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>{field("twilioAccountSid", "Account SID", "text", "Starts with AC — find it in your Twilio console")}</div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Auth Token</label>
              <input type="password" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder="Leave blank to keep existing" value={twilioAuthToken} onChange={e => setTwilioAuthToken(e.target.value)} autoComplete="new-password" />
              <p className="text-xs text-slate-400 mt-1">Leave blank to keep existing token</p>
            </div>
            <div>{field("twilioFromNumber", "Twilio From Number", "text", "Your Twilio number e.g. +447700900000")}</div>
            <div>{field("adminNotificationPhone", "Your Mobile Number", "text", "Where SMS alerts are sent e.g. +447700900123")}</div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 flex-wrap">
            <button type="button" onClick={handleTestSms} disabled={testSmsMutation.isPending} className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {testSmsMutation.isPending ? "Sending…" : "Send test SMS"}
            </button>
            {smsTestResult?.ok && <span className="text-sm text-green-600 font-medium">✓ Test SMS sent</span>}
            {smsTestResult && !smsTestResult.ok && <span className="text-sm text-red-600">{smsTestResult.error || "Failed to send"}</span>}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Social Media</h2>
          {field("facebookUrl", "Facebook URL")}
          {field("instagramUrl", "Instagram URL")}
          {field("twitterUrl", "Twitter/X URL")}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">SEO</h2>
          {field("seoTitle", "SEO Title")}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">SEO Description</label>
            <textarea rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" value={form.seoDescription || ""} onChange={e => setForm({ ...form, seoDescription: e.target.value })} />
          </div>
          {field("googleAnalyticsId", "Google Analytics ID")}
        </div>
        <div className="flex items-center gap-4 pb-4">
          <button type="submit" disabled={updateMutation.isPending} className="inline-flex h-10 items-center rounded-md bg-orange-500 px-6 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">
            {updateMutation.isPending ? "Saving..." : "Save Settings"}
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
        </div>
      </form>
    </div>
  );
}

export default function DashboardApp() {
  const { isSignedIn } = useAuthCtx();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isSignedIn) return <Redirect to="/sign-in" />;

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-slate-900 min-h-screen flex-col">
        <SidebarContent currentPath={location} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-4 pt-4 pb-0 border-b border-slate-800">
              <span className="text-white font-bold text-sm">Menu</span>
              <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white p-2 -mr-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <SidebarContent currentPath={location} onNavClick={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 bg-white border-b border-slate-200 px-4 h-14 flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="font-semibold text-slate-800 text-sm">
            {NAV_ITEMS.find(n => n && (location === n.path || (location.startsWith(n.path + "/") && n.path !== "/dashboard")))?.label || "Dashboard"}
          </span>
        </header>

        <main className="flex-1 overflow-auto">
          <Switch>
            <Route path="/dashboard" component={DashboardHome} />
            <Route path="/dashboard/leads" component={LeadsPage} />
            <Route path="/dashboard/leads/:id" component={({ params: p }) => <LeadDetailPage id={Number(p.id)} />} />
            <Route path="/dashboard/quotes" component={QuotesPage} />
            <Route path="/dashboard/quotes/:id" component={({ params: p }) => <QuoteDetailPage id={Number(p.id)} />} />
            <Route path="/dashboard/projects" component={ProjectsPage} />
            <Route path="/dashboard/projects/:id" component={({ params: p }) => <ProjectDetailPage id={Number(p.id)} />} />
            <Route path="/dashboard/customers" component={CustomersPage} />
            <Route path="/dashboard/customers/:id" component={({ params: p }) => <CustomerDetailPage id={Number(p.id)} />} />
            <Route path="/dashboard/gallery" component={GalleryPage} />
            <Route path="/dashboard/reviews" component={ReviewsPage} />
            <Route path="/dashboard/case-studies" component={CaseStudiesPage} />
            <Route path="/dashboard/services" component={ServicesPage} />
            <Route path="/dashboard/areas" component={AreasPage} />
            <Route path="/dashboard/faqs" component={FaqsPage} />
            <Route path="/dashboard/blog" component={BlogPage} />
            <Route path="/dashboard/messages" component={MessagesPage} />
            <Route path="/dashboard/visualiser" component={VisualiserPage} />
            <Route path="/dashboard/team" component={TeamPage} />
            <Route path="/dashboard/settings" component={SettingsPage} />
            <Route component={() => <div className="p-8 text-slate-400">Page not found</div>} />
          </Switch>
        </main>
      </div>
    </div>
  );
}
