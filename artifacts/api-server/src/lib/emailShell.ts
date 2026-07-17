// Shared branded HTML email shell — every customer/admin email in the platform renders through
// this so tenants get a consistent, modern, mobile-first look using their own logo/colors instead
// of the plain-text emails the app shipped with originally. Table-based layout + inline styles for
// maximum email-client compatibility (Outlook desktop has no CSS support beyond inline styles),
// with a <style> block adding real @media responsiveness for every other client (Apple Mail,
// Gmail web/app, Outlook.com, Yahoo — all of which honor it).

export interface BrandConfig {
  tenantName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  websiteUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  twitterUrl?: string | null;
  youtubeUrl?: string | null;
  tiktokUrl?: string | null;
}

function normalizeBrand(brand: BrandConfig) {
  return {
    tenantName: brand.tenantName,
    logoUrl: brand.logoUrl || undefined,
    primary: brand.primaryColor || "#f97316",
    dark: brand.secondaryColor || "#1e293b",
    phone: brand.phone || undefined,
    email: brand.email || undefined,
    address: [brand.address, brand.city].filter(Boolean).join(", ") || undefined,
    websiteUrl: brand.websiteUrl || undefined,
    socials: [
      brand.facebookUrl ? { label: "Facebook", url: brand.facebookUrl } : null,
      brand.instagramUrl ? { label: "Instagram", url: brand.instagramUrl } : null,
      brand.twitterUrl ? { label: "Twitter", url: brand.twitterUrl } : null,
      brand.youtubeUrl ? { label: "YouTube", url: brand.youtubeUrl } : null,
      brand.tiktokUrl ? { label: "TikTok", url: brand.tiktokUrl } : null,
    ].filter(Boolean) as { label: string; url: string }[],
  };
}

/** A single icon+label+value row, e.g. "📞 Phone — 01234 567890". */
export function emailInfoRow(icon: string, label: string, value: string, accent = "#f97316"): string {
  return `
    <tr>
      <td style="padding:6px 0" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="32" valign="top">
            <div style="width:24px;height:24px;border-radius:50%;background:${accent};color:#fff;font-size:13px;line-height:24px;text-align:center;font-family:Arial,sans-serif">${icon}</div>
          </td>
          <td style="padding-left:10px;font-family:Arial,sans-serif" valign="top">
            <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:.04em;font-weight:bold">${label}</div>
            <div style="font-size:14px;color:#1e293b;font-weight:600">${value}</div>
          </td>
        </tr></table>
      </td>
    </tr>`;
}

/** A vertical, numbered "What happens next" list. */
export function emailStepsList(steps: string[], accent = "#f97316"): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0">
      ${steps.map((step, i) => `
        <tr>
          <td width="32" valign="top" style="padding:6px 0">
            <div style="width:24px;height:24px;border-radius:50%;background:${accent};color:#fff;font-size:12px;font-weight:bold;line-height:24px;text-align:center;font-family:Arial,sans-serif">${i + 1}</div>
          </td>
          <td style="padding:6px 0 6px 10px;font-family:Arial,sans-serif;font-size:14px;color:#334155;line-height:1.5" valign="top">${step}</td>
        </tr>`).join("")}
    </table>`;
}

/** Two columns that stack to one on mobile — e.g. a photo beside a project summary. */
export function emailTwoColumn(leftHtml: string, rightHtml: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="stack-table">
      <tr>
        <td class="stack-col" width="45%" valign="top" style="padding-right:12px">${leftHtml}</td>
        <td class="stack-col" width="55%" valign="top" style="padding-left:12px">${rightHtml}</td>
      </tr>
    </table>`;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** A compact striped label/value table for data-dense admin alerts (new lead, contact form, etc). */
export function emailDataTable(rows: Array<[label: string, value: string | undefined]>): string {
  const filled = rows.filter((r): r is [string, string] => !!r[1]);
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
      ${filled.map(([label, value], i) => `
        <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#ffffff"}">
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#64748b;width:38%;vertical-align:top">${label}</td>
          <td style="padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;color:#0f172a;vertical-align:top">${value}</td>
        </tr>`).join("")}
    </table>`;
}

export function emailButton(label: string, url: string, color = "#f97316"): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0">
      <tr><td style="border-radius:8px;background:${color}">
        <a href="${url}" style="display:inline-block;padding:14px 28px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">${label}</a>
      </td></tr>
    </table>`;
}

export interface EmailShellOptions {
  brand: BrandConfig;
  preheader?: string;
  heading: string;
  intro?: string;
  bodyHtml: string;
}

export function renderEmailShell(opts: EmailShellOptions): string {
  const b = normalizeBrand(opts.brand);
  const year = new Date().getFullYear();

  const logoBlock = b.logoUrl
    ? `<img src="${b.logoUrl}" alt="${b.tenantName}" height="40" style="height:40px;max-width:220px;display:block" />`
    : `<span style="font-family:Arial,sans-serif;font-size:20px;font-weight:bold;color:#ffffff">${b.tenantName}</span>`;

  const footerContactRows = [
    b.phone ? `<a href="${telHref(b.phone)}" style="color:#cbd5e1;text-decoration:none">${b.phone}</a>` : null,
    b.email ? `<a href="mailto:${b.email}" style="color:#cbd5e1;text-decoration:none">${b.email}</a>` : null,
  ].filter(Boolean).join(`<span style="color:#475569"> &nbsp;|&nbsp; </span>`);

  const socialRow = b.socials.length
    ? `<tr><td style="padding-top:14px;text-align:center">${b.socials.map(s => `<a href="${s.url}" style="color:#cbd5e1;text-decoration:none;font-size:12px;margin:0 8px;font-family:Arial,sans-serif">${s.label}</a>`).join("")}</td></tr>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${opts.heading}</title>
<style>
  body,table,td,a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  body { margin:0; padding:0; width:100%!important; background:#f1f5f9; }
  img { border:0; outline:none; }
  @media only screen and (max-width:600px) {
    .email-container { width:100%!important; }
    .email-padding { padding-left:20px!important; padding-right:20px!important; }
    .stack-col { display:block!important; width:100%!important; padding-left:0!important; padding-right:0!important; }
    .stack-col + .stack-col { padding-top:14px!important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f1f5f9">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f1f5f9">${opts.preheader || ""}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9">
    <tr>
      <td align="center" style="padding:24px 12px">
        <table role="presentation" width="600" class="email-container" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
          <tr>
            <td style="background:${b.dark};padding:24px 32px" align="left">
              ${logoBlock}
            </td>
          </tr>
          <tr>
            <td class="email-padding" style="padding:32px">
              <h1 style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:22px;color:#0f172a">${opts.heading}</h1>
              ${opts.intro ? `<p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:15px;color:#475569;line-height:1.6">${opts.intro}</p>` : ""}
              ${opts.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background:${b.dark};padding:28px 32px" align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="text-align:center;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff">${b.tenantName}</td></tr>
                ${b.address ? `<tr><td style="text-align:center;padding-top:6px;font-family:Arial,sans-serif;font-size:12px;color:#94a3b8">${b.address}</td></tr>` : ""}
                ${footerContactRows ? `<tr><td style="text-align:center;padding-top:10px;font-family:Arial,sans-serif;font-size:12px">${footerContactRows}</td></tr>` : ""}
                ${socialRow}
                <tr><td style="text-align:center;padding-top:16px;font-family:Arial,sans-serif;font-size:11px;color:#64748b">&copy; ${year} ${b.tenantName}. All rights reserved.</td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
