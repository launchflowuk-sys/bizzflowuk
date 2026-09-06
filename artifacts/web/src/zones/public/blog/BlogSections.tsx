import React from "react";
import BlogContent from "./BlogContent";
import { blogTheme, blogPattern, seedFrom, type BlogTheme } from "./theme";

/**
 * The blog body, shared by all three public site templates. Deliberately renders NO site chrome —
 * each template wraps these in its own nav, hero and footer, so a tenant keeps its own identity
 * while the blog itself stays one design we extend rather than three we maintain.
 *
 * Nothing here may mention a trade, a service or a town. Everything specific comes from the
 * tenant row, the settings row or the post itself.
 */

type Tenant = any;
type Settings = any;
type Post = any;

function fmtDate(value?: string | Date | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function Btn({ href, children, theme, variant = "solid", full }: {
  href: string; children: React.ReactNode; theme: BlogTheme; variant?: "solid" | "outline"; full?: boolean;
}) {
  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: ".5rem",
    padding: ".78rem 1.4rem", borderRadius: "10px", fontWeight: 600, fontSize: ".93rem",
    textDecoration: "none", transition: "opacity .15s ease, transform .15s ease",
    width: full ? "100%" : undefined, lineHeight: 1.2, textAlign: "center",
  };
  const style: React.CSSProperties = variant === "solid"
    ? { ...base, background: theme.accent, color: theme.onAccent, border: `1px solid ${theme.accent}` }
    : { ...base, background: "transparent", color: theme.accent, border: `1.5px solid ${theme.accentEdge}` };
  return <a href={href} style={style}>{children}</a>;
}

