import nodemailer from "nodemailer";
import { logger } from "./logger";
import { renderEmailShell, emailInfoRow, emailStepsList, emailButton, emailDataTable, telHref, type BrandConfig } from "./emailShell";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
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
    attachments: payload.attachments,
  });
}

// ─── 1. New Lead — admin alert ────────────────────────────────────────────────
export function buildLeadNewAdminEmail(opts: {
  brand: BrandConfig;
  adminEmail: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  reference?: string;
  serviceInterest?: string;
  address?: string;
  postcode?: string;
  budget?: string;
  notes?: string;
  propertyType?: string;
  propertyTypeOther?: string;
  existingSurface?: string;
  desiredFinish?: string;
  timeframe?: string;
  photoUrls?: string[];
  preferredContactMethod?: string;
  bestTimeToContact?: string;
  areaToRender?: string;
  areaToRenderOther?: string;
  numberOfStoreys?: string;
  wallArea?: string;
  currentCondition?: string[];
  preferredColour?: string;
  preferredColourOther?: string;
  requiresInsulation?: string;
  insulationThickness?: string;
  insulationMaterial?: string;
  accessConditions?: string[];
  propertyStatus?: string;
  companyName?: string;
  // Construction (AMO Services) fields
  clientType?: string;
  projectDescription?: string;
  planningStatus?: string;
  hasDrawings?: string;
  urgency?: string;
}): EmailPayload {
  const name = `${opts.firstName} ${opts.lastName}`.trim();
  const accent = opts.brand.primaryColor || "#f97316";
  const withOther = (value?: string, other?: string) => (value === "Other" && other ? `Other — ${other}` : value);
  const isEwi = opts.serviceInterest === "External Wall Insulation";

  const table = emailDataTable([
    ["Name", name],
    ["Email", opts.email ? `<a href="mailto:${opts.email}">${opts.email}</a>` : undefined],
    ["Phone", opts.phone],
    ["Preferred Contact Method", opts.preferredContactMethod],
    ["Best Time to Contact", opts.bestTimeToContact],
    ["Address", [opts.address, opts.postcode].filter(Boolean).join(", ") || undefined],
    ["Property Type", withOther(opts.propertyType, opts.propertyTypeOther)],
    ["Company Name", opts.companyName],
    ["Area to Be Rendered", withOther(opts.areaToRender, opts.areaToRenderOther)],
    ["Number of Storeys", opts.numberOfStoreys],
    ["Approximate Wall Area", opts.wallArea],
    ["Service Required", opts.serviceInterest],
    ["Client Type", opts.clientType],
    ["Project Description", opts.projectDescription],
    ["Planning / Building Regs", opts.planningStatus],
    ["Has Drawings / Plans", opts.hasDrawings],
    ["Urgency", opts.urgency],
    ["Existing Surface", opts.existingSurface],
    ["Current Condition", opts.currentCondition?.length ? opts.currentCondition.join(", ") : undefined],
    ["Desired Finish", opts.desiredFinish],
    ["Preferred Colour", withOther(opts.preferredColour, opts.preferredColourOther)],
    ...(isEwi ? ([
      ["Requires Insulation", opts.requiresInsulation],
      ["Insulation Thickness", opts.insulationThickness],
      ["Insulation Material", opts.insulationMaterial],
    ] as Array<[string, string | undefined]>) : []),
    ["Access Conditions", opts.accessConditions?.length ? opts.accessConditions.join(", ") : undefined],
    ["Property Status", opts.propertyStatus],
    ["Preferred Timeframe", opts.timeframe],
    ["Budget", opts.budget],
    ["Notes", opts.notes],
    ["Attachments", opts.photoUrls?.length ? opts.photoUrls.map((u, i) => `<a href="${u}">Attachment ${i + 1}</a>`).join(" · ") : undefined],
  ]);

  return {
    to: opts.adminEmail,
    subject: `New Lead — ${name}${opts.reference ? ` (${opts.reference})` : ""}`,
    html: renderEmailShell({
      brand: opts.brand,
      preheader: `New lead from ${name}${opts.reference ? ` — ${opts.reference}` : ""}`,
      heading: "New Lead Received",
      intro: `A new lead has been submitted on your ${opts.brand.tenantName} platform${opts.reference ? ` — reference <strong>${opts.reference}</strong>` : ""}.`,
      bodyHtml: table,
    }),
    text: `New lead${opts.reference ? ` (${opts.reference})` : ""}: ${name}. Email: ${opts.email || "—"}. Phone: ${opts.phone || "—"}. Service: ${opts.serviceInterest || "—"}. Property: ${opts.propertyType || "—"}. Area: ${opts.areaToRender || "—"}. Surface: ${opts.existingSurface || "—"}. Finish: ${opts.desiredFinish || "—"}. Timeframe: ${opts.timeframe || "—"}. Address: ${[opts.address, opts.postcode].filter(Boolean).join(", ") || "—"}. Notes: ${opts.notes || "—"}.`,
  };
}

