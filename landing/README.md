# Bussola landing site

Standalone static marketing site for **usebussola.com** — separate from the
Next.js app in `../src`. No build step, no dependencies, no framework.

```
landing/
├── index.html          # Home
├── features.html       # Feature detail + widget catalog
├── connectors.html     # Wave 1 / Wave 2 / planned connectors
├── pricing.html        # Plans, comparison table, FAQ
├── open-source.html    # Self-hosting, quick start, MCP, stack
├── styles.css          # One design system — palette mirrors src/styles/palette-tokens.css
└── assets/             # logo, favicon, Elms Sans, GitHub repo images, brand logos
```

The hero dashboard and per-feature graphics are pure CSS/inline SVG — no image
dependencies, they follow the light/dark theme.

## Preview

```bash
npx serve landing
```

Then open <http://localhost:3000>.

## Deploy

Point any static host (Netlify, Vercel, Cloudflare Pages, S3) at this folder.
CTAs link to `https://usebussola.app` and the GitHub repo.

## Before launch

- Fill in the legal pages: `/privacy`, `/terms`, `/imprint` (Malango Tech UG).
- Confirm the GitHub org/repo slug (`notsurenaime/bussola`) in every link.
- Replace the monochrome letter marks for Resend / Sentry / Lemon Squeezy /
  GitHub / GitLab / Linear / Notion with real logos if brand usage allows.
