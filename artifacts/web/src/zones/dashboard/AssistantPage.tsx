import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { api, useApi } from "./tradeApi";

/**
 * Flo — ask your business a question.
 *
 * A full view, not a drawer. A drawer says "side feature"; this is meant to be
 * the place you go first in the morning, so it gets a page and room to lay an
 * answer out properly.
 *
 * Flo's answers come back as structured blocks rather than markdown, and this
 * file renders them with the dashboard's own components. That is what keeps
 * every answer titled, grouped and on-brand instead of whatever formatting the
 * model felt like producing — and it means a table of overdue invoices looks
 * like the rest of the product.
 */

type Tone = "good" | "bad" | "warn" | "neutral";

type Block =
  | { type: "figures"; title?: string; items: Array<{ label: string; value: string; hint?: string; tone?: Tone }> }
  | { type: "table"; title?: string; columns: string[]; rows: string[][] }
  | { type: "list"; title?: string; items: string[] }
  | { type: "note"; tone?: Tone; text: string };

type Answer = {
  summary: string;
  blocks: Block[];
  actions: Array<{ label: string; href: string }>;
};

type Turn = { question: string; answer: Answer | null; error?: string };

const TONE_PILL: Record<Tone, string> = {
  good: "active", bad: "danger", warn: "pending", neutral: "done",
};