// ─── 2. New Lead — customer acknowledgement ───────────────────────────────────
export function buildLeadNewCustomerEmail(opts: {
  brand: BrandConfig;
  firstName: string;
  serviceInterest?: string;
  to: string;
}): EmailPayload {
  const accent = opts.brand.primaryColor || "#f97316";
  const phone = opts.brand.phone || undefined;
  const infoRows = [
    opts.serviceInterest ? emailInfoRow("&#9998;", "Service Requested", opts.serviceInterest, accent) : "",
    phone ? emailInfoRow("&#9742;", "Call Us", phone, accent) : "",
    opts.brand.email ? emailInfoRow("&#9993;", "Email Us", opts.brand.email, accent) : "",
  ].filter(Boolean).join("");

  const bodyHtml = `
    ${infoRows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px">${infoRows}</table>` : ""}
    <h2 style="margin:24px 0 8px;font-family:Arial,sans-serif;font-size:16px;color:#0f172a">What happens next</h2>
    ${emailStepsList([
      "We'll review your enquiry and check the details you've provided.",
      "A member of our team will call you within 24 hours to discuss your project.",
      "We'll arrange a free, no-obligation survey at a time that suits you.",
    ], accent)}
    ${phone ? emailButton(`Call Us Now — ${phone}`, telHref(phone), accent) : ""}`;

  return {
    to: opts.to,
    subject: `Thanks for your enquiry — ${opts.brand.tenantName}`,
    html: renderEmailShell({
      brand: opts.brand,
      preheader: `We've received your enquiry and will be in touch within 24 hours.`,
      heading: "Thank You For Your Enquiry",
      intro: `Hi ${opts.firstName}, thanks for getting in touch${opts.serviceInterest ? ` about <strong>${opts.serviceInterest}</strong>` : ""}! We've received your enquiry and will be in touch within 24 hours to arrange a free survey.`,
      bodyHtml,
    }),
    text: `Hi ${opts.firstName}, thanks for contacting ${opts.brand.tenantName}! We'll be in touch within 24 hours. Questions? Call ${phone || ""}.`,
  };
}

// ─── 3. Survey Booked — customer notification ─────────────────────────────────
export function buildSurveyBookedCustomerEmail(opts: {
  brand: BrandConfig;
  firstName: string;
  to: string;
}): EmailPayload {
  const accent = opts.brand.primaryColor || "#f97316";
  const phone = opts.brand.phone || undefined;
  return {
    to: opts.to,
    subject: `Survey booked — ${opts.brand.tenantName}`,
    html: renderEmailShell({
      brand: opts.brand,
      preheader: "Your survey has been booked.",
      heading: "Your Survey Is Booked",
      intro: `Great news, ${opts.firstName}! Your survey has been booked. We'll be in touch shortly to confirm the exact date and time.`,
      bodyHtml: phone ? emailButton(`Call Us — ${phone}`, telHref(phone), accent) : "",
    }),
    text: `Hi ${opts.firstName}, your survey has been booked with ${opts.brand.tenantName}. We'll confirm the date/time shortly. Questions? Call ${phone || ""}.`,
  };
}

// ─── 3b. Standalone Payment Request — customer notification ──────────────────
export function buildPaymentRequestEmail(opts: {
  brand: BrandConfig;
  firstName: string;
  amount: string;
  paymentLinkUrl: string;
  to: string;
}): EmailPayload {
  const accent = opts.brand.primaryColor || "#f97316";
  const phone = opts.brand.phone || undefined;
  const bodyHtml = `
    ${emailInfoRow("&#163;", "Amount Requested", opts.amount, accent)}
    ${emailButton("Pay Now", opts.paymentLinkUrl, accent)}`;
  return {
    to: opts.to,
    subject: `Payment request — ${opts.brand.tenantName}`,
    html: renderEmailShell({
      brand: opts.brand,
      preheader: `${opts.brand.tenantName} has sent you a payment request for ${opts.amount}.`,
      heading: "Payment Request",
      intro: `Hi ${opts.firstName}, <strong>${opts.brand.tenantName}</strong> has sent you a payment request.`,
      bodyHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px">${emailInfoRow("&#163;", "Amount Requested", opts.amount, accent)}</table>${emailButton("Pay Now", opts.paymentLinkUrl, accent)}`,
    }),
    text: `Hi ${opts.firstName}, ${opts.brand.tenantName} has sent you a payment request for ${opts.amount}. Pay here: ${opts.paymentLinkUrl}. Questions? Call ${phone || ""}.`,
  };
}

