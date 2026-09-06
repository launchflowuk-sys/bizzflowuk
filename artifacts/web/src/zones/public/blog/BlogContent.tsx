import React from "react";
import type { BlogTheme } from "./theme";

/**
 * Renders the markdown-lite stored in blog_posts.content.
 *
 * The old blog dropped `{post.content}` straight into a div, so every article rendered as one
 * unbroken wall of text with the newlines collapsed — headings, lists and all. This understands
 * the small subset of Markdown the dashboard editor can realistically produce:
 *
 *   ## Heading            ### Sub-heading        > Pull quote
 *   - Bullet              1. Numbered            --- Divider
 *   **bold**              [text](https://…)
 *
 * Deliberately not a full Markdown parser and deliberately not dangerouslySetInnerHTML: post
 * content is editable from the dashboard, so it renders as React text nodes and cannot inject
 * markup into a client's live site.
 */

type Props = { content: string; theme: BlogTheme };

/** **bold** and [text](url) inside a line of otherwise plain text. */
function inline(text: string, theme: BlogTheme, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let n = 0;

  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(<strong key={`${keyPrefix}-b${n++}`} style={{ color: theme.ink, fontWeight: 600 }}>{m[1]}</strong>);
    } else {
      const href = m[3];
      const external = /^https?:\/\//.test(href);
      out.push(
        <a
          key={`${keyPrefix}-a${n++}`}
          href={href}
          {...(external ? { rel: "noopener noreferrer" } : {})}
          style={{ color: theme.accent, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: "2px" }}
        >
          {m[2]}
        </a>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function BlogContent({ content, theme }: Props) {
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];

  let paragraph: string[] = [];
  let bullets: string[] = [];
  let numbers: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (!text) return;
    blocks.push(
      <p key={`p${key++}`} style={{ color: theme.body, margin: 0 }}>
        {inline(text, theme, `p${key}`)}
      </p>,
    );
  };

  const flushBullets = () => {
    if (!bullets.length) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={`ul${key++}`} className="blog-list" style={{ color: theme.body }}>
        {items.map((li, i) => (
          <li key={i} style={{ marginBottom: ".45rem" }}>{inline(li, theme, `ul${key}-${i}`)}</li>
        ))}
      </ul>,
    );
  };

  const flushNumbers = () => {
    if (!numbers.length) return;
    const items = numbers;
    numbers = [];
    blocks.push(
      <ol key={`ol${key++}`} className="blog-list" style={{ color: theme.body }}>
        {items.map((li, i) => (
          <li key={i} style={{ marginBottom: ".45rem" }}>{inline(li, theme, `ol${key}-${i}`)}</li>
        ))}
      </ol>,
    );
  };

  const flushAll = () => { flushParagraph(); flushBullets(); flushNumbers(); };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) { flushAll(); continue; }

    if (trimmed === "---") {
      flushAll();
      blocks.push(<hr key={`hr${key++}`} style={{ border: 0, borderTop: `1px solid ${theme.line}`, margin: 0 }}/>);
      continue;
    }

    const h2 = /^##\s+(.*)$/.exec(trimmed);
    const h3 = /^###\s+(.*)$/.exec(trimmed);
    if (h3) {
      flushAll();
      blocks.push(
        <h3 key={`h3${key++}`} style={{ color: theme.ink, fontSize: "1.06rem", fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
          {inline(h3[1], theme, `h3${key}`)}
        </h3>,
      );
      continue;
    }
    if (h2) {
      flushAll();
      blocks.push(
        <h2 key={`h2${key++}`} style={{ color: theme.ink, fontSize: "1.42rem", fontWeight: 700, margin: 0, lineHeight: 1.22, letterSpacing: "-.01em", textWrap: "balance" }}>
          {inline(h2[1], theme, `h2${key}`)}
        </h2>,
      );
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      flushAll();
      blocks.push(
        <blockquote
          key={`bq${key++}`}
          style={{
            margin: 0,
            padding: "1rem 1.25rem",
            borderLeft: `3px solid ${theme.accent}`,
            background: theme.accentSoft,
            borderRadius: "0 10px 10px 0",
            color: theme.ink,
            fontSize: "1.03rem",
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          {inline(quote[1], theme, `bq${key}`)}
        </blockquote>,
      );
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) { flushParagraph(); flushNumbers(); bullets.push(bullet[1]); continue; }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) { flushParagraph(); flushBullets(); numbers.push(numbered[1]); continue; }

    flushBullets(); flushNumbers();
    paragraph.push(trimmed);
  }

  flushAll();

  return (
    <div className="blog-body" style={{ display: "flex", flexDirection: "column", gap: "1.15rem", lineHeight: 1.72, fontSize: "1.02rem" }}>
      <style>{`
        .blog-body .blog-list { margin: 0; padding-left: 1.25rem; }
        .blog-body .blog-list li::marker { color: ${theme.accent}; }
      `}</style>
      {blocks}
    </div>
  );
}
