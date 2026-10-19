# Admin audit fix plan (site repo RiosenBeq/laffogato, base origin/main cf30307)

Written 17 Oct 2026 from the original findings (`docs/handoff/audit-{SHE,ORD,KAR,PEO,CAT,CON,SYS}.json`), the adversarial verdicts on cf30307, the queued operator requests P2a (karaoke refund policy from the panel) and P2b (Filament depth round 2), and the two branches in flight (feat/menu-photos, feat/site-home-karaoke-art). Planning only: no source file was edited and nothing was pushed.

Machine-readable companion: `docs/handoff/audit-verified.json` (214 kept findings, each with the verdict note, the corrected fix, `root_cause`, `package`, `pr`, `branch`, `subtasks`, `operator_decisions`, `adversarial_review`, `lawyer_review`, `status`). Generator: `docs/handoff/audit-plan-work/assign.py` (verdict inputs in `plan-work/v-*.json`).

## 0. Summary

- Kept: 214 = 197 verified findings (198 verdicts, all real; SHE-01 dropped because c2dc9f4, #122, already fixed it on main) + 17 findings the auditors missed and the verifiers added.
  - By verified severity: 18 high, 74 medium, 122 low (no critical left).
  - 192 need their own code, 20 are fully covered by a root-cause fix owned elsewhere (`status: covered`), 2 need no code by default (`status: no_code`: SHE-27, KAR-08).
- 7 packages, 22 PRs (packages above ~1,500 changed lines are split into sequential PRs). Total about 21,000 changed lines including tests, excluding generated bundles.
- The 18 high items: SHE-02/KAR-09 (GTM in the admin), ORD-01, ORD-02, ORD-03, ORD-13, ORD-16, KAR-01, PEO-01, PEO-02, PEO-M01, CAT-01, CAT-02, CAT-03, CAT-05, CON-01, CON-02, CON-03.
- New migrations (4, strictly serial after feat/menu-photos' `20261017120000_menu_photos.sql`): catalog-data (variant stock function), content-legal (legal override history), karaoke-refund-policy (reservation policy snapshot), system-audit-log (append-only trigger).
- Biggest planning surprise: the PayNkolay adapter refuses every partial refund amount (`src/lib/payment/paynkolay.ts:1317-1323`, "kısmi iade desteklenmiyor", docs/PAYNKOLAY.md §3.2 still unmeasured, and live POS calls are forbidden). P2a's "late cancel refunds P%" therefore cannot be sent automatically for 1..99%. Decision D9 gives a safe default so the work is not blocked.
- Final step (user order, 17 Oct: "en son tüm repoları mainlere push etmeyi unutma"): after review and green CI, every package branch is merged to main in the order of §2, then the lafmobil follow-ups. This planning step pushed nothing.

## 1. Root causes: one fix each (deduplication)

| Root cause | One fix | Owner PR | Findings it closes |
| --- | --- | --- | --- |
| RC-BTN unlayered `button { font: inherit; cursor: pointer }` | Add `font: revert-layer` to `[data-admin-root] :is(a, button)`; unlayered `[data-admin-root] :is(button:disabled, [aria-disabled="true"]) { cursor: not-allowed }`. Never `cursor: revert-layer` (Tailwind 4.3.3 preflight has no button pointer). | shell-css | SHE-03, ORD-04, KAR-04, CAT-11, PEO-19, CON-18, SHE-26 (font part); follow-up size cleanups KAR-05, CAT-12 |
| RC-INPUT-FONT unlayered `input, textarea, select { font: inherit }` | `[data-admin-root] :is(input, textarea, select) { font: revert-layer }`; keep min-width:0 and the iOS 16px guard | shell-css | KAR-M01 |
| RC-FOCUS unlayered green focus ring | `[data-admin-root] :focus-visible { outline: 2px solid var(--admin-primary); outline-offset: 2px; box-shadow: none }` (12.46:1). Planner resolution: the SHE-16 verdict wins over ORD-23/KAR-04's revert-layer, which would restore the 1.59:1 gold ring. | shell-css | SHE-16, ORD-23, KAR-04 (focus part, menu rows included) |
| RC-PRINT unscoped print rule | Scope to `body:has([data-print-receipt])`; print:hidden on sidebar, top bar, drawer | shell-css (+ shell-nav) | SHE-08, KAR-16, CON-11 |
| RC-GTM tags on /admin | site-tags.tsx gets a separate admin-document predicate; `isCheckoutPath` untouched | shell-css | SHE-02, KAR-09 |
| RC-MUTE `--admin-text-mute #8A7A64` | Token -> `#74644F` (5.71 white, 5.08 bg, 5.30 surface-2, 4.86 neutral-soft; the only proposed hex that clears 4.5:1 on all four grounds); placeholders lose `/70`; pairs added to tests/admin-ui-kit.test.ts | shell-kit | SHE-04, ORD-05, KAR-06, PEO-11, CAT-21, CON-06 (+ PEO-09/CAT-09 error colour via RC-RESET work) |
| RC-FIELD-BORDER field boundary 1.38:1 | New `--admin-border-field #9C8B70` (3.31:1 white, 3.07:1 surface-2) on inputs and FilterBar fields; pagination cells h-11 | shell-kit | SHE-32 |
| RC-RESET React 19 `<form action>` reset on refusal | One tested helper in action-form.tsx: `useNoResetSubmit(dispatch, pending)` (preventDefault + `new FormData(form, submitter)` + startTransition, pending guard against double submit) and `withPanelCatch(action, onThrow)` for legacy `{error}` state shapes; ActionForm gains `beforeSubmit`. Each package moves its forms onto it. | shell-kit (helper), each package (adoption) | SHE-M01, ORD-03, KAR-02, KAR-14, PEO-02, PEO-09, PEO-16, CAT-01, CAT-09, CAT-13, CAT-17, CON-03, CON-04, SYS-01, SYS-18 (+ CON-22) |
| RC-LABEL Field `<label>` wrapping a checkbox or uploader | `Field as="fieldset"` variant (legend + described hint). Field itself stays a label (SYS-05 verdict: a div would strip every input's name). | shell-kit (variant), each package (adoption) | SYS-05, CON-05, SYS-M02, CAT-15, PEO-20 (promo-form part) |
| RC-TABLE table wider than its card | DataTable wrapper `relative`; actions th/td `sticky right-0` with a row-following background; areas trim their columns | shell-kit (+ orders-ui, karaoke-panel, system-audit-log) | ORD-02, ORD-M01, KAR-03, SYS-11 (columns) |
| RC-FILTER-MOBILE FilterBar always open | Below md: search + "Filtreler (n)" details/summary, open when a filter is set | shell-kit | SHE-07, ORD-08, KAR-10 |
| RC-PENDING no navigation feedback | FilterBar push in useTransition; useLinkStatus on tabs, pagination, sort; admin/loading.tsx + sidebar link status | shell-kit + shell-nav | ORD-17, KAR-19, SHE-12, PEO-23 / CON-24 / CAT-08 (loading part) |
| RC-MODAL refusal lost with its dialog | Toast the last refusal when an unclosed dialog unmounts; reset `open` when `disabledReason` appears | shell-kit | KAR-01 |
| RC-ARIA-NAME repeated "Sil"/"Kaydet" | Optional `ariaLabel` on ConfirmButton / ActionModal trigger | shell-kit (prop), packages pass labels | KAR-22, CAT-23, CON-23 |
| RC-CHECKBOX bulk checkboxes need a missing plugin | `h-5 w-5 accent-[var(--admin-primary)]` in a 44px hit area | shell-kit | SHE-19, ORD-22 (checkbox part) |
| RC-NUMERIC codes and amounts in Poppins | `NUMERIC_STYLE` (ui-monospace stack) for amounts, codes, POS refs; `--mono` untouched | shell-kit | KAR-18, CON-27 (mono part) |
| RC-NAV-REFRESH stale sidebar badges | Kit fires `admin:changed` after a successful action; useNavCount re-polls | shell-kit + shell-nav | KAR-23 |
| RC-TR-FOLD locale-free search | `lib/admin/text-fold.ts foldTr()`; SQL side `translate()` on both sides | shell-kit (helper) | PEO-05, CAT-19, global search |
| RC-SEED seed when a table is empty | One-time marker, `setCounter` never lowers, product/menu/category seed never in production | catalog-data | CAT-04, CON-01 |
| RC-THROW-AUDIT `logAudit` throws after the write landed | `safeAudit` in each place | each package | ORD-12, ORD-M02, ORD-28, SHE-M02, SYS-02 |
| RC-SETTINGS-TAB-URL settings tab lives in useState | ARIA tabs synced with `?sekme=` | system-settings | SYS-08, SHE-24, KAR-12 |
| RC-CLOSURE inline closure passed to a client form | `.bind` + one static test scanning src/app | people-money | PEO-01, PEO-M01 |
| RC-2FA-RESET no way back after a lost phone | Owner-only audited reset2FAAction, 2FA badge, delete drops the 2FA row | people-money (+ shell-access copy) | PEO-07, SHE-10 |
| RC-DASH-TZ dashboard on the UTC clock | istanbulClock / `timeZone: "Europe/Istanbul"` | system-insights | SHE-15, KAR-M02 |
| RC-SETTINGS-REACH settings not shown where promised | Footer, home facts, visit CTAs, mail footers read settings | system-site-settings | SYS-04, SYS-M01 |
| RC-LEGACY, RC-STICKY-BAR, RC-LINK-BUTTON, RC-LIST-KIT | Same recipe, applied in the package that owns each file | each package | listed per package |

## 2. Merge order and waves

The machine has 8 GB shared with other agents: at most two builders and one reviewer at a time, every heavy command through `$SP/heavy`.

1. Wave 0 (in flight): feat/menu-photos (laffogato#124) merges; feat/site-home-karaoke-art merges when reviewed; lafmobil#11.
2. Wave 1 (blocking, serial): **shell-css** -> **shell-kit**. Everything else builds on the kit.
3. Wave 2 (high and money first, in pairs): [orders-money, catalog-data] -> [people-money, content-legal] -> [system-settings, shell-access] -> [karaoke-panel, shell-nav].
4. Wave 3 (P2a): **karaoke-refund-policy** (needs system-settings for the extracted karaoke tab, karaoke-panel, and the earlier migrations merged) -> **karaoke-refund-policy-web** (needs feat/site-home-karaoke-art). Land both in the same batch.
5. Wave 4 (P2b lists and UI polish): [orders-ui, catalog-storefront] -> [catalog-forms, people-customers] -> [catalog-lists, people-lists] -> [content-app, system-audit-log] -> [system-insights] (needs karaoke-panel's attention query).
6. Wave 5: **system-site-settings** (needs feat/site-home-karaoke-art and karaoke-refund-policy).
7. Final: local visual sweep of every admin screen at 390/1024/1280 (no browser login in this CLI session), lafmobil P2a follow-up PR (spec §7, API-MOBILE re-sync + RECONCILED hash), then merge everything to main in this order and verify the prod deploy from main.

Inside a package the PRs are sequential (one builder per package), so files may repeat between PRs of the same package; across packages the file sets do not overlap except for the sequenced exceptions in §3.

## 3. Shared-file rules (the only cross-package overlaps)

1. `src/lib/admin/store.ts` (7,171 lines) cannot be split without a refactor; ownership is by function. Touch nothing else; rebase in merge order.

   | Package / PR | Functions |
   | --- | --- |
   | orders-money | `OPEN_ORDER_STATUSES`/`countOpenOrders` (1333-1360), `finalizeOrder` input passthrough (2123), `insertOrderRow` manual payment row (2136), `createManualOrder` (2748), `updateOrderDetails` (4574), `markOrderPaidManually` helper extraction (4641) |
   | catalog-data | `setCounter` (555), `slugifyId` (572), `deriveSku` (605), `ensureSeed` (674-800), `createProduct` (1001), `updateProduct` (1024), `listStockMoves` count (1166), variant pre-check in `resolveOrderLines` (1827-1916), `ensureShopHeroSeed` (6202), `contentResource().ensure` (6350-6371), `ensureAppContentSeed` (6685) |
   | people-money / people-customers | `updatePromo` (5622); `listCustomers`/`summarizeCustomers` (1564-1610) or a new paged query |
   | karaoke-refund-policy | `AdminSettings` (433), `defaultSettings` (634), `getSettings`/`updateSettings` (4984-5044): karaoke fields only |
   | system-insights | `getDashboardStats` (5045), `topProducts` (5976), `analyticsHeadline` (6014) |

2. `db/schema.sql` and `src/lib/db/schema-sql.ts` are generated: never hand-merge. After every rebase run `npm run db:bundle` and commit. Migration names must sort after every migration already on main; rename the file on rebase if needed. Order: menu-photos -> catalog-data -> content-legal -> karaoke-refund-policy -> system-audit-log.
3. `src/lib/email/templates/karaoke-*.html`, `src/lib/email/text.ts`, `src/lib/email/templates.generated.ts`: karaoke-refund-policy first (karaoke bodies), then system-site-settings (footers in all 21 templates). `templates.generated.ts` is regenerated, never hand-edited.
4. `src/app/admin/ayarlar/karaoke-tab.tsx` + `karaoke-actions.ts`: created by system-settings as a pure move (plus RC-RESET), owned by the karaoke package after that PR merges.
5. `src/app/globals.css`: only shell-css, only the admin block (6130-6171) plus new rules right after it. The in-flight branches edit other regions; whoever merges later rebases.
6. `docs/AUDIT.md` (and other docs): each PR edits only its own subsection; textual rebase only.
7. Shared tests: `tests/admin-root-css.test.ts`, `tests/admin-ui-kit.test.ts`, `tests/admin-action-form.test.ts`, `tests/admin-confirm-ui.test.ts` are extended by shell PRs only. Other PRs add `tests/admin-<topic>.test.ts` files or extend the test file of the code they own. `tests/admin-content-deletes.test.ts` seed mocks are updated by catalog-data (RC-SEED).
8. CLAUDE.md front/back split ("Arka yüz ön yüz PR'ında değişmez"): front-end-only PRs are shell-css, catalog-storefront and karaoke-refund-policy-web. system-site-settings mixes both: keep web and mail in separate commits and split into two PRs if the reviewer applies the rule strictly.
9. Never touched by any package: the five card files (rule 28), `src/app/odeme/**` checkout CSP, `next.config.ts` CSP (admin CSP deferred, D34), `home-page.tsx`, `menu-page.tsx`, `visuals.tsx`, `data.ts`, `shop-page.tsx`, `story-page.tsx`, `home-hero-slider.tsx`, `page-hero.tsx`, `src/app/karaoke/page.tsx` (in-flight branches). `app.tsx` and `src/app/page.tsx` only in system-site-settings after feat/site-home-karaoke-art merges.

## 4. Packages

Legend: H/M/L = verified severity; `*` = covered by a root-cause fix owned here; "Incoming" = parts of findings whose primary owner is another PR, done here because this PR owns the file.

### Package 1 SHELL (merges first)

#### 1a shell-css: `fix/admin-audit-shell-css`
- Findings: SHE-02 (H), KAR-09* (H), SHE-08 (M), SHE-03, SHE-16, KAR-M01 (L); covered: ORD-04, KAR-04, CAT-11, CON-11, KAR-16, ORD-23, PEO-19, CON-18.
- Files: `src/app/globals.css` (admin block only), `src/components/laffogato/site-tags.tsx`, `tests/admin-root-css.test.ts`, `tests/checkout-document.test.ts` (or a new `tests/site-tags-admin.test.ts`).
- Order of work:
  1. site-tags: separate `isAdminDocument(path)` (`/admin` or `/admin/...`, not `/administrator`); the tag gate returns false for checkout OR admin. Do not change `isCheckoutPath` (proxy nonce CSP and checkout guard use it).
  2. globals.css: RC-BTN, RC-INPUT-FONT, RC-FOCUS, RC-PRINT rules.
  3. Check locally at 390/1024/1280 (the `ordv` harness): kit buttons at text-sm, inputs 14px on desktop and 16px on phones, one visible focus ring, a non-receipt admin page and `/hukuk/*` print, the order receipt and `masalar/yazdir` still print alone.
- Tests: admin-root-css asserts `font: revert-layer` on links/buttons and fields, the disabled cursor rule, no `cursor: revert-layer`, the focus rule, the scoped print rule; site-tags cases for `/admin`, `/admin/siparisler`, `/administrator`, `/odeme`.
- Money: no. Review: security-minded (PII and admin-takeover path through GTM). Decision: D34.
- Size: 4 files, ~200 lines.

#### 1b shell-kit: `fix/admin-audit-shell-kit`
- Findings: KAR-01 (H), ORD-02 (H), SHE-04, SHE-07, ORD-06, KAR-03 (M), SHE-19, SHE-32, ORD-17, ORD-M01, KAR-18 (L); covered: ORD-05, KAR-06, PEO-11, CAT-21, CON-06, ORD-08, KAR-10, KAR-19. Also delivers the RC-RESET helper, RC-LABEL variant, RC-ARIA-NAME prop, RC-TR-FOLD helper and the `admin:changed` event.
- Incoming: SHE-M03 (toast close 44px), KAR-22/CAT-23/CON-23 (ariaLabel prop), KAR-23 (event dispatch), ORD-22 (checkbox).
- Files: `src/app/admin/layout.tsx` (token block only), `src/components/admin/{forms.tsx,action-form.tsx,bulk.tsx}`, `src/components/admin/ui/{action-modal,data-table,filter-bar,pagination,status-tabs,toast,toast-core,styles,index}`, new `src/lib/admin/text-fold.ts`, tests.
- Order of work:
  1. Tokens (RC-MUTE, RC-FIELD-BORDER), placeholders at full token.
  2. RC-RESET: `useNoResetSubmit`, `withPanelCatch`, ActionForm on the helper + `beforeSubmit`.
  3. RC-LABEL: `Field as="fieldset"`.
  4. RC-MODAL (KAR-01) and the `ariaLabel` prop.
  5. RC-TABLE: sticky actions column, `relative` wrapper (ORD-02, ORD-M01, KAR-03 kit part).
  6. RC-FILTER-MOBILE + RC-PENDING in FilterBar; useLinkStatus marks in StatusTabs, Pagination, sort headers; pagination h-11.
  7. bulk.tsx: RC-CHECKBOX; ORD-06 spacer follows the bar's measured height (ResizeObserver), same API for orders, products, menu.
  8. Toast close h-11; `admin:changed` after a successful action; `NUMERIC_STYLE`; text-fold helper.
- Tests: tests/admin-ui-kit.test.ts (mute and field-border pairs on white, bg, surface-2, neutral-soft; sticky actions classes; pagination 44px); tests/admin-action-form.test.ts (jsdom: a refused submit keeps text, select and checkbox values; a second submit while pending dispatches once; redirect is rethrown; `beforeSubmit` false cancels); tests/admin-confirm-ui.test.ts (refusal toasted when the dialog unmounts after revalidate, e.g. refund_unknown; no ghost reopen after disabledReason; ariaLabel on the trigger); new tests/admin-filter-bar.test.ts (collapsed below md, "Filtreler (n)", open when filtered, pending label); new tests/admin-text-fold.test.ts (İsmail/ismail, IRMAK/ırmak, FINDIK/Fındık, italyan/İtalyan).
- Money: no code, but KAR-01 is the refund-dialog feedback path: include the refund_unknown test.
- Size: ~17 files, ~900 lines.

#### 1c shell-nav: `fix/admin-audit-shell-nav` (includes the P2b shell work)
- Findings: SHE-05 (M), SHE-12, SHE-13, SHE-18, SHE-20, SHE-25, SHE-31, SHE-M03, KAR-23 (L). P2b: global search, breadcrumbs, collapsible nav groups, a user menu (2FA link).
- Incoming: SHE-08 (print:hidden), SHE-11 (layout catch), ORD-21 (badge link `?durum=acik`), SHE-22 ("Mağaza vitrini"), CON-19 (icons), CAT-08/PEO-23/CON-24 (admin/loading.tsx).
- Files: `src/components/admin/admin-sidebar.tsx`, `src/app/admin/layout.tsx` (nav defs, top bar, denied notice, session-unavailable catch), new `src/components/admin/ui/breadcrumbs.tsx`, new `src/components/admin/admin-search.tsx`, `src/lib/admin/nav-match.ts`, new `src/lib/admin/search.ts`, new `src/app/admin/ara/page.tsx`, new `src/app/admin/loading.tsx`, new `src/app/admin/[...rest]/page.tsx`, `src/app/admin/{error,not-found}.tsx`, tests.
- Order of work:
  1. Sidebar tokens (SHE-05, SHE-18), a per-item `icon` key on NavItemDef (SHE-18, CON-19), label fixes.
  2. Drawer as a native `<dialog>` with showModal, Escape, focus return, aria-expanded/controls (SHE-13); 44px hamburger and close (SHE-M03); print:hidden.
  3. Landing-path links from `landingPathFor(role)` (logo, error, not-found); denied notice from the layout; "Güvenlik / 2FA" in a footer user menu (SHE-25).
  4. useNavCount re-polls on `admin:changed` (KAR-23); orders badge links to the Açık tab.
  5. Collapsible groups (state per group in localStorage; the active item's group always open).
  6. Breadcrumbs from nav-match + pathname ("Yeni", "Düzenle", "Ayrıntı" for dynamic segments) in a desktop top bar and under the mobile top bar.
  7. Global search (D36): `lib/admin/search.ts` with role-gated providers (orders by number, e-mail, name, phone; customers; products; menu items; karaoke codes), `LIMIT 5` each, SQL fold with `translate()`, results page `/admin/ara?q=` and a top-bar GET form that works without JS. Read-only, no new index.
  8. `admin/loading.tsx` skeleton, sidebar link status, `[...rest]/page.tsx` -> `notFound()` (SHE-20).
  9. Layout catches the session-unavailable error (introduced by shell-access) and renders the shell with a notice; dormant until shell-access lands.
- Tests: nav-match/breadcrumb labels; search role gating, fold and limit (mocked db); drawer dialog attributes; catch-all calls notFound; tests/admin-panel-shell.test.ts updated.
- Money: no. Review: light security check of the search role gates (PII). Decisions: D36.
- Size: ~14 files, ~1,150 lines.

#### 1d shell-access: `fix/admin-audit-shell-access`
- Findings: SHE-09, SHE-11 (M), SHE-21, SHE-23, SHE-26, SHE-28, SHE-30, SHE-M01, SHE-M02 (L).
- Incoming: SHE-10 (2FA page copy + DB runbook), SHE-17 (login and 2FA screens on kit), SHE-22 ("doğrulama uygulaması"), SHE-05 (login footer colour), SHE-25 (enroll success link).
- Files: `src/lib/admin/{auth.ts,twofa.ts}`, `src/app/admin/giris/{page.tsx,actions.ts,login-form.tsx}`, `src/app/admin/2fa-kurulum/{page.tsx,actions.ts}`, `src/app/admin/iki-asama/{page.tsx,actions.ts}`, `src/components/admin/{twofa-enroll-form,twofa-verify-form}.tsx`, `src/app/admin/actions.ts`, `src/proxy.ts`, docs/AUDIT.md (2FA/session subsection), tests.
- Order of work: logout signs out first, then safeAudit (SHE-M02) -> login form on useNoResetSubmit keeping the e-mail, e-mail <= 254 with "@" (SHE-M01, SHE-28), copy, h1, aria and role=alert (SHE-21, SHE-23), kit screens -> reuse a draft secret younger than 15 min, cancel redirects to the landing page, startEnrollment stays page-only (SHE-09) -> disable answers by flash + redirect, kit buttons (SHE-26), SHE-10 copy -> proxy `url.search = ""` and `next = path + search` (SHE-30) -> SHE-11: throwing panel-account lookup inside auth.ts (users.ts untouched), env fallback only for env addresses, DB-unreachable propagates as a distinct error, pages throw into admin/error.tsx.
- Tests: refused login keeps the e-mail, 300-char e-mail refused; draft secret reused within 15 min and replaced after (tests/admin-2fa-enrollment.test.ts:19 still passes); proxy keeps the query in `next` and drops it from the login URL; DB down throws while an env account still signs in; logout clears the cookie when the audit insert fails.
- Money: no. Review: security review (auth, session, 2FA). Decisions: D33, D35, D40.
- Size: ~16 files, ~650 lines.

### Package 2 ORDERS

#### 2a orders-money: `fix/admin-audit-orders-money`
- Findings: ORD-01, ORD-03, ORD-13, ORD-16 (H), ORD-07, ORD-09, ORD-12, ORD-M02 (M), ORD-18, ORD-19, ORD-21, ORD-29, ORD-M03 (L).
- Incoming: ORD-05 (neutral-400 in the manual form), ORD-26 (manual form copy).
- Files: `src/components/admin/manual-order-form.tsx`, `src/lib/admin/manual-order-schema.ts`, `src/app/admin/siparisler/{actions.ts,page.tsx,[id]/page.tsx,yeni/page.tsx}`, `src/components/admin/order-detail.tsx` (ConsentSection), `src/components/admin/orders-list.tsx` (live prop), `src/lib/admin/order-filters.ts`, store.ts functions (§3), `src/app/admin/kasa/{actions.ts,till-console.tsx}`, `src/lib/mobile/counter.ts`, tests.
- Order of work:
  1. Manual form on useNoResetSubmit; every field error under its field in danger ink with aria-describedby; schema maxLengths mirrored; Turkish zod messages; stock in options, sold-out disabled, qty capped; Vazgeç as a Link; numbered remove labels (ORD-03, ORD-M03, ORD-18).
  2. Teslimat choice threaded to `finalizeOrder` (D4) (ORD-01).
  3. Payment method required for a paid/preparing start; manual payment row written; none for pending_payment (D5) (ORD-19).
  4. Order details edit: before/after in the audit, e-mail change only for `customers` roles on open orders with a confirm (D2) (ORD-16); consent evidence hidden from staff (D3) (ORD-29).
  5. `OrdersList key={JSON.stringify(sp)}` (ORD-07); live poll on the default Açık view (ORD-09); one exported `OPEN_ORDER_STATUSES` (ORD-21).
  6. Kasa: 3-minute repeat guard on the e-mail kind with an explicit "tekrar" box, field cleared, "Damga ver" disabled until "Yeni işlem" (D6) (ORD-13); safeAudit + client try/catch answering "Damga verilmiş olabilir, üyenin kartını kontrol et." + consumed QR (ORD-12); `redeemCounterToken` returns a `partial` outcome after the burn (ORD-M02).
- Tests: tests/manual-order-schema.test.ts (fulfillment, payment method, Turkish messages); new tests/admin-manual-order.test.ts (pickup has 0 shipping and can be completed, courier fee from settings, paid start writes a manual payment row, pending does not, jsdom: a refusal keeps the status select); tests/admin-order-actions.test.ts (staff or closed order cannot change the e-mail, audit has before/after); tests/admin-order-filters.test.ts (live on Açık); tests/admin-kasa.test.ts (repeat within 3 min refused, "tekrar" allowed, post-burn throw answers "verilmiş olabilir", safeAudit failure does not throw); counter partial outcome; consent hidden for staff. CI only: a pickup manual order in tests/db-integration-admin-orders.test.ts.
- Money: YES (shipping fee, paid status, payment rows, stamps): adversarial review before merge. Decisions: D2, D3, D4, D5, D6.
- Size: ~17 files, ~1,150 lines.

#### 2b orders-ui: `fix/admin-audit-orders-ui`
- Findings: ORD-10, ORD-11, ORD-14, ORD-20, ORD-22, ORD-24, ORD-25, ORD-26, ORD-27 (L).
- Incoming: ORD-02 (columns), ORD-06 (phone bulk menu), ORD-05 (editor colour).
- Files: `src/components/admin/{orders-list,order-detail,order-customer-editor,order-badges,order-actions-ui}.tsx`, `src/app/admin/siparisler/{page.tsx,[id]/page.tsx,yeni/page.tsx}`, `src/app/admin/kasa/{camera-scanner.tsx,scan-engine.ts,till-console.tsx}` (copy), `src/lib/admin/order-channel.ts` (copy), tests.
- Order of work: column trims and a re-measure at 820/1024/1280 -> banner offset, "Yeni sipariş sesi" toggle -> bulk buttons in one ActionMenu on phones -> customer editor on kit (address shown only for shipping/delivery) -> stacked order lines below sm -> read failures say so -> kit badge tones with nowrap -> empty state link, out-of-range page redirect, visible card link -> copy -> reticle sized from the video rect (pure helper).
- Tests: failed reads show notes; stacked lines markup; Ses label/aria-pressed; out-of-range redirect; reticle math helper.
- Money: no. Size: ~13 files, ~650 lines.

### Package 3 KARAOKE (includes P2a)

#### 3a karaoke-panel: `fix/admin-audit-karaoke-panel` (includes the P2b tables list)
- Findings: KAR-07 (M), KAR-05, KAR-11, KAR-12, KAR-13, KAR-14, KAR-15, KAR-17, KAR-20, KAR-21, KAR-22, KAR-24, KAR-25 (L). P2b: Masalar list on the kit plus a view page.
- Incoming: KAR-03 (customer column), KAR-10 (shorter description), KAR-18 (NUMERIC_STYLE).
- Files: `src/components/admin/{karaoke-panel,karaoke-today-card}.tsx`, `src/lib/admin/{karaoke-panel,karaoke-audit}.ts`, `src/app/admin/mobil/karaoke/{page.tsx,actions.ts,[id]/page.tsx}`, `src/lib/mobile/karaoke.ts` (attention query, no-notify flag), `src/lib/mobile/karaoke-payment.ts` (ended pay-at-venue cancel without mail), `src/app/admin/masalar/**` (new `[id]/page.tsx` view), `src/lib/admin/cafe-tables.ts` (only if paging is needed), tests.
- Order of work:
  1. `listKaraokeAttention()` targeted query (requested+paid any day, requested+none from today, pending past due, refunding, cancelled+paid) and `loadKaraokeTodayCard()`; the Dikkat tab uses it (KAR-07, KAR-25). The dashboard switches to it in system-insights.
  2. Ended check in `confirmReservationAction` only; ended pay-at-venue cancel without the customer mail; dialog copy; no new status (D7) (KAR-13).
  3. Audit read fallback and notes (KAR-15); back link keeps the list query via `sameSitePath` (KAR-20); code in the mobile card and first cell (KAR-11); column widths; numeric style; copy (KAR-21); `?sekme=karaoke` link (KAR-12).
  4. Masalar on DataTable + FilterBar + StatusTabs + ActionMenu + view page; table form on ActionForm (KAR-14); one button size (KAR-05); aria names and a live region (KAR-22); back links and `yazdir?masa=` (KAR-24); kit tones (KAR-17).
- Tests: tests/admin-karaoke-panel.test.ts (attention covers paid+requested on a past day; ended confirm refused; ended pay-at-venue cancel sends no mail); tests/admin-karaoke-pages.test.ts (audit read failure renders "Geçmiş okunamadı"); tests/admin-cafe-tables-actions.test.ts (DB throw -> PANEL_ACTION_FAILED, values kept); Masalar list/view render.
- Money: YES (cancel and refund flows of past bookings): adversarial review. Decisions: D7, D8.
- Size: ~20 files, ~1,050 lines.

#### 3b karaoke-refund-policy (P2a back-end): `fix/admin-audit-karaoke-refund-policy`
- Scope: the operator's P2a spec (`$SP/spec-p2a-refund-policy.md`), all sections except the two public components.
- Files: `db/migrations/<ts>_karaoke_cancel_policy.sql` (+ bundle), `src/lib/mobile/{karaoke-time,karaoke,karaoke-core,karaoke-payment,karaoke-notices}.ts`, `src/app/api/mobile/v1/karaoke/**` (additive `lateRefundPercent`), store.ts settings functions (§3), `src/app/admin/ayarlar/{karaoke-tab.tsx,karaoke-actions.ts}` (after the system-settings move), `src/app/admin/mobil/karaoke/**` (policy snapshot and owed partial refund shown), `src/lib/email/templates/karaoke-{rezervasyon,iptal}.html`, `src/lib/email/templates.generated.ts` (regenerated), `src/lib/email/text.ts` (karaoke parts), `src/lib/legal/content-karaoke.ts` (and `lib/legal/meta.ts` if the version moves), docs/API-MOBILE.md §7.1, docs/PAYNKOLAY.md (partial refund handling), tests.
- Order of work: pure `karaokeCancellationRules({freeCancelHours, lateRefundPercent})` with byte-identical defaults and a tested Turkish suffix helper (or a rephrase) -> migration (nullable `"freeCancelHours"`, `"lateRefundPercent"`; NULL = 2/0) and snapshot at `createReservation` -> settings fields (0..72, 0..100), owner-only zod action, live preview -> behaviour per D9 with rule 29 rollbacks -> availability from current settings, reservations from the snapshot, additive field, docs, report the new API hash -> mails with the actual amount -> legal text per D11 -> panel display.
- Tests (spec §6): snapshot at create; legacy NULL = 2/0; sentences for (2,0), (0,0), (24,50), (3,100); default-case byte identity with today's constants; suffix helper; late cancel refused at 0%; 100% late refund goes through the POS with rollback on refusal/timeout; 1..99% follows D9 (owed amount = round(paid * P / 100), staff alert, hand settle); staff cancel still full; settings validation and owner-only action; availability API fields; mails with the actual amount. CI only: the migration columns are nullable.
- Money: YES (refunds): adversarial review. Lawyer: content-karaoke.ts and the mail wording. The API-MOBILE.md change means the orchestrator re-syncs the app copy and its RECONCILED hash; lafmobil follow-up PR per spec §7. Decisions: D9, D10, D11.
- Depends on: system-settings, karaoke-panel, and the migrations of menu-photos, catalog-data and content-legal merged.
- Size: ~24 files + 3 generated, ~1,450 lines (about 600 of them tests).

#### 3c karaoke-refund-policy-web: `fix/admin-audit-karaoke-refund-policy-web`
- Files: `src/components/laffogato/karaoke-booking.tsx` (pre-info box from server sentences), `src/components/uye/karaoke-reservation-view.tsx` (detail and cancel from the snapshot, partial amount), tests.
- Depends on: feat/site-home-karaoke-art merged (it edits karaoke-booking.tsx) and 3b merged. Merge in the same batch as 3b so the pre-information never disagrees with the snapshot; the owner keeps the defaults until 3c is live.
- Tests: render tests for default and non-default sentences; tests/frontend-form-contract.test.ts stays green.
- Money: display of refund terms: reviewed with 3b. Front-end only. Size: ~3 files, ~200 lines.

### Package 4 PEOPLE (customers, promos, coupons, users, newsletter)

#### 4a people-money: `fix/admin-audit-people-money`
- Findings: PEO-01, PEO-02, PEO-M01 (H), PEO-04, PEO-06, PEO-07, PEO-08, PEO-09, PEO-22, PEO-M04, SHE-10* (M), ORD-28, PEO-16, PEO-20, PEO-M02, PEO-M03 (L).
- Incoming: PEO-24 (past expiry refused in promo and coupon).
- Files: `src/app/admin/promosyon/{[id]/duzenle/page.tsx,yeni/page.tsx,actions.ts}`, `src/components/admin/promo-form.tsx`, `src/lib/admin/promo-schema.ts`, store.ts `updatePromo`, `src/app/uye/hesap/adreslerim/[id]/duzenle/page.tsx`, `src/components/admin/{customer-form,customer-coupons,customer-stamps,customer-actions,delete-row-form}.tsx`, `src/app/admin/musteriler/{actions.ts,page.tsx (anon filter only),[email]/actions.ts,[email]/duzenle/page.tsx}`, `src/lib/customer/store.ts` (`adminUpdateCustomer`), `src/app/admin/kullanicilar/{actions.ts,page.tsx,user-forms.tsx}`, `src/lib/admin/users.ts` (`deleteAdminUser`), `src/app/admin/bulten/actions.ts`, `src/lib/newsletter/store.ts`, `src/app/admin/bulten/kampanya/{actions.ts,campaign-mail-controls.tsx,page.tsx (send form only)}`, tests.
- Order of work:
  1. `.bind` on both pages plus a static test that scans src/app for inline closures passed to client forms (PEO-01, PEO-M01); `updatePromo` writes editable fields only, never `usageCount` (PEO-M03, same PR as PEO-01).
  2. The five PEOPLE forms on useNoResetSubmit, errors in danger ink with role=alert, flashes before redirects, `deactivateNewsletterSubscriber` reports whether a row changed (PEO-02, PEO-09, PEO-16).
  3. Caps and dates: promo ceilings + withPanelCatch (PEO-06), coupon min-basket cap (PEO-M02), past expiry refused (PEO-24 part).
  4. `addCounterStampAction`: `customers` gate, member must exist and be active, safeAudit (ORD-28).
  5. Consent: panel cannot turn marketing/newsletter on, panel opt-out clears `marketingConsentAt`, ledger source stays `admin`, consent date shown (D12) (PEO-04).
  6. Closed accounts out of the roll-up, honest "Hesabı sil" copy (D13) (PEO-M04).
  7. reset2FAAction + 2FA badge + delete drops the 2FA row (PEO-07, SHE-10); role text from `sectionsFor` (PEO-22).
  8. Campaign send through ConfirmButton with the recipient count and a confirm phrase, ActionResult answers; DeleteRowForm -> ConfirmButton (D15) (PEO-08).
  9. Button-in-link and nested label fixes in the forms (PEO-20 part).
- Tests: new tests/admin-client-closures.test.ts; updatePromo payload has no usageCount; tests/admin-customer-actions.test.ts (jsdom: refused coupon keeps "Tür"; consent false->true refused; opt-out clears the date); promo caps and past expiry; coupon min cap; stamp gate and inactive member; tests/admin-staff-actions.test.ts / tests/admin-users.test.ts (reset2FA owner-only and audited without the secret; delete drops 2FA); tests/admin-campaign-mail-actions.test.ts (new return shape); roll-up excludes `%@anon.local`.
- Money: YES (coupons, promos, stamps, consent): adversarial review. Lawyer: PEO-04, PEO-M04. Decisions: D12, D13, D15, D40.
- Size: ~26 files, ~1,250 lines.

#### 4b people-customers: `fix/admin-audit-people-customers` (P2b customers list)
- Findings: PEO-03, PEO-05, PEO-10, PEO-13 (M), ORD-30, PEO-17, PEO-18, PEO-21, PEO-25, PEO-26 (L).
- Incoming: PEO-20 and ORD-27 (member page headers and lists), ORD-05 (colour).
- Files: `src/app/admin/musteriler/page.tsx` (rebuild), `src/app/admin/musteriler/[email]/page.tsx`, store.ts `listCustomers`/`summarizeCustomers` or a new `src/lib/admin/customer-list.ts`, `src/lib/customer/store.ts` (`listAllCustomers` paging if used), tests (tests/admin-customer-detail.test.ts:159 -> "Toplam harcama").
- Order of work: server-side paged query with the SQL fold, filters (Üye, Misafir, Pasif, consent), sort and counts -> DataTable with mobileCard, StatusTabs, FilterBar, Pagination, ActionMenu; tiles in one scope -> member page: overflow fix (PEO-03), kit pieces and tones (PEO-10, PEO-17, PEO-18), copy (PEO-21), title without the e-mail (D14) (PEO-25), tile label (PEO-26), order history limited to 20 with "Tümünü gör" on DataTable (ORD-30).
- Tests: fold (İsmail/ismail) in the query, paging and counts, member page overflow classes, updated detail string.
- Money: no (reads); PII screen, check the `customers` gate. Decision: D14.
- Size: ~6 files, ~1,000 lines.

#### 4c people-lists: `fix/admin-audit-people-lists` (P2b promos, newsletter, users)
- Findings: PEO-12 (M), PEO-14, PEO-15, PEO-23, PEO-24 (L).
- Incoming: PEO-10, PEO-17, PEO-18, PEO-21 (newsletter and campaign screens).
- Files: `src/app/admin/promosyon/page.tsx` (+ new `[id]/page.tsx` view), `src/app/admin/bulten/page.tsx` (+ subscriber view), `src/app/admin/bulten/kampanya/{page.tsx,[id]/page.tsx,yeni/page.tsx,campaign-mail-form.tsx,campaign-status.tsx}`, `src/components/admin/{campaign-send-table,campaign-send-log}.tsx`, `src/lib/admin/{campaign-sends,campaign-mail-schema}.ts`, `src/app/admin/kullanicilar/page.tsx` (+ new `[id]/page.tsx` view), tests.
- Order of work: promos (tabs Aktif / Pasif / Süresi dolmuş / Limit doldu, search, sort, view) -> newsletter (tabs, search, paging, consent text in the view; the audited consent CSV only after system-audit-log adds the `export` action) -> campaign send log on SQL tallies with search, filter, paging -> composer bar with a surface (PEO-12) -> parallel audience counts and back links (PEO-23) -> users list and view.
- Tests: send-log tallies cover every row; promo tab filters; newsletter paging; users list render.
- Money: no. Size: ~16 files, ~1,200 lines.

### Package 5 CATALOG

#### 5a catalog-data: `fix/admin-audit-catalog-data`
- Findings: CAT-01, CAT-02, CAT-03, CAT-05, CON-01* (H), CAT-04, CAT-09, CAT-14, SYS-M02 (M), CAT-17, CAT-18, CAT-20, CAT-22, CAT-28, CAT-29, CAT-M02 (L).
- Incoming: CAT-24 (wizard copy).
- Files: `src/components/admin/{product-wizard,backdrop-field}.tsx`, `src/lib/admin/{product-schema,menu-item-schema,stock-delta}.ts`, `src/app/admin/urunler/actions.ts`, `src/app/admin/stok-hareketleri/actions.ts` (variant adjust), store.ts functions (§3), `db/migrations/<ts>_variant_stock_adjust.sql` (+ bundle), tests/admin-content-deletes.test.ts (seed mocks), tests.
- Order of work:
  1. Price at least 1 kuruş, variant price+delta at least 1 kuruş, menu M above 0 (L may stay empty, "-" or 0); optional prices keep moneyToMinor (CAT-05).
  2. Wizard: useNoResetSubmit keeping ProductActionState, per-step validation and jump to the failing step, error marks on step pills, FormFieldError-style errors with aria, withPanelCatch (CAT-01, CAT-02, CAT-09, CAT-17).
  3. Allergen fieldset (SYS-M02), Vazgeç link (CAT-22), copy (CAT-24), weight default empty and honest hints (CAT-M02), nameless variant issue (CAT-29), empty SKU by default + TR fold in deriveSku (CAT-18), null update refusal (CAT-28), bulk audit ids (CAT-20).
  4. Stock (D16): open-time snapshots; deltas through `adjust_product_stock` + stock move; new atomic `adjust_variant_stock` SQL function; products.stock derived from active variants; `resolveOrderLines` checks product and variant like `claim_order_stock`; Stok gets variant adjustments (CAT-03, CAT-14).
  5. Seeds (D17): marker rows, `setCounter` never lowers, product/menu/category seed off in production; mocks updated; delete-all test (CAT-04, CON-01).
- Tests: tests/admin-catalog-money.test.ts (0 price refused, optional prices still 0, variant below 1 kuruş refused, menu M=0 refused, L empty ok); jsdom wizard (refused save keeps cat, img, backdrop, isActive, featured; hidden-step invalid jumps); updateProduct leaves stock alone when unchanged and applies a delta with a stock move when changed; derived total; seed gating (delete all, reset memo, list = []); SKU fold; nameless variant refused; null update refused. CI only: `adjust_variant_stock` integration test.
- Money: YES (prices, stock, zero-total settle stays untouched): adversarial review. Decisions: D16, D17, D20.
- Size: ~14 files + 2 generated, ~1,400 lines.

#### 5b catalog-storefront: `fix/admin-audit-catalog-storefront` (front-end only)
- Findings: CAT-M01 (M). Incoming: CAT-25 (export the live Slide), CAT-27 (quoted, escaped `url()` in the storefront slider).
- Files: `src/components/laffogato/{product-detail,shop-hero-slider}.tsx`, `src/app/magaza/urun/[slug]/page.tsx` (threshold prop if needed), tests. Must not touch app.tsx, home-hero-slider.tsx, shop-page.tsx; if the threshold can only arrive through app.tsx, wait for feat/site-home-karaoke-art.
- Order of work: DetailGrid from product data (brand, notes, sku, weight above 0, nuts allergen), hard-coded rows dropped (D19); free-shipping lines (313, 326) from settings, hidden at 0; `cssUrl()` helper; Slide exported.
- Tests: no Bialetti, warranty or fixed allergen text; brand/notes shown when set; threshold text from the prop; cssUrl escaping (space, quote, paren, backslash).
- Money: display only. Lawyer: allergen and warranty wording. Size: ~4 files, ~250 lines.

#### 5c catalog-forms: `fix/admin-audit-catalog-forms`
- Findings: CAT-06, CAT-10, CAT-12, CAT-13 (M), CAT-15, CAT-24, CAT-25, CAT-27 (L).
- Incoming: CAT-11 (pills), CAT-08 (hero thumbnail path), CAT-20 (menu and hero audit), CAT-22, CAT-28 (hero), CAT-23 (image-upload names).
- Files: `src/components/admin/{menu-item-form,image-upload,category-form}.tsx`, `src/app/admin/menu/{actions.ts,yeni/page.tsx,[id]/duzenle/page.tsx}`, `src/app/admin/kategoriler/{actions.ts,yeni/page.tsx,[id]/duzenle/page.tsx}`, `src/app/admin/magaza-hero/{actions.ts,slide-form.tsx,page.tsx,yeni/page.tsx,[id]/page.tsx}`, `src/app/admin/urunler/{yeni,[id]/duzenle}/page.tsx` (copy), tests.
- Order of work: hero actions on ActionResult + ActionForm with title checks on create and update (CAT-13, CAT-28) -> URL and CTA validation, `cssUrl` in the admin (CAT-27) -> preview from the exported Slide (CAT-25) -> hero delete logs the title, menu bulk ids (CAT-20) -> tag checkboxes (D21) (CAT-10) -> uploader outside Field (CAT-15) -> image footer wraps, 44px × (CAT-12), names (CAT-23) -> duplicate slug refused and honest copy (D18) (CAT-06) -> copy and Vazgeç (CAT-22, CAT-24).
- Tests: blank hero title refused on create and update; double submit creates one slide; bad URLs refused; menu tags filtered to the four values; duplicate slug refused; image-upload labels.
- Money: no. Decisions: D18, D21. Size: ~16 files, ~750 lines.

#### 5d catalog-lists: `fix/admin-audit-catalog-lists` (P2b products, menu, categories, stock)
- Findings: CAT-07, CAT-08 (M), CAT-16, CAT-19, CAT-23, CAT-26, CAT-30 (L).
- Incoming: CAT-11, CAT-14 (per-variant stock in the list), CAT-10 (Turkish tag chips), CAT-21 (small text colours), CAT-17 (bulk callbacks).
- Files: `src/app/admin/urunler/page.tsx` (+ new `[id]/page.tsx` view), `src/components/admin/{products-list,menu-list,stock-adjust-form}.tsx`, `src/app/admin/menu/page.tsx` (+ view), `src/app/admin/kategoriler/page.tsx`, `src/app/admin/stok-hareketleri/page.tsx`, `src/components/admin/product-wizard.tsx` (beforeunload only), tests.
- Order of work: list DTOs without base64, cost or SEO, served thumbnails (CAT-07, CAT-08) -> DataTable + FilterBar (fold search, CAT-19) + StatusTabs + Pagination + ActionMenu with a row Aktif toggle for products and menu -> categories count-only -> stock ledger with count, notice, paging, date range (CAT-16) -> labels and tones (CAT-23, CAT-26) -> wizard beforeunload (CAT-30).
- Tests: serialized props contain no costMinor or images; fold search; ledger paging and count; bulk callbacks answer PANEL_ACTION_FAILED on a throw.
- Money: no. Size: ~12 files, ~1,400 lines.

### Package 6 CONTENT

#### 6a content-legal: `fix/admin-audit-content-legal`
- Findings: CON-02, CON-03 (H), CON-10, CON-15, CON-M01 (M), CON-13, CON-14, CON-16, CON-17, CON-22, CON-28, CON-30 (L).
- Incoming: CON-05 (legal-doc-form checkbox), CON-07 (hukuk pills), CON-23 (roles, headings), CON-24 (Hikaye/Basın empty states), CON-25 (copy), CON-27 (legal textarea).
- Files: `src/app/admin/hukuk/{page.tsx,actions.ts,[slug]/page.tsx}` + new `[slug]/onizle/page.tsx`, `src/components/admin/legal-doc-form.tsx`, `src/lib/admin/legal-schema.ts`, `src/lib/legal/store.ts`, `db/migrations/<ts>_legal_override_history.sql` (+ bundle, per D22), `src/app/admin/icerik/{page.tsx,actions.ts,content-form.tsx}`, `src/lib/admin/{site-content,content-fields}.ts`, `src/app/admin/hikaye/{page.tsx,actions.ts}`, `src/app/admin/basin/{page.tsx,actions.ts}`, tests.
- Order of work: legal and site-text forms on useNoResetSubmit (CON-03), errors, maxLengths, flash, Vazgeç (CON-22) -> reset behind ConfirmButton with an archive row and a restore (CON-02) -> owner-only draft preview (CON-10) -> effective date: blank prefill, "D Ay YYYY" check, refuse an unchanged date when a checkout or karaoke body changed, show the version orders will record (D25) (CON-M01, CON-30) -> "Varsayılana dön" per field, empty refused for story and founder keys (D23) (CON-13) -> labels (D24) (CON-14) -> maxLength and field errors instead of `.slice`, press quote required (CON-15) -> Turkish error (CON-16) -> placeholders (CON-17) -> sticky bar (CON-28).
- Tests: tests/legal-schema.test.ts (date format, refusals); reset archives and restores, ActionResult; preview owner-only; empty story refused, empty home.hero allowed, reset deletes the override; over-long values refused, not cut; refused content save keeps values.
- Money: no. Lawyer: consent versioning and legal text handling (CON-02, CON-30, CON-M01); review the consent-version logic carefully (checkout evidence). Decisions: D22, D23, D24, D25.
- Size: ~18 files + 2 generated, ~1,000 lines.

#### 6b content-app: `fix/admin-audit-content-app` (P2b app content lists)
- Findings: CON-04, CON-05, CON-07, CON-08, CON-12 (M), CON-09, CON-19, CON-20, CON-21, CON-23, CON-24, CON-25, CON-26, CON-27, CON-29 (L).
- Incoming: CON-03 and KAR-02 (app-config and venue forms), KAR-06/KAR-17 (save bar, headings), KAR-12 (owner-only reword).
- Files: `src/app/admin/mobil/ayarlar/{page.tsx,actions.ts,app-config-form.tsx}`, `src/app/admin/mobil/canli-durum/{page.tsx,actions.ts,venue-status-form.tsx}`, `src/app/admin/mobil/{slaytlar,duyurular,gonderiler}/**`, `src/app/admin/mobil/fal-bildirimleri/page.tsx`, `src/lib/admin/app-content-schema.ts`, `src/lib/mobile/fal.ts` (count only, if needed), tests.
- Order of work: app-config tabs on the helper, ARIA tabs with `?bolum=` (CON-20), confirm on maintenance on / minimum version up (D26) (CON-12), Bakım modu fieldset (CON-05), reminder pattern, rows and messages (CON-21), mono stack and inputMode (CON-27), copy (CON-25) -> venue form -> slide/announcement/post forms on ActionForm + SubmitButton with field errors (CON-04), post form `beforeSubmit` confirm and fieldsets (CON-05), newsletter gate for the mail (D27) (CON-26) -> lists on DataTable/StatusTabs with publish-status badges and safe dates (CON-08), mail status from the campaign (CON-09), flash instead of `?eposta=` (CON-29), tones (CON-07, CON-19), back links, delete in the edit header, fA'L count (CON-24), aria names (CON-23).
- Tests: tests/admin-mobile-content-actions.test.ts (blank title -> field error; double submit -> one row); mail needs `newsletter`; refused app-config save keeps values; maintenance confirm path; an invalid stored date renders a badge instead of throwing; a reminder with text but no id is refused.
- Money: no (mass-mail gate is consent-adjacent: note it for the reviewer). Decisions: D26, D27.
- Size: ~28 files, ~1,300 lines.

### Package 7 SYSTEM

#### 7a system-settings: `fix/admin-audit-system-settings`
- Findings: KAR-02, SYS-01, SYS-02, SYS-03, SYS-05, SYS-06, SYS-07, SYS-08, SYS-12 (M), SHE-24, SYS-18, SYS-19, SYS-20, SYS-21, SYS-23, SYS-25 (L).
- Incoming: KAR-06 (save bar colour), KAR-12 (`?sekme`), KAR-17 (headings), SYS-24 (banners).
- Files: `src/app/admin/ayarlar/{page.tsx,settings-form.tsx,actions.ts,identity-status.tsx}`, new `src/app/admin/ayarlar/{karaoke-tab.tsx,karaoke-actions.ts}` (pure move; ownership passes to package 3 on merge), `src/lib/email/send.ts` (Turkish Resend errors), tests.
- Order of work: 1) move the karaoke tab and action out unchanged so P2a can start; 2) every tab on the helper with role=status/alert (SYS-01, SYS-18, KAR-02); 3) ARIA tabs with `?sekme=` and a select below sm (SYS-08, SHE-24, KAR-12); 4) fieldsets for switches (SYS-05); 5) confirms for shop off, indexing off, order mail off, an unverified sender, zero recipients (D26) (SYS-06); 6) dirty state, tab dots, beforeunload; "Test gönder" disabled while dirty, revalidatePath, Turkish errors (SYS-07, SYS-23); 7) actions: Genel zod (https hero, e-mail, lengths) (SYS-25), integer KDV, money caps, safeAudit in `ok()` (SYS-02), before/after payloads, no-op skip, `send_test` (SYS-12); 8) copy and tones (D28) (SYS-03, SYS-19, SYS-20, SYS-21, KAR-17, SYS-24, KAR-06).
- Tests: tests/admin-settings-actions.test.ts ("8,5" refused, overflow refused, audit failure does not throw, before/after payload, no-op skipped, `send_test`); jsdom settings form (refused save keeps the checkbox, `?sekme=email` selects the tab, a hint click does not toggle the switch).
- Money: YES, light (shipping and courier fees, shop switch): adversarial review. Decisions: D26, D28.
- Size: ~9 files, ~1,250 lines (about 150 of them a pure move).

