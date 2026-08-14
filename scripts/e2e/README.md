# End-to-end booking-flow test

Walks a tenant's full booking funnel against a **real** database and a **real** SMTP server, and
asserts on what actually landed in the mailbox — not on whether the API returned 200.

That distinction is the point. `sendEmail` no-ops silently when SMTP isn't configured and
`fireNotification` swallows its own errors, so every notification bug this repo has shipped
returned a perfectly healthy 200 while nothing left the building. Only a real mailbox catches those.

It found three live defects on its first run (see migration `0018` and commit `9227ce5`).

## Run it

Two throwaway containers — Postgres, and Mailpit as a fake SMTP server with a web inbox:

```bash
docker run -d --name bf-pg -e POSTGRES_PASSWORD=bizzflow -e POSTGRES_DB=bizzflow -p 55432:5432 postgres:16-alpine && docker run -d --name bf-mail -p 8025:8025 -p 1025:1025 axllent/mailpit
```

Point the schema at it, then start the API:

```bash
DATABASE_URL=postgres://postgres:bizzflow@localhost:55432/bizzflow pnpm --filter @workspace/db run push-force
```

```bash
DATABASE_URL=postgres://postgres:bizzflow@localhost:55432/bizzflow SESSION_SECRET=local-test-secret-at-least-64-characters-long-0123456789abcdef PORT=8080 PRIVATE_UPLOAD_DIR=./data/uploads SEED_ADMIN_PASSWORD=LocalTest123! pnpm --filter @workspace/api-server run dev
```

The tenant under test needs SMTP pointed at Mailpit (`host: localhost`, `port: 1025`) and an
`admin_notification_email` set, and the admin user needs `users.tenant_id` set to that tenant —
otherwise every dashboard call returns an empty list and the run fails at step 3.

Then:

```bash
node scripts/e2e/booking-flow.mjs
```

Watch the mail arrive at http://localhost:8025. Exits non-zero if any check fails.

## What it covers

Public enquiry → admin alert + customer ack → admin login → lead in dashboard → survey booked →
lead converted to quote → line item + total → payment link → **quote sent** (customer + admin) →
customer pay page → customer accepts → admin alerted → customer record auto-created → contact form.

21 checks. **20 should pass.** The 21st (`4b. Admin gets survey confirmation`) asserts something
that isn't a requirement — the tenant books the survey themselves, so they don't need emailing.
It's left failing deliberately rather than deleted, so the question stays visible. If you decide
tenants *should* get that confirmation, add an admin branch to `survey_booked` in
`lib/notifications.ts` and it goes green.

## Configuration

| Variable | Default |
|---|---|
| `E2E_API` | `http://localhost:8080/api` |
| `E2E_MAIL` | `http://localhost:8025/api/v1` |
| `E2E_SLUG` | `amo-rendering` |
| `E2E_ADMIN_EMAIL` | `mark@amorendering.co.uk` |
| `E2E_ADMIN_PASS` | `LocalTest123!` |

Set `E2E_SLUG=amo-services` to walk the construction tenant instead.

## Never point this at production

It submits real leads, sends real emails and accepts real quotes. Localhost only.

## Tear down

```bash
docker rm -f bf-pg bf-mail
```