// ─── 4. Quote Sent — customer notification ────────────────────────────────────
export function buildQuoteSentCustomerEmail(opts: {
  brand: BrandConfig;
  firstName: string;
  reference?: string;
  paymentLinkUrl?: string;
  paymentAmount?: string;
  remainingBalance?: string;
  to: string;
}): EmailPayload {
  const accent = opts.brand.primaryColor || "#f97316";
  const phone = opts.brand.phone || undefined;
  const infoRows = [
    opts.reference ? emailInfoRow("&#128196;", "Quote Reference", opts.reference, accent) : "",
    opts.paymentAmount ? emailInfoRow("&#163;", "Amount Requested", opts.paymentAmount, accent) : "",
    opts.remainingBalance ? emailInfoRow("&#8635;", "Remaining Balance", opts.remainingBalance, accent) : "",
    phone ? emailInfoRow("&#9742;", "Call Us", phone, accent) : "",
  ].filter(Boolean).join("");

  const bodyHtml = `
    ${infoRows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px">${infoRows}</table>` : ""}
    ${opts.paymentLinkUrl ? emailButton("View & Pay Your Quote", opts.paymentLinkUrl, accent) : ""}`;

  return {
    to: opts.to,
    subject: `Your quote is ready — ${opts.brand.tenantName}`,
    html: renderEmailShell({
      brand: opts.brand,
      preheader: `Your quote${opts.reference ? ` (${opts.reference})` : ""} is ready to view.`,
      heading: "Your Quote Is Ready",
      intro: `Hi ${opts.firstName}, great news! We've prepared a quote for your project. Please review it and don't hesitate to reach out with any questions.`,
      bodyHtml,
    }),
    text: `Hi ${opts.firstName}, your quote${opts.reference ? ` (${opts.reference})` : ""} is ready from ${opts.brand.tenantName}. Questions? Call ${phone || ""}.${opts.paymentLinkUrl ? ` View & pay: ${opts.paymentLinkUrl}` : ""}${opts.paymentAmount ? ` Amount requested: ${opts.paymentAmount}.` : ""}${opts.remainingBalance ? ` Remaining balance after this payment: ${opts.remainingBalance}.` : ""}`,
  };
}

// ─── 5. Quote Accepted — admin alert ──────────────────────────────────────────
export function buildQuoteAcceptedAdminEmail(opts: {
  brand: BrandConfig;
  adminEmail: string;
  reference: string;
  customerName?: string;
}): EmailPayload {
  const accent = opts.brand.primaryColor || "#f97316";
  return {
    to: opts.adminEmail,
    subject: `Quote Accepted — ${opts.reference}`,
    html: renderEmailShell({
      brand: opts.brand,
      preheader: `Quote ${opts.reference} has been accepted.`,
      heading: "Quote Accepted!",
      intro: `Quote <strong>${opts.reference}</strong>${opts.customerName ? ` from <strong>${opts.customerName}</strong>` : ""} has been accepted. Log in to your dashboard to create a project and schedule the work.`,
      bodyHtml: emailDataTable([
        ["Reference", opts.reference],
        ["Customer", opts.customerName],
      ]),
    }),
    text: `Quote ${opts.reference}${opts.customerName ? ` from ${opts.customerName}` : ""} has been accepted. Log in to proceed.`,
  };
}

// ─── 5b. Payment Received — admin alert ───────────────────────────────────────
export function buildPaymentReceivedAdminEmail(opts: {
  brand: BrandConfig;
  adminEmail: string;
  reference: string;
  amount: string;
  customerName?: string;
}): EmailPayload {
  return {
    to: opts.adminEmail,
    subject: `Payment Received — ${opts.reference} (${opts.amount})`,
    html: renderEmailShell({
      brand: opts.brand,
      preheader: `${opts.amount} received against quote ${opts.reference}.`,
      heading: "Payment Received!",
      intro: `<strong>${opts.amount}</strong> has been paid against quote <strong>${opts.reference}</strong>${opts.customerName ? ` by <strong>${opts.customerName}</strong>` : ""}. Log in to your dashboard to view the full payment history for this quote.`,
      bodyHtml: emailDataTable([
        ["Reference", opts.reference],
        ["Amount", opts.amount],
        ["Customer", opts.customerName],
      ]),
    }),
    text: `Payment received: ${opts.amount} against quote ${opts.reference}${opts.customerName ? ` from ${opts.customerName}` : ""}.`,
  };
}

// ─── 5c. Payment Received — customer receipt ──────────────────────────────────
export function buildPaymentReceivedCustomerEmail(opts: {
  brand: BrandConfig;
  firstName: string;
  reference?: string;
  amount: string;
  to: string;
}): EmailPayload {
  const accent = opts.brand.primaryColor || "#f97316";
  const phone = opts.brand.phone || undefined;
  return {
    to: opts.to,
    subject: `Payment received — ${opts.brand.tenantName}`,
    html: renderEmailShell({
      brand: opts.brand,
      preheader: `We've received your payment of ${opts.amount}.`,
      heading: "Payment Received — Thank You",
      intro: `Thanks, ${opts.firstName} — we've received your payment of <strong>${opts.amount}</strong>${opts.reference ? ` for quote <strong>${opts.reference}</strong>` : ""}.`,
      bodyHtml: emailDataTable([
        ["Amount Paid", opts.amount],
        ["Quote Reference", opts.reference],
      ]),
    }),
    text: `Hi ${opts.firstName}, we've received your payment of ${opts.amount}${opts.reference ? ` for quote ${opts.reference}` : ""}. Questions? Call ${phone || ""}.`,
  };
}

