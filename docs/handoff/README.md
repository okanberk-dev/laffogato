# Handoff: L'Affogato admin audit, legal program and admin UI v2 (19 Oct 2026)

This folder is everything a cloud session needs to continue the work that the local orchestration session ran on 17-19 Oct 2026. Rules: `brief-cloud.md`. Remaining work, in order: `queue.json` (each item has `handoffStatus`, `prio`, `after` dependencies, `review` type and a notes file in `items/`).

## What is done (merged to main, production verified from main)

Site `RiosenBeq/laffogato`:

| PR | What |
| --- | --- |
| #127, #131 | Admin shell CSS and kit (wave 1) |
| #136 | Orders: manual order delivery and payment record, e-mail lock, till repeat guard |
| #137 | Catalog: stock form snapshot, atomic variant stock, seed markers |
| #138 | People: promo edit, forms keep input, panel cannot switch commercial consent on, 2FA reset |
| #139 | Legal and site texts: archived reset, draft preview, version label |
| #140 | Settings: refused saves keep the tab, dangerous switches confirm, tabs in the URL |
| #141 | Karaoke panel and tables |
| #142 | Shell nav: POST search, content map, collapsible menu, drawer, role landing |
| #143 | Panel sign-in and 2FA hardening |
| #144 | Server refuses a variantless line for a variant product |
| #145, #151 | Web account deletion only as a request to the team; app keeps in-app deletion (Apple 5.1.1(v)) |
| #146 | Karaoke cancel/refund policy from the panel, per-booking snapshot, staff cancel always full (locked to 2 h / 0 % until the app reads server rules) |
| #147 | Admin new-order alert: bell, desktop notification, one tab rings, hourly poll when closed |
| #148 | No form submits as a GET with PII before hydration |
| #149 | Orders UI |
| #150 | Legal: 14-day return, free return shipping, mediation, Türkiye-only delivery, no card-storage sentences |
| #152 | Karaoke booking wizard (phone and desktop), KDV amount next to the total |
| #153 | Storefront: product facts from data, variant quick add opens the product |
| #154 | Menu: 14 allergen groups per item, price-list date, 10 mismatched stock photos removed |
| #155 | Dashboard and reports |
| #156 | Catalog forms (shop hero, menu tags, categories) |
| #157 | App content screens |
| #158 | Re-clear card keys minted during the 18-19 Oct incident |
| #159 | Customers list: paged SQL list with Turkish search, member page fits phones |

App `RiosenBeq/lafmobil`: synced to the site's `docs/API-MOBILE.md` (new `RECONCILED` hash) and the legal export of 19 Oct (see the lafmobil PR of 19 Oct).

## Branches pushed but NOT reviewed (continue them; do not rebuild from scratch)

`handoffStatus: built-needs-review` (the builder finished; its report is in `reports/<slug>-build.json`): run the independent review for its `review` type, fix what survives, bring it up to date with main, open the PR, merge when green.

`handoffStatus: partial-build` (the build was stopped mid-way; the last commit is a `wip(...)` commit that may not typecheck): finish the build first, then review as above.

Branch names are in `queue.json` (`branch`).

## Specs

- Admin audit packages: `audit-fix-plan.md` (§1 root causes, §3 shared files, §4 packages, §5 decisions) and `audit-verified.json` (214 findings with the corrected fix per finding; filter by `pr`). Remaining audit packages: catalog-lists (5d), people-lists (4c), system-audit-log (7c), system-site-settings (7d).
- Legal program: `legal-final-program.json` (57 decisions with basis, the site PR list with exact edits, data fixes, operator actions) and `legal-report-tr.md` (Turkish report). Remaining legal PRs are the `legal-*` items in `queue.json`.
- Admin UI v2: `admin-ui-final-design.md` (decision, nav per role, palette, page pattern, PR plan) and `admin-ui-final-items.json` (UI-1..UI-20 builder notes). Libraries, exact pins: `lucide-react@1.51.0` (UI-1), `react-aria-components@1.21.1` (UI-6), `@internationalized/date@3.12.4` (UI-14).
- Per item notes: `items/<slug>.md` (they override the plan where they differ).

## Known open points

- Operator facts: e-invoices already go out through Paraşüt (19 Oct); Neon free plan (compute and branch limits).
- Production incident 18-19 Oct: an old preview was promoted to production by hand and served 9.5 h; fixed by promoting main again and #158. Possible side effect: the old code's seed logic may have refilled an empty content table (app announcements, posts, slides): the operator was asked to check those lists.
- lafmobil follow-ups: the app side of the legal program (`appPRs`), with what the site already serves and what still waits for site items, is copied to lafmobil `docs/site-handoff/` (lafmobil is a separate private repository; its cloud session reads that copy). Every site change to `docs/API-MOBILE.md` or to the legal texts needs the byte-identical contract copy plus a new `RECONCILED` hash and a new legal export; those run in a session with both checkouts.
- Final steps once the queue is empty: a visual pass of every admin screen at 390, 1024 and 1280 px; remove stale branches; confirm production from main.
