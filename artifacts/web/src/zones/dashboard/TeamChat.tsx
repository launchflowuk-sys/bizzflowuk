import { useEffect, useMemo, useState } from "react";
import { api, useApi } from "./tradeApi";
import DictatableTextarea from "./VoiceInput";

/**
 * Messages between the people who work here.
 *
 * The Messages page has only ever been an inbox for website enquiries, so the
 * two people actually running the business had nowhere to say anything to each
 * other. It happens in WhatsApp instead — where it is not attached to the job,
 * not visible to whoever picks the work up next, and gone the moment somebody
 * clears a chat.
 *
 * Deliberately not a chat app. No threads, no reactions, no typing dots. It is
 * a note to whoever is covering tomorrow, kept with the business rather than
 * on a phone, and it can be pinned to the job it is about.
 */

type Person = { id: number; firstName: string | null; lastName: string | null; email: string };
type Message = {
  id: number; body: string; createdAt: string; readAt: string | null;
  senderId: number; senderName: string | null;
  recipientId: number | null; recipientName: string | null;
  toEveryone: boolean; mine: boolean;
  projectId: number | null; projectTitle: string | null;
};

function personName(p: Person): string {
  return [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email;
}

/** "Today at 14:20", "Yesterday at 08:05", then the date. */
function whenText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (days === 0) return `Today at ${time}`;
  if (days === 1) return `Yesterday at ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at ${time}`;
}

export default function TeamChat() {
  const { data: people } = useApi<Person[]>("/team-messages/people");
  const { data, loading, error, reload } = useApi<Message[]>("/team-messages");
  const { data: jobs } = useApi<any[]>("/projects");

  const [body, setBody] = useState("");
  const [to, setTo] = useState<string>("");          // "" = everyone
  const [jobId, setJobId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Opening the page is reading it. Anything else means an unread badge that
  // never clears without a second deliberate action nobody will find.
  useEffect(() => {
    if (!data?.some(m => !m.mine && m.recipientId !== null && !m.readAt)) return;
    api.post("/team-messages/read").catch(() => { /* badge is cosmetic */ });
  }, [data]);

  // Oldest at the top, so it reads like a conversation rather than a feed.
  const messages = useMemo(
    () => [...(data ?? [])].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [data],
  );

  async function send() {
    if (!body.trim()) return;
    setBusy(true); setNote(null);
    try {
      await api.post("/team-messages", {
        body: body.trim(),
        recipientId: to ? Number(to) : null,
        projectId: jobId ? Number(jobId) : null,
      });
      setBody("");
      setJobId("");
      reload();
    } catch (e: any) {
      setNote(e?.message || "Could not send that.");
    } finally { setBusy(false); }
  }

  const openJobs = (jobs ?? []).filter((j: any) => j.status !== "Completed").slice(0, 40);

  return (
    <div className="space-y-4">
      {/* Compose sits at the TOP on purpose. On a phone, a box at the bottom of
          a long list is a scroll away, and the thing people come here to do is
          write something. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[13px] font-semibold text-slate-700 mb-1.5">Who</span>
            <select value={to} onChange={e => setTo(e.target.value)}
              className="w-full h-11 px-3 rounded-[12px] border border-slate-300 text-[15px] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]">
              <option value="">Everyone in the business</option>
              {(people ?? []).map(p => <option key={p.id} value={p.id}>{personName(p)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[13px] font-semibold text-slate-700 mb-1.5">
              About a job <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <select value={jobId} onChange={e => setJobId(e.target.value)}
              className="w-full h-11 px-3 rounded-[12px] border border-slate-300 text-[15px] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]">
              <option value="">Not about a particular job</option>
              {openJobs.map((j: any) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </label>
        </div>

        <DictatableTextarea
          value={body}
          onChange={setBody}
          rows={3}
          disabled={busy}
          placeholder="Left the stopcock key under the step at Chadwell Road — you'll need it tomorrow."
          className="w-full rounded-[12px] border border-slate-300 px-3.5 py-2.5 text-[16px] sm:text-[15px] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
        />

        {note && <p className="text-[13px] text-red-600">{note}</p>}

        <button type="button" onClick={send} disabled={busy || !body.trim()}
          className="inline-flex h-11 items-center rounded-xl bg-[var(--brand)] px-5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
          {busy ? "Sending…" : to ? `Send to ${personName((people ?? []).find(p => String(p.id) === to)!)}` : "Send to everyone"}
        </button>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-center text-slate-400 py-8 text-[14.5px]">Loading…</p>}

      {!loading && messages.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-[15px] font-semibold text-slate-700">Nothing here yet.</p>
          <p className="text-[13.5px] text-slate-500 mt-1 max-w-sm mx-auto">
            Notes to whoever is on tomorrow — where the key is, what the customer said, what to
            pick up on the way. Kept with the business instead of in somebody's phone.
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        {messages.map(m => (
          <div key={m.id}
            className={`rounded-xl border p-4 ${m.mine ? "border-[var(--brand)]/30 bg-[var(--brand-tint)]" : "border-slate-200 bg-white"}`}>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-[13.5px] font-bold text-slate-900">
                {m.mine ? "You" : m.senderName}
              </span>
              {m.toEveryone
                ? <span className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-slate-400">everyone</span>
                : <span className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-slate-400">
                    {m.mine ? `to ${m.recipientName}` : "just you"}
                  </span>}
              <span className="text-[12.5px] text-slate-400">{whenText(m.createdAt)}</span>
            </div>

            <p className="text-[15px] text-slate-800 whitespace-pre-wrap leading-relaxed">{m.body}</p>

            {m.projectTitle && (
              <a href={`/dashboard/projects/${m.projectId}`}
                className="mt-2 inline-block text-[13px] font-semibold text-[var(--brand-ink)] hover:underline">
                About: {m.projectTitle}
              </a>
            )}

            {m.mine && (
              <button
                onClick={async () => {
                  if (!confirm("Delete this message?")) return;
                  try { await api.del(`/team-messages/${m.id}`); reload(); }
                  catch (e: any) { setNote(e?.message || "Could not delete it."); }
                }}
                className="mt-2 ml-3 text-[12.5px] text-slate-400 hover:text-red-600">
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
