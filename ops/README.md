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

Set on the **api-server** service in Coolify, then redeploy — env changes do not
take effect until the container restarts.

| Variable | Example | Notes |
|---|---|---|
| `PLATFORM_SMTP_HOST` | `smtp.postmarkapp.com` | |
| `PLATFORM_SMTP_PORT` | `587` | 465 switches to implicit TLS automatically |
| `PLATFORM_SMTP_USER` | *(token / mailbox)* | |
| `PLATFORM_SMTP_PASS` | *(token / password)* | **Coolify only. Never in chat or git.** |
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
welcome email lands in spam, which is worse than not sending it. Whichever
provider you use gives you the exact DNS records to add at the registrar.

### What sends
| Event | To | Purpose |
|---|---|---|
| Signup | `PLATFORM_ALERT_EMAIL` | A business joined. Reply-To is the owner. |
| Signup | the new owner | Welcome, first three steps, link to their site |
| Subscription active | `PLATFORM_ALERT_EMAIL` | Somebody started paying |
| Trial started via Stripe | `PLATFORM_ALERT_EMAIL` | |
| Cancelled / past due / unpaid | `PLATFORM_ALERT_EMAIL` | Money stopped |
| Help Centre request | `support@launchflow.co.uk` | Falls back to platform SMTP when the tenant has none |
