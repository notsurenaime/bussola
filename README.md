<p align="center">
  <img src="public/git-header.png" alt="Bussola — finally a beautiful dashboard" width="100%" />
</p>

Local-first, plug-and-play dashboard for connecting infrastructure and finance sources into customizable canvases.

**MVP connectors:** Railway · Netlify · Supabase · Qonto  
**Stack:** Next.js · TypeScript · Tailwind v4 · shadcn/ui · Tremor Raw · SQLite

<p align="center">
  <img src="public/git-main.png" alt="Bussola — opensource, secure, fast. Beautiful & truly yours." width="100%" />
</p>

## Quick start

```bash
pnpm install
cp .env.example .env.local
# optional but recommended:
# openssl rand -hex 32  →  set as BUSSOLA_ENCRYPTION_KEY

pnpm db:migrate
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), create a local admin password, then:

1. **Connections** — paste API tokens for Railway / Netlify / Supabase / Qonto  
2. **Dashboards** — create a canvas  
3. **Edit** — drag, resize, and add Tremor trackers + KPI blocks  

Without a connection, widgets show an empty state and link to Connections.

## Local private use

- Data lives in `./data/bussola.db` (or `BUSSOLA_DATA_DIR`)
- API secrets are encrypted with AES-256-GCM
- Single-user password auth via HTTP-only session cookie
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
- Designed to migrate storage to Supabase later for cloud / multi-user
