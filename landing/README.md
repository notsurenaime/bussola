# Bussola landing site

Standalone static marketing site for **usebussola.com** — separate from the
Next.js app in `../src`. No build step, no dependencies, no framework: every
file here is served exactly as it sits on disk.

```
landing/
├── index.html          # Home
├── features.html       # Feature detail + the full widget catalog (filterable)
├── connectors.html     # Shipping / next / roadmap, one card per source
├── pricing.html        # Four tiers, monthly–yearly switch, comparison, FAQ
├── security.html       # Credential handling, read-only design, disclosure
├── open-source.html    # Self-hosting, editions, architecture, MCP, stack
├── privacy.html        # GDPR privacy policy          ── drafts, see below
├── terms.html          # Terms of service             ──
├── imprint.html        # § 5 DDG provider information ──
├── 404.html            # Not-found page (noindex)
├── styles.css          # One design system for every page
├── site.js             # Theme toggle, nav, reveals, price switch, filters
├── robots.txt
├── sitemap.xml
└── assets/             # Logo, favicon, Elms Sans, social card, brand marks
```

The hero dashboard and every per-feature graphic are pure CSS and inline SVG —
no image dependencies, and they follow the theme.

The one photographic section is the light/dark pair, and it is composed in the
page rather than shipped as a flat image: `laptop-light.png` and
`laptop-dark.png` are cut-outs with transparent backgrounds, positioned as
percentages of one box so the overlap holds at every width and the page's own
background shows through between them. Under 52rem they stop overlapping and
stack. `og-card.jpg` is the 1200x630 social card.

## Preview

```bash
npx serve landing
```

Then open <http://localhost:3000>. (`.claude/launch.json` also defines a
`landing` server on port 4321 for the in-editor preview.)

## Deploy

Point any static host (Netlify, Vercel, Cloudflare Pages, S3) at this folder.
Two things are worth configuring on the host:

- Serve `404.html` for unmatched paths.
- Serve the pages at extensionless URLs if you prefer `/pricing` over
  `/pricing.html`. The internal links use the `.html` form, which works either
  way; the `<link rel="canonical">` tags point at `.html` URLs, so change them
  in `head()` if you rewrite.

## How it is themed

Semantic tokens are declared **once**, with `light-dark()`, on top of
`color-scheme: light dark`. That means the OS preference works with no
JavaScript at all, and the header toggle only has to override `color-scheme`
on `:root` — every token follows. The toggle cycles system → light → dark and
persists in `localStorage`; a tiny inline script in `<head>` applies the stored
value before first paint so there is no flash.

Brand logos are the one thing `light-dark()` cannot handle, so each `.bmark`
carries an `on-light` and an `on-dark` image and CSS swaps them. Sources with
no licensed asset (Resend, Sentry, Lemon Squeezy, GitHub, GitLab, Linear,
Notion) are drawn from the same inline paths the app uses in
`src/components/brand/source-icons.tsx` — nothing renders as a letter tile.

Everything JavaScript adds is progressive. Scroll reveals in particular are
opt-*in*: the hidden state lives behind a `.js-anim` class that the boot script
only sets when it can be undone, and `site.js` drops the class outright if the
observer has not fired within 2.5s. No failure mode leaves the page blank.

## Keeping it true to the product

The numbers on these pages are not decorative — they are checked against the
app:

| Claim | Source of truth |
|---|---|
| 52 widgets, and every widget name | `src/lib/widgets/registry.ts` |
| 9 live connectors, credential per source | `src/lib/connectors/catalog.ts` |
| Plan prices, limits, history windows | `src/lib/billing/plans.ts` |
| Sync worker, backoff, hourly history | `README.md` → “How data gets fetched” |

When any of those change, update the pages in the same commit. The header,
footer and `<head>` block are duplicated across pages on purpose — that is the
cost of having no build step, and it is cheaper than the alternative for ten
pages.

## Before launch

- [ ] **Fill in the legal pages.** `privacy.html`, `terms.html` and
      `imprint.html` are drafts. Every field that needs the company's real
      details is marked inline in an amber `.todo` chip and each page carries a
      visible “draft” banner — grep for `class="todo"` to list them. They need
      a lawyer's review, not just the blanks filled.
- [ ] Confirm the GitHub org/repo slug (`notsurenaime/bussola`) in every link.
- [ ] Point `hello@`, `privacy@` and `security@usebussola.com` at a real inbox,
      or change the addresses.
- [ ] Confirm the processor table in `privacy.html` matches the contracts you
      actually signed.
- [ ] `assets/git-main.png`, `git-end.png` and `git-header.png` are unused by
      these pages — they belong to the repo README, and `git-main.png` was only
      the source the social card was cut from. Drop all three (~920 KB) if you
      want a leaner deploy.
