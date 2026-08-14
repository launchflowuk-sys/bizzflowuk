import { logger } from "./logger";

export interface SmsCreds {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export async function sendSms(to: string, body: string, creds: SmsCreds | null | undefined): Promise<void> {
  if (!creds?.accountSid || !creds?.authToken || !creds?.fromNumber) {
    logger.info({ to, body: body.slice(0, 80) }, "[SMS - NOT CONFIGURED] Would send SMS");
    return;
  }

  // Overridable so the message bodies can be captured by a local stub in testing. Defaults to the
  // real API, so production behaviour is unchanged when the variable is unset.
  const base = process.env["TWILIO_API_BASE"] || "https://api.twilio.com";
  const url = `${base}/2010-04-01/Accounts/${creds.accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: creds.fromNumber, Body: body });
  const basic = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio error ${res.status}: ${text}`);
  }
}
