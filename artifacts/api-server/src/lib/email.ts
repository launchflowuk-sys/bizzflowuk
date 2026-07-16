import nodemailer from "nodemailer";
import { logger } from "./logger";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(payload: EmailPayload, smtp: SmtpConfig | null | undefined): Promise<void> {
  if (!smtp?.host || !smtp?.user || !smtp?.pass) {
    logger.info({ to: payload.to, subject: payload.subject }, "[EMAIL - NOT CONFIGURED] Would send email");
    return;
  }
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port ?? 587,
    secure: smtp.secure ?? false,
    auth: { user: smtp.user, pass: smtp.pass },
  });
  await transporter.sendMail({
    from: smtp.from || smtp.user,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
}

// ─── 1. New Lead — admin alert ────────────────────────────────────────────────
export function buildLeadNewAdminEmail(opts: {
  tenantName: string;
  adminEmail: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  serviceInterest?: string;
  address?: string;
  postcode?: string;
  budget?: string;
  notes?: string;
}): EmailPayload {
  const name = `${opts.firstName} ${opts.lastName}`.trim();
  return {
    to: opts.adminEmail,
    subject: `New Lead — ${name}`,
    html: `
      <h2>New Lead Received</h2>
      <p>A new lead has been submitted on your ${opts.tenantName} platform.</p>
      <table style="border-collapse:collapse;width:100%;max-width:600px">
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Name</td><td style="padding:8px">${name}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Email</td><td style="padding:8px">${opts.email ? `<a href="mailto:${opts.email}">${opts.email}</a>` : "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Phone</td><td style="padding:8px">${opts.phone || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Service</td><td style="padding:8px">${opts.serviceInterest || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Address</td><td style="padding:8px">${[opts.address, opts.postcode].filter(Boolean).join(", ") || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Budget</td><td style="padding:8px">${opts.budget || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Notes</td><td style="padding:8px">${opts.notes || "—"}</td></tr>
      </table>`,
    text: `New lead: ${name}. Email: ${opts.email || "—"}. Phone: ${opts.phone || "—"}. Service: ${opts.serviceInterest || "—"}.`,
  };
}

// ─── 2. New Lead — customer acknowledgement ───────────────────────────────────
export function buildLeadNewCustomerEmail(opts: {
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  firstName: string;
  serviceInterest?: string;
  to: string;
}): EmailPayload {
  return {
    to: opts.to,
    subject: `Thanks for your enquiry — ${opts.tenantName}`,
    html: `
      <h2>Thanks for getting in touch, ${opts.firstName}!</h2>
      <p>We've received your enquiry${opts.serviceInterest ? ` about <strong>${opts.serviceInterest}</strong>` : ""} and will be in touch within 24 hours to arrange a free survey.</p>
      <p>In the meantime, if you have any questions:</p>
      <ul>
        ${opts.tenantPhone ? `<li>Phone: <a href="tel:${opts.tenantPhone}">${opts.tenantPhone}</a></li>` : ""}
        ${opts.tenantEmail ? `<li>Email: <a href="mailto:${opts.tenantEmail}">${opts.tenantEmail}</a></li>` : ""}
      </ul>
      <p>— The ${opts.tenantName} Team</p>`,
    text: `Hi ${opts.firstName}, thanks for contacting ${opts.tenantName}! We'll be in touch within 24 hours. Questions? Call ${opts.tenantPhone}.`,
  };
}

// ─── 3. Survey Booked — customer notification ─────────────────────────────────
export function buildSurveyBookedCustomerEmail(opts: {
  tenantName: string;
  tenantPhone: string;
  firstName: string;
  to: string;
}): EmailPayload {
  return {
    to: opts.to,
    subject: `Survey booked — ${opts.tenantName}`,
    html: `
      <h2>Great news, ${opts.firstName}!</h2>
      <p>Your survey has been booked. We'll be in touch shortly to confirm the exact date and time.</p>
      <p>Need to change anything? Call us on <a href="tel:${opts.tenantPhone}">${opts.tenantPhone}</a>.</p>
      <p>— The ${opts.tenantName} Team</p>`,
    text: `Hi ${opts.firstName}, your survey has been booked with ${opts.tenantName}. We'll confirm the date/time shortly. Questions? Call ${opts.tenantPhone}.`,
  };
}

// ─── 4. Quote Sent — customer notification ────────────────────────────────────
export function buildQuoteSentCustomerEmail(opts: {
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  firstName: string;
  reference?: string;
  paymentLinkUrl?: string;
  to: string;
}): EmailPayload {
  return {
    to: opts.to,
    subject: `Your quote is ready — ${opts.tenantName}`,
    html: `
      <h2>Your quote is ready, ${opts.firstName}!</h2>
      ${opts.reference ? `<p>Quote reference: <strong>${opts.reference}</strong></p>` : ""}
      <p>We've prepared a quote for your project. Please review it and don't hesitate to reach out with any questions:</p>
      <ul>
        ${opts.tenantPhone ? `<li>Phone: <a href="tel:${opts.tenantPhone}">${opts.tenantPhone}</a></li>` : ""}
        ${opts.tenantEmail ? `<li>Email: <a href="mailto:${opts.tenantEmail}">${opts.tenantEmail}</a></li>` : ""}
      </ul>
      ${opts.paymentLinkUrl ? `<p><a href="${opts.paymentLinkUrl}" style="display:inline-block;padding:12px 24px;background:#1F8CFF;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">View & Pay Your Quote</a></p>` : ""}
      <p>— The ${opts.tenantName} Team</p>`,
    text: `Hi ${opts.firstName}, your quote${opts.reference ? ` (${opts.reference})` : ""} is ready from ${opts.tenantName}. Questions? Call ${opts.tenantPhone}.${opts.paymentLinkUrl ? ` View & pay: ${opts.paymentLinkUrl}` : ""}`,
  };
}

// ─── 5. Quote Accepted — admin alert ──────────────────────────────────────────
export function buildQuoteAcceptedAdminEmail(opts: {
  tenantName: string;
  adminEmail: string;
  reference: string;
  customerName?: string;
}): EmailPayload {
  return {
    to: opts.adminEmail,
    subject: `Quote Accepted — ${opts.reference}`,
    html: `
      <h2>Quote Accepted!</h2>
      <p>Quote <strong>${opts.reference}</strong>${opts.customerName ? ` from <strong>${opts.customerName}</strong>` : ""} has been accepted.</p>
      <p>Log in to your dashboard to create a project and schedule the work.</p>`,
    text: `Quote ${opts.reference}${opts.customerName ? ` from ${opts.customerName}` : ""} has been accepted. Log in to proceed.`,
  };
}

// ─── 5b. Payment Received — admin alert ───────────────────────────────────────
export function buildPaymentReceivedAdminEmail(opts: {
  tenantName: string;
  adminEmail: string;
  reference: string;
  amount: string;
  customerName?: string;
}): EmailPayload {
  return {
    to: opts.adminEmail,
    subject: `Payment Received — ${opts.reference} (${opts.amount})`,
    html: `
      <h2>Payment Received!</h2>
      <p><strong>${opts.amount}</strong> has been paid against quote <strong>${opts.reference}</strong>${opts.customerName ? ` by <strong>${opts.customerName}</strong>` : ""}.</p>
      <p>Log in to your dashboard to view the full payment history for this quote.</p>`,
    text: `Payment received: ${opts.amount} against quote ${opts.reference}${opts.customerName ? ` from ${opts.customerName}` : ""}.`,
  };
}

// ─── 5c. Payment Received — customer receipt ──────────────────────────────────
export function buildPaymentReceivedCustomerEmail(opts: {
  tenantName: string;
  tenantPhone: string;
  firstName: string;
  reference?: string;
  amount: string;
  to: string;
}): EmailPayload {
  return {
    to: opts.to,
    subject: `Payment received — ${opts.tenantName}`,
    html: `
      <h2>Thanks, ${opts.firstName} — payment received!</h2>
      <p>We've received your payment of <strong>${opts.amount}</strong>${opts.reference ? ` for quote <strong>${opts.reference}</strong>` : ""}.</p>
      <p>Questions? Call us on <a href="tel:${opts.tenantPhone}">${opts.tenantPhone}</a>.</p>
      <p>— The ${opts.tenantName} Team</p>`,
    text: `Hi ${opts.firstName}, we've received your payment of ${opts.amount}${opts.reference ? ` for quote ${opts.reference}` : ""}. Questions? Call ${opts.tenantPhone}.`,
  };
}

// ─── 6. Lead Won — customer notification ──────────────────────────────────────
export function buildLeadWonCustomerEmail(opts: {
  tenantName: string;
  tenantPhone: string;
  firstName: string;
  to: string;
}): EmailPayload {
  return {
    to: opts.to,
    subject: `Your project is confirmed — ${opts.tenantName}`,
    html: `
      <h2>Fantastic news, ${opts.firstName}!</h2>
      <p>Your project with <strong>${opts.tenantName}</strong> is now confirmed. We'll be in touch shortly to schedule the work.</p>
      <p>Questions? Call <a href="tel:${opts.tenantPhone}">${opts.tenantPhone}</a>.</p>
      <p>— The ${opts.tenantName} Team</p>`,
    text: `Hi ${opts.firstName}, your project with ${opts.tenantName} is confirmed! We'll schedule the work shortly. Questions? Call ${opts.tenantPhone}.`,
  };
}

// ─── 7. Project In Progress — customer notification ───────────────────────────
export function buildProjectInProgressCustomerEmail(opts: {
  tenantName: string;
  tenantPhone: string;
  firstName: string;
  projectTitle: string;
  to: string;
}): EmailPayload {
  return {
    to: opts.to,
    subject: `Work has started on your project — ${opts.tenantName}`,
    html: `
      <h2>Work has started, ${opts.firstName}!</h2>
      <p>The team is now working on your project: <strong>${opts.projectTitle}</strong>.</p>
      <p>Any questions during the works? Call us on <a href="tel:${opts.tenantPhone}">${opts.tenantPhone}</a>.</p>
      <p>— The ${opts.tenantName} Team</p>`,
    text: `Hi ${opts.firstName}, work has started on "${opts.projectTitle}" with ${opts.tenantName}. Questions? Call ${opts.tenantPhone}.`,
  };
}

// ─── 8. Project Complete — customer notification ──────────────────────────────
export function buildProjectCompleteCustomerEmail(opts: {
  tenantName: string;
  tenantPhone: string;
  firstName: string;
  projectTitle: string;
  to: string;
}): EmailPayload {
  return {
    to: opts.to,
    subject: `Your project is complete — ${opts.tenantName}`,
    html: `
      <h2>All done, ${opts.firstName}!</h2>
      <p>Your project <strong>${opts.projectTitle}</strong> is now complete. We hope you're absolutely delighted with the results!</p>
      <p>Questions or follow-up? Call us on <a href="tel:${opts.tenantPhone}">${opts.tenantPhone}</a>.</p>
      <p>Thank you for choosing ${opts.tenantName}.</p>
      <p>— The ${opts.tenantName} Team</p>`,
    text: `Hi ${opts.firstName}, your project "${opts.projectTitle}" with ${opts.tenantName} is now complete. Thank you! Questions? Call ${opts.tenantPhone}.`,
  };
}

// ─── Review Request ───────────────────────────────────────────────────────────
export function buildReviewRequestEmail(opts: {
  tenantName: string;
  firstName?: string;
  reviewUrl: string;
  customTemplate?: string;
  to: string;
}): EmailPayload {
  const name = opts.firstName || "there";
  const html = opts.customTemplate
    ? `<p>${opts.customTemplate.replace(/\{name\}/g, name).replace(/\{reviewUrl\}/g, opts.reviewUrl).replace(/\n/g, "<br>")}</p>`
    : `
      <h2>How did we do, ${name}?</h2>
      <p>We hope you're enjoying the results of your recent project with <strong>${opts.tenantName}</strong>!</p>
      <p>If you have a moment, we'd really appreciate a quick review — it only takes a minute and helps other homeowners find us.</p>
      ${opts.reviewUrl ? `<p><a href="${opts.reviewUrl}" style="background:#f97316;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">Leave a Review</a></p>` : ""}
      <p>Thank you so much for your support.</p>
      <p>— The ${opts.tenantName} Team</p>`;
  const text = opts.customTemplate
    ? opts.customTemplate.replace(/\{name\}/g, name).replace(/\{reviewUrl\}/g, opts.reviewUrl)
    : `Hi ${name}, we hope you're enjoying your recent project with ${opts.tenantName}! We'd love a quick review${opts.reviewUrl ? `: ${opts.reviewUrl}` : ""}. Thank you!`;
  return { to: opts.to, subject: `How did we do? — ${opts.tenantName}`, html, text };
}

// ─── Contact form helpers (used directly in contact.ts) ───────────────────────
export function buildContactAdminEmail(opts: {
  tenantName: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
}): EmailPayload {
  return {
    to: opts.email,
    subject: `New Contact Message — ${opts.name}`,
    html: `
      <h2>New Contact Message</h2>
      <p>Someone has sent a message via your ${opts.tenantName} website contact form.</p>
      <table style="border-collapse:collapse;width:100%;max-width:600px">
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Name</td><td style="padding:8px">${opts.name}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Email</td><td style="padding:8px"><a href="mailto:${opts.email}">${opts.email}</a></td></tr>
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Phone</td><td style="padding:8px">${opts.phone || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Message</td><td style="padding:8px">${opts.message}</td></tr>
      </table>`,
    text: `New message from ${opts.name} (${opts.email}): ${opts.message}`,
  };
}

export function buildContactCustomerEmail(opts: {
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  name: string;
  to: string;
}): EmailPayload {
  return {
    to: opts.to,
    subject: `We've received your message — ${opts.tenantName}`,
    html: `
      <h2>Message received, ${opts.name}!</h2>
      <p>Thank you for contacting ${opts.tenantName}. We'll get back to you as soon as possible.</p>
      <p>If your enquiry is urgent, call us on <a href="tel:${opts.tenantPhone}">${opts.tenantPhone}</a>.</p>
      <p>— The ${opts.tenantName} Team</p>`,
    text: `Thanks ${opts.name}! We've received your message and will respond shortly. Urgent? Call ${opts.tenantPhone}.`,
  };
}

export function buildVisualiserAdminEmail(opts: {
  tenantName: string;
  adminEmail: string;
  name: string;
  email: string;
  phone?: string;
  renderColour?: string;
  notes?: string;
}): EmailPayload {
  return {
    to: opts.adminEmail,
    subject: `New Visualiser Request — ${opts.name}`,
    html: `
      <h2>New Visualiser Request</h2>
      <p>A customer has submitted a colour visualiser request on your ${opts.tenantName} website.</p>
      <table style="border-collapse:collapse;width:100%;max-width:600px">
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Name</td><td style="padding:8px">${opts.name}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Email</td><td style="padding:8px"><a href="mailto:${opts.email}">${opts.email}</a></td></tr>
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Phone</td><td style="padding:8px">${opts.phone || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Colour</td><td style="padding:8px">${opts.renderColour || "—"}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;background:#f5f5f5">Notes</td><td style="padding:8px">${opts.notes || "—"}</td></tr>
      </table>`,
    text: `New visualiser request from ${opts.name} (${opts.email}). Colour: ${opts.renderColour}. Notes: ${opts.notes}`,
  };
}