#### 7b system-insights: `fix/admin-audit-system-insights` (P2b dashboard widgets)
- Findings: SHE-06, SHE-14, SYS-14, SYS-15, SYS-16 (M), KAR-M02*, SHE-15, SHE-17, SHE-22, SHE-29, SYS-17, SYS-22, SYS-24 (L).
- Incoming: KAR-07 (dashboard uses the attention query), SHE-31 (linked stat cards), ORD-30 (recent orders on DataTable), SHE-24 (`?sekme=email` link).
- Files: `src/app/admin/page.tsx`, `src/app/admin/raporlar/page.tsx`, `src/components/admin/revenue-chart.tsx`, new `src/components/admin/dashboard/*.tsx`, store.ts report functions (§3), `src/lib/email/health.ts`, tests.
- Order of work: dashboard (D38): role-aware linked cards, Net ciro only for `reports` roles (D1), kit stat size with min-w-0 and truncate, Istanbul time, copy, e-mail health with a 3 s timeout and a guarded widget, karaoke card via `loadKaraokeTodayCard`, recent orders, revenue chart (owner/manager), low stock -> reports (D31, D32): period on tiles and top list, refunds netted, bars by revenue with a "liste fiyatıyla" label, Dönüşüm card removed, grid breakpoints, chart axis sized to its labels with an empty state, an sr-only table and 4.5:1 labels, kit tones, copy.
- Tests: tests/admin-reports-ltv.test.ts / new report tests (period filter, refunds netted, bar width by revenue); tests/admin-revenue-buckets.test.ts (axis width, empty state, sr table); dashboard (staff sees no Net ciro; greeting and date correct at 00:30 Istanbul); health fetch aborts.
- Money: no writes; ask the reviewer to check the figures. Decisions: D1, D31, D32, D35, D38.
- Size: ~8 files, ~950 lines.

