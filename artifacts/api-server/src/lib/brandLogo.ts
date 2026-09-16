/**
 * The tenant's logo, as bytes pdfkit can draw.
 *
 * Lifted out of the invoice route because the certificate renderer needs the
 * same thing, and a second copy would drift the first time one of the guards
 * below was tightened.
 *
 * Every guard here exists because the alternative is a document that fails to
 * render at all: pdfkit throws on an SVG, chokes on a corrupt file, and will
 * happily sit waiting on a logo URL that has gone away.
 */
export async function fetchBrandLogo(settings: any): Promise<Buffer | null> {
  const url = String(settings?.logoUrl ?? "").trim();
  if (!url) return null;
  try {
    const absolute = url.startsWith("http")
      ? url
      : `${process.env["PUBLIC_BASE_URL"] || "https://bizzflowuk.com"}${url.startsWith("/") ? "" : "/"}${url}`;
    // Bounded, because a hanging fetch here would hang the whole document.
    const res = await fetch(absolute, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    // pdfkit reads PNG and JPEG only. An SVG would throw inside the renderer,
    // which is caught there, but refusing it here is cheaper.
    if (!/png|jpe?g/i.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // A 5MB logo is a mistake, not a logo.
    return buf.byteLength > 5_000_000 ? null : buf;
  } catch {
    return null;
  }
}