export default function AssistantPage() {
  const { data: suggestions } = useApi<Array<{ label: string; question: string }>>("/assistant/suggestions");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, busy]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setQuestion("");
    setBusy(true);
    setTurns(t => [...t, { question: q, answer: null }]);
    try {
      const answer = await api.post<Answer>("/assistant/ask", { question: q });
      setTurns(t => t.map((turn, i) => (i === t.length - 1 ? { ...turn, answer } : turn)));
    } catch (err: any) {
      setTurns(t => t.map((turn, i) => (i === t.length - 1 ? { ...turn, error: err?.message || "Flo could not answer." } : turn)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 sm:px-10 pb-16 max-w-[1000px]">
      <div className="ws-heading" style={{ display: "block" }}>
        <p className="ws-eyebrow">Ask Flo</p>
        <h1>What do you want to know?</h1>
        <p className="ws-sub">
          Flo can see your leads, quotes, invoices, jobs, certificates and money — and nothing outside this business.
        </p>
      </div>

      {/* Nothing asked yet: give people a way in. A blank box is a worse prompt
          than four buttons showing what this is for. */}
      {!turns.length && (
        <section className="ws-panel" style={{ marginBottom: "18px" }}>
          <div className="ws-panel-top"><h2>Try one of these</h2></div>
          <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit,minmax(16rem,1fr))" }}>
            {(suggestions ?? []).map(s => (
              <button
                key={s.label}
                type="button"
                onClick={() => ask(s.question)}
                style={{
                  textAlign: "left", padding: "16px 18px", borderRadius: "10px",
                  border: "1px solid var(--ws-line)", background: "#fff", cursor: "pointer",
                }}
              >
                <strong style={{ display: "block", fontSize: "15px" }}>{s.label}</strong>
                <span style={{ fontSize: "13px", color: "var(--ws-muted)" }}>{s.question}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: "grid", gap: "18px" }}>
        {turns.map((turn, i) => (
          <div key={i}>
            <p style={{
              fontSize: "17px", fontWeight: 650, letterSpacing: "-0.3px",
              marginBottom: "12px", display: "flex", gap: "10px", alignItems: "baseline",
            }}>
              <span aria-hidden="true" style={{ color: "var(--ws-muted)", fontSize: "13px" }}>You asked</span>
              {turn.question}
            </p>

            {!turn.answer && !turn.error && (
              <section className="ws-panel" aria-live="polite">
                <p style={{ color: "var(--ws-muted)" }}>Flo is looking…</p>
              </section>
            )}

            {turn.error && (
              <section className="ws-panel" style={{ borderColor: "#e5b4ad", background: "#fbe9e7" }}>
                <p style={{ color: "#8c2f22" }}>{turn.error}</p>
              </section>
            )}

            {turn.answer && <AnswerView answer={turn.answer} />}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* The prompt box sits at the bottom and stays there, like every other
          assistant people already know how to use. */}
      <form
        onSubmit={e => { e.preventDefault(); ask(question); }}
        style={{
          position: "sticky", bottom: 0, paddingTop: "18px", paddingBottom: "18px",
          background: "linear-gradient(to bottom, transparent, var(--ws-bg) 22%)",
          marginTop: "18px",
        }}
      >
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            className="ws-field"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Ask about your leads, quotes, invoices, jobs or certificates…"
            maxLength={500}
            disabled={busy}
          />
          <button type="submit" className="ws-btn" disabled={busy || !question.trim()}>
            {busy ? "Asking…" : <>Ask <span aria-hidden="true">↗</span></>}
          </button>
        </div>
        <p style={{ marginTop: "10px", fontSize: "12.5px", color: "var(--ws-muted)" }}>
          Flo reads your data to answer. It cannot change anything, and it cannot see any other business.
        </p>
      </form>
    </div>
  );
}

function AnswerView({ answer }: { answer: Answer }) {
  return (
    <section className="ws-panel">
      {answer.summary && (
        <p style={{ fontSize: "16px", lineHeight: 1.65, marginBottom: answer.blocks.length ? "22px" : 0 }}>
          {answer.summary}
        </p>
      )}

      <div style={{ display: "grid", gap: "22px" }}>
        {answer.blocks.map((block, i) => <BlockView key={i} block={block} />)}
      </div>

      {!!answer.actions?.length && (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "22px", paddingTop: "18px", borderTop: "1px solid var(--ws-line)" }}>
          {answer.actions.map(a => (
            <Link key={a.href + a.label} href={a.href} className="ws-pill" data-tone="active" style={{ textDecoration: "none" }}>
              {a.label} →
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function BlockView({ block }: { block: Block }) {
  const title = "title" in block && block.title
    ? <h3 className="ws-eyebrow" style={{ marginBottom: "12px" }}>{block.title}</h3>
    : null;

  if (block.type === "figures") {
    return (
      <div>
        {title}
        <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit,minmax(11rem,1fr))" }}>
          {block.items.map((item, i) => (
            <div key={i} style={{ border: "1px solid var(--ws-line)", borderRadius: "10px", padding: "16px 18px" }}>
              <span style={{ display: "block", fontSize: "12.5px", color: "var(--ws-muted)" }}>{item.label}</span>
              <strong style={{ display: "block", fontSize: "26px", fontWeight: 650, letterSpacing: "-1px", margin: "6px 0 2px" }}>
                {item.value}
              </strong>
              {item.hint && <span style={{ fontSize: "12px", color: "var(--ws-muted)" }}>{item.hint}</span>}
              {item.tone && item.tone !== "neutral" && (
                <span className="ws-pill" data-tone={TONE_PILL[item.tone]} style={{ marginTop: "8px" }}>
                  {item.tone === "good" ? "Healthy" : item.tone === "bad" ? "Needs you" : "Watch"}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (block.type === "table") {
    return (
      <div>
        {title}
        <div className="ws-table-scroll">
          <table className="ws-table">
            <thead>
              <tr>{block.columns.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (block.type === "list") {
    return (
      <div>
        {title}
        <ul style={{ margin: 0, paddingLeft: "20px", display: "grid", gap: "8px", fontSize: "15px", lineHeight: 1.6 }}>
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </div>
    );
  }

  const tone = block.tone ?? "neutral";
  const style = tone === "bad" ? { background: "#fbe9e7", color: "#8c2f22" }
    : tone === "warn" ? { background: "#faf0d8", color: "#896723" }
    : tone === "good" ? { background: "var(--ws-active)", color: "var(--brand-ink)" }
    : { background: "var(--ws-hover)", color: "inherit" };

  return (
    <p style={{ ...style, borderRadius: "10px", padding: "14px 16px", fontSize: "14.5px", lineHeight: 1.6 }}>
      {block.text}
    </p>
  );
}