#### 7c system-audit-log: `fix/admin-audit-system-audit-log` (P2b audit log list)
- Findings: ORD-15, SYS-10, SYS-11, SYS-13 (M), SYS-09 (L). Incoming: SYS-22 (audit log copy).
- Files: `src/app/admin/olay-kaydi/page.tsx` (+ new `[id]/page.tsx` view, new `csv/route.ts`), `src/lib/admin/{audit,audit-view}.ts`, `src/app/admin/siparisler/csv/route.ts`, `db/migrations/<ts>_audit_logs_append_only.sql` (+ bundle), `src/lib/retention.ts` (check only), tests.
- Order of work: Turkish labels for nested keys, roles, statuses, sections (SYS-10) -> kit page with paging, compact rows and a detail view (SYS-09, SYS-11) -> `export` AuditAction with labels and tone, safeAudit in the order CSV route (ORD-15), owner-only formula-safe audit CSV -> append-only trigger (UPDATE raises P0001, DELETE only past the 10-year retention, createdAt format unchanged) (D30) (SYS-13) -> "değiştirilemez" stays only because the trigger landed.
- Tests: label mapping; listAuditLogs paging; the order CSV writes an export row and its response is unchanged; tests/admin-schema-migration.test.ts; CI only: UPDATE raises, old DELETE allowed, recent DELETE refused, retention still deletes old rows.
- Money: no. Review: DB trigger and retention safety. Decision: D30.
- Size: ~9 files + 2 generated, ~700 lines.

