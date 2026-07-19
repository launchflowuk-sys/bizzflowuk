import { Switch, Route, useLocation, Link, useLocation as useWouterLocation, Redirect } from "wouter";
import { useAuthCtx } from "@/lib/auth";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import {
  useGetMe, useGetDashboardStats, useGetRecentActivity, useGetLeadPipeline,
  useListLeads, useGetLead, useCreateLead, useUpdateLead, useDeleteLead, useListLeadNotes, useCreateLeadNote,
  useConvertLeadToQuote, useConvertLeadToProject,
  useListQuotes, useGetQuote, useCreateQuote, useUpdateQuote, useListQuoteItems, useCreateQuoteItem, useUpdateQuoteItem, useDeleteQuoteItem, useConvertQuoteToProject,
  useListQuotePaymentLinks, useCreateQuotePaymentLink, useSendPaymentLink, useListPaymentLinks, useCreateStandalonePaymentLink,
  useListProjects, useGetProject, useCreateProject, useUpdateProject, useListProjectUpdates, useCreateProjectUpdate,
  useListCustomers, useGetCustomer, useCreateCustomer,
  useListGalleryImages, useCreateGalleryImage, useUpdateGalleryImage, useDeleteGalleryImage,
  useListReviews, useCreateReview, useUpdateReview, useDeleteReview,
  useListCaseStudies, useCreateCaseStudy, useUpdateCaseStudy, useDeleteCaseStudy,
  useListServices, useCreateService, useUpdateService, useDeleteService,
  useListPriceItems, useCreatePriceItem, useUpdatePriceItem, useDeletePriceItem,
  useListAreas, useCreateArea, useUpdateArea, useDeleteArea,
  useListFaqs, useCreateFaq, useUpdateFaq, useDeleteFaq,
  useListBlogPosts, useCreateBlogPost, useUpdateBlogPost, useDeleteBlogPost,
  useListVisualiserRequests, useDeleteVisualiserRequest,
  useListContactMessages,
  useListTeamMembers, useCreateTeamMember, useUpdateTeamMember, useDeleteTeamMember,
  useGetSettings, useUpdateSettings, useTestEmailSettings, useTestSmsSettings,
  useListSentEmails, useComposeEmail, useRequestDashboardUploadUrl,
} from "@workspace/api-client-react";
import {
  getListLeadsQueryKey, getListQuotesQueryKey, getListProjectsQueryKey, getListCustomersQueryKey,
  getListQuoteItemsQueryKey, getListQuotePaymentLinksQueryKey, getListPaymentLinksQueryKey, getListProjectUpdatesQueryKey,
  getListGalleryImagesQueryKey, getListReviewsQueryKey, getListCaseStudiesQueryKey,
  getListServicesQueryKey, getListPriceItemsQueryKey, getListAreasQueryKey, getListFaqsQueryKey,
  getListBlogPostsQueryKey, getListTeamMembersQueryKey, getListSentEmailsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

// ─── Toast system ─────────────────────────────────────────────────────────────
type ToastMsg = { id: number; text: string; type: "success" | "error" };
type ToastFn = (text: string, type?: "success" | "error") => void;
const ToastCtx = createContext<ToastFn>(() => {});
function useToast() { return useContext(ToastCtx); }

function ToastContainer({ toasts, remove }: { toasts: ToastMsg[]; remove: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg text-sm font-medium pointer-events-auto animate-in fade-in slide-in-from-bottom-2 ${t.type === "error" ? "bg-red-600 text-white" : "bg-slate-900 text-white"}`}>
          <span>{t.type === "success" ? "✓" : "✕"}</span>
          <span>{t.text}</span>
          <button onClick={() => remove(t.id)} className="ml-2 opacity-60 hover:opacity-100">✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── Generic Modal ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white rounded-t-xl">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Delete Confirm inside modal ────────────────────────────────────────────────
function DeleteConfirm({ label, onConfirm, onCancel, isPending }: { label: string; onConfirm: () => void; onCancel: () => void; isPending: boolean }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700">Are you sure you want to delete <strong>{label}</strong>? This cannot be undone.</p>
      <div className="flex gap-2">
        <button onClick={onConfirm} disabled={isPending} className="inline-flex h-9 items-center rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">
          {isPending ? "Deleting..." : "Yes, Delete"}
        </button>
        <button onClick={onCancel} className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
      </div>
    </div>
  );
}

// ─── Shared helpers ─────────────────────────────────────────────────────────────
const inputCls = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500";
const labelCls = "block text-sm font-medium text-slate-700 mb-1";

function FField({ label, value, onChange, type = "text", hint }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; hint?: string }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input type={type} className={inputCls} value={value ?? ""} onChange={e => onChange(e.target.value)} />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}
function FTextarea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <textarea rows={rows} className={inputCls} value={value ?? ""} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
function FCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  );
}
function SaveCancelBar({ onCancel, isPending, label = "Save" }: { onCancel: () => void; isPending: boolean; label?: string }) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="submit" disabled={isPending} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">
        {isPending ? "Saving..." : label}
      </button>
      <button type="button" onClick={onCancel} className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
    </div>
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

function SignOutButton() {
  const { signOut } = useAuthCtx();
  return (
    <button onClick={signOut} className="w-full text-left px-3 py-2 rounded-md text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
      Sign out
    </button>
  );
}

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { path: "/dashboard/leads", label: "Leads", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { path: "/dashboard/quotes", label: "Quotes", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { path: "/dashboard/payment-links", label: "Payment Links", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { path: "/dashboard/emails", label: "Emails", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { path: "/dashboard/projects", label: "Projects", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { path: "/dashboard/customers", label: "Customers", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  null,
  { path: "/dashboard/gallery", label: "Gallery", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { path: "/dashboard/reviews", label: "Reviews", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
  { path: "/dashboard/case-studies", label: "Case Studies", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { path: "/dashboard/services", label: "Services", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" },
  { path: "/dashboard/pricing", label: "Pricing", icon: "M9 8h6m-5 0a3 3 0 110 6H9l3 3m-3-9l3-3M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
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
        <div className="font-bold text-white text-sm">BizzFlow</div>
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

// ─── Dashboard Home ────────────────────────────────────────────────────────────
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

// ─── Leads ─────────────────────────────────────────────────────────────────────
function LeadsPage() {
  const { data: leads, isLoading } = useListLeads();
  const qc = useQueryClient();
  const deleteMutation = useDeleteLead();
  const showToast = useToast();
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const filtered = (leads as any[])?.filter((l: any) => !statusFilter || l.status === statusFilter);

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id } as any);
      qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      showToast("Lead deleted");
      setDeleteId(null);
    } catch (err: any) {
      showToast(err?.message || "Delete failed", "error");
    }
  };

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
                      <td className="px-4 py-3 text-right">
                        {deleteId === l.id ? (
                          <span className="flex items-center gap-1 justify-end">
                            <button onClick={() => handleDelete(l.id)} className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded">Confirm</button>
                            <button onClick={() => setDeleteId(null)} className="text-xs text-slate-500 hover:text-slate-700 px-1">Cancel</button>
                          </span>
                        ) : (
                          <button onClick={() => setDeleteId(l.id)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                        )}
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

function LeadDetailPage({ id }: { id: number }) {
  const [, navigate] = useWouterLocation();
  const { data: lead, isLoading } = useGetLead(id);
  const { data: notes } = useListLeadNotes(id);
  const updateMutation = useUpdateLead();
  const noteMutation = useCreateLeadNote();
  const convertToQuote = useConvertLeadToQuote();
  const convertToProject = useConvertLeadToProject();
  const qc = useQueryClient();
  const showToast = useToast();
  const [noteContent, setNoteContent] = useState("");
  const [confirmQuote, setConfirmQuote] = useState(false);
  const [confirmProject, setConfirmProject] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const l = lead as any;

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>;
  if (!l) return <div className="p-8 text-center text-slate-500">Lead not found</div>;

  // Construction-tenant leads populate clientType/projectDescription instead of the
  // rendering-specific survey fields — hide the rendering rows for those to avoid a wall of "-".
  const isConstructionLead = !!(l.clientType || l.projectDescription);

  const handleStatusChange = async (status: string) => {
    try {
      await updateMutation.mutateAsync({ id, data: { status } } as any);
      qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
    } catch (err: any) {
      showToast(err?.message || "Update failed", "error");
    }
  };
  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;
    try {
      await noteMutation.mutateAsync({ id, data: { content: noteContent } } as any);
      setNoteContent("");
      qc.invalidateQueries();
    } catch (err: any) {
      showToast(err?.message || "Failed to add note", "error");
    }
  };
  const handleConvertToQuote = async () => {
    try {
      const result = await convertToQuote.mutateAsync({ id } as any) as any;
      qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
      showToast("Lead converted to quote");
      navigate(`/dashboard/quotes/${result.id}`);
    } catch (err: any) {
      showToast(err?.message || "Conversion failed", "error");
    }
  };
  const handleConvertToProject = async () => {
    try {
      const result = await convertToProject.mutateAsync({ id } as any) as any;
      qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      showToast("Lead converted to project");
      navigate(`/dashboard/projects/${result.id}`);
    } catch (err: any) {
      showToast(err?.message || "Conversion failed", "error");
    }
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
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold text-slate-900">Contact Details</h2>
              {l.reference && <span className="text-xs font-mono text-slate-400">{l.reference}</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Email: </span><a href={`mailto:${l.email}`} className="text-orange-600 hover:underline break-all">{l.email || "-"}</a></div>
              <div><span className="text-slate-500">Phone: </span><a href={`tel:${l.phone}`} className="text-orange-600 hover:underline">{l.phone || "-"}</a></div>
              <div><span className="text-slate-500">Preferred Contact Method: </span><span className="text-slate-900">{l.preferredContactMethod || "-"}</span></div>
              <div><span className="text-slate-500">Best Time to Contact: </span><span className="text-slate-900">{l.bestTimeToContact || "-"}</span></div>
              <div><span className="text-slate-500">City: </span><span className="text-slate-900">{l.city || "-"}</span></div>
              <div><span className="text-slate-500">Postcode: </span><span className="text-slate-900">{l.postcode || "-"}</span></div>
              <div className="sm:col-span-2"><span className="text-slate-500">Address: </span><span className="text-slate-900">{l.address || "-"}</span></div>
              {!isConstructionLead && <div><span className="text-slate-500">Property Type: </span><span className="text-slate-900">{l.propertyType === "Other" && l.propertyTypeOther ? `Other — ${l.propertyTypeOther}` : (l.propertyType || "-")}</span></div>}
              {l.companyName && <div><span className="text-slate-500">Company Name: </span><span className="text-slate-900">{l.companyName}</span></div>}
              {/* Construction-industry lead fields — present only when the lead came from a construction tenant's form */}
              {l.clientType && <div><span className="text-slate-500">Client Type: </span><span className="text-slate-900">{l.clientType}</span></div>}
              {l.urgency && <div><span className="text-slate-500">Urgency: </span><span className="text-slate-900">{l.urgency}</span></div>}
              {l.planningStatus && <div><span className="text-slate-500">Planning / Building Regs: </span><span className="text-slate-900">{l.planningStatus}</span></div>}
              {l.hasDrawings && <div><span className="text-slate-500">Has Drawings / Plans: </span><span className="text-slate-900">{l.hasDrawings}</span></div>}
              {l.projectDescription && <div className="sm:col-span-2"><span className="text-slate-500">Project Description: </span><span className="text-slate-900 whitespace-pre-wrap">{l.projectDescription}</span></div>}
              {!isConstructionLead && (<>
              <div><span className="text-slate-500">Area to Be Rendered: </span><span className="text-slate-900">{l.areaToRender === "Other" && l.areaToRenderOther ? `Other — ${l.areaToRenderOther}` : (l.areaToRender || "-")}</span></div>
              <div><span className="text-slate-500">Number of Storeys: </span><span className="text-slate-900">{l.numberOfStoreys || "-"}</span></div>
              <div><span className="text-slate-500">Approx. Wall Area: </span><span className="text-slate-900">{l.wallArea || "-"}</span></div>
              </>)}
              <div><span className="text-slate-500">Service: </span><span className="text-slate-900">{l.serviceInterest || "-"}</span></div>
              {!isConstructionLead && (<>
              <div><span className="text-slate-500">Existing Surface: </span><span className="text-slate-900">{l.existingSurface || "-"}</span></div>
              <div className="sm:col-span-2"><span className="text-slate-500">Current Condition: </span><span className="text-slate-900">{(l.currentCondition as string[] | undefined)?.length ? (l.currentCondition as string[]).join(", ") : "-"}</span></div>
              <div><span className="text-slate-500">Desired Finish: </span><span className="text-slate-900">{l.desiredFinish || "-"}</span></div>
              <div><span className="text-slate-500">Preferred Colour: </span><span className="text-slate-900">{(l.preferredColour === "Custom Colour" || l.preferredColour === "Other") && l.preferredColourOther ? `${l.preferredColour} — ${l.preferredColourOther}` : (l.preferredColour || "-")}</span></div>
              {l.serviceInterest === "External Wall Insulation" && (
                <>
                  <div><span className="text-slate-500">Requires Insulation: </span><span className="text-slate-900">{l.requiresInsulation || "-"}</span></div>
                  <div><span className="text-slate-500">Insulation Thickness: </span><span className="text-slate-900">{l.insulationThickness || "-"}</span></div>
                  <div><span className="text-slate-500">Insulation Material: </span><span className="text-slate-900">{l.insulationMaterial || "-"}</span></div>
                </>
              )}
              <div className="sm:col-span-2"><span className="text-slate-500">Access Conditions: </span><span className="text-slate-900">{(l.accessConditions as string[] | undefined)?.length ? (l.accessConditions as string[]).join(", ") : "-"}</span></div>
              <div><span className="text-slate-500">Property Status: </span><span className="text-slate-900">{l.propertyStatus || "-"}</span></div>
              </>)}
              <div><span className="text-slate-500">Timeframe: </span><span className="text-slate-900">{l.timeframe || "-"}</span></div>
              <div><span className="text-slate-500">Source: </span><span className="text-slate-900">{l.source || "-"}</span></div>
              <div><span className="text-slate-500">Budget: </span><span className="text-slate-900">{l.budget || "-"}</span></div>
              <div><span className="text-slate-500">Created: </span><span className="text-slate-900">{l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-GB") : "-"}</span></div>
              {l.notes && <div className="sm:col-span-2"><span className="text-slate-500">Notes: </span><span className="text-slate-900">{l.notes}</span></div>}
              {!!(l.photoUrls as string[] | undefined)?.length && (
                <div className="sm:col-span-2">
                  <span className="text-slate-500">Attachments: </span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {(l.photoUrls as string[]).map((u, i) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50">Attachment {i + 1}</a>
                    ))}
                  </div>
                </div>
              )}
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
            <button onClick={() => setShowCompose(true)} disabled={!l.email} title={!l.email ? "This lead has no email on file" : undefined} className="w-full rounded-md border border-slate-300 text-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed">
              ✉ Send Email / Request More Info
            </button>
            {!confirmQuote ? (
              <button onClick={() => setConfirmQuote(true)} className="w-full rounded-md border border-orange-500 text-orange-600 px-3 py-2.5 text-sm font-medium hover:bg-orange-50">
                → Convert to Quote
              </button>
            ) : (
              <div className="rounded-md border border-orange-200 bg-orange-50 p-3 space-y-2">
                <p className="text-xs text-slate-700 font-medium">Convert this lead to a quote?</p>
                <div className="flex gap-2">
                  <button onClick={handleConvertToQuote} disabled={convertToQuote.isPending} className="flex-1 rounded bg-orange-500 text-white py-1.5 text-xs font-medium hover:bg-orange-400 disabled:opacity-50">
                    {convertToQuote.isPending ? "Converting..." : "Yes, Convert"}
                  </button>
                  <button onClick={() => setConfirmQuote(false)} className="flex-1 rounded border border-slate-300 text-slate-700 py-1.5 text-xs font-medium hover:bg-slate-50">Cancel</button>
                </div>
              </div>
            )}
            {!confirmProject ? (
              <button onClick={() => setConfirmProject(true)} className="w-full rounded-md border border-slate-300 text-slate-700 px-3 py-2.5 text-sm font-medium hover:bg-slate-50">
                → Convert to Project
              </button>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-xs text-slate-700 font-medium">Convert directly to a project?</p>
                <div className="flex gap-2">
                  <button onClick={handleConvertToProject} disabled={convertToProject.isPending} className="flex-1 rounded bg-slate-700 text-white py-1.5 text-xs font-medium hover:bg-slate-600 disabled:opacity-50">
                    {convertToProject.isPending ? "Converting..." : "Yes, Convert"}
                  </button>
                  <button onClick={() => setConfirmProject(false)} className="flex-1 rounded border border-slate-300 text-slate-700 py-1.5 text-xs font-medium hover:bg-slate-50">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {showCompose && (
        <ComposeEmailModal
          initialTo={l.email || ""}
          initialToName={`${l.firstName || ""} ${l.lastName || ""}`.trim()}
          leadId={id}
          onClose={() => setShowCompose(false)}
        />
      )}
    </div>
  );
}

// ─── New Lead Page ────────────────────────────────────────────────────────────
function NewLeadPage() {
  const [, navigate] = useWouterLocation();
  const createMutation = useCreateLead();
  const qc = useQueryClient();
  const showToast = useToast();
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    serviceInterest: "", city: "", address: "", source: "", status: "New", notes: "",
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const lead = await createMutation.mutateAsync({ data: form } as any) as any;
      qc.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      showToast("Lead created");
      navigate(`/dashboard/leads/${lead.id}`);
    } catch (err: any) { showToast(err?.message || "Failed to create lead", "error"); }
  };

  const fieldCls = "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500";

  return (
    <div className="p-4 sm:p-6 max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/leads" className="text-sm text-slate-500 hover:text-orange-500">← Leads</Link>
        <h1 className="text-xl font-bold text-slate-900">New Lead</h1>
      </div>
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-xs font-medium text-slate-700 mb-1">First Name</label><input value={form.firstName} onChange={set("firstName")} className={fieldCls} /></div>
          <div><label className="block text-xs font-medium text-slate-700 mb-1">Last Name</label><input value={form.lastName} onChange={set("lastName")} className={fieldCls} /></div>
          <div><label className="block text-xs font-medium text-slate-700 mb-1">Email</label><input type="email" value={form.email} onChange={set("email")} className={fieldCls} /></div>
          <div><label className="block text-xs font-medium text-slate-700 mb-1">Phone</label><input type="tel" value={form.phone} onChange={set("phone")} className={fieldCls} /></div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Service Interest</label>
            <select value={form.serviceInterest} onChange={set("serviceInterest")} className={fieldCls}>
              <option value="">Select service...</option>
              {["Silicone Rendering","Monocouche Rendering","K Rend","Pebbledash Removal","EWI","Render Repairs","Other"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
            <select value={form.status} onChange={set("status")} className={fieldCls}>
              {["New","Contacted","Survey Booked","Quote Sent","Won","Lost"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div><label className="block text-xs font-medium text-slate-700 mb-1">City</label><input value={form.city} onChange={set("city")} className={fieldCls} /></div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Source</label>
            <select value={form.source} onChange={set("source")} className={fieldCls}>
              <option value="">Select source...</option>
              {["Website","Referral","Google","Facebook","Instagram","Other"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2"><label className="block text-xs font-medium text-slate-700 mb-1">Address</label><input value={form.address} onChange={set("address")} className={fieldCls} /></div>
          <div className="sm:col-span-2"><label className="block text-xs font-medium text-slate-700 mb-1">Notes</label><textarea rows={3} value={form.notes} onChange={set("notes")} className={fieldCls} /></div>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={createMutation.isPending} className="rounded-md bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50">{createMutation.isPending ? "Saving..." : "Create Lead"}</button>
          <Link href="/dashboard/leads" className="rounded-md border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

// ─── Quotes ────────────────────────────────────────────────────────────────────
function QuotesPage() {
  const { data: quotes, isLoading } = useListQuotes();
  const createMutation = useCreateQuote();
  const [, navigate] = useWouterLocation();
  const qc = useQueryClient();
  const showToast = useToast();
  const [showNew, setShowNew] = useState(false);
  const [newRef, setNewRef] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const ref = newRef.trim() || `QUO-${Date.now()}`;
      const q = await createMutation.mutateAsync({ data: { reference: ref } } as any) as any;
      qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
      showToast("Quote created");
      setShowNew(false);
      setNewRef("");
      navigate(`/dashboard/quotes/${q.id}`);
    } catch (err: any) { showToast(err?.message || "Failed to create quote", "error"); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Quotes</h1>
        <button onClick={() => setShowNew(true)} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ New</button>
      </div>
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <h2 className="font-semibold text-slate-900">New Quote</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Reference <span className="font-normal text-slate-400">(leave blank to auto-generate)</span></label>
                <input value={newRef} onChange={e => setNewRef(e.target.value)} placeholder="e.g. QUO-001" className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={createMutation.isPending} className="flex-1 rounded-md bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50">{createMutation.isPending ? "Creating..." : "Create Quote"}</button>
                <button type="button" onClick={() => setShowNew(false)} className="flex-1 rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <>
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

// ─── Standalone Payment Links ──────────────────────────────────────────────────
function PaymentLinksPage() {
  const { data: links, isLoading } = useListPaymentLinks();
  const createLink = useCreateStandalonePaymentLink();
  const sendPaymentLink = useSendPaymentLink();
  const qc = useQueryClient();
  const showToast = useToast();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ customerName: "", customerAddress: "", customerPhone: "", customerEmail: "", amount: "" });
  const [sendingLinkId, setSendingLinkId] = useState<number | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.customerName || !form.customerEmail) { showToast("Customer name and email are required", "error"); return; }
    if (!Number.isFinite(amount) || amount <= 0) { showToast("Enter a valid amount", "error"); return; }
    try {
      await createLink.mutateAsync({ data: {
        customerName: form.customerName,
        customerAddress: form.customerAddress || undefined,
        customerPhone: form.customerPhone || undefined,
        customerEmail: form.customerEmail,
        amount,
      } } as any);
      qc.invalidateQueries({ queryKey: getListPaymentLinksQueryKey() });
      showToast("Payment link created");
      setShowNew(false);
      setForm({ customerName: "", customerAddress: "", customerPhone: "", customerEmail: "", amount: "" });
    } catch (err: any) {
      showToast(err?.message || "Failed to create payment link", "error");
    }
  };

  const copyLink = async (url: string) => {
    try { await navigator.clipboard.writeText(url); showToast("Link copied"); } catch { showToast("Copy failed", "error"); }
  };
  const handleSend = async (linkId: number) => {
    setSendingLinkId(linkId);
    try {
      await sendPaymentLink.mutateAsync({ id: linkId } as any);
      qc.invalidateQueries({ queryKey: getListPaymentLinksQueryKey() });
      showToast("Payment link sent to customer");
    } catch (err: any) {
      showToast(err?.message || "Failed to send payment link", "error");
    } finally {
      setSendingLinkId(null);
    }
  };

  const rows = (links as any[]) || [];

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Payment Links</h1>
          <p className="text-sm text-slate-500">Create and send one-off payment requests for phone or in-person sales — no quote required.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400 whitespace-nowrap">+ New</button>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-slate-900">Create Payment Link</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Customer Name *</label>
                <input value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} required className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
                <input value={form.customerAddress} onChange={e => setForm({ ...form, customerAddress: e.target.value })} className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone Number</label>
                <input value={form.customerPhone} onChange={e => setForm({ ...form, customerPhone: e.target.value })} className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
                <input type="email" value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })} required className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Amount to request (£) *</label>
                <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={createLink.isPending} className="flex-1 rounded-md bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50">{createLink.isPending ? "Creating..." : "Create Payment Link"}</button>
                <button type="button" onClick={() => setShowNew(false)} className="flex-1 rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <>
          <div className="md:hidden space-y-2">
            {!rows.length ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">No payment links yet</div> : rows.map((l: any) => (
              <div key={l.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-slate-900">{l.customerName || l.quoteId && `Quote #${l.quoteId}` || "—"}</div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${l.status === "Paid" ? "bg-green-100 text-green-700" : l.status === "Failed" ? "bg-red-100 text-red-700" : l.status === "Cancelled" ? "bg-slate-200 text-slate-500" : "bg-amber-100 text-amber-700"}`}>{l.status}</span>
                </div>
                <div className="text-xs text-slate-500 space-y-0.5">
                  <div className="font-semibold text-slate-700">£{Number(l.amount).toFixed(2)}</div>
                  {l.customerEmail && <div>{l.customerEmail}</div>}
                  <div>{new Date(l.createdAt).toLocaleDateString("en-GB")} {l.quoteId ? "· Quote-linked" : "· Standalone"}</div>
                </div>
                {l.status === "Pending" && (
                  <>
                    {l.sentAt && <div className="text-[11px] text-green-700 font-medium">✓ Sent {new Date(l.sentAt).toLocaleDateString("en-GB")}</div>}
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => copyLink(l.url)} className="flex-1 rounded border border-slate-300 text-slate-700 py-1.5 text-xs font-medium hover:bg-slate-50">Copy link</button>
                      <button onClick={() => handleSend(l.id)} disabled={sendingLinkId === l.id} className="flex-1 rounded bg-orange-500 text-white py-1.5 text-xs font-medium hover:bg-orange-400 disabled:opacity-50">{sendingLinkId === l.id ? (l.sentAt ? "Resending..." : "Sending...") : (l.sentAt ? "Resend" : "Send Payment Link")}</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Customer</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Amount</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Created</th><th className="px-4 py-3" />
                </tr></thead>
                <tbody>
                  {!rows.length ? <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No payment links yet</td></tr> : rows.map((l: any) => (
                    <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{l.customerName || "—"}<div className="text-xs font-normal text-slate-400">{l.customerEmail}</div></td>
                      <td className="px-4 py-3 text-slate-500">{l.quoteId ? <Link href={`/dashboard/quotes/${l.quoteId}`} className="text-orange-500 hover:text-orange-600">Quote-linked</Link> : "Standalone"}</td>
                      <td className="px-4 py-3 text-slate-700">£{Number(l.amount).toFixed(2)}</td>
                      <td className="px-4 py-3"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${l.status === "Paid" ? "bg-green-100 text-green-700" : l.status === "Failed" ? "bg-red-100 text-red-700" : l.status === "Cancelled" ? "bg-slate-200 text-slate-500" : "bg-amber-100 text-amber-700"}`}>{l.status}</span></td>
                      <td className="px-4 py-3 text-slate-500">{new Date(l.createdAt).toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-3 text-right">
                        {l.status === "Pending" && (
                          <div className="flex items-center justify-end gap-3">
                            {l.sentAt && <span className="text-[11px] text-green-700 font-medium">✓ Sent {new Date(l.sentAt).toLocaleDateString("en-GB")}</span>}
                            <button onClick={() => copyLink(l.url)} className="text-xs text-slate-500 hover:text-slate-700 font-medium">Copy link</button>
                            <button onClick={() => handleSend(l.id)} disabled={sendingLinkId === l.id} className="text-xs text-orange-500 hover:text-orange-600 font-medium disabled:opacity-50">{sendingLinkId === l.id ? (l.sentAt ? "Resending..." : "Sending...") : (l.sentAt ? "Resend" : "Send Payment Link")}</button>
                          </div>
                        )}
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

// ─── Rich text editor — contentEditable + execCommand toolbar, no dependency ──
// Uncontrolled by design: React never re-renders its own innerHTML back in, so typing
// never resets the cursor. Give it a `key` from the parent to force a fresh, empty mount.
function ToolbarBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onMouseDown={e => e.preventDefault()} onClick={onClick} title={title} className="w-8 h-8 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors">
      {children}
    </button>
  );
}
const ToolbarDivider = () => <span className="w-px h-6 bg-slate-300 mx-1 flex-shrink-0" />;

function RichTextEditor({ onChange }: { onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    if (ref.current) {
      onChange(ref.current.innerHTML);
      setIsEmpty(!ref.current.textContent?.trim());
    }
  };
  const handleLink = () => {
    const url = window.prompt("Link URL (e.g. https://example.com)");
    if (url) exec("createLink", url);
  };
  return (
    <div className="rounded-md border border-slate-300 overflow-hidden focus-within:ring-1 focus-within:ring-orange-500 focus-within:border-orange-500">
      <div className="flex items-center gap-0.5 flex-wrap border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        <ToolbarBtn onClick={() => exec("formatBlock", "<h2>")} title="Heading"><span className="text-sm font-bold">H</span></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("formatBlock", "<p>")} title="Paragraph"><span className="text-sm">¶</span></ToolbarBtn>
        <ToolbarDivider/>
        <ToolbarBtn onClick={() => exec("bold")} title="Bold"><span className="text-sm font-bold">B</span></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("italic")} title="Italic"><span className="text-sm italic">I</span></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("underline")} title="Underline"><span className="text-sm underline">U</span></ToolbarBtn>
        <ToolbarDivider/>
        <ToolbarBtn onClick={() => exec("insertUnorderedList")} title="Bullet list">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="7" r="1.3" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="5" cy="17" r="1.3" fill="currentColor" stroke="none"/><path strokeLinecap="round" strokeWidth={2} d="M9.5 7h9M9.5 12h9M9.5 17h9"/></svg>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => exec("insertOrderedList")} title="Numbered list"><span className="text-xs font-semibold">1.</span></ToolbarBtn>
        <ToolbarBtn onClick={() => exec("formatBlock", "<blockquote>")} title="Quote">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M7.17 6A4.5 4.5 0 003 10.5V18h6v-6H5.5v-1.5A2.5 2.5 0 018 8V6H7.17zm10 0A4.5 4.5 0 0013 10.5V18h6v-6h-3.5v-1.5A2.5 2.5 0 0118 8V6h-.83z"/></svg>
        </ToolbarBtn>
        <ToolbarDivider/>
        <ToolbarBtn onClick={handleLink} title="Insert link">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5"/></svg>
        </ToolbarBtn>
        <ToolbarDivider/>
        <ToolbarBtn onClick={() => exec("undo")} title="Undo">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l-4-4 4-4m-4 4h10.5a4.5 4.5 0 110 9H11"/></svg>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => exec("redo")} title="Redo">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4 4-4 4m4-4H8.5a4.5 4.5 0 100 9H13"/></svg>
        </ToolbarBtn>
      </div>
      <div className="relative">
        {isEmpty && <p className="pointer-events-none absolute top-3 left-3 text-sm text-slate-400">Write your message…</p>}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={() => { if (ref.current) { onChange(ref.current.innerHTML); setIsEmpty(!ref.current.textContent?.trim()); } }}
          className="email-rich-editor min-h-[200px] max-h-[400px] overflow-y-auto px-3 py-3 text-[15px] leading-relaxed text-slate-800 focus:outline-none"
        />
      </div>
      <style>{`
        .email-rich-editor h2 { font-size: 1.15em; font-weight: 700; margin: 0.5em 0; }
        .email-rich-editor blockquote { border-left: 3px solid #cbd5e1; padding-left: 0.75em; margin: 0.5em 0; color: #64748b; }
        .email-rich-editor ul { list-style: disc; padding-left: 1.5em; }
        .email-rich-editor ol { list-style: decimal; padding-left: 1.5em; }
        .email-rich-editor a { color: #f97316; text-decoration: underline; }
      `}</style>
    </div>
  );
}

// ─── Attachment upload — used by the email composer, authenticated dashboard upload ──
const EMAIL_ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_EMAIL_ATTACHMENTS = 5;

function EmailAttachmentUpload({ onChange }: { onChange: (urls: string[]) => void }) {
  const requestUrl = useRequestDashboardUploadUrl();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<{ url: string; name: string; state: "uploading" | "done" | "error" }[]>([]);
  const [limitError, setLimitError] = useState<string | null>(null);

  const handleFiles = async (fileList: FileList) => {
    setLimitError(null);
    const incoming = Array.from(fileList);
    const room = MAX_EMAIL_ATTACHMENTS - files.length;
    if (room <= 0) { setLimitError(`You can attach up to ${MAX_EMAIL_ATTACHMENTS} files.`); return; }
    const toUpload = incoming.slice(0, room);
    if (incoming.length > room) setLimitError(`Only ${room} more file${room === 1 ? "" : "s"} could be added (max ${MAX_EMAIL_ATTACHMENTS} total).`);

    const newEntries = toUpload.map(f => ({ url: "", name: f.name, state: "uploading" as const }));
    setFiles(prev => [...prev, ...newEntries]);

    for (const file of toUpload) {
      try {
        const result = await requestUrl.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type as any } }) as any;
        await fetch(result.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        setFiles(prev => {
          const next = prev.map(f => (f.name === file.name && f.state === "uploading") ? { ...f, url: result.objectPath, state: "done" as const } : f);
          onChange(next.filter(f => f.state === "done").map(f => f.url));
          return next;
        });
      } catch {
        setFiles(prev => prev.map(f => (f.name === file.name && f.state === "uploading") ? { ...f, state: "error" as const } : f));
      }
    }
  };

  const removeFile = (name: string) => {
    setFiles(prev => {
      const next = prev.filter(f => f.name !== name);
      onChange(next.filter(f => f.state === "done").map(f => f.url));
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
          Attach Files
        </button>
        <span className="text-[11px] text-slate-400">Photos, PDF or Word — up to {MAX_EMAIL_ATTACHMENTS} files, 10MB each</span>
        <input ref={inputRef} type="file" multiple accept={EMAIL_ATTACHMENT_ACCEPT} className="hidden" onChange={e => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {limitError && <p className="text-xs text-red-600 mt-1">{limitError}</p>}
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map(f => (
            <div key={f.name} className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 pl-2 pr-1.5 py-1 text-xs">
              <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span className="max-w-[140px] truncate text-slate-700">{f.name}</span>
              {f.state === "uploading" && <span className="text-slate-400">…</span>}
              {f.state === "error" && <span className="text-red-500 font-medium">Failed</span>}
              {f.state === "done" && <span className="text-green-600">✓</span>}
              <button type="button" onClick={() => removeFile(f.name)} className="text-slate-400 hover:text-red-500 ml-0.5">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Compose Email modal — reused by the Emails panel and the Lead detail page ──
function ComposeEmailModal({ initialTo = "", initialToName = "", initialSubject = "", leadId, onClose, onSent }: {
  initialTo?: string;
  initialToName?: string;
  initialSubject?: string;
  leadId?: number;
  onClose: () => void;
  onSent?: () => void;
}) {
  const composeEmail = useComposeEmail();
  const qc = useQueryClient();
  const showToast = useToast();
  const [form, setForm] = useState({ toEmail: initialTo, toName: initialToName, subject: initialSubject });
  const bodyRef = useRef("");
  const attachmentsRef = useRef<string[]>([]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.toEmail || !form.subject || !bodyRef.current.trim()) { showToast("Fill in recipient, subject, and message", "error"); return; }
    try {
      await composeEmail.mutateAsync({ data: { toEmail: form.toEmail, toName: form.toName || undefined, subject: form.subject, bodyHtml: bodyRef.current, leadId, attachmentUrls: attachmentsRef.current } } as any);
      qc.invalidateQueries({ queryKey: getListSentEmailsQueryKey() });
      showToast("Email sent");
      onSent?.();
      onClose();
    } catch (err: any) {
      showToast(err?.message || "Failed to send email", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="font-semibold text-slate-900">Compose Email</h2>
        <form onSubmit={handleSend} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">To Email *</label>
              <input type="email" value={form.toEmail} onChange={e => setForm({ ...form, toEmail: e.target.value })} required className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">To Name</label>
              <input value={form.toName} onChange={e => setForm({ ...form, toName: e.target.value })} className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Subject *</label>
            <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Message *</label>
            <RichTextEditor onChange={html => { bodyRef.current = html; }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Attachments</label>
            <EmailAttachmentUpload onChange={urls => { attachmentsRef.current = urls; }} />
          </div>
          <p className="text-[11px] text-slate-400">Sent in your business's branded email design automatically — no need to add a signature.</p>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={composeEmail.isPending} className="flex-1 rounded-md bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50">{composeEmail.isPending ? "Sending..." : "Send Email"}</button>
            <button type="button" onClick={onClose} className="flex-1 rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Emails — one-off branded compose + send log (not a synced inbox) ─────────
function EmailsPage() {
  const { data: emails, isLoading } = useListSentEmails();
  const [showCompose, setShowCompose] = useState(false);

  const rows = (emails as any[]) || [];

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Emails</h1>
          <p className="text-sm text-slate-500">Send a one-off branded email to a lead or customer, and keep a record of what was sent.</p>
        </div>
        <button onClick={() => setShowCompose(true)} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400 whitespace-nowrap">+ Compose</button>
      </div>

      {showCompose && <ComposeEmailModal onClose={() => setShowCompose(false)} />}

      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <>
          <div className="md:hidden space-y-2">
            {!rows.length ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">No emails sent yet</div> : rows.map((m: any) => (
              <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-slate-900">{m.subject}</div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${m.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{m.status}</span>
                </div>
                <div className="text-xs text-slate-500">{m.toName ? `${m.toName} · ` : ""}{m.toEmail}</div>
                <div className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleString("en-GB")}{m.attachmentUrls?.length ? ` · 📎 ${m.attachmentUrls.length}` : ""}</div>
              </div>
            ))}
          </div>
          <div className="hidden md:block rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Subject</th><th className="text-left px-4 py-3">To</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Attachments</th><th className="text-left px-4 py-3">Sent</th>
                </tr></thead>
                <tbody>
                  {!rows.length ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No emails sent yet</td></tr> : rows.map((m: any) => (
                    <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{m.subject}</td>
                      <td className="px-4 py-3 text-slate-600">{m.toName ? `${m.toName} · ` : ""}{m.toEmail}</td>
                      <td className="px-4 py-3"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${m.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{m.status}</span></td>
                      <td className="px-4 py-3 text-slate-500">{m.attachmentUrls?.length || "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(m.createdAt).toLocaleString("en-GB")}</td>
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
  const { data: paymentLinks } = useListQuotePaymentLinks(id);
  const updateMutation = useUpdateQuote();
  const createItem = useCreateQuoteItem();
  const deleteItem = useDeleteQuoteItem();
  const convertToProject = useConvertQuoteToProject();
  const createPaymentLink = useCreateQuotePaymentLink();
  const sendPaymentLink = useSendPaymentLink();
  const qc = useQueryClient();
  const showToast = useToast();
  const [newItem, setNewItem] = useState({ description: "", quantity: 1, unitPrice: "" });
  const [confirmProject, setConfirmProject] = useState(false);
  const [confirmPayment, setConfirmPayment] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [depositMode, setDepositMode] = useState(false);
  const [sendingLinkId, setSendingLinkId] = useState<number | null>(null);
  const [applyVat, setApplyVat] = useState(true);
  const [vatInitialized, setVatInitialized] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const q = quote as any;
  const lineItems = items as any[] || [];

  useEffect(() => {
    if (q && !vatInitialized) {
      setApplyVat(Number(q.vatRate) > 0);
      setVatInitialized(true);
    }
  }, [q, vatInitialized]);

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>;
  if (!q) return <div className="p-8 text-center text-slate-500">Quote not found</div>;

  const subtotal = lineItems.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  const vat = applyVat ? subtotal * 0.2 : 0;
  const total = subtotal + vat;

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.description || !newItem.unitPrice) return;
    const qty = Number(newItem.quantity);
    const price = Number(newItem.unitPrice);
    try {
      await createItem.mutateAsync({ id, data: { description: newItem.description, quantity: qty, unitPrice: price, total: qty * price, sortOrder: lineItems.length } } as any);
      setNewItem({ description: "", quantity: 1, unitPrice: "" });
      qc.invalidateQueries({ queryKey: getListQuoteItemsQueryKey(id) });
    } catch (err: any) {
      showToast(err?.message || "Failed to add item", "error");
    }
  };
  const handleStatusChange = async (status: string) => {
    try {
      await updateMutation.mutateAsync({ id, data: { status } } as any);
      qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
      setConfirmStatus(null);
    } catch (err: any) {
      showToast(err?.message || "Update failed", "error");
    }
  };
  const handleSaveQuote = async () => {
    try {
      await updateMutation.mutateAsync({ id, data: { vatRate: applyVat ? 20 : 0, subtotal, vatAmount: vat, total } } as any);
      qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
      showToast("Quote saved");
    } catch (err: any) {
      showToast(err?.message || "Failed to save quote", "error");
    }
  };
  const handleConvertToProject = async () => {
    try {
      const result = await convertToProject.mutateAsync({ id } as any) as any;
      qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      showToast("Quote converted to project");
      navigate(`/dashboard/projects/${result.id}`);
    } catch (err: any) {
      showToast(err?.message || "Conversion failed", "error");
    }
  };
  const links = (paymentLinks as any[]) || [];
  const handleGeneratePaymentLink = async () => {
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) { showToast("Enter a valid amount", "error"); return; }
    try {
      await createPaymentLink.mutateAsync({ id, data: { amount } } as any);
      qc.invalidateQueries({ queryKey: getListQuotePaymentLinksQueryKey(id) });
      setPayAmount("");
      setConfirmPayment(false);
      showToast("Payment link generated");
    } catch (err: any) {
      showToast(err?.message || "Failed to generate payment link", "error");
    }
  };
  const copyLink = async (url: string) => {
    try { await navigator.clipboard.writeText(url); showToast("Link copied"); } catch { showToast("Copy failed", "error"); }
  };
  const handleSendPaymentLink = async (linkId: number) => {
    setSendingLinkId(linkId);
    try {
      await sendPaymentLink.mutateAsync({ id: linkId } as any);
      qc.invalidateQueries({ queryKey: getListQuotePaymentLinksQueryKey(id) });
      qc.invalidateQueries({ queryKey: getListQuotesQueryKey() });
      showToast("Payment link sent to customer");
    } catch (err: any) {
      showToast(err?.message || "Failed to send payment link", "error");
    } finally {
      setSendingLinkId(null);
    }
  };

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
                      <td className="py-2 text-right"><button onClick={async () => { try { await deleteItem.mutateAsync({ id, itemId: item.id } as any); qc.invalidateQueries({ queryKey: getListQuoteItemsQueryKey(id) }); } catch { showToast("Delete failed", "error"); } }} className="text-red-400 hover:text-red-600 text-xs">✕</button></td>
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
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={applyVat} onChange={e => setApplyVat(e.target.checked)} className="rounded border-slate-300 text-orange-500 focus:ring-orange-500" />
                Apply VAT (20%)
              </label>
              <div className="text-sm text-right space-y-1">
                <div className="text-slate-600">Subtotal: <span className="font-medium text-slate-900">£{subtotal.toFixed(2)}</span></div>
                {applyVat && <div className="text-slate-600">VAT (20%): <span className="font-medium text-slate-900">£{vat.toFixed(2)}</span></div>}
                <div className="text-base font-bold text-slate-900">Total: £{total.toFixed(2)}</div>
              </div>
              <button onClick={handleSaveQuote} disabled={updateMutation.isPending} className="w-full rounded-md bg-orange-500 text-white py-2 text-sm font-medium hover:bg-orange-400 disabled:opacity-50">
                {updateMutation.isPending ? "Saving..." : "Save Quote"}
              </button>
            </div>
          </div>
          {q.notes && <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><h2 className="font-semibold text-slate-900 mb-2">Notes</h2><p className="text-sm text-slate-600">{q.notes}</p></div>}
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
            <h2 className="font-semibold text-slate-900">Update Status</h2>
            {["Draft", "Sent"].map(s => (
              <button key={s} onClick={() => handleStatusChange(s)} className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors ${q.status === s ? "bg-orange-500 text-white font-medium" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>{s}</button>
            ))}
            {["Accepted", "Rejected"].map(s => (
              <button key={s} onClick={() => setConfirmStatus(s)} className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors ${q.status === s ? "bg-orange-500 text-white font-medium" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>{s}</button>
            ))}
            {confirmStatus && (
              <div className="rounded-md border border-orange-200 bg-orange-50 p-3 space-y-2">
                <p className="text-xs font-medium text-slate-700">
                  Mark this quote as <strong>{confirmStatus}</strong>? {confirmStatus === "Rejected" ? "The customer's payment page will immediately show \"Quote Declined\"." : "This will notify your admin inbox."}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => handleStatusChange(confirmStatus)} disabled={updateMutation.isPending} className={`flex-1 rounded text-white py-1.5 text-xs font-medium disabled:opacity-50 ${confirmStatus === "Rejected" ? "bg-red-600 hover:bg-red-500" : "bg-orange-500 hover:bg-orange-400"}`}>
                    {updateMutation.isPending ? "Saving..." : `Yes, mark as ${confirmStatus}`}
                  </button>
                  <button onClick={() => setConfirmStatus(null)} className="flex-1 rounded border border-slate-300 text-slate-700 py-1.5 text-xs font-medium hover:bg-slate-50">Cancel</button>
                </div>
              </div>
            )}
          </div>
          {q.status === "Accepted" && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="font-semibold text-slate-900 mb-3">Actions</h2>
              {!confirmProject ? (
                <button onClick={() => setConfirmProject(true)} className="w-full rounded-md bg-orange-500 text-white px-3 py-2.5 text-sm font-medium hover:bg-orange-400">→ Convert to Project</button>
              ) : (
                <div className="rounded-md border border-orange-200 bg-orange-50 p-3 space-y-2">
                  <p className="text-xs font-medium text-slate-700">Convert this quote to a project?</p>
                  <div className="flex gap-2">
                    <button onClick={handleConvertToProject} disabled={convertToProject.isPending} className="flex-1 rounded bg-orange-500 text-white py-1.5 text-xs font-medium hover:bg-orange-400 disabled:opacity-50">
                      {convertToProject.isPending ? "Converting..." : "Yes, Convert"}
                    </button>
                    <button onClick={() => setConfirmProject(false)} className="flex-1 rounded border border-slate-300 text-slate-700 py-1.5 text-xs font-medium">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
            <h2 className="font-semibold text-slate-900">Payments</h2>
            {links.length > 0 && (
              <div className="space-y-2">
                {links.map((l: any) => (
                  <div key={l.id} className="rounded-md border border-slate-100 bg-slate-50 p-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">£{Number(l.amount).toFixed(2)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${l.status === "Paid" ? "bg-green-100 text-green-700" : l.status === "Failed" ? "bg-red-100 text-red-700" : l.status === "Cancelled" ? "bg-slate-200 text-slate-500" : "bg-amber-100 text-amber-700"}`}>{l.status}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span>{l.isAutoGenerated ? "Auto (full amount)" : "Manual"} · {new Date(l.createdAt).toLocaleDateString("en-GB")}</span>
                      {l.status === "Pending" && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => copyLink(l.url)} className="text-slate-500 hover:text-slate-700 font-medium">Copy link</button>
                          {l.sentAt ? (
                            <span className="flex items-center gap-1.5">
                              <span className="text-green-700 font-medium">✓ Sent {new Date(l.sentAt).toLocaleDateString("en-GB")}</span>
                              <button onClick={() => handleSendPaymentLink(l.id)} disabled={sendingLinkId === l.id} className="text-orange-600 hover:text-orange-500 font-medium disabled:opacity-50">
                                {sendingLinkId === l.id ? "Resending..." : "Resend"}
                              </button>
                            </span>
                          ) : (
                            <button onClick={() => handleSendPaymentLink(l.id)} disabled={sendingLinkId === l.id} className="text-orange-600 hover:text-orange-500 font-medium disabled:opacity-50">
                              {sendingLinkId === l.id ? "Sending..." : "Send Payment Link"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!confirmPayment ? (
              <button onClick={() => { setConfirmPayment(true); setDepositMode(false); setPayAmount(total.toFixed(2)); }} className="w-full rounded-md border border-slate-300 text-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-50">+ Generate Payment Link</button>
            ) : (
              <div className="rounded-md border border-orange-200 bg-orange-50 p-3 space-y-2">
                <p className="text-xs font-medium text-slate-700">Amount to request:</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setDepositMode(false); setPayAmount(total.toFixed(2)); }} className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${!depositMode ? "bg-orange-500 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"}`}>Full Amount (£{total.toFixed(2)})</button>
                  <button type="button" onClick={() => { setDepositMode(true); setPayAmount(""); }} className={`flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${depositMode ? "bg-orange-500 text-white" : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"}`}>Deposit</button>
                </div>
                {depositMode && (
                  <input type="number" min="0.01" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="e.g. 500.00" autoFocus className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
                )}
                <div className="flex gap-2">
                  <button onClick={handleGeneratePaymentLink} disabled={createPaymentLink.isPending} className="flex-1 rounded bg-orange-500 text-white py-1.5 text-xs font-medium hover:bg-orange-400 disabled:opacity-50">
                    {createPaymentLink.isPending ? "Generating..." : "Generate Link"}
                  </button>
                  <button onClick={() => { setConfirmPayment(false); setPayAmount(""); setDepositMode(false); }} className="flex-1 rounded border border-slate-300 text-slate-700 py-1.5 text-xs font-medium">Cancel</button>
                </div>
              </div>
            )}
          </div>
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

// ─── Projects ─────────────────────────────────────────────────────────────────
function ProjectsPage() {
  const { data: projects, isLoading } = useListProjects();
  const createMutation = useCreateProject();
  const [, navigate] = useWouterLocation();
  const qc = useQueryClient();
  const showToast = useToast();
  const [statusFilter, setStatusFilter] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newProj, setNewProj] = useState({ title: "", city: "", description: "" });
  const filtered = (projects as any[])?.filter((p: any) => !statusFilter || p.status === statusFilter);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProj.title.trim()) return;
    try {
      const p = await createMutation.mutateAsync({ data: newProj } as any) as any;
      qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      showToast("Project created");
      setShowNew(false);
      setNewProj({ title: "", city: "", description: "" });
      navigate(`/dashboard/projects/${p.id}`);
    } catch (err: any) { showToast(err?.message || "Failed to create project", "error"); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Projects</h1>
        <button onClick={() => setShowNew(true)} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ New</button>
      </div>
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <h2 className="font-semibold text-slate-900">New Project</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Title <span className="text-red-400">*</span></label>
                <input required value={newProj.title} onChange={e => setNewProj(p => ({ ...p, title: e.target.value }))} placeholder="e.g. John Smith — Silicone Render" className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
                <input value={newProj.city} onChange={e => setNewProj(p => ({ ...p, city: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                <textarea rows={2} value={newProj.description} onChange={e => setNewProj(p => ({ ...p, description: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={createMutation.isPending} className="flex-1 rounded-md bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50">{createMutation.isPending ? "Creating..." : "Create Project"}</button>
                <button type="button" onClick={() => setShowNew(false)} className="flex-1 rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {["", "Enquiry", "Survey Booked", "Quote Approved", "Scheduled", "In Progress", "Completed"].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{s || "All"}</button>
        ))}
      </div>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <>
          <div className="md:hidden space-y-2">
            {!filtered?.length ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">No projects found</div> : filtered.map((p: any) => (
              <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300 transition-colors active:bg-slate-50">
                <div className="flex items-start justify-between gap-2 mb-1.5"><div className="font-medium text-slate-900">{p.title}</div><Badge status={p.status} /></div>
                <div className="text-xs text-slate-500 space-y-0.5">
                  {[p.city, p.postcode].filter(Boolean).join(", ") && <div>{[p.city, p.postcode].filter(Boolean).join(", ")}</div>}
                  {p.scheduledStart && <div>Starts {new Date(p.scheduledStart).toLocaleDateString("en-GB")}</div>}
                </div>
              </Link>
            ))}
          </div>
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
  const showToast = useToast();
  const [updateForm, setUpdateForm] = useState({ title: "", content: "", visibleToCustomer: true });
  const p = project as any;
  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>;
  if (!p) return <div className="p-8 text-center text-slate-500">Project not found</div>;

  const handleStatusChange = async (status: string) => {
    try {
      await updateMutation.mutateAsync({ id, data: { status } } as any);
      qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
    } catch (err: any) {
      showToast(err?.message || "Update failed", "error");
    }
  };
  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateForm.content.trim()) return;
    try {
      await createUpdate.mutateAsync({ id, data: updateForm } as any);
      setUpdateForm({ title: "", content: "", visibleToCustomer: true });
      qc.invalidateQueries({ queryKey: getListProjectUpdatesQueryKey(id) });
    } catch (err: any) {
      showToast(err?.message || "Failed to add update", "error");
    }
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

// ─── Customers ─────────────────────────────────────────────────────────────────
function CustomersPage() {
  const { data: customers, isLoading } = useListCustomers();
  const createMutation = useCreateCustomer();
  const [, navigate] = useWouterLocation();
  const qc = useQueryClient();
  const showToast = useToast();
  const [showNew, setShowNew] = useState(false);
  const [newCust, setNewCust] = useState({ firstName: "", lastName: "", email: "", phone: "", city: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCust.firstName.trim() && !newCust.lastName.trim()) return;
    try {
      const c = await createMutation.mutateAsync({ data: newCust } as any) as any;
      qc.invalidateQueries({ queryKey: getListCustomersQueryKey() });
      showToast("Customer created");
      setShowNew(false);
      setNewCust({ firstName: "", lastName: "", email: "", phone: "", city: "" });
      navigate(`/dashboard/customers/${c.id}`);
    } catch (err: any) { showToast(err?.message || "Failed to create customer", "error"); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Customers</h1>
        <button onClick={() => setShowNew(true)} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ New</button>
      </div>
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}>
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <h2 className="font-semibold text-slate-900">New Customer</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">First Name</label>
                  <input value={newCust.firstName} onChange={e => setNewCust(c => ({ ...c, firstName: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Last Name</label>
                  <input value={newCust.lastName} onChange={e => setNewCust(c => ({ ...c, lastName: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <input type="email" value={newCust.email} onChange={e => setNewCust(c => ({ ...c, email: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                <input type="tel" value={newCust.phone} onChange={e => setNewCust(c => ({ ...c, phone: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
                <input value={newCust.city} onChange={e => setNewCust(c => ({ ...c, city: e.target.value }))} className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={createMutation.isPending} className="flex-1 rounded-md bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50">{createMutation.isPending ? "Creating..." : "Create Customer"}</button>
                <button type="button" onClick={() => setShowNew(false)} className="flex-1 rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <>
          <div className="md:hidden space-y-2">
            {!(customers as any[])?.length ? <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">No customers yet</div> : (customers as any[]).map((c: any) => (
              <Link key={c.id} href={`/dashboard/customers/${c.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300 transition-colors active:bg-slate-50">
                <div className="flex items-start justify-between gap-2 mb-1"><div className="font-medium text-slate-900">{c.firstName} {c.lastName}</div>{c.portalEnabled && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Portal</span>}</div>
                <div className="text-xs text-slate-500 space-y-0.5">{c.email && <div>{c.email}</div>}{c.phone && <div>{c.phone}</div>}{c.city && <div>{c.city}</div>}</div>
              </Link>
            ))}
          </div>
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
                      <td className="px-4 py-3">{c.portalEnabled ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span> : <span className="text-xs text-slate-400">-</span>}</td>
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
  const c = customer as any;
  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>;
  if (!c) return <div className="p-8 text-center text-slate-500">Customer not found</div>;
  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/dashboard/customers" className="text-sm text-slate-500 hover:text-orange-500">&larr; Customers</Link>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{c.firstName} {c.lastName}</h1>
        {c.portalEnabled && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Portal Active</span>}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
        <h2 className="font-semibold text-slate-900">Contact Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><span className="text-slate-500">Email: </span><a href={`mailto:${c.email}`} className="text-orange-600 hover:underline break-all">{c.email || "-"}</a></div>
          <div><span className="text-slate-500">Phone: </span><a href={`tel:${c.phone}`} className="text-orange-600 hover:underline">{c.phone || "-"}</a></div>
          <div><span className="text-slate-500">City: </span><span className="text-slate-900">{c.city || "-"}</span></div>
          <div><span className="text-slate-500">Postcode: </span><span className="text-slate-900">{c.postcode || "-"}</span></div>
          {c.address && <div className="sm:col-span-2"><span className="text-slate-500">Address: </span><span className="text-slate-900">{c.address}</span></div>}
        </div>
      </div>
    </div>
  );
}

// ─── CMS: Gallery ──────────────────────────────────────────────────────────────
function GalleryPage() {
  const { data, isLoading } = useListGalleryImages();
  const createMutation = useCreateGalleryImage();
  const updateMutation = useUpdateGalleryImage();
  const deleteMutation = useDeleteGalleryImage();
  const qc = useQueryClient();
  const showToast = useToast();
  const rows = data as any[] || [];
  const [modal, setModal] = useState<{ mode: "add" | "edit" | "delete"; item?: any } | null>(null);
  const [form, setForm] = useState<any>({});

  const openAdd = () => { setForm({ featured: false, sortOrder: 0 }); setModal({ mode: "add" }); };
  const openEdit = (item: any) => { setForm({ ...item }); setModal({ mode: "edit", item }); };
  const openDelete = (item: any) => setModal({ mode: "delete", item });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modal?.mode === "add") await createMutation.mutateAsync({ data: form } as any);
      else await updateMutation.mutateAsync({ id: modal!.item.id, data: form } as any);
      qc.invalidateQueries({ queryKey: getListGalleryImagesQueryKey() });
      showToast(modal?.mode === "add" ? "Image added" : "Image updated");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Save failed", "error"); }
  };
  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: modal!.item.id } as any);
      qc.invalidateQueries({ queryKey: getListGalleryImagesQueryKey() });
      showToast("Image deleted");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Delete failed", "error"); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Gallery</h1>
        <button onClick={openAdd} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add Image</button>
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
                    <p className="text-xs text-slate-400">{item.featured ? "Featured · " : ""}{item.category || ""}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(item)} className="text-xs text-slate-500 hover:text-orange-600 px-2 py-1 rounded hover:bg-orange-50">Edit</button>
                    <button onClick={() => openDelete(item)} className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {modal && (
        <Modal title={modal.mode === "delete" ? "Delete Image" : modal.mode === "add" ? "Add Image" : "Edit Image"} onClose={() => setModal(null)}>
          {modal.mode === "delete" ? (
            <DeleteConfirm label={modal.item?.caption || "this image"} onConfirm={handleDelete} onCancel={() => setModal(null)} isPending={deleteMutation.isPending} />
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <FField label="Image URL *" value={form.imageUrl || ""} onChange={v => setForm({ ...form, imageUrl: v })} />
              <FField label="Caption" value={form.caption || ""} onChange={v => setForm({ ...form, caption: v })} />
              <FField label="Alt Text" value={form.altText || ""} onChange={v => setForm({ ...form, altText: v })} />
              <FField label="Category" value={form.category || ""} onChange={v => setForm({ ...form, category: v })} />
              <FField label="Sort Order" type="number" value={form.sortOrder ?? 0} onChange={v => setForm({ ...form, sortOrder: Number(v) })} />
              <FCheck label="Featured" checked={!!form.featured} onChange={v => setForm({ ...form, featured: v })} />
              <SaveCancelBar onCancel={() => setModal(null)} isPending={createMutation.isPending || updateMutation.isPending} />
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── CMS: Reviews ──────────────────────────────────────────────────────────────
function ReviewsPage() {
  const { data, isLoading } = useListReviews();
  const createMutation = useCreateReview();
  const updateMutation = useUpdateReview();
  const deleteMutation = useDeleteReview();
  const qc = useQueryClient();
  const showToast = useToast();
  const rows = data as any[] || [];
  const [modal, setModal] = useState<{ mode: "add" | "edit" | "delete"; item?: any } | null>(null);
  const [form, setForm] = useState<any>({});

  const openAdd = () => { setForm({ rating: 5, featured: false, published: true }); setModal({ mode: "add" }); };
  const openEdit = (item: any) => { setForm({ ...item }); setModal({ mode: "edit", item }); };
  const openDelete = (item: any) => setModal({ mode: "delete", item });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modal?.mode === "add") await createMutation.mutateAsync({ data: form } as any);
      else await updateMutation.mutateAsync({ id: modal!.item.id, data: form } as any);
      qc.invalidateQueries({ queryKey: getListReviewsQueryKey() });
      showToast(modal?.mode === "add" ? "Review added" : "Review updated");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Save failed", "error"); }
  };
  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: modal!.item.id } as any);
      qc.invalidateQueries({ queryKey: getListReviewsQueryKey() });
      showToast("Review deleted");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Delete failed", "error"); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Reviews</h1>
        <button onClick={openAdd} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add</button>
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
                      {item.platform && <span className="text-xs text-slate-400">{item.platform}</span>}
                      {item.featured && <span className="text-xs text-green-600 font-medium">Featured</span>}
                      {!item.published && <span className="text-xs text-slate-400">Draft</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(item)} className="text-xs text-slate-500 hover:text-orange-600 px-2 py-1 rounded hover:bg-orange-50">Edit</button>
                    <button onClick={() => openDelete(item)} className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {modal && (
        <Modal title={modal.mode === "delete" ? "Delete Review" : modal.mode === "add" ? "Add Review" : "Edit Review"} onClose={() => setModal(null)}>
          {modal.mode === "delete" ? (
            <DeleteConfirm label={modal.item?.reviewerName || "this review"} onConfirm={handleDelete} onCancel={() => setModal(null)} isPending={deleteMutation.isPending} />
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <FField label="Reviewer Name *" value={form.reviewerName || ""} onChange={v => setForm({ ...form, reviewerName: v })} />
              <FTextarea label="Review Text *" value={form.reviewText || ""} onChange={v => setForm({ ...form, reviewText: v })} />
              <div>
                <label className={labelCls}>Rating</label>
                <select className={inputCls} value={form.rating ?? 5} onChange={e => setForm({ ...form, rating: Number(e.target.value) })}>
                  {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} star{r !== 1 ? "s" : ""}</option>)}
                </select>
              </div>
              <FField label="Platform (e.g. Google, Trustpilot)" value={form.platform || ""} onChange={v => setForm({ ...form, platform: v })} />
              <FField label="Review Date" type="date" value={form.reviewDate || ""} onChange={v => setForm({ ...form, reviewDate: v })} />
              <div className="flex gap-4">
                <FCheck label="Featured" checked={!!form.featured} onChange={v => setForm({ ...form, featured: v })} />
                <FCheck label="Published" checked={form.published !== false} onChange={v => setForm({ ...form, published: v })} />
              </div>
              <SaveCancelBar onCancel={() => setModal(null)} isPending={createMutation.isPending || updateMutation.isPending} />
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── CMS: Case Studies ─────────────────────────────────────────────────────────
function CaseStudiesPage() {
  const { data, isLoading } = useListCaseStudies();
  const createMutation = useCreateCaseStudy();
  const updateMutation = useUpdateCaseStudy();
  const deleteMutation = useDeleteCaseStudy();
  const qc = useQueryClient();
  const showToast = useToast();
  const rows = data as any[] || [];
  const [modal, setModal] = useState<{ mode: "add" | "edit" | "delete"; item?: any } | null>(null);
  const [form, setForm] = useState<any>({});

  const openAdd = () => { setForm({ featured: false, published: true }); setModal({ mode: "add" }); };
  const openEdit = (item: any) => { setForm({ ...item }); setModal({ mode: "edit", item }); };
  const openDelete = (item: any) => setModal({ mode: "delete", item });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modal?.mode === "add") await createMutation.mutateAsync({ data: form } as any);
      else await updateMutation.mutateAsync({ id: modal!.item.id, data: form } as any);
      qc.invalidateQueries({ queryKey: getListCaseStudiesQueryKey() });
      showToast(modal?.mode === "add" ? "Case study added" : "Case study updated");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Save failed", "error"); }
  };
  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: modal!.item.id } as any);
      qc.invalidateQueries({ queryKey: getListCaseStudiesQueryKey() });
      showToast("Case study deleted");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Delete failed", "error"); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Case Studies</h1>
        <button onClick={openAdd} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add</button>
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
                      {item.projectType && <span className="text-xs text-slate-400">{item.projectType}</span>}
                      {item.featured && <span className="text-xs text-green-600 font-medium">Featured</span>}
                      {!item.published && <span className="text-xs text-amber-600 font-medium">Draft</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(item)} className="text-xs text-slate-500 hover:text-orange-600 px-2 py-1 rounded hover:bg-orange-50">Edit</button>
                    <button onClick={() => openDelete(item)} className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {modal && (
        <Modal title={modal.mode === "delete" ? "Delete Case Study" : modal.mode === "add" ? "Add Case Study" : "Edit Case Study"} onClose={() => setModal(null)}>
          {modal.mode === "delete" ? (
            <DeleteConfirm label={modal.item?.title || "this case study"} onConfirm={handleDelete} onCancel={() => setModal(null)} isPending={deleteMutation.isPending} />
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <FField label="Title *" value={form.title || ""} onChange={v => setForm({ ...form, title: v })} />
              <FField label="Slug" value={form.slug || ""} onChange={v => setForm({ ...form, slug: v })} hint="URL-friendly identifier (auto-generated if blank)" />
              <FField label="Project Type" value={form.projectType || ""} onChange={v => setForm({ ...form, projectType: v })} />
              <FField label="Location" value={form.location || ""} onChange={v => setForm({ ...form, location: v })} />
              <FField label="Completion Date" value={form.completionDate || ""} onChange={v => setForm({ ...form, completionDate: v })} />
              <FTextarea label="Description" value={form.description || ""} onChange={v => setForm({ ...form, description: v })} rows={4} />
              <FField label="Cover Image URL" value={form.coverImageUrl || ""} onChange={v => setForm({ ...form, coverImageUrl: v })} />
              <div className="flex gap-4">
                <FCheck label="Featured" checked={!!form.featured} onChange={v => setForm({ ...form, featured: v })} />
                <FCheck label="Published" checked={form.published !== false} onChange={v => setForm({ ...form, published: v })} />
              </div>
              <SaveCancelBar onCancel={() => setModal(null)} isPending={createMutation.isPending || updateMutation.isPending} />
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── CMS: Pricing (powers the public cost calculator) ───────────────────────────
function PricingPage() {
  const { data, isLoading } = useListPriceItems();
  const createMutation = useCreatePriceItem();
  const updateMutation = useUpdatePriceItem();
  const deleteMutation = useDeletePriceItem();
  const qc = useQueryClient();
  const showToast = useToast();
  const rows = (data as any[] || []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const [modal, setModal] = useState<{ mode: "add" | "edit" | "delete"; item?: any } | null>(null);
  const [form, setForm] = useState<any>({});

  const openAdd = () => { setForm({ unit: "each", unitPrice: "0", fixed: false, published: true, sortOrder: rows.length * 10 }); setModal({ mode: "add" }); };
  const openEdit = (item: any) => { setForm({ ...item }); setModal({ mode: "edit", item }); };
  const openDelete = (item: any) => setModal({ mode: "delete", item });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, unitPrice: String(form.unitPrice ?? "0"), sortOrder: Number(form.sortOrder ?? 0), minQuantity: Number(form.minQuantity ?? 0) };
      if (modal?.mode === "add") await createMutation.mutateAsync({ data: payload } as any);
      else await updateMutation.mutateAsync({ id: modal!.item.id, data: payload } as any);
      qc.invalidateQueries({ queryKey: getListPriceItemsQueryKey() });
      showToast(modal?.mode === "add" ? "Price item added" : "Price item updated");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Save failed", "error"); }
  };
  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: modal!.item.id } as any);
      qc.invalidateQueries({ queryKey: getListPriceItemsQueryKey() });
      showToast("Price item deleted");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Delete failed", "error"); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Pricing</h1>
          <p className="text-sm text-slate-500 mt-0.5">These items power the public cost calculator. Add at least one to make the calculator live on your site.</p>
        </div>
        <button onClick={openAdd} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400 flex-shrink-0">+ Add</button>
      </div>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {!rows.length ? <div className="p-8 text-center text-slate-400">No price items yet — the calculator stays hidden until you add some.</div> : (
            <div className="divide-y divide-slate-100">
              {rows.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {item.category && <span className="text-xs text-slate-400">{item.category}</span>}
                      <span className="text-xs font-semibold text-slate-600">£{item.unitPrice} {item.fixed ? "fixed" : `per ${item.unit}`}</span>
                      {!item.published && <span className="text-xs text-amber-600 font-medium">Hidden</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(item)} className="text-xs text-slate-500 hover:text-orange-600 px-2 py-1 rounded hover:bg-orange-50">Edit</button>
                    <button onClick={() => openDelete(item)} className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {modal && (
        <Modal title={modal.mode === "delete" ? "Delete Price Item" : modal.mode === "add" ? "Add Price Item" : "Edit Price Item"} onClose={() => setModal(null)}>
          {modal.mode === "delete" ? (
            <DeleteConfirm label={modal.item?.name || "this item"} onConfirm={handleDelete} onCancel={() => setModal(null)} isPending={deleteMutation.isPending} />
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <FField label="Item Name *" value={form.name || ""} onChange={v => setForm({ ...form, name: v })} hint="e.g. Silicone render, Loft conversion, Call-out charge" />
              <FField label="Category" value={form.category || ""} onChange={v => setForm({ ...form, category: v })} hint="Groups items on the calculator, e.g. Rendering, Extras, Delivery" />
              <FField label="Description" value={form.description || ""} onChange={v => setForm({ ...form, description: v })} />
              <div className="grid grid-cols-2 gap-3">
                <FField label="Unit Price (£) *" value={form.unitPrice ?? "0"} onChange={v => setForm({ ...form, unitPrice: v })} hint="Number only, e.g. 45.00" />
                <FField label="Unit" value={form.unit || "each"} onChange={v => setForm({ ...form, unit: v })} hint="each, m², day, hour, linear m" />
              </div>
              <FField label="Sort Order" type="number" value={form.sortOrder ?? 0} onChange={v => setForm({ ...form, sortOrder: Number(v) })} />
              <div className="flex gap-4">
                <FCheck label="Fixed add-on (checkbox, no quantity)" checked={!!form.fixed} onChange={v => setForm({ ...form, fixed: v })} />
                <FCheck label="Published" checked={form.published !== false} onChange={v => setForm({ ...form, published: v })} />
              </div>
              <SaveCancelBar onCancel={() => setModal(null)} isPending={createMutation.isPending || updateMutation.isPending} />
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── CMS: Services ─────────────────────────────────────────────────────────────
function ServicesPage() {
  const { data, isLoading } = useListServices();
  const createMutation = useCreateService();
  const updateMutation = useUpdateService();
  const deleteMutation = useDeleteService();
  const qc = useQueryClient();
  const showToast = useToast();
  const rows = data as any[] || [];
  const [modal, setModal] = useState<{ mode: "add" | "edit" | "delete"; item?: any } | null>(null);
  const [form, setForm] = useState<any>({});

  const openAdd = () => { setForm({ featured: false, published: true, sortOrder: 0 }); setModal({ mode: "add" }); };
  const openEdit = (item: any) => { setForm({ ...item }); setModal({ mode: "edit", item }); };
  const openDelete = (item: any) => setModal({ mode: "delete", item });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modal?.mode === "add") await createMutation.mutateAsync({ data: form } as any);
      else await updateMutation.mutateAsync({ id: modal!.item.id, data: form } as any);
      qc.invalidateQueries({ queryKey: getListServicesQueryKey() });
      showToast(modal?.mode === "add" ? "Service added" : "Service updated");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Save failed", "error"); }
  };
  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: modal!.item.id } as any);
      qc.invalidateQueries({ queryKey: getListServicesQueryKey() });
      showToast("Service deleted");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Delete failed", "error"); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Services</h1>
        <button onClick={openAdd} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add</button>
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
                      {!item.published && <span className="text-xs text-amber-600 font-medium">Draft</span>}
                      {item.shortDescription && <span className="text-xs text-slate-400 truncate">{item.shortDescription}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(item)} className="text-xs text-slate-500 hover:text-orange-600 px-2 py-1 rounded hover:bg-orange-50">Edit</button>
                    <button onClick={() => openDelete(item)} className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {modal && (
        <Modal title={modal.mode === "delete" ? "Delete Service" : modal.mode === "add" ? "Add Service" : "Edit Service"} onClose={() => setModal(null)}>
          {modal.mode === "delete" ? (
            <DeleteConfirm label={modal.item?.name || "this service"} onConfirm={handleDelete} onCancel={() => setModal(null)} isPending={deleteMutation.isPending} />
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <FField label="Service Name *" value={form.name || ""} onChange={v => setForm({ ...form, name: v })} />
              <FField label="Slug" value={form.slug || ""} onChange={v => setForm({ ...form, slug: v })} hint="URL-friendly identifier" />
              <FField label="Short Description" value={form.shortDescription || ""} onChange={v => setForm({ ...form, shortDescription: v })} />
              <FTextarea label="Full Description" value={form.description || ""} onChange={v => setForm({ ...form, description: v })} rows={4} />
              <FField label="Icon (emoji or icon name)" value={form.icon || ""} onChange={v => setForm({ ...form, icon: v })} />
              <FField label="Hero Image URL" value={form.heroImageUrl || ""} onChange={v => setForm({ ...form, heroImageUrl: v })} />
              <FField label="Sort Order" type="number" value={form.sortOrder ?? 0} onChange={v => setForm({ ...form, sortOrder: Number(v) })} />
              <div className="flex gap-4">
                <FCheck label="Featured" checked={!!form.featured} onChange={v => setForm({ ...form, featured: v })} />
                <FCheck label="Published" checked={form.published !== false} onChange={v => setForm({ ...form, published: v })} />
              </div>
              <SaveCancelBar onCancel={() => setModal(null)} isPending={createMutation.isPending || updateMutation.isPending} />
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── CMS: Areas ────────────────────────────────────────────────────────────────
function AreasPage() {
  const { data, isLoading } = useListAreas();
  const createMutation = useCreateArea();
  const updateMutation = useUpdateArea();
  const deleteMutation = useDeleteArea();
  const qc = useQueryClient();
  const showToast = useToast();
  const rows = data as any[] || [];
  const [modal, setModal] = useState<{ mode: "add" | "edit" | "delete"; item?: any } | null>(null);
  const [form, setForm] = useState<any>({});

  const openAdd = () => { setForm({ published: true }); setModal({ mode: "add" }); };
  const openEdit = (item: any) => { setForm({ ...item }); setModal({ mode: "edit", item }); };
  const openDelete = (item: any) => setModal({ mode: "delete", item });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modal?.mode === "add") await createMutation.mutateAsync({ data: form } as any);
      else await updateMutation.mutateAsync({ id: modal!.item.id, data: form } as any);
      qc.invalidateQueries({ queryKey: getListAreasQueryKey() });
      showToast(modal?.mode === "add" ? "Area added" : "Area updated");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Save failed", "error"); }
  };
  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: modal!.item.id } as any);
      qc.invalidateQueries({ queryKey: getListAreasQueryKey() });
      showToast("Area deleted");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Delete failed", "error"); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Areas</h1>
        <button onClick={openAdd} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add</button>
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
                      {!item.published && <span className="text-xs text-amber-600 font-medium">Draft</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(item)} className="text-xs text-slate-500 hover:text-orange-600 px-2 py-1 rounded hover:bg-orange-50">Edit</button>
                    <button onClick={() => openDelete(item)} className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {modal && (
        <Modal title={modal.mode === "delete" ? "Delete Area" : modal.mode === "add" ? "Add Area" : "Edit Area"} onClose={() => setModal(null)}>
          {modal.mode === "delete" ? (
            <DeleteConfirm label={modal.item?.name || "this area"} onConfirm={handleDelete} onCancel={() => setModal(null)} isPending={deleteMutation.isPending} />
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <FField label="Area Name *" value={form.name || ""} onChange={v => setForm({ ...form, name: v })} />
              <FField label="Slug" value={form.slug || ""} onChange={v => setForm({ ...form, slug: v })} hint="URL-friendly identifier" />
              <FField label="County" value={form.county || ""} onChange={v => setForm({ ...form, county: v })} />
              <FField label="Postcode Prefix (e.g. SW1)" value={form.postcodePrefix || ""} onChange={v => setForm({ ...form, postcodePrefix: v })} />
              <FTextarea label="Description" value={form.description || ""} onChange={v => setForm({ ...form, description: v })} />
              <FCheck label="Published" checked={form.published !== false} onChange={v => setForm({ ...form, published: v })} />
              <SaveCancelBar onCancel={() => setModal(null)} isPending={createMutation.isPending || updateMutation.isPending} />
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── CMS: FAQs ─────────────────────────────────────────────────────────────────
function FaqsPage() {
  const { data, isLoading } = useListFaqs();
  const createMutation = useCreateFaq();
  const updateMutation = useUpdateFaq();
  const deleteMutation = useDeleteFaq();
  const qc = useQueryClient();
  const showToast = useToast();
  const rows = data as any[] || [];
  const [modal, setModal] = useState<{ mode: "add" | "edit" | "delete"; item?: any } | null>(null);
  const [form, setForm] = useState<any>({});

  const openAdd = () => { setForm({ sortOrder: 0 }); setModal({ mode: "add" }); };
  const openEdit = (item: any) => { setForm({ ...item }); setModal({ mode: "edit", item }); };
  const openDelete = (item: any) => setModal({ mode: "delete", item });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modal?.mode === "add") await createMutation.mutateAsync({ data: form } as any);
      else await updateMutation.mutateAsync({ id: modal!.item.id, data: form } as any);
      qc.invalidateQueries({ queryKey: getListFaqsQueryKey() });
      showToast(modal?.mode === "add" ? "FAQ added" : "FAQ updated");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Save failed", "error"); }
  };
  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: modal!.item.id } as any);
      qc.invalidateQueries({ queryKey: getListFaqsQueryKey() });
      showToast("FAQ deleted");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Delete failed", "error"); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">FAQs</h1>
        <button onClick={openAdd} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add</button>
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
                    {item.category && <span className="text-xs text-slate-400">{item.category}</span>}
                  </div>
                  <div className="flex gap-1 flex-shrink-0 mt-0.5">
                    <button onClick={() => openEdit(item)} className="text-xs text-slate-500 hover:text-orange-600 px-2 py-1 rounded hover:bg-orange-50">Edit</button>
                    <button onClick={() => openDelete(item)} className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {modal && (
        <Modal title={modal.mode === "delete" ? "Delete FAQ" : modal.mode === "add" ? "Add FAQ" : "Edit FAQ"} onClose={() => setModal(null)}>
          {modal.mode === "delete" ? (
            <DeleteConfirm label="this FAQ" onConfirm={handleDelete} onCancel={() => setModal(null)} isPending={deleteMutation.isPending} />
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <FField label="Question *" value={form.question || ""} onChange={v => setForm({ ...form, question: v })} />
              <FTextarea label="Answer *" value={form.answer || ""} onChange={v => setForm({ ...form, answer: v })} rows={4} />
              <FField label="Category" value={form.category || ""} onChange={v => setForm({ ...form, category: v })} />
              <FField label="Sort Order" type="number" value={form.sortOrder ?? 0} onChange={v => setForm({ ...form, sortOrder: Number(v) })} />
              <SaveCancelBar onCancel={() => setModal(null)} isPending={createMutation.isPending || updateMutation.isPending} />
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── CMS: Blog ─────────────────────────────────────────────────────────────────
function BlogPage() {
  const { data, isLoading } = useListBlogPosts();
  const createMutation = useCreateBlogPost();
  const updateMutation = useUpdateBlogPost();
  const deleteMutation = useDeleteBlogPost();
  const qc = useQueryClient();
  const showToast = useToast();
  const rows = data as any[] || [];
  const [modal, setModal] = useState<{ mode: "add" | "edit" | "delete"; item?: any } | null>(null);
  const [form, setForm] = useState<any>({});

  const openAdd = () => { setForm({ published: false }); setModal({ mode: "add" }); };
  const openEdit = (item: any) => { setForm({ ...item }); setModal({ mode: "edit", item }); };
  const openDelete = (item: any) => setModal({ mode: "delete", item });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modal?.mode === "add") await createMutation.mutateAsync({ data: form } as any);
      else await updateMutation.mutateAsync({ id: modal!.item.id, data: form } as any);
      qc.invalidateQueries({ queryKey: getListBlogPostsQueryKey() });
      showToast(modal?.mode === "add" ? "Post created" : "Post updated");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Save failed", "error"); }
  };
  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: modal!.item.id } as any);
      qc.invalidateQueries({ queryKey: getListBlogPostsQueryKey() });
      showToast("Post deleted");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Delete failed", "error"); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Blog</h1>
        <button onClick={openAdd} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ New Post</button>
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
                    <button onClick={() => openEdit(item)} className="text-xs text-slate-500 hover:text-orange-600 px-2 py-1 rounded hover:bg-orange-50">Edit</button>
                    <button onClick={() => openDelete(item)} className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {modal && (
        <Modal title={modal.mode === "delete" ? "Delete Post" : modal.mode === "add" ? "New Blog Post" : "Edit Blog Post"} onClose={() => setModal(null)}>
          {modal.mode === "delete" ? (
            <DeleteConfirm label={modal.item?.title || "this post"} onConfirm={handleDelete} onCancel={() => setModal(null)} isPending={deleteMutation.isPending} />
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <FField label="Title *" value={form.title || ""} onChange={v => setForm({ ...form, title: v })} />
              <FField label="Slug" value={form.slug || ""} onChange={v => setForm({ ...form, slug: v })} hint="URL-friendly identifier" />
              <FField label="Author Name" value={form.authorName || ""} onChange={v => setForm({ ...form, authorName: v })} />
              <FField label="Cover Image URL" value={form.coverImageUrl || ""} onChange={v => setForm({ ...form, coverImageUrl: v })} />
              <FTextarea label="Excerpt" value={form.excerpt || ""} onChange={v => setForm({ ...form, excerpt: v })} rows={2} />
              <FTextarea label="Content" value={form.content || ""} onChange={v => setForm({ ...form, content: v })} rows={6} />
              <FCheck label="Published" checked={!!form.published} onChange={v => setForm({ ...form, published: v })} />
              <SaveCancelBar onCancel={() => setModal(null)} isPending={createMutation.isPending || updateMutation.isPending} />
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── Messages ──────────────────────────────────────────────────────────────────
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

// ─── Visualiser ────────────────────────────────────────────────────────────────
function VisualiserPage() {
  const { data, isLoading } = useListVisualiserRequests();
  const deleteMutation = useDeleteVisualiserRequest();
  const qc = useQueryClient();
  const showToast = useToast();
  const rows = data as any[] || [];
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id } as any);
      qc.invalidateQueries();
      showToast("Request deleted");
      setDeleteId(null);
    } catch (err: any) { showToast(err?.message || "Delete failed", "error"); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Visualiser Requests</h1>
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
                  <div className="text-xs text-slate-400 flex-shrink-0 mr-1">{item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-GB") : ""}</div>
                  <div className="flex gap-1 flex-shrink-0">
                    {deleteId === item.id ? (
                      <>
                        <button onClick={() => handleDelete(item.id)} className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded">Confirm</button>
                        <button onClick={() => setDeleteId(null)} className="text-xs text-slate-500 hover:text-slate-700 px-1">Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteId(item.id)} className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
                    )}
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

// ─── CMS: Team ─────────────────────────────────────────────────────────────────
function TeamPage() {
  const { data, isLoading } = useListTeamMembers();
  const createMutation = useCreateTeamMember();
  const updateMutation = useUpdateTeamMember();
  const deleteMutation = useDeleteTeamMember();
  const qc = useQueryClient();
  const showToast = useToast();
  const rows = data as any[] || [];
  const [modal, setModal] = useState<{ mode: "add" | "edit" | "delete"; item?: any } | null>(null);
  const [form, setForm] = useState<any>({});

  const openAdd = () => { setForm({ sortOrder: 0 }); setModal({ mode: "add" }); };
  const openEdit = (item: any) => { setForm({ ...item }); setModal({ mode: "edit", item }); };
  const openDelete = (item: any) => setModal({ mode: "delete", item });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modal?.mode === "add") await createMutation.mutateAsync({ data: form } as any);
      else await updateMutation.mutateAsync({ id: modal!.item.id, data: form } as any);
      qc.invalidateQueries({ queryKey: getListTeamMembersQueryKey() });
      showToast(modal?.mode === "add" ? "Team member added" : "Team member updated");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Save failed", "error"); }
  };
  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync({ id: modal!.item.id } as any);
      qc.invalidateQueries({ queryKey: getListTeamMembersQueryKey() });
      showToast("Team member removed");
      setModal(null);
    } catch (err: any) { showToast(err?.message || "Delete failed", "error"); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Team</h1>
        <button onClick={openAdd} className="inline-flex h-9 items-center rounded-md bg-orange-500 px-3 sm:px-4 text-sm font-medium text-white hover:bg-orange-400">+ Add Member</button>
      </div>
      {isLoading ? <div className="p-8 text-center text-slate-400">Loading...</div> : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {!rows.length ? <div className="p-8 text-center text-slate-400">No team members yet</div> : (
            <div className="divide-y divide-slate-100">
              {rows.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    {item.photoUrl ? <img src={item.photoUrl} className="w-9 h-9 rounded-full object-cover" alt="" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} /> : <span className="text-sm font-bold text-orange-600">{(item.name || "?")[0].toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400 truncate">{item.role || ""}{item.email ? ` · ${item.email}` : ""}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(item)} className="text-xs text-slate-500 hover:text-orange-600 px-2 py-1 rounded hover:bg-orange-50">Edit</button>
                    <button onClick={() => openDelete(item)} className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {modal && (
        <Modal title={modal.mode === "delete" ? "Remove Team Member" : modal.mode === "add" ? "Add Team Member" : "Edit Team Member"} onClose={() => setModal(null)}>
          {modal.mode === "delete" ? (
            <DeleteConfirm label={modal.item?.name || "this member"} onConfirm={handleDelete} onCancel={() => setModal(null)} isPending={deleteMutation.isPending} />
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <FField label="Full Name *" value={form.name || ""} onChange={v => setForm({ ...form, name: v })} />
              <FField label="Job Title / Role" value={form.role || ""} onChange={v => setForm({ ...form, role: v })} />
              <FField label="Email" type="email" value={form.email || ""} onChange={v => setForm({ ...form, email: v })} />
              <FField label="Photo URL" value={form.photoUrl || ""} onChange={v => setForm({ ...form, photoUrl: v })} />
              <FTextarea label="Bio" value={form.bio || ""} onChange={v => setForm({ ...form, bio: v })} rows={3} />
              <FField label="Sort Order" type="number" value={form.sortOrder ?? 0} onChange={v => setForm({ ...form, sortOrder: Number(v) })} />
              <SaveCancelBar onCancel={() => setModal(null)} isPending={createMutation.isPending || updateMutation.isPending} />
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function SettingsPage() {
  const { data: settings, isLoading } = useGetSettings();
  const updateMutation = useUpdateSettings();
  const testEmailMutation = useTestEmailSettings();
  const testSmsMutation = useTestSmsSettings();
  const showToast = useToast();
  const [form, setForm] = useState<any>(null);
  const [smtpPass, setSmtpPass] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [squareAccessToken, setSquareAccessToken] = useState("");
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
    if (squareAccessToken) payload.squareAccessToken = squareAccessToken;
    else delete payload.squareAccessToken;
    try {
      await updateMutation.mutateAsync({ data: payload } as any);
      showToast("Settings saved");
      setSmtpPass("");
      setTwilioAuthToken("");
      setSquareAccessToken("");
    } catch (err: any) {
      showToast(err?.message || "Save failed — please check your inputs and try again", "error");
    }
  };

  const handleTestEmail = async () => {
    setEmailTestResult(null);
    try {
      const result = await testEmailMutation.mutateAsync();
      setEmailTestResult(result as any);
      setTimeout(() => setEmailTestResult(null), 8000);
    } catch (err: any) {
      showToast(err?.message || "Test failed", "error");
    }
  };
  const handleTestSms = async () => {
    setSmsTestResult(null);
    try {
      const result = await testSmsMutation.mutateAsync();
      setSmsTestResult(result as any);
      setTimeout(() => setSmsTestResult(null), 8000);
    } catch (err: any) {
      showToast(err?.message || "Test failed", "error");
    }
  };

  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>;
  if (!form) return null;

  const field = (key: string, lbl: string, type = "text", hint?: string) => (
    <div key={key}>
      <label className={labelCls}>{lbl}</label>
      <input type={type} className={inputCls} value={form[key] ?? ""} onChange={e => setForm({ ...form, [key]: e.target.value })} />
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
          {field("logoUrl", "Logo URL", "text", "Full URL to your logo image (shown in the site header)")}
          {field("faviconUrl", "Favicon URL", "text", "URL to your browser tab icon — paste the full URL to a PNG or ICO file (ideally 64×64px)")}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Hero Section</h2>
          {field("heroHeadline", "Hero Headline")}
          <div>
            <label className={labelCls}>Hero Subheadline</label>
            <textarea rows={3} className={inputCls} value={form.heroSubheadline || ""} onChange={e => setForm({ ...form, heroSubheadline: e.target.value })} />
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
            <div className="col-span-1 sm:col-span-2">{field("smtpHost", "Mail Server Host", "text", "e.g. mail.yourdomain.com or smtp.office365.com")}</div>
            <div>
              <label className={labelCls}>Port</label>
              <input type="number" className={inputCls} value={form.smtpPort ?? 587} onChange={e => setForm({ ...form, smtpPort: Number(e.target.value) })} />
              <p className="text-xs text-slate-400 mt-1">Usually 587 (STARTTLS) or 465 (SSL)</p>
            </div>
            <div className="flex items-center gap-3 sm:pt-6">
              <input type="checkbox" id="smtpSecure" className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" checked={!!form.smtpSecure} onChange={e => setForm({ ...form, smtpSecure: e.target.checked })} />
              <label htmlFor="smtpSecure" className="text-sm font-medium text-slate-700">Use SSL/TLS (port 465)</label>
            </div>
            <div>{field("smtpUser", "Username / Email", "email", "Usually your full email address")}</div>
            <div>
              <label className={labelCls}>Password</label>
              <input type="password" className={inputCls} placeholder="Leave blank to keep existing" value={smtpPass} onChange={e => setSmtpPass(e.target.value)} autoComplete="new-password" />
              <p className="text-xs text-slate-400 mt-1">Leave blank to keep existing password</p>
            </div>
            <div className="col-span-1 sm:col-span-2">{field("smtpFrom", "From Address", "text", `e.g. AMO Rendering <info@amorendering.co.uk>`)}</div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={handleTestEmail} disabled={testEmailMutation.isPending} className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {testEmailMutation.isPending ? "Sending..." : "Send Test Email"}
            </button>
            {emailTestResult && (
              <span className={`text-sm font-medium ${emailTestResult.ok ? "text-green-600" : "text-red-600"}`}>
                {emailTestResult.ok ? "✓ Test email sent!" : `✕ ${emailTestResult.error}`}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">SMS Notifications (Twilio)</h2>
            <p className="text-xs text-slate-500 mt-1">Optional — connect Twilio to send SMS notifications.</p>
          </div>
          {field("twilioAccountSid", "Account SID")}
          <div>
            <label className={labelCls}>Auth Token</label>
            <input type="password" className={inputCls} placeholder="Leave blank to keep existing" value={twilioAuthToken} onChange={e => setTwilioAuthToken(e.target.value)} autoComplete="new-password" />
            <p className="text-xs text-slate-400 mt-1">Leave blank to keep existing token</p>
          </div>
          {field("twilioFromNumber", "From Number", "text", "e.g. +447700000000")}
          {field("adminNotificationPhone", "Admin Notification Phone", "text", "Receives SMS when a lead/quote is submitted")}
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={handleTestSms} disabled={testSmsMutation.isPending} className="inline-flex h-9 items-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {testSmsMutation.isPending ? "Sending..." : "Send Test SMS"}
            </button>
            {smsTestResult && (
              <span className={`text-sm font-medium ${smsTestResult.ok ? "text-green-600" : "text-red-600"}`}>
                {smsTestResult.ok ? "✓ Test SMS sent!" : `✕ ${smsTestResult.error}`}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">Payments (Square)</h2>
            <p className="text-xs text-slate-500 mt-1">Connect Square to let customers pay quotes online. Sandbox and production use different credentials — update all three fields when you switch.</p>
          </div>
          {form.squareEnvironment === "sandbox" && (
            <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 inline-block">Sandbox mode — no real charges will be made</p>
          )}
          <div>
            <label className={labelCls}>Environment</label>
            <select className={inputCls} value={form.squareEnvironment ?? "sandbox"} onChange={e => setForm({ ...form, squareEnvironment: e.target.value })}>
              <option value="sandbox">Sandbox (testing)</option>
              <option value="production">Production (real charges)</option>
            </select>
          </div>
          {field("squareApplicationId", "Application ID")}
          {field("squareLocationId", "Location ID")}
          <div>
            <label className={labelCls}>Access Token</label>
            <input type="password" className={inputCls} placeholder="Leave blank to keep existing" value={squareAccessToken} onChange={e => setSquareAccessToken(e.target.value)} autoComplete="new-password" />
            <p className="text-xs text-slate-400 mt-1">Leave blank to keep existing token</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Notification Events</h2>
          <p className="text-xs text-slate-500">Choose which events trigger email and/or SMS notifications.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left py-2 pr-4">Event</th><th className="text-center py-2 px-3">Email</th><th className="text-center py-2 px-3">SMS</th><th className="text-left py-2 pl-3">Recipient</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  { emailKey: "notifyLeadNewEmail", smsKey: "notifyLeadNewSms", label: "New lead submitted", recipient: "Admin alert + customer acknowledgement" },
                  { emailKey: "notifySurveyBookedEmail", smsKey: "notifySurveyBookedSms", label: "Survey booked", recipient: "Customer" },
                  { emailKey: "notifyQuoteSentEmail", smsKey: "notifyQuoteSentSms", label: "Quote sent", recipient: "Customer" },
                  { emailKey: "notifyQuoteAcceptedEmail", smsKey: "notifyQuoteAcceptedSms", label: "Quote accepted", recipient: "Admin alert" },
                  { emailKey: "notifyPaymentReceivedEmail", smsKey: "notifyPaymentReceivedSms", label: "Payment received", recipient: "Admin alert + customer receipt" },
                  { emailKey: "notifyLeadWonEmail", smsKey: "notifyLeadWonSms", label: "Lead won / project confirmed", recipient: "Customer" },
                  { emailKey: "notifyProjectInProgressEmail", smsKey: "notifyProjectInProgressSms", label: "Project started (In Progress)", recipient: "Customer" },
                  { emailKey: "notifyProjectCompleteEmail", smsKey: "notifyProjectCompleteSms", label: "Project completed", recipient: "Customer" },
                ].map(row => (
                  <tr key={row.emailKey} className="text-sm">
                    <td className="py-2.5 pr-4 text-slate-700">{row.label}</td>
                    <td className="py-2.5 px-3 text-center"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" checked={!!form[row.emailKey]} onChange={e => setForm({ ...form, [row.emailKey]: e.target.checked })} /></td>
                    <td className="py-2.5 px-3 text-center"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" checked={!!form[row.smsKey]} onChange={e => setForm({ ...form, [row.smsKey]: e.target.checked })} /></td>
                    <td className="py-2.5 pl-3 text-slate-500 text-xs">{row.recipient}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">Review Requests</h2>
            <p className="text-xs text-slate-500 mt-1">Automatically ask customers for a review after a project completes.</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="reviewEnabled" className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500" checked={!!form.reviewRequestEnabled} onChange={e => setForm({ ...form, reviewRequestEnabled: e.target.checked })} />
            <label htmlFor="reviewEnabled" className="text-sm font-medium text-slate-700">Enable automatic review requests</label>
          </div>
          {form.reviewRequestEnabled && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Delay (hours after completion)</label>
                  <input type="number" min={1} className={inputCls} value={form.reviewRequestDelayHours ?? 24} onChange={e => setForm({ ...form, reviewRequestDelayHours: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelCls}>Send via</label>
                  <select className={inputCls} value={form.reviewRequestChannel || "both"} onChange={e => setForm({ ...form, reviewRequestChannel: e.target.value })}>
                    <option value="email">Email only</option>
                    <option value="sms">SMS only</option>
                    <option value="both">Email + SMS</option>
                  </select>
                </div>
              </div>
              {field("reviewPlatformUrl", "Review Platform URL", "text", "e.g. https://g.page/r/your-business/review — where customers go to leave a review")}
              <div>
                <label className={labelCls}>Custom Message (optional)</label>
                <textarea rows={5} className={inputCls} placeholder="Leave blank to use the default message. Use {name} for the customer's first name and {reviewUrl} for the review link." value={form.reviewRequestTemplate || ""} onChange={e => setForm({ ...form, reviewRequestTemplate: e.target.value })} />
                <p className="text-xs text-slate-400 mt-1">If blank, a professional default message is used.</p>
              </div>
            </>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Social Media</h2>
          {field("facebookUrl", "Facebook URL")}
          {field("instagramUrl", "Instagram URL")}
          {field("twitterUrl", "Twitter/X URL")}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">Legal Pages</h2>
            <p className="text-xs text-slate-500 mt-1">Your site already publishes a solid default Terms &amp; Conditions and Privacy Policy for a UK rendering business, linked in the footer and referenced on the quote form and payment pages. Leave these blank to use the default, or paste your own wording to replace it entirely.</p>
          </div>
          <div>
            <label className={labelCls}>Custom Terms &amp; Conditions (optional)</label>
            <textarea rows={6} className={inputCls} placeholder="Leave blank to use the default Terms & Conditions" value={form.termsContent || ""} onChange={e => setForm({ ...form, termsContent: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Custom Privacy Policy (optional)</label>
            <textarea rows={6} className={inputCls} placeholder="Leave blank to use the default Privacy Policy" value={form.privacyContent || ""} onChange={e => setForm({ ...form, privacyContent: e.target.value })} />
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">SEO</h2>
          {field("seoTitle", "SEO Title")}
          <div>
            <label className={labelCls}>SEO Description</label>
            <textarea rows={3} className={inputCls} value={form.seoDescription || ""} onChange={e => setForm({ ...form, seoDescription: e.target.value })} />
          </div>
          {field("googleAnalyticsId", "Google Analytics ID", "text", "GA4 Measurement ID, e.g. G-XXXXXXXXXX")}
          {field("googleAdsConversionId", "Google Ads Conversion ID", "text", "e.g. AW-XXXXXXXXX — used to track quote-request conversions for ad campaigns")}
          {field("googleAdsConversionLabel", "Google Ads Conversion Label", "text", "The conversion label from your Google Ads conversion action")}
        </div>
        <div className="flex items-center gap-4 pb-4">
          <button type="submit" disabled={updateMutation.isPending} className="inline-flex h-10 items-center rounded-md bg-orange-500 px-6 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50">
            {updateMutation.isPending ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function DashboardApp() {
  const { isSignedIn } = useAuthCtx();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const nextIdRef = useRef(0);

  const showToast: ToastFn = (text, type = "success") => {
    const id = ++nextIdRef.current;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };
  const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  if (!isSignedIn) return <Redirect to="/sign-in" />;

  return (
    <ToastCtx.Provider value={showToast}>
      <div className="flex min-h-screen bg-slate-50">
        <aside className="hidden md:flex w-56 flex-shrink-0 bg-slate-900 min-h-screen flex-col">
          <SidebarContent currentPath={location} />
        </aside>

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

        <div className="flex-1 min-w-0 flex flex-col">
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
              <Route path="/dashboard/leads/new" component={NewLeadPage} />
              <Route path="/dashboard/leads/:id" component={({ params: p }) => <LeadDetailPage id={Number(p.id)} />} />
              <Route path="/dashboard/quotes" component={QuotesPage} />
              <Route path="/dashboard/quotes/:id" component={({ params: p }) => <QuoteDetailPage id={Number(p.id)} />} />
              <Route path="/dashboard/payment-links" component={PaymentLinksPage} />
              <Route path="/dashboard/emails" component={EmailsPage} />
              <Route path="/dashboard/projects" component={ProjectsPage} />
              <Route path="/dashboard/projects/:id" component={({ params: p }) => <ProjectDetailPage id={Number(p.id)} />} />
              <Route path="/dashboard/customers" component={CustomersPage} />
              <Route path="/dashboard/customers/:id" component={({ params: p }) => <CustomerDetailPage id={Number(p.id)} />} />
              <Route path="/dashboard/gallery" component={GalleryPage} />
              <Route path="/dashboard/reviews" component={ReviewsPage} />
              <Route path="/dashboard/case-studies" component={CaseStudiesPage} />
              <Route path="/dashboard/services" component={ServicesPage} />
              <Route path="/dashboard/pricing" component={PricingPage} />
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

        <ToastContainer toasts={toasts} remove={removeToast} />
      </div>
    </ToastCtx.Provider>
  );
}
