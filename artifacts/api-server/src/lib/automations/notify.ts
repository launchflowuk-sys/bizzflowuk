import { db, tenantsTable, tenantSettingsTable, customersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendAndRecord } from "../emailLog";
import { sendSms } from "../sms";
import { buildSmtpConfig, buildSmsCreds } from "../settingsHelpers";
import { logger } from "../logger";

/**
 * Sending, for automations.
 *
 * Every rule in the catalogue needs the same four things: the business's name
 * and colours, its mail settings, the customer's details, and a way to send
 * that gets LOGGED rather than dropped. Written once here so thirteen rules
 * cannot each get it slightly differently.
 *
 * Everything goes through sendAndRecord, so "we sent it" and "SMTP was never
 * configured" are distinguishable from the dashboard instead of both looking
 * like silence. The review sync spent months doing nothing precisely because a
 * failure had nowhere to show up.
 */

export type TenantVoice = {
  name: string;
  slug: string;
  settings: any;
  smtp: ReturnType<typeof buildSmtpConfig>;
  sms: ReturnType<typeof buildSmsCreds>;
  brandColor: string;
};

const voiceCache = new Map<number, { at: number; voice: TenantVoice | null }>();
/** One sweep touches one tenant many times; this stops it refetching per rule. */
const VOICE_TTL_MS = 60_000;

export async function tenantVoice(tenantId: number): Promise<TenantVoice | null> {
  const hit = voiceCache.get(tenantId);
  if (hit && Date.now() - hit.at < VOICE_TTL_MS) return hit.voice;

  const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
  const [settings] = await db.select().from(tenantSettingsTable)
    .where(eq(tenantSettingsTable.tenantId, tenantId)).limit(1);

  const voice = tenant
    ? {
      name: tenant.name,
      slug: tenant.slug,
      settings,
      smtp: buildSmtpConfig(settings as any),
      sms: buildSmsCreds(settings as any),
      brandColor: (settings as any)?.primaryColor || "#102333",
    }
    : null;

  voiceCache.set(tenantId, { at: Date.now(), voice });
  return voice;
}

export type Recipient = {
  firstName: string;
  email: string | null;
  phone: string | null;
};

export async function customerRecipient(customerId: number | null): Promise<Recipient | null> {
  if (!customerId) return null;
  const [c] = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
  if (!c) return null;
  return {
    firstName: c.firstName || "there",
    email: c.email ?? null,
    phone: c.phone ?? null,
  };
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

/**
 * The house email shell.
 *
 * Plain, narrow, and signed with the business's own name and number. No hero
 * image and no marketing furniture: these are messages about somebody's boiler,
 * and the ones that read like a person wrote them are the ones that get a
 * reply.
 */
export function automationEmail(voice: TenantVoice, opts: {
  greeting: string;
  body: string[];
  cta?: { label: string; url: string };
}): string {
  const paras = opts.body.map(p => `<p style="margin:0 0 14px">${p}</p>`).join("");
  const cta = opts.cta
    ? `<p style="margin:0 0 18px"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:${esc(voice.brandColor)};color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:bold">${esc(opts.cta.label)}</a></p>`
    : "";
  const s = voice.settings ?? {};
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#111827;max-width:560px">
  <p style="margin:0 0 14px">${esc(opts.greeting)}</p>
  ${paras}
  ${cta}
  <p style="margin:0;color:#6B7280;font-size:13px">${esc(voice.name)}${s.phone ? ` &middot; ${esc(s.phone)}` : ""}${s.email ? ` &middot; ${esc(s.email)}` : ""}</p>
</div>`;
}

/**
 * Send to a customer by whichever channels are configured and known.
 *
 * Returns whether ANYTHING went out. A rule uses that to decide whether it has
 * genuinely done something — counting an action that reached nobody is how a
 * dashboard ends up claiming forty things it did not do.
 */
export async function notifyCustomer(args: {
  voice: TenantVoice;
  to: Recipient;
  event: string;
  subject: string;
  html: string;
  sms?: string;
  tenantId: number;
}): Promise<boolean> {
  let sent = false;

  if (args.to.email) {
    try {
      await sendAndRecord(
        { to: args.to.email, subject: args.subject, html: args.html },
        args.voice.smtp,
        { tenantId: args.tenantId, event: args.event },
      );
      sent = true;
    } catch (err) {
      logger.error({ err, event: args.event, tenantId: args.tenantId }, "Automation email failed");
    }
  }

  // SMS only when there is a number AND an account. sendSms logs and returns
  // quietly with no credentials, which must not be mistaken for a send.
  if (args.sms && args.to.phone && args.voice.sms?.accountSid) {
    try {
      await sendSms(args.to.phone, args.sms, args.voice.sms);
      sent = true;
    } catch (err) {
      logger.error({ err, event: args.event, tenantId: args.tenantId }, "Automation SMS failed");
    }
  }

  return sent;
}
