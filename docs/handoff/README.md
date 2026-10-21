# Handoff: L'Affogato admin audit, legal program and admin UI v2 (19 Oct 2026)

## Status: completed (21 Oct 2026)

The queue in `queue.json` is empty: every item below was built, independently reviewed (three lenses plus verifiers for money, refund, consent and legal work; one review otherwise), passed the local CI gate at its exact head (typecheck, `lint --max-warnings=0`, full vitest against Postgres 16, `next build`; GitHub Actions is off until 1 Nov), squash-merged, and production was confirmed from `main` (Vercel production deployment of the merge commit, 8 paths 200). The rest of this file is the history of the handoff and is kept for reference.

Merged 20-21 Oct 2026, site `RiosenBeq/laffogato`:

| PR | What |
| --- | --- |
| #189 | Staff updates Live status; table count for owner and manager; venue quick switch (UI-10) |
| #190 | Saved list views, orders first (UI-11) |
| #191 | Karaoke: late cancel by the venue gives a make-good hour or money; a late-cancelled hour can be resold |
| #192 | Unsaved-change guard on settings, app settings, legal and campaign forms |
| #193 | Legal: every shown version stored; order and karaoke confirmation e-mail carries the accepted texts (durable copy) |
| #194 | Database and key safety: connection only from DATABASE_URL, milestone reward and key fixes |
| #195 | Laptop rail menu (64 px) and compact density |
| #196 | KVKK: guest karaoke data erased after 3 years, every erasure run logged; till path changes |
| #197 | Date filter presets on lists (UI-14, `@internationalized/date@3.12.4`) |
| #198 | Palette: Settings sections searchable |
| #199 | Turkish date and time field on publish windows |
| #200 | Type-to-search product / variant picker on stock adjust and manual order (UI-16) |
| #201 | Page header pattern and copy sweep on Today, Catalog and Marketing (UI-19) |
| #202 | Page header pattern and copy sweep on Content and Admin pages; Press and Story create dialogs (UI-20) |
| 44c5cb78 | Karaoke link to the venue panel: signed ping on karaoke writes, signed `GET /api/panel/karaoke` (`docs/PANEL-KARAOKE.md`; pushed straight to `main` at the operator's request) |

App `RiosenBeq/lafmobil`: #20 (last free-cancel minute refunds in full, same rule as the site), #21 (site texts of 21 Oct: payment, karaoke code handover, shop label and dated discount), #22 (contract and legal export synced from site `main` of 21 Oct, new `RECONCILED` hash).

Final checks on 21 Oct: a visual pass of 58 admin screens at 390, 1024 and 1280 px (production build, seeded throwaway database) found no horizontal overflow; merged work branches were deleted (never `claude/*`).

### Still open

- Admin widget chunk budgets: the date widgets (#197, about 84 KB gz) and the combobox (#200, about 64 KB gz) are over the 8 KB per-route target; accepted and listed as open in `docs/AUDIT.md`.
- App version 1.1.0 and `KARAOKE_POLICY_APP_VERSION`: only after the operator says the app build with the server-side karaoke rules is live in the stores.
- Raise `minSupportedAppVersion` before the app shows "Eski fiyat" (dated discount) to older builds.

### Operator to-dos

- Re-enable the four GitHub Actions workflows on 1 Nov (disabled 19 Oct for the free-minutes quota).
- Decide `RETENTION_APPLY` (the erasure job runs as a dry run until it is set).
- Announce the till change in the app and send the informational e-mail (#196, decision R4).
- `KARAOKE_SYNC_SECRET` answers 401 to unsigned requests in production, so it is set; keep the same value in the panel project and set `PANEL_URL` only if the panel moves from `https://ladmin.laffogato.net`.
- Neon: about 1.96 CU-h a day after #185 (75.03 on 20 Oct 20:35, 76.24 on 21 Oct 12:20); look again if it passes 2.2 a day.

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