// ─── 6. Lead Won — customer notification ──────────────────────────────────────
export function buildLeadWonCustomerEmail(opts: {
  brand: BrandConfig;
  firstName: string;
  to: string;
}): EmailPayload {
  const accent = opts.brand.primaryColor || "#f97316";
  const phone = opts.brand.phone || undefined;
  return {
    to: opts.to,
    subject: `Your project is confirmed — ${opts.brand.tenantName}`,
    html: renderEmailShell({
      brand: opts.brand,
      preheader: "Your project is now confirmed.",
      heading: "Your Project Is Confirmed",
      intro: `Fantastic news, ${opts.firstName}! Your project with <strong>${opts.brand.tenantName}</strong> is now confirmed. We'll be in touch shortly to schedule the work.`,
      bodyHtml: phone ? emailButton(`Call Us — ${phone}`, telHref(phone), accent) : "",
    }),
    text: `Hi ${opts.firstName}, your project with ${opts.brand.tenantName} is confirmed! We'll schedule the work shortly. Questions? Call ${phone || ""}.`,
  };
}

// ─── 7. Project In Progress — customer notification ───────────────────────────
export function buildProjectInProgressCustomerEmail(opts: {
  brand: BrandConfig;
  firstName: string;
  projectTitle: string;
  to: string;
}): EmailPayload {
  const accent = opts.brand.primaryColor || "#f97316";
  const phone = opts.brand.phone || undefined;
  return {
    to: opts.to,
    subject: `Work has started on your project — ${opts.brand.tenantName}`,
    html: renderEmailShell({
      brand: opts.brand,
      preheader: `Work has started on ${opts.projectTitle}.`,
      heading: "Work Has Started",
      intro: `Work has started, ${opts.firstName}! The team is now working on your project: <strong>${opts.projectTitle}</strong>.`,
      bodyHtml: phone ? emailButton(`Questions? Call Us — ${phone}`, telHref(phone), accent) : "",
    }),
    text: `Hi ${opts.firstName}, work has started on "${opts.projectTitle}" with ${opts.brand.tenantName}. Questions? Call ${phone || ""}.`,
  };
}

// ─── 8. Project Complete — customer notification ──────────────────────────────
export function buildProjectCompleteCustomerEmail(opts: {
  brand: BrandConfig;
  firstName: string;
  projectTitle: string;
  to: string;
}): EmailPayload {
  const accent = opts.brand.primaryColor || "#f97316";
  const phone = opts.brand.phone || undefined;
  return {
    to: opts.to,
    subject: `Your project is complete — ${opts.brand.tenantName}`,
    html: renderEmailShell({
      brand: opts.brand,
      preheader: `${opts.projectTitle} is now complete.`,
      heading: "Your Project Is Complete",
      intro: `All done, ${opts.firstName}! Your project <strong>${opts.projectTitle}</strong> is now complete. We hope you're absolutely delighted with the results! Thank you for choosing ${opts.brand.tenantName}.`,
      bodyHtml: phone ? emailButton(`Questions? Call Us — ${phone}`, telHref(phone), accent) : "",
    }),
    text: `Hi ${opts.firstName}, your project "${opts.projectTitle}" with ${opts.brand.tenantName} is now complete. Thank you! Questions? Call ${phone || ""}.`,
  };
}

