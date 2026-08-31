<p align="center">
  <img src="public/git-header.png" alt="Bussola — finally a beautiful dashboard" width="100%" />
</p>

Local-first, plug-and-play dashboard for connecting infrastructure and finance sources into customizable canvases.

**MVP connectors:** Railway · Netlify · Supabase · Qonto  
**Stack:** Next.js · TypeScript · Tailwind v4 · shadcn/ui · Tremor Raw · Postgres

<p align="center">
  <img src="public/git-main.png" alt="Bussola — opensource, secure, fast. Beautiful & truly yours." width="100%" />
</p>

## Quick start

```bash
npm install
cp .env.example .env.local
# optional but recommended:
# openssl rand -hex 32  →  set as BUSSOLA_ENCRYPTION_KEY

npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), claim the instance with an
account only you hold, then:

1. **Connections** — paste API tokens for Railway / Netlify / Supabase / Qonto
2. **Dashboards** — create a canvas
3. **Edit** — drag, resize, and add Tremor trackers + KPI blocks

Without a connection, widgets show an empty state and link to Connections.

## Database

Bussola speaks Postgres, and only Postgres — one schema, one migration set, the
same queries whether you run it on a laptop or host it for others.

**No `DATABASE_URL`** (the default): the app runs on
[PGlite](https://pglite.dev), Postgres compiled to WASM, stored under
`./data/pgdata`. No server, no Docker, nothing to install. PGlite is
single-process by design — perfect for one person, not for a shared instance.

**With `DATABASE_URL`**: any Postgres server. Use this the moment more than one
person depends on the install.

```bash
docker compose up -d db
export DATABASE_URL=postgres://bussola:bussola@localhost:5432/bussola
npm run db:migrate
```

Schema changes go through Drizzle: edit `src/lib/db/schema.ts`, run
`npm run db:generate`, commit the SQL in `drizzle/`.

## Editions

The same codebase runs in two modes, selected by `BUSSOLA_EDITION`.

| | `self-hosted` (default) | `cloud` |
|---|---|---|
| Tenancy | one organization, created on first signup | one per customer |
| Sign-in | email + password, one account | email + password, open signup |
| Database | PGlite or your own Postgres | managed Postgres, required |
| Secrets | fall back to local dev values | `BUSSOLA_ENCRYPTION_KEY` + `BETTER_AUTH_SECRET` required |
| Billing | none, everything unlocked | Stripe checkout, portal, webhook |

This is not two builds. Every query against tenant-owned data goes through the
organization-scoped repositories in `src/lib/db/tenant.ts`, in both editions —
so the self-hosted path exercises the very isolation code that keeps hosted
customers apart, and ESLint refuses to compile a route handler that reaches
around it.

## Auth

Identity runs on [Better Auth](https://better-auth.com), inside the app and on
the same Postgres as everything else — no external identity provider, so the
hosted and self-hosted editions run the *same* auth code rather than two
implementations.

Self-hosted accepts exactly one account: the first person to reach `/signup`
claims the instance, and every later attempt is refused. Cloud leaves signup
open, and each account gets its own organization the moment it is created.

## How data gets fetched

Widgets never trigger a provider call. A background worker refreshes each
connection on its own schedule and writes a snapshot; every widget request is
then a single local query. Upstream traffic scales with the number of
**connections**, not with how many people are looking at a dashboard — which is
what keeps a shared deployment from being rate-limited (or banned) by Railway,
Netlify, Supabase and especially Qonto.

Each connection carries its own schedule. A failing one backs off exponentially
to at most hourly, and after ten consecutive failures it stops being synced
altogether and the widget asks its owner to reconnect — a revoked token stops
generating traffic instead of being retried forever. Pasting new credentials
clears the failure count and resumes immediately.

Where the worker runs depends on the deployment:

| Deployment | How |
|---|---|
| Self-hosted (one Next server) | Automatic, in-process via `instrumentation.ts` |
| Separate process / container | `npm run worker`, plus `BUSSOLA_DISABLE_INLINE_SYNC=1` |
| Serverless with cron | `POST /api/internal/sync` with `BUSSOLA_SYNC_SECRET` |

The last two rows require `DATABASE_URL`. PGlite serves exactly one process, so
a worker started next to the app server would open the same directory a second
time and act on a stale view of it — the worker refuses to start rather than do
that quietly. On PGlite, use the in-process scheduler.

Workers claim connections with `FOR UPDATE SKIP LOCKED` and a lease, so several
can run at once without fetching the same connection twice, and a worker that
dies mid-fetch just leaves its connections to become due again.

The one exception is the Qonto transactions list: it is cursor-paginated and
user-driven, so it reads through to the API behind a short per-tenant cache.

## Plans

Hosted only. Self-hosted never constructs a Stripe client, never creates a
subscription row, and has no limits — `entitlementsFor()` returns unlimited
before it touches the database, so the billing code is inert rather than
merely unused.

| | Trial | Solo | Team |
|---|---|---|---|
| Price | — | €12/mo · €108/yr | €39/mo · €384/yr |
| Dashboards | 1 | 5 | 20 |
| Widgets per dashboard | 4 | 8 | 12 |
| Connectors | Unlimited | Unlimited | Unlimited |
| Seats | 1 | 1 | 5, then €8/seat |
| History | 7 days | 30 days | 12 months |
| Share links | — | — | Unlimited, white-label |
| Alerts | — | Email | Email · Slack · Discord |
| MCP server | — | Yes | Yes, org-wide config |

Connectors are never rationed: they are the reason to buy Bussola, so the
plans differ on dashboards, widgets, seats and history instead. The trial is
deliberately usable rather than a paywall — enough to connect a source and see
a real dashboard, not enough to run a business on.

Limits are enforced when creating a dashboard, widget or invitation, and
nowhere else: a downgrade never deletes anything a customer already has, it
only stops them adding more. Counts are taken at the moment of the check, so
there is no counter to drift. Over-limit answers 402.

Plans live in `src/lib/billing/plans.ts`. Stripe is the source of truth for
*which* plan is active; that file says what the plan means. Entitlements are
read from a local subscription table the webhook keeps current, never from
Stripe in the request path — so Stripe being down slows nobody's dashboard.

- `POST /api/billing/checkout` — Stripe Checkout for a plan and interval
- `POST /api/billing/portal` — Stripe's own portal for cards, invoices, cancellation
- `POST /api/billing/webhook` — signature-verified, idempotent on Stripe's event
  id so a redelivery cannot apply a plan change twice

A price id we do not recognise resolves to the trial, so a mis-configured
price cannot quietly grant the top tier.

## History

The worker appends one sample per connection per hour, alongside the latest
snapshot it serves reads from. Hourly rather than per-sync: a 60-second
interval would write ~43k rows per connection per month at a resolution nobody
plots. Retention is pruned hourly against each organization's plan, which is
what makes "30 days" and "12 months" true rather than marketing copy.
Self-hosted keeps everything.

## Local private use

- Data lives in `./data/pgdata` (or your `DATABASE_URL` server)
- API secrets are encrypted with AES-256-GCM
- Auth is [Better Auth](https://better-auth.com): email + password, sessions in
  your own database, CSRF-checked, no third-party identity service
- Light / dark theme with the Bussola palette and **Elms Sans**

## Widget catalog

| Widget | Source |
|---|---|
| Service Status | Railway latest deploy status per service |
| Deploy Health | Railway live status + failed deploys since |
| Fleet Health | Railway healthy/total services |
| CPU & Memory | Railway avg resources (last hour) |
| Usage This Cycle | Railway estimated billing-cycle usage |
| Recent Deploys | Railway deployment feed |
| Deploy Health | Netlify recent deploy trail |
| Sites Board | Netlify site publish status |
| Sites Health | Netlify ready/total sites |
| Recent Deploys | Netlify deployment feed |
| Build Minutes | Netlify build minutes this period |
| Form Submissions | Netlify Forms submission counts |
| Project Health | Supabase healthy/total projects |
| Projects Board | Supabase project status list |
| Service Health | DB / Auth / Storage / Realtime / Functions |
| API Traffic | Supabase request mix (7 days) |
| Request Volume | Total Supabase API requests (7 days) |
| Security Advisors | Open Supabase security findings |
| Cash Balance | Total cash across Qonto accounts |
| Available Liquidity | Spendable balance after pending |
| 30-Day Net Cashflow | In − out over the last 30 days |
| In vs Out | 30-day inflow / outflow bars |
| Accounts Overview | Pie split of cash by Qonto account |
| Account History | 30-day cash trail (from settled txs) |
| Recent Transactions | Latest bank movements |
| Status Board | Cross-source status list |

Coming soon (UI stubs): Stripe, Polar, Attio, Vercel, webtraffic.

<p align="center">
  <img src="public/git-end.png" alt="Bussola — connects everything you already use" width="100%" />
</p>

## Notes

- Qonto accepts `login:secret` as one API key field, or separate login + secret key
- Widget responses come from worker snapshots; see “How data gets fetched”
- Storage is multi-tenant already: every row is owned by an organization, so
  the hosted edition adds accounts and billing rather than a new data model