function PatternBand({ theme, seed, height, children }: {
  theme: BlogTheme; seed: number; height: number | string; children?: React.ReactNode;
}) {
  return (
    <div
      aria-hidden={children ? undefined : true}
      style={{
        height, width: "100%", backgroundColor: theme.ground,
        backgroundImage: blogPattern(theme, seed), backgroundRepeat: "repeat",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

/** Eyebrow label for a post — its category if it has one, otherwise a neutral fallback. */
function postLabel(post: Post): string {
  return post?.categoryName || post?.category?.name || "Guide";
}

// ─────────────────────────────────────────────────────────────────────────────
// INDEX
// ─────────────────────────────────────────────────────────────────────────────

export function BlogIndexBody({ posts, siteBase, tenant, settings, isLoading }: {
  posts: Post[] | undefined; siteBase: string; tenant: Tenant; settings: Settings; isLoading?: boolean;
}) {
  const theme = blogTheme(settings, tenant);
  const list = Array.isArray(posts) ? posts : [];
  const quoteHref = `${siteBase}/quote`;
  const contactHref = `${siteBase}/contact`;
  const phone = settings?.phone;

  return (
    <>
      <section style={{ background: theme.surface, padding: "3.5rem 0" }}>
        <div style={{ maxWidth: "72rem", margin: "0 auto", padding: "0 1.25rem" }}>
          {isLoading ? (
            <p style={{ color: theme.muted, textAlign: "center", padding: "3rem 0" }}>Loading guides…</p>
          ) : list.length === 0 ? (
            <div style={{
              border: `1px solid ${theme.line}`, borderRadius: "14px", padding: "3rem 1.5rem",
              textAlign: "center", background: theme.ground,
            }}>
              <p style={{ color: theme.body, margin: 0 }}>New guides are on the way. In the meantime, tell us about your project and we'll answer your questions directly.</p>
              <div style={{ marginTop: "1.25rem" }}><Btn href={quoteHref} theme={theme}>Get a free quote</Btn></div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(19rem, 1fr))", gap: "1.5rem" }}>
              {list.map((post: Post) => {
                const seed = seedFrom(post.slug || post.id);
                const date = fmtDate(post.publishedAt);
                return (
                  <a
                    key={post.id ?? post.slug}
                    href={`${siteBase}/blog/${post.slug}`}
                    style={{
                      display: "flex", flexDirection: "column", textDecoration: "none",
                      border: `1px solid ${theme.line}`, borderRadius: "14px", overflow: "hidden",
                      background: theme.surface, height: "100%",
                    }}
                  >
                    {post.heroImageUrl
                      ? <img src={post.heroImageUrl} alt="" loading="lazy" width={600} height={210} style={{ width: "100%", height: "13rem", objectFit: "cover", display: "block" }}/>
                      : <PatternBand theme={theme} seed={seed} height="13rem"/>
                    }
                    <div style={{ padding: "1.25rem 1.35rem 1.45rem", display: "flex", flexDirection: "column", gap: ".6rem", flex: 1 }}>
                      <span style={{ fontSize: ".68rem", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: theme.accent }}>
                        {postLabel(post)}
                      </span>
                      <h2 style={{ margin: 0, fontSize: "1.14rem", fontWeight: 700, color: theme.ink, lineHeight: 1.3, textWrap: "balance" }}>
                        {post.title}
                      </h2>
                      {post.excerpt && (
                        <p style={{ margin: 0, fontSize: ".92rem", color: theme.body, lineHeight: 1.6 }}>{post.excerpt}</p>
                      )}
                      <div style={{ marginTop: "auto", paddingTop: ".85rem", display: "flex", flexWrap: "wrap", gap: ".6rem", alignItems: "center", fontSize: ".78rem", color: theme.muted }}>
                        {date && <span>{date}</span>}
                        {date && post.readTime ? <span aria-hidden="true">·</span> : null}
                        {post.readTime ? <span>{post.readTime} min read</span> : null}
                      </div>
                      <span style={{ fontSize: ".85rem", fontWeight: 700, color: theme.accent }}>Read the guide →</span>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section style={{ background: theme.ground, padding: "3.25rem 0", borderTop: `1px solid ${theme.line}` }}>
        <div style={{ maxWidth: "44rem", margin: "0 auto", padding: "0 1.25rem", textAlign: "center", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, color: theme.ink, textWrap: "balance" }}>
            Still have a question about your project?
          </h2>
          <p style={{ margin: 0, color: theme.body, lineHeight: 1.65 }}>
            Every property is different, and a guide can only take you so far. Send us the details and photos and you'll get a straight answer and a written quote — no obligation.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem", justifyContent: "center", marginTop: ".35rem" }}>
            <Btn href={quoteHref} theme={theme}>{settings?.ctaText || "Get a free quote"}</Btn>
            {phone
              ? <Btn href={`tel:${String(phone).replace(/\s+/g, "")}`} theme={theme} variant="outline">Call {phone}</Btn>
              : <Btn href={contactHref} theme={theme} variant="outline">Contact us</Btn>}
          </div>
        </div>
      </section>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ARTICLE
// ─────────────────────────────────────────────────────────────────────────────

export function BlogArticleBody({ post, posts, siteBase, tenant, settings, services, isLoading }: {
  post: Post | undefined; posts?: Post[]; siteBase: string; tenant: Tenant; settings: Settings;
  services?: any[]; isLoading?: boolean;
}) {
  const theme = blogTheme(settings, tenant);
  const quoteHref = `${siteBase}/quote`;
  const contactHref = `${siteBase}/contact`;
  const phone = settings?.phone;
  const name = tenant?.name || "our team";

  if (isLoading) {
    return <section style={{ padding: "5rem 1.25rem", textAlign: "center", color: theme.muted }}>Loading…</section>;
  }
  if (!post) {
    return (
      <section style={{ padding: "5rem 1.25rem", textAlign: "center", display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: "1.5rem", color: theme.ink }}>We couldn't find that guide</h1>
        <p style={{ margin: 0, color: theme.body }}>It may have been renamed or removed.</p>
        <Btn href={`${siteBase}/blog`} theme={theme}>Back to all guides</Btn>
      </section>
    );
  }

  const seed = seedFrom(post.slug || post.id);
  const date = fmtDate(post.publishedAt);
  const related = (Array.isArray(posts) ? posts : []).filter((p: Post) => p.slug !== post.slug).slice(0, 3);
  const serviceList = (Array.isArray(services) ? services : []).slice(0, 8);

  return (
    <>
      {post.heroImageUrl
        ? <img src={post.heroImageUrl} alt="" width={1600} height={340} style={{ width: "100%", height: "clamp(11rem, 26vw, 20rem)", objectFit: "cover", display: "block" }}/>
        : <PatternBand theme={theme} seed={seed} height="clamp(8rem, 18vw, 13rem)"/>
      }

      <section style={{ background: theme.surface, padding: "2.75rem 0 4rem" }}>
        <div style={{ maxWidth: "76rem", margin: "0 auto", padding: "0 1.25rem" }}>
          <div className="blog-grid" style={{ display: "grid", gap: "2.75rem", alignItems: "start" }}>
            <style>{`
              .blog-grid { grid-template-columns: 1fr; }
              @media (min-width: 62rem) { .blog-grid { grid-template-columns: minmax(0,1fr) 20rem; } }
            `}</style>

            <article style={{ display: "flex", flexDirection: "column", gap: "1.6rem", minWidth: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: ".85rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: ".55rem", fontSize: ".78rem", color: theme.muted }}>
                  <a href={`${siteBase}/blog`} style={{ color: theme.accent, fontWeight: 700, textDecoration: "none" }}>← All guides</a>
                  <span aria-hidden="true">/</span>
                  <span style={{ fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: theme.accent }}>{postLabel(post)}</span>
                </div>

                <h1 style={{ margin: 0, fontSize: "clamp(1.7rem, 4vw, 2.4rem)", fontWeight: 700, color: theme.ink, lineHeight: 1.14, letterSpacing: "-.02em", textWrap: "balance" }}>
                  {post.title}
                </h1>

                <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem", alignItems: "center", fontSize: ".85rem", color: theme.muted }}>
                  {post.authorName && <span>By {post.authorName}</span>}
                  {date && <span>{date}</span>}
                  {post.readTime ? <span>{post.readTime} min read</span> : null}
                </div>

                {post.excerpt && (
                  <p style={{
                    margin: 0, fontSize: "1.1rem", lineHeight: 1.6, color: theme.ink, fontWeight: 500,
                    borderLeft: `3px solid ${theme.accent}`, paddingLeft: "1rem",
                  }}>
                    {post.excerpt}
                  </p>
                )}
              </div>

              <BlogContent content={post.content} theme={theme}/>

              {/* End-of-article conversion block — the reason the guide exists. */}
              <div style={{
                borderRadius: "14px", padding: "1.9rem 1.75rem", background: theme.accentSoft,
                border: `1px solid ${theme.accentEdge}`, display: "flex", flexDirection: "column", gap: ".85rem",
              }}>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: theme.ink, textWrap: "balance" }}>
                  Want this priced for your property?
                </h2>
                <p style={{ margin: 0, color: theme.body, lineHeight: 1.65 }}>
                  Send {name} a few photos and the rough measurements and you'll get a written quote that sets out exactly what's included — so you can compare it properly against anything else you've been given.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: ".7rem", marginTop: ".25rem" }}>
                  <Btn href={quoteHref} theme={theme}>{settings?.ctaText || "Get a free quote"}</Btn>
                  {phone && <Btn href={`tel:${String(phone).replace(/\s+/g, "")}`} theme={theme} variant="outline">Call {phone}</Btn>}
                </div>
              </div>
            </article>

            <aside style={{ display: "flex", flexDirection: "column", gap: "1.1rem", minWidth: 0 }}>
              <div style={{ border: `1px solid ${theme.line}`, borderRadius: "14px", padding: "1.4rem", background: theme.surface, display: "flex", flexDirection: "column", gap: ".7rem" }}>
                <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: theme.ink }}>Free written quote</h2>
                <p style={{ margin: 0, fontSize: ".88rem", color: theme.body, lineHeight: 1.6 }}>
                  Tell us what you're planning and send photos if you have them. No obligation, no pressure.
                </p>
                <Btn href={quoteHref} theme={theme} full>{settings?.ctaText || "Get a free quote"}</Btn>
                {phone && (
                  <a href={`tel:${String(phone).replace(/\s+/g, "")}`} style={{ fontSize: ".88rem", fontWeight: 700, color: theme.accent, textDecoration: "none", textAlign: "center" }}>
                    Or call {phone}
                  </a>
                )}
              </div>

              {serviceList.length > 0 && (
                <div style={{ border: `1px solid ${theme.line}`, borderRadius: "14px", padding: "1.4rem", background: theme.surface }}>
                  <h2 style={{ margin: "0 0 .6rem", fontSize: ".95rem", fontWeight: 700, color: theme.ink }}>What we do</h2>
                  {serviceList.map((s: any) => (
                    <a
                      key={s.slug || s.id}
                      href={`${siteBase}/services/${s.slug}`}
                      style={{
                        display: "block", padding: ".55rem 0", fontSize: ".89rem", color: theme.body,
                        textDecoration: "none", borderBottom: `1px solid ${theme.lineSoft}`,
                      }}
                    >
                      {s.name}
                    </a>
                  ))}
                </div>
              )}

              {related.length > 0 && (
                <div style={{ border: `1px solid ${theme.line}`, borderRadius: "14px", padding: "1.4rem", background: theme.surface, display: "flex", flexDirection: "column", gap: ".8rem" }}>
                  <h2 style={{ margin: 0, fontSize: ".95rem", fontWeight: 700, color: theme.ink }}>More guides</h2>
                  {related.map((r: Post) => (
                    <a key={r.slug} href={`${siteBase}/blog/${r.slug}`} style={{ display: "flex", gap: ".8rem", textDecoration: "none", alignItems: "center" }}>
                      <span style={{
                        flex: "0 0 auto", width: "3.1rem", height: "3.1rem", borderRadius: "8px",
                        backgroundColor: theme.ground, backgroundImage: blogPattern(theme, seedFrom(r.slug || r.id)),
                      }}/>
                      <span style={{ fontSize: ".86rem", fontWeight: 600, color: theme.ink, lineHeight: 1.4 }}>{r.title}</span>
                    </a>
                  ))}
                  <a href={`${siteBase}/blog`} style={{ fontSize: ".85rem", fontWeight: 700, color: theme.accent, textDecoration: "none" }}>
                    See all guides →
                  </a>
                </div>
              )}

              <div style={{ border: `1px solid ${theme.line}`, borderRadius: "14px", padding: "1.4rem", background: theme.ground, display: "flex", flexDirection: "column", gap: ".55rem" }}>
                <h2 style={{ margin: 0, fontSize: ".95rem", fontWeight: 700, color: theme.ink }}>Prefer to talk it through?</h2>
                <p style={{ margin: 0, fontSize: ".88rem", color: theme.body, lineHeight: 1.6 }}>
                  Send a message and we'll come back to you.
                </p>
                <a href={contactHref} style={{ fontSize: ".88rem", fontWeight: 700, color: theme.accent, textDecoration: "none" }}>Contact {name} →</a>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
