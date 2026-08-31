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
| Billing | none, everything unlocked | Stripe *(Phase 3)* |

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
- Widget responses are cached ~45–60s to keep local resource use low
- Storage is multi-tenant already: every row is owned by an organization, so
  the hosted edition adds accounts and billing rather than a new data model
