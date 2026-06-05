import { useUser, SignIn, UserButton } from "@clerk/react";
import { useGetPortalMe, useListPortalMessages, useCreatePortalMessage } from "@workspace/api-client-react";
import { useState } from "react";
import { Switch, Route, Link, useLocation } from "wouter";

function PortalNav({ currentPath }: { currentPath: string }) {
  const nav = [
    { path: '/portal', label: 'Overview' },
    { path: '/portal/project', label: 'My Project' },
    { path: '/portal/updates', label: 'Updates' },
    { path: '/portal/messages', label: 'Messages' },
    { path: '/portal/warranty', label: 'Warranty' },
  ];
  return (
    <nav className="bg-slate-900 text-white">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="font-bold text-sm">Customer Portal</div>
        <div className="flex items-center gap-1">
          {nav.map(n => (
            <Link key={n.path} href={n.path} className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${currentPath === n.path ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>{n.label}</Link>
          ))}
        </div>
        <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-7 h-7' } }}/>
      </div>
    </nav>
  );
}

function PortalOverview() {
  const { data, isLoading } = useGetPortalMe();
  const d = data as any;
  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/></div>;
  if (!d) return <div className="p-8 text-center text-slate-500">No account data found. Please contact your renderer to enable portal access.</div>;
  const latestProject = d.projects?.[0];
  const latestQuote = d.quotes?.[0];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome back, {d.customer?.firstName}</h1>
        <p className="text-slate-600 mt-1">Here's an overview of your project status.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">Latest Project</h2>
          {latestProject ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-slate-900">{latestProject.title}</p>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${latestProject.status === 'Completed' ? 'bg-green-100 text-green-700' : latestProject.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>{latestProject.status}</span>
              {latestProject.scheduledStart && <p className="text-slate-500">Start date: {new Date(latestProject.scheduledStart).toLocaleDateString('en-GB')}</p>}
            </div>
          ) : <p className="text-sm text-slate-400">No projects yet</p>}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-semibold text-slate-900">Latest Quote</h2>
          {latestQuote ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-slate-900">{latestQuote.reference}</p>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${latestQuote.status === 'Accepted' ? 'bg-green-100 text-green-700' : latestQuote.status === 'Sent' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>{latestQuote.status}</span>
              <p className="text-slate-700 font-semibold">Total: £{Number(latestQuote.total).toFixed(2)}</p>
            </div>
          ) : <p className="text-sm text-slate-400">No quotes yet</p>}
        </div>
      </div>
    </div>
  );
}

function PortalProject() {
  const { data, isLoading } = useGetPortalMe();
  const d = data as any;
  const project = d?.projects?.[0];
  if (isLoading) return <div className="flex h-64 items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/></div>;
  const stages = ['Enquiry', 'Survey Booked', 'Quote Approved', 'Scheduled', 'In Progress', 'Completed'];
  const currentIndex = project ? stages.indexOf(project.status) : -1;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">My Project</h1>
      {project ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
          <div>
            <h2 className="font-semibold text-slate-900 text-lg">{project.title}</h2>
            {project.address && <p className="text-slate-500 text-sm mt-1">{project.address}, {project.city}</p>}
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-4">Project Progress</h3>
            <div className="flex items-center gap-0 overflow-x-auto pb-2">
              {stages.map((stage, i) => (
                <div key={stage} className="flex items-center flex-shrink-0">
                  <div className={`flex flex-col items-center ${i <= currentIndex ? 'text-orange-500' : 'text-slate-300'}`}>
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${i < currentIndex ? 'bg-orange-500 border-orange-500 text-white' : i === currentIndex ? 'border-orange-500 text-orange-500' : 'border-slate-200 text-slate-300'}`}>
                      {i < currentIndex ? '✓' : i + 1}
                    </div>
                    <span className={`text-xs mt-1 text-center max-w-16 ${i <= currentIndex ? 'text-slate-700' : 'text-slate-400'}`}>{stage}</span>
                  </div>
                  {i < stages.length - 1 && <div className={`w-8 h-0.5 flex-shrink-0 mt-0 -mt-4 ${i < currentIndex ? 'bg-orange-500' : 'bg-slate-200'}`}/>}
                </div>
              ))}
            </div>
          </div>
          {project.description && <div><h3 className="text-sm font-medium text-slate-700 mb-2">Description</h3><p className="text-sm text-slate-600">{project.description}</p></div>}
          {project.warrantyInfo && <div className="rounded-lg bg-green-50 border border-green-200 p-4"><h3 className="text-sm font-medium text-green-900 mb-1">Warranty</h3><p className="text-sm text-green-700">{project.warrantyInfo}</p></div>}
        </div>
      ) : <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">No project information yet. Please contact your renderer for updates.</div>}
    </div>
  );
}

function PortalMessages() {
  const { data: messages, isLoading } = useListPortalMessages();
  const mutation = useCreatePortalMessage();
  const [content, setContent] = useState('');
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    await mutation.mutateAsync({ data: { content } } as any);
    setContent('');
  };
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto p-4 space-y-3">
          {isLoading ? <div className="text-center py-8 text-slate-400">Loading...</div>
          : !(messages as any[])?.length ? <div className="text-center py-8 text-slate-400">No messages yet. Send a message to your renderer below.</div>
          : (messages as any[]).map((m: any) => (
            <div key={m.id} className={`flex ${m.senderRole === 'customer' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-sm rounded-xl px-4 py-3 text-sm ${m.senderRole === 'customer' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-900'}`}>
                <p>{m.content}</p>
                <p className={`text-xs mt-1 ${m.senderRole === 'customer' ? 'text-orange-200' : 'text-slate-400'}`}>{m.createdAt ? new Date(m.createdAt).toLocaleString('en-GB') : ''}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input value={content} onChange={e => setContent(e.target.value)} placeholder="Type a message..." className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"/>
            <button type="submit" disabled={mutation.isPending} className="inline-flex items-center rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400 disabled:opacity-50">Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function PortalWarranty() {
  const { data } = useGetPortalMe();
  const d = data as any;
  const project = d?.projects?.find((p: any) => p.warrantyInfo);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Warranty Information</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {project?.warrantyInfo ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-6">
              <h2 className="font-semibold text-green-900 mb-2">Your Warranty</h2>
              <p className="text-green-700">{project.warrantyInfo}</p>
            </div>
            <div className="text-sm text-slate-600 space-y-2">
              <p><strong>Project:</strong> {project.title}</p>
              {project.completedAt && <p><strong>Completed:</strong> {new Date(project.completedAt).toLocaleDateString('en-GB')}</p>}
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-400 py-8">
            <p>No warranty information available yet.</p>
            <p className="text-sm mt-2">Warranty details will appear here once your project is completed.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortalApp() {
  const { isSignedIn, isLoaded } = useUser();
  const [location] = useLocation();
  if (!isLoaded) return <div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"/></div>;
  if (!isSignedIn) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><SignIn routing="virtual"/></div>;
  return (
    <div className="min-h-screen bg-slate-50">
      <PortalNav currentPath={location}/>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Switch>
          <Route path="/portal" component={PortalOverview}/>
          <Route path="/portal/project" component={PortalProject}/>
          <Route path="/portal/messages" component={PortalMessages}/>
          <Route path="/portal/warranty" component={PortalWarranty}/>
          <Route path="/portal/updates" component={PortalProject}/>
        </Switch>
      </main>
    </div>
  );
}