// ─── Review Request ───────────────────────────────────────────────────────────
export function buildReviewRequestEmail(opts: {
  brand: BrandConfig;
  firstName?: string;
  reviewUrl: string;
  customTemplate?: string;
  to: string;
}): EmailPayload {
  const accent = opts.brand.primaryColor || "#f97316";
  const name = opts.firstName || "there";
  const intro = opts.customTemplate
    ? opts.customTemplate.replace(/\{name\}/g, name).replace(/\{reviewUrl\}/g, opts.reviewUrl).replace(/\n/g, "<br>")
    : `We hope you're enjoying the results of your recent project with <strong>${opts.brand.tenantName}</strong>! If you have a moment, we'd really appreciate a quick review — it only takes a minute and helps other homeowners find us.`;
  const text = opts.customTemplate
    ? opts.customTemplate.replace(/\{name\}/g, name).replace(/\{reviewUrl\}/g, opts.reviewUrl)
    : `Hi ${name}, we hope you're enjoying your recent project with ${opts.brand.tenantName}! We'd love a quick review${opts.reviewUrl ? `: ${opts.reviewUrl}` : ""}. Thank you!`;
  return {
    to: opts.to,
    subject: `How did we do? — ${opts.brand.tenantName}`,
    html: renderEmailShell({
      brand: opts.brand,
      preheader: "We'd love a quick review!",
      heading: `How Did We Do, ${name}?`,
      intro,
      bodyHtml: opts.reviewUrl ? emailButton("Leave a Review", opts.reviewUrl, accent) : "",
    }),
    text,
  };
}

// ─── Contact form helpers (used directly in contact.ts) ───────────────────────
export function buildContactAdminEmail(opts: {
  brand: BrandConfig;
  name: string;
  email: string;
  phone?: string;
  message: string;
}): EmailPayload {
  return {
    to: opts.email,
    subject: `New Contact Message — ${opts.name}`,
    html: renderEmailShell({
      brand: opts.brand,
      preheader: `New message from ${opts.name}.`,
      heading: "New Contact Message",
      intro: `Someone has sent a message via your ${opts.brand.tenantName} website contact form.`,
      bodyHtml: emailDataTable([
        ["Name", opts.name],
        ["Email", `<a href="mailto:${opts.email}">${opts.email}</a>`],
        ["Phone", opts.phone],
        ["Message", opts.message],
      ]),
    }),
    text: `New message from ${opts.name} (${opts.email}): ${opts.message}`,
  };
}

export function buildContactCustomerEmail(opts: {
  brand: BrandConfig;
  name: string;
  to: string;
}): EmailPayload {
  const accent = opts.brand.primaryColor || "#f97316";
  const phone = opts.brand.phone || undefined;
  return {
    to: opts.to,
    subject: `We've received your message — ${opts.brand.tenantName}`,
    html: renderEmailShell({
      brand: opts.brand,
      preheader: "We've received your message.",
      heading: "Message Received",
      intro: `Thank you for contacting ${opts.brand.tenantName}, ${opts.name}. We'll get back to you as soon as possible.`,
      bodyHtml: phone ? emailButton(`Urgent? Call Us — ${phone}`, telHref(phone), accent) : "",
    }),
    text: `Thanks ${opts.name}! We've received your message and will respond shortly. Urgent? Call ${phone || ""}.`,
  };
}

// ─── Dashboard-composed email — sent manually by a tenant admin, still templated ──
export function buildComposedEmail(opts: {
  brand: BrandConfig;
  subject: string;
  bodyHtml: string;
  to: string;
  attachments?: EmailAttachment[];
}): EmailPayload {
  return {
    to: opts.to,
    subject: opts.subject,
    html: renderEmailShell({
      brand: opts.brand,
      preheader: opts.subject,
      heading: opts.subject,
      bodyHtml: opts.bodyHtml,
    }),
    text: opts.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    attachments: opts.attachments,
  };
}

export function buildVisualiserAdminEmail(opts: {
  brand: BrandConfig;
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
    html: renderEmailShell({
      brand: opts.brand,
      preheader: `New visualiser request from ${opts.name}.`,
      heading: "New Visualiser Request",
      intro: `A customer has submitted a colour visualiser request on your ${opts.brand.tenantName} website.`,
      bodyHtml: emailDataTable([
        ["Name", opts.name],
        ["Email", `<a href="mailto:${opts.email}">${opts.email}</a>`],
        ["Phone", opts.phone],
        ["Colour", opts.renderColour],
        ["Notes", opts.notes],
      ]),
    }),
    text: `New visualiser request from ${opts.name} (${opts.email}). Colour: ${opts.renderColour}. Notes: ${opts.notes}`,
  };
}