#### 7d system-site-settings: `fix/admin-audit-system-site-settings`
- Findings: SYS-04, SYS-M01 (M).
- Files: `src/components/laffogato/{chrome,seo-content,visit-page}.tsx`, `src/app/page.tsx`, `src/components/laffogato/app.tsx` (only if FooterSettings threading needs it), `src/lib/seo/app-props.ts`, `src/lib/email/templates/*.html` (footers), `src/lib/email/templates.generated.ts` (regenerated), `src/lib/email/text.ts`, `src/app/admin/ayarlar/page.tsx` (description), tests.
- Depends on: feat/site-home-karaoke-art (page.tsx, app.tsx) and karaoke-refund-policy (templates, text.ts) merged.
- Order of work: hours label from settings into FooterSettings and SeoContent, `||` fallbacks for phone and e-mail, visit CTAs use `visit.phone` -> mail footers filled from settings, templates regenerated (D29).
- Tests: footer shows settings hours; blank phone falls back; mail footer filled; tests/mobile-copy-dash.test.ts and the long-dash tests stay green.
- Money: no. Front/back split: two commits, two PRs if the reviewer asks. Size: ~30 files (21 templates), ~450 hand-written lines.

## 5. Operator decisions (recommended defaults; work proceeds on the default unless the operator says otherwise)

