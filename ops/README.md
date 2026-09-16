# Server operations

Scripts that live on the Hetzner box, kept here so they are in version control
rather than only in `/usr/local/bin` where nobody can see them.

## disk-guard.sh

Hourly, via `/etc/cron.d/docker-prune`. Reclaims Docker space when the root
disk goes over 70%, stopping at 55%.

**Why it exists.** On 15 Sep 2026 every site went down with the disk 100% full
and zero bytes free: Postgres could not write WAL and crashed into recovery
mode. There was no leak. Every Coolify deploy leaves an image tagged with its
commit SHA — about 1.75GB across api and web — and a working day is 10-15
pushes. That is 20-25GB on a 38GB disk, in one day.

**Two things it got wrong, both found the same night:**

1. The original was weekly with 168h retention. On a busy Tuesday, "anything
   from the last seven days" is every image built that week, so it could never
   help. Now hourly and driven by disk pressure, which is the thing that
   actually varies.

2. It pruned build cache older than 24h — which protects exactly the cache
   causing the problem. Shoji noticed the disk climbing again and it was
   holding 9.6GB of cache all created that same day. The age filter is gone:
   build cache is a speed optimisation, and losing it costs one slower build
   and never correctness.

Deploying this file does not install it. To update the server:

    scp -i ~/.ssh/lima_hetzner ops/disk-guard.sh root@167.233.218.87:/usr/local/bin/disk-guard.sh
    ssh -i ~/.ssh/lima_hetzner root@167.233.218.87 "chmod +x /usr/local/bin/disk-guard.sh"

Check what it has been doing: `tail /var/log/disk-guard.log`

---

## Platform email (PLATFORM_SMTP_*)

**Plain SMTP through nodemailer — the same transport every tenant already
uses.** No third-party email API, no SDK, no account with anybody. `sendEmail()`
in `lib/email.ts` is the only sender in this codebase and the platform mailbox
goes through it exactly like a tenant's does; the only difference is where the
credentials come from (env, not a settings row, so no tenant admin can read or
change the address the platform speaks from).

Set on the **api-server** service in Coolify, then redeploy — env changes do not
take effect until the container restarts.

| Variable | Example | Notes |
|---|---|---|
| `PLATFORM_SMTP_HOST` | your own mail server | the in-house box, same as the tenants |
| `PLATFORM_SMTP_PORT` | `587` | 465 switches to implicit TLS automatically |
| `PLATFORM_SMTP_USER` | `hello@bizzflowuk.com` | the mailbox itself |
| `PLATFORM_SMTP_PASS` | *(mailbox password)* | **Coolify only. Never in chat or git.** |
| `PLATFORM_SMTP_FROM` | `BizzFlowUK <hello@bizzflowuk.com>` | Must be a verified sender on the domain |
| `PLATFORM_ALERT_EMAIL` | `shujaat@launchflow.co.uk` | Where signup and subscription alerts land |

Two different addresses on purpose: mail **from** a BizzFlowUK address, because a
trade who signed up to BizzFlowUK and receives mail from an unfamiliar domain
reads it as phishing and so do spam filters; alerts **to** one LaunchFlow inbox
so every product reports to the same place.

Without these the platform still runs — every send logs
`[platform-mail] NOT SENT` and nothing breaks. That is the state the platform
shipped in, which is why a signup was invisible.

**Deliverability.** The sending domain needs SPF, DKIM and DMARC records or the
welcome email lands in spam, which is worse than not sending it. Same records
the tenant mailboxes already have — add them for `bizzflowuk.com` at the
registrar.

### What sends
| Event | To | Purpose |
|---|---|---|
| Signup | `PLATFORM_ALERT_EMAIL` | A business joined. Reply-To is the owner. |
| Signup | the new owner | Welcome, first three steps, link to their site |
| Subscription active | `PLATFORM_ALERT_EMAIL` | Somebody started paying |
| Trial started via Stripe | `PLATFORM_ALERT_EMAIL` | |
| Cancelled / past due / unpaid | `PLATFORM_ALERT_EMAIL` | Money stopped |
| Help Centre request | `support@launchflow.co.uk` | Falls back to platform SMTP when the tenant has none |

---

## FreeAgent app registration

The code is written and checked against the published API; it cannot connect
until an app exists. Ten minutes, once, on **our** side — not the tenant's.

1. Sign in at **https://dev.freeagent.com** (a FreeAgent developer account is
   free and separate from any subscription).
2. **Create new app**.
   - Name: `BizzFlowUK`
   - Description: what it does — pushes invoices and contacts from BizzFlowUK.
   - **OAuth redirect URI** (exactly this, no trailing slash):
     `https://bizzflowuk.com/api/accounting/callback/freeagent`
3. It gives an **OAuth identifier** (the client id) and an **OAuth secret**.
4. Put both on the **api-server** service in Coolify and redeploy:

| Variable | Value |
|---|---|
| `FREEAGENT_CLIENT_ID` | the OAuth identifier |
| `FREEAGENT_CLIENT_SECRET` | the OAuth secret — **Coolify only, never in chat or git** |
| `FREEAGENT_SANDBOX` | `1` to point at the sandbox; leave unset for live |

Until those are set, FreeAgent shows in Settings → Accounting as "not available
yet" with the Connect button disabled, which is deliberate: a button that
dead-ends on somebody else's error page is worse than one that plainly is not
ready.

**Sandbox first is worth it here.** Unlike Xero there is no demo company on a
live account — a mistake posts into somebody's real books. Set
`FREEAGENT_SANDBOX=1`, connect a sandbox company, push one invoice, then clear
the variable.

### After the first real connection
Check the invoice that lands in FreeAgent:
- it is a **draft**, not issued;
- the VAT rate matches;
- the revenue sits in the right category. If not, set the code in
  Settings → Accounting → Change (FreeAgent calls it a category; type the code
  as it appears there, e.g. `001`).