| ID | Question | Recommended default | Findings / PR |
| --- | --- | --- | --- |
| D1 | Does Personel see "Net ciro" on the dashboard? | No, follow the role matrix (reports = owner/manager). | SHE-14 / system-insights |
| D2 | Who may change an order's customer e-mail? | Owner/manager, open orders only, with a confirm; staff keep name/phone/address edits on open orders; audit keeps before/after. | ORD-16 / orders-money |
| D3 | Consent IP and browser on the order page for Personel? | Hidden ("Kayıtlı"); data unchanged. | ORD-29 / orders-money |
| D4 | Manual order default delivery | Gel-al (free); Kurye = delivery fee from settings; Kargo = settings rule. | ORD-01 / orders-money |
| D5 | Manual order started as paid | Require the payment method and write the manual payment row. | ORD-19 / orders-money |
| D6 | Kasa e-mail stamp repeat guard | 3 minutes, explicit "tekrar" box to override. | ORD-13 / orders-money |
| D7 | Past karaoke evenings | No confirm after the end; ended pay-at-venue cancel without a customer mail; no new "Gelmedi" status (mobile API). | KAR-13 / karaoke-panel |
| D8 | Karaoke new booking, reschedule, resend, CSV, check-in | Backlog, not this round. | KAR-08 / none |
| D9 | P2a late refund for 1..99% while PayNkolay refuses partial amounts (paynkolay.ts:1317-1323; order partial card refunds hit the same refusal at order-ops.ts:306) | Panel accepts 0..100. 0 = refused (today). 100 = automatic full POS refund with rule 29 rollback. 1..99 = reservation cancelled, `refunding` with the owed amount round(paid * P / 100), staff alerted by mail, staff refunds in the PayNkolay panel and presses "Elle iade edildi" (settleKaraokeRefundByHand); customer copy says the amount "kartına iade edilir" without promising it instantly. Alternative: allow only 0 or 100 until partial refunds are verified live. | P2a / karaoke-refund-policy |
| D10 | Admin "geç iptal kuralına göre iade et" option | Skip (spec: only if easy and safe). | P2a |
| D11 | Karaoke legal text | Render hours and percent from the current settings in content-karaoke.ts, bump the karaoke legal version when they change, reservation keeps its own snapshot; lawyer review. | P2a |
| D12 | Panel and commercial consent | Panel cannot switch marketing/newsletter on; panel opt-out clears the consent date; lawyer review. | PEO-04 / people-money |
| D13 | Closed accounts in Müşteriler and "Hesabı sil" copy | Hide `%@anon.local` rows from the roll-up; copy says orders keep the invoice name/address for fiscal retention; no order scrubbing without a lawyer. | PEO-M04 / people-money |
| D14 | Customer e-mail in admin URLs | Title without the e-mail now; an opaque-id route later. | PEO-25 / people-customers |
| D15 | Campaign send confirmation | ActionModal showing the recipient count; type the count to confirm. | PEO-08 / people-money |
| D16 | Product vs variant stock | Products with variants: total = sum of active variant stock (derived, read-only in the wizard); variant edits are deltas through a new atomic SQL function with a stock move; Stok gets variant adjustments; stock stays editable in the product form via snapshot deltas. | CAT-03, CAT-14 / catalog-data |
| D17 | Runtime seeds | Product/menu/category seed only outside production; hero and content seeds gated by a one-time marker; counters never lowered. | CAT-04, CON-01 / catalog-data |
| D18 | What Kategoriler controls | Panel labels only this round (copy fixed, duplicate slug refused); no storefront wiring (shop-page.tsx is in feat/site-home-karaoke-art). | CAT-06 / catalog-forms |
| D19 | Product page fixed rows | Drop the hard-coded allergen, brand, warranty, origin and tasting rows; show the product's own brand and notes; free-shipping line from settings, hidden at 0; lawyer review. | CAT-M01 / catalog-storefront |
| D20 | Product weight default | Empty (not shown) for new products. | CAT-M02 / catalog-data |
| D21 | Menu tags | Only signature/new/iced/nuts (Turkish labels); list existing non-standard tags in the PR before they drop on the next save. | CAT-10 / catalog-forms |
| D22 | Legal "Varsayılana döndür" archive | New `legal_override_history` table (migration) with a restore; alternative: put the old text in the audit payload. | CON-02 / content-legal |
| D23 | Emptied site texts | Refuse empty for story and founder keys; allow empty home.hero (the band's off switch); add per-field "Varsayılana dön". | CON-13 / content-legal |
| D24 | Founder name/role fields | Label them "Yalnız uygulamada" (no story-page change; that file is in feat/site-home-karaoke-art). | CON-14 / content-legal |
| D25 | Legal effective date | Blank prefill for a new override, "D Ay YYYY" check, refuse an unchanged date when a checkout/karaoke body changed; lawyer review. | CON-M01, CON-30 / content-legal |
| D26 | Confirm dangerous switches | Yes: maintenance on, minimum version up, shop off, indexing off, order mail off, unverified sender, zero recipients. | CON-12, SYS-06 |
| D27 | Post e-mail to members | Requires the `newsletter` role as well as `mobileApp`. | CON-26 / content-app |
| D28 | KDV tab | Reword (prices include KDV, the rate changes no amount); no KDV storage this round; lawyer note on legal/content.ts:4908, 5771, 13849. | SYS-03 / system-settings |
| D29 | Settings on footer, home and mails | Web parts after feat/site-home-karaoke-art, mail footers after P2a, in the last PR. | SYS-04, SYS-M01 / system-site-settings |
| D30 | Audit log append-only | Yes: UPDATE blocked, DELETE only past the 10-year retention. | SYS-13 / system-audit-log |
| D31 | Report semantics | Period applies to tiles and top list; refunds netted; top products by revenue, labelled "liste fiyatıyla". | SYS-16 / system-insights |
| D32 | Dönüşüm card | Remove. | SYS-17 / system-insights |
| D33 | Session lifetime and logout revocation | No change now (7 days + per-request fingerprint); a session-version column later if wanted. | SHE-27 / none |
| D34 | Admin-only CSP | Tag exclusion now; a narrower /admin CSP later (tests/security-headers.test.ts must change deliberately). | SHE-02 / shell-css |
| D35 | Greeting by name | Greet without a name (no AdminSession change). | SHE-22 / system-insights |
| D36 | Global search scope | Orders, customers, products, menu items, karaoke codes; role-gated per section; LIMIT 5 each; no new index. | P2b / shell-nav |
| D37 | View pages for lists | Read-only view pages only where a list has no detail today (products, menu, promos, users, tables, newsletter subscriber, audit event). | P2b / lists |
| D38 | Dashboard widgets | Linked role-aware stat cards, 14-day revenue chart (owner/manager), orders by status, karaoke today/attention, low stock, recent orders. | P2b / system-insights |
| D40 | 2FA recovery codes | Later (schema change); now owner reset + a DB runbook. | SHE-10, PEO-07 |

## 6. Findings needing no code, already fixed, or partly refuted

Already fixed (not in verified.json):
- SHE-01: fixed on main by c2dc9f4 (#122): `[data-admin-root] :is(a, button)` reverts colour, background, border, padding and text-decoration, and the test checks the whole rule. Only font, cursor and focus remained; they are SHE-03 and SHE-16.

No code by default (in verified.json with `status: no_code`):
- SHE-27: product decision (D33); the fingerprint already revokes on password reset, deactivation and demotion.
- KAR-08: feature requests (D8); the verdict records the constraints for when they are built.

No separate code, closed by a root-cause fix owned elsewhere (`status: covered`): ORD-04, KAR-04, CAT-11, PEO-19, CON-18 (RC-BTN via SHE-03); ORD-23 (RC-FOCUS via SHE-16, its revert-layer fix rejected); KAR-09 (via SHE-02); KAR-16, CON-11 (via SHE-08); ORD-05, KAR-06, PEO-11, CAT-21, CON-06 (via SHE-04; the leftover neutral-* spots are subtasks of the owning PRs); ORD-08, KAR-10 (via SHE-07); KAR-19 (via ORD-17); SHE-10 (via PEO-07); KAR-M02 (via SHE-15); CON-01 (via CAT-04).

Feature gaps delivered as P2b rather than as fixes: SHE-31 (shell-nav + system-insights), CAT-30 (catalog-lists), PEO-13/14/15/24 list parts, SYS-09 (audit list).

Partly refuted, the refuted part needs no code:
- SHE-32: the toast "×" glyph contrast (aria-hidden icon, 4.16:1 meets 3:1).
- KAR-20: the EmptyState reset (FilterBar already shows "Sıfırla").
- ORD-20: the timeline "Kayıt yok" (the timeline always has stages).
- ORD-11: "duplicates the Teslimat section" (the two complement each other).
- ORD-06: "37px of the last card covered" (not reproduced).
- ORD-21: "three numbers" (two).
- SHE-12: page count (53 of 58, not 55).
- SHE-28: impact overstated (rate-limited per IP; cannot match a real account).
- SHE-29: the Promise.all failure path is error.tsx by design; only the Resend timeout is fixed.
- CON-13: the empty home band is the designed off switch.
- SYS-09: the 2.45 MB page size was not re-measured.

Deferred parts (not in this round): SHE-02 admin-only CSP (D34), SHE-10 recovery codes (D40), PEO-25 opaque customer route (D14), SYS-03 KDV storage (D28), SYS-17 range/compare/export/breakdowns, CAT-06 storefront wiring (D18), CON-14 story page reading the founder keys (D24).

## 7. Size estimates

| PR | Files | Changed lines (code + tests) | Adversarial review | Lawyer |
| --- | --- | --- | --- | --- |
| 1a shell-css | 4 | ~200 | no (security look at GTM) | no |
| 1b shell-kit | ~17 | ~900 | no (refund dialog test) | no |
| 1c shell-nav | ~14 | ~1,150 | no (search role gates) | no |
| 1d shell-access | ~16 | ~650 | security review | no |
| 2a orders-money | ~17 | ~1,150 | YES | no |
| 2b orders-ui | ~13 | ~650 | no | no |
| 3a karaoke-panel | ~20 | ~1,050 | YES | no |
| 3b karaoke-refund-policy | ~24 + 3 generated | ~1,450 | YES | yes |
| 3c karaoke-refund-policy-web | ~3 | ~200 | with 3b | with 3b |
| 4a people-money | ~26 | ~1,250 | YES | yes |
| 4b people-customers | ~6 | ~1,000 | no | no |
| 4c people-lists | ~16 | ~1,200 | no | no |
| 5a catalog-data | ~14 + 2 generated | ~1,400 | YES | no |
| 5b catalog-storefront | ~4 | ~250 | no | yes |
| 5c catalog-forms | ~16 | ~750 | no | no |
| 5d catalog-lists | ~12 | ~1,400 | no | no |
| 6a content-legal | ~18 + 2 generated | ~1,000 | no (consent logic review) | yes |
| 6b content-app | ~28 | ~1,300 | no | no |
| 7a system-settings | ~9 | ~1,250 | YES (light) | yes (KDV note) |
| 7b system-insights | ~8 | ~950 | no (figures check) | no |
| 7c system-audit-log | ~9 + 2 generated | ~700 | no (DB trigger review) | no |
| 7d system-site-settings | ~30 (21 templates) | ~450 + regenerated | no | no |
| Total | | ~21,300 | | |

No PR is planned above ~1,500 changed lines. The ones closest to the limit (3b, 5a, 5d) should split a self-contained tail into a follow-up PR if they overshoot: 3b the legal/mail wording, 5a the seed markers (RC-SEED), 5d the stock ledger.

## 8. Final step

- After each PR: review (adversarial where marked), green CI (`eslint .`, `tsc`, vitest, DB integration in CI), then queue for the end-of-run merge batch.
- Lawyer list for the final summary: PEO-04, PEO-M04, CAT-M01 (allergen, warranty, free-shipping promise), CON-02/CON-30/CON-M01 (legal override history and consent versioning), SYS-03 (KDV statements in legal/content.ts), P2a (content-karaoke.ts and the refund mails).
- lafmobil: P2a follow-up PR (prefer the server's sentences, keep verbatim fallbacks, show the partial amount when `lateRefundPercent` exists), API-MOBILE.md re-sync and RECONCILED hash.
- User order (17 Oct): at the very end, merge every finished branch of both repos to main in the §2 order and check the prod deploy from main.
