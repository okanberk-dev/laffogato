# Admin UI v2: final design

Date: 18 Oct 2026. Base: main 8307b4f (people-money #138 e241512 merged since; nothing here depends on it).
Operator request (18 Oct): "admin panelini de daha fazla sadeleştirip gelişmiş yapar mısın? Admin panel UI UX'inde olsun library veya bir UI bulup direkt entegre edebilirsin". The operator also said: do what is most correct, do not ask. Every decision below is taken, with its default.

Inputs: proposal-minimal.md, proposal-headless.md, proposal-shadcn.md, the three judge files, and the code (main, plus the worktrees of shell-nav, shell-access, karaoke-panel and system-settings). Claims the design relies on were re-checked; section 9 lists them.

---

## 1. The decision

### 1.1 Scores and the overrule

| Proposal | Operator UX | Engineering | A11y / perf / security | Sum |
| --- | --- | --- | --- | --- |
| headless (React Aria) | 7.5 | 7 | 7.5 | **22** |
| minimal (no framework) | 7 | 8 | 7 | **22** |
| shadcn (Radix + cmdk) | 6.5 | 4 | 5.5 | 16 |

Headless and minimal tie at 22. The tie is broken by checking what each high score stands on:

- Headless leads two lenses (operator UX 7.5, a11y/perf 7.5). Part of both leads rests on claims the judges found wrong:
  - "Icons used in Server Components ship no client JS". lucide-react 1.x `Icon.mjs` is `"use client"` and calls `useLucideContext`, so icons are client references. This claim feeds its "+5-8 KB per page" shell figure.
  - Date-range filters "in every FilterBar (orders, karaoke, audit, stock)". Stock has none. Only `order-filters.ts`, `karaoke-panel.ts` and `audit-view.ts` declare a `date-range` field.
  - "The 8 datetime-local boxes". main has 10, in 6 forms (`grep 'type="datetime-local"'` = 10).
  - "No in-flight branch edits layout.tsx, admin-sidebar.tsx or nav-match.ts". shell-nav (1c) edits all three (+119, +742, +85).
  Once these are discounted, the library's reach is smaller (3 lists, not 4), its adoption work is larger (10 boxes, not 8), and its shell cost is not proven. Its a11y lead also leans on a second modal system (React Aria Modal) that every judge asked us to avoid.
- Minimal's top score (engineering 8) stands on verified facts: zero or one dependency, additive-only kit changes, correct sequencing (1c and 1d, the `auth.ts:499` query join, the karaoke test literal). It has wrong claims too (the cmdk release date, `?sekme=kargo`, "jsdom tests"). They touch details this design re-specifies (7a's real tab id is `shipping`; no DOM test environment is assumed), not its foundation.
- Shadcn's spend (a Radix ActionMenu on every admin page, Kasa included) loses pre-hydration taps, puts the refund and cancel dialogs behind a new outlet, and breaks the server-rendered safety tests in `tests/admin-confirm-ui.test.ts`. It is out. Its Turkish search fold, its keyboard rules, its inline next step and its readable labels are grafted.

**Winner: minimal as the base.** The library comes from headless, used only where HTML is weak and loaded only on interaction. That honours the operator's invitation without rewriting the audited kit.

### 1.2 What is taken from each

From **minimal** (base):
- The UX audit and the information architecture: 5 groups, items that own tabs drawn by the shell, no URL or folder moves, a flat list for 6 items or fewer, no nav chrome for the cashier.
- Copy rules, the page pattern (`PageHeader` additive props, `PageShell` with three widths, `EmptyState.action`, a "Nasıl çalışır?" disclosure), the modal-vs-page rule.
- The phone bottom bar for counter roles with one shared bottom inset.
- Staff land on open orders, with the `?denied=1` join fixed.
- The köşk quick status, the unsaved-changes guard, the Gün sonu sheet, the palette's "Ayarlar içinde" deep links (with 7a's real tab ids).
- Delete the stale `components.json`.
- The per-role "union of item and tab hrefs equals today's" invariant.

From **headless**:
- React Aria Components, but only for the palette list, the date fields (desktop only) and the combobox. All lazy leaf widgets, with native fallbacks and unchanged wire values.
- The rules that keep the library out of server files: library imports only in `"use client"` files, sub-path imports, a server-safe kit with no library import.
- The search route specification (401, 403, Origin check, no-store, proxy redirect mapped to "Oturumun kapandı").
- Recents in `sessionStorage`, cleared on Çıkış. Saved views drop `q` and any value with `@` or 7+ digits. A read-only palette.
- Keyboard rules: no Ctrl+Alt (AltGr), no `i`/`ı`, skip `isComposing`, an off switch (WCAG 2.1.4), `aria-keyshortcuts`.
- Test strategy: pure modules plus `renderToStaticMarkup` in the existing node environment.
- The inline forward-only order step.

From **shadcn**:
- The loose ASCII fold for static palette entries ("siparis" finds "Siparişler"), keywords for old and English names, `Intl.Collator("tr")` sorting, Turkish strings everywhere.
- The ⌘K / Ctrl+K label, decided after mount.
- Badge and KeyValueGrid labels at 12 px in sentence case instead of 10 px uppercase tracked text.
- The collapsible laptop rail, and density only on `pointer: fine`.
- The ESLint `no-restricted-imports` guard plus a deps test (exact pins, one version per package in the lockfile).
- Bundle numbers in the PR body.

New in this design (each one closes a gap a judge found):
- Recents and saved views are keyed per admin account and re-filtered by `canAccess` at render.
- No palette link carries a query that looks like PII.
- Single-key shortcuts are off on `/admin/kasa` and for the cashier.
- An "İçeriğe geç" skip link.
- The palette is hosted in the kit's native `<dialog>`: one modal system.
- Personel may update Canlı durum through a narrow `venue` section that leaves `totalTables` with owner and manager. A partial SQL update means a quick change never overwrites a colleague's.

### 1.3 Packages (exact pins, all at least 14 days old on 18 Oct, verified with `npm view`)

| Package | Pin | Published | Peer / deps | Used for | Lands in |
| --- | --- | --- | --- | --- | --- |
| `lucide-react` | **1.51.0** | 3 Oct 2026 | peer `react ^16.5.1 \|\| … \|\| ^19.0.0` (19.2.4 OK); no runtime deps; `sideEffects: false`; ISC; on Next 16's default `optimizePackageImports` | sidebar, bottom bar, tabs, palette, empty states | UI-1 |
| `react-aria-components` | **1.21.1** | 4 Sep 2026 | peer `react` / `react-dom ^19.0.0-rc.1` OK; deps `react-aria 3.52.1` (4 Sep) + `react-stately 3.50.0` (1 Sep), exact, plus `@internationalized/string`, `@react-types/shared`, `@swc/helpers`, `client-only` | palette list (Autocomplete, SearchField, ListBox), ComboBox, DateRangePicker, DatePicker | UI-6 |
| `@internationalized/date` | **3.12.4** | 1 Sep 2026 | dep `@swc/helpers ^0.5.0`; no peers; the version RAC 1.21.1 asks for (`^3.12.4`) | `parseDate`, `today("Europe/Istanbul")`, `CalendarDateTime` | UI-14 |

Not taken: Radix (any), cmdk (1.1.1 is from 14 Mar 2025, 19 months with no release, and pulls Radix Dialog), shadcn CLI or registry, clsx, tailwind-merge, cva, sonner, TanStack Table, react-hook-form, Recharts, `tailwindcss-react-aria-components` (it would need an `@plugin` line in the shared `globals.css`), and `@react-aria/optimize-locales-plugin` (it needs `next.config.ts`, the CSP file; only if measured over 10 KB, in its own PR). Newer lines exist (lucide 1.59.0 from 17 Oct, RAC 1.22.1 from 9 Oct). They are not taken until they are 14 days old. Upgrades are deliberate PRs.

**Install procedure** (builders never run `npm install`; `node_modules` in a worktree is a symlink to SITE):
1. Before the builder starts, the orchestrator runs this in SITE: `npm install --no-save --ignore-scripts --before=<PR date minus 14 days> <pkg>@<pin>`. That puts the package into the shared `node_modules` for tsc, vitest and build.
2. The builder adds the exact pin (no `^`) to `package.json`. The orchestrator then runs `npm install --package-lock-only --ignore-scripts --before=<same date>` in the worktree, which writes only `package-lock.json`. The builder checks that the lockfile diff adds only the expected packages, and the deps test passes.
3. `--before` keeps the transitive caret ranges (`@internationalized/string`, `@react-types/shared`, `@swc/helpers`) at versions at least 14 days old too.

**CSP:** no change. Everything is self-hosted chunks and inline SVG. React Aria and the palette write styles through the CSSOM (not governed by `style-src`). SSR `style=""` stays under today's `style-src 'self' 'unsafe-inline'`. The search fetch is `connect-src 'self'`. React Aria's `LocalizedStringProvider` (it renders an inline `<script>`) is never used. When the deferred nonce policy (D34) lands, add `<meta property="csp-nonce">` in the admin layout.

**Budget, measured in each PR body:**
- At most **8 KB gz** added to every admin route.
- **0 KB** of library code on `/admin/kasa` for any role. The cashier gets no new shell code paths at all.
- Lazy chunks: palette at most 45 KB gz, date widget at most 45 KB, combobox at most 35 KB.
- Measure with a `NODE_ENV=production next build --webpack` in the worktree (gzip of `.next/static/chunks` for `/admin/siparisler` and `/admin/kasa`, before and after; then `rm -rf .next`). `next experimental-analyze` only in the SITE checkout (Turbopack panics on symlinked `node_modules`).

---

## 2. Operator decisions, taken (no question left open)

| # | Question | Decision | Why |
| --- | --- | --- | --- |
| D1 | Integrate a library? | **Yes.** `lucide-react` + `react-aria-components` + `@internationalized/date`, pinned as above, used only in lazy leaf widgets | The operator invited it. It pays off for Turkish dates on laptops, searchable pickers on phones and an accessible combobox, and costs 0 KB on pages that do not use it |
| D2 | Staff landing | **`/admin/siparisler?durum=acik`** (the "Açık" tab already exists in `order-filters.ts:91`). Owner and manager keep `/admin`; the cashier keeps `/admin/kasa` | The shift starts with open orders. The dashboard's "Toplam ürün" and "Kategori" tiles are not shift tasks, and its "Net ciro" is SHE-14 (7b) |
| D3 | Canlı durum for Personel | **Yes**, through a new `venue` section (owner, manager, staff) that gates only `/admin/mobil/canli-durum` and its actions. Staff may set status, free tables, Wi-Fi, noise, power and the note; **`totalTables` stays with owner and manager**. `mobileApp` (slides, posts, app settings) is unchanged | The köşk shift sees the room; the app's home must stay true. The action already writes an audit row. A dedicated security-reviewed PR (UI-13) |
| D4 | Group names | **Bugün · Katalog · Pazarlama · İçerik · Yönetim** | "İçerik" is the operator's existing word. "Vitrin" would overload the slayt/hero/vitrin trio the copy rules retire |
| D5 | Row menu technology | **Keep `ActionMenu` on `<details>/<summary>`**. ActionModal and ConfirmButton stay on native `<dialog>` | It works before hydration and keeps KAR-01's refusal keeper and focus return. It also keeps the server-rendered safety tests passing (a closed Radix or React Aria menu renders no items on the server) |
| D6 | Vitrin hub scope | **One "Slaytlar" item with all three carousels as tabs**: Anasayfa (`/admin/anasayfa-hero`), Mağaza (`/admin/magaza-hero`), Uygulama (`/admin/mobil/slaytlar`), under İçerik | "Slaytı değiştirmek istiyorum" gets one answer |
| D7 | Shortcuts default | **⌘K / Ctrl+K always on** for every role with a palette (owner, manager, staff). **Single-key shortcuts on by default** except for the cashier and anywhere on `/admin/kasa` (typed and scanned codes arrive there). Never while typing, composing or with a dialog open. Off switch "Tek tuş kısayolları" in the user menu | WCAG 2.1.4 and Turkish-Q rules in section 4.4 |
| D8 | Dark mode | **No, not in this program.** Revisit after the copy sweeps as a tokens-only change | Admin tokens are fixed hex values with AA tests, and 748 hard-coded colour utilities sit in 68 files, most owned by in-flight PRs. Roughly 2,500+ lines for no operator request |
| D9 | Test environment | **Stay on vitest `environment: "node"`. No jsdom or happy-dom.** Every rule lives in a pure module (node tests). Markup is checked with `renderToStaticMarkup`. Interaction is checked in a scripted real-browser pass whose checklist goes in the PR body. No PR is gated on DOM tests | `vitest.config.mts` is node-only and nothing DOM-like is installed. jsdom also lacks `showModal()`. If order-alerts lands a DOM environment first, UI PRs may add interaction tests with it, but none waits for it |
| D10 | Density | Comfortable (44 px) by default everywhere. A "Sıkı görünüm" toggle applies only under `pointer: fine` | Phones and tablets at the counter keep 44 px targets (SHE-32) |
| D11 | `components.json` | **Delete** (UI-1) | It points `shadcn add` at `src/app/globals.css` (style new-york, `cssVariables: true`, alias `@/lib/utils/cn` that does not exist). It would write `--accent` and `--ring` over the brand tokens |
| D12 | Native date inputs on phones | **Kept.** The React Aria date widgets mount only under `(pointer: fine)` and only on interaction | The OS pickers on phones are already localised and better than segmented fields |

---

## 3. Information architecture

### 3.1 Principle

Merging happens in the nav config and the shell, never in routes. An item may own **tabs**, which are other existing URLs:
- The shell draws the tab strip under the breadcrumbs.
- Each page keeps its route, its `requireRole` and its own form.
- No page file and no route folder moves, so nothing collides with the audit PRs that own the pages.
- Every bookmark, e-mail link, `?durum=`, `?sekme=` and `?denied=1` keeps working.

### 3.2 Nav per role

Roles: O owner, M manager, S staff, C cashier. Sections come from `SECTION_ROLES` (`src/lib/admin/roles.ts`); only D3 adds `venue`.

**Bugün**

| Item | URL | Section | O | M | S | C | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Genel bakış | `/admin` | dashboard | x | x | x | | |
| Siparişler | `/admin/siparisler` | orders | x | x | x | | badge (open orders); the badge links `?durum=acik` |
| Karaoke | `/admin/mobil/karaoke` | karaoke | x | x | x | | badge (tonight). Keep the literal line `{ href: "/admin/mobil/karaoke", label: "Karaoke", section: "karaoke" }` that `tests/admin-karaoke-panel.test.ts:689` greps |
| Kasa | `/admin/kasa` | till | x | x | x | (x) | was "Kasa · damga"; the cashier reaches it with no nav chrome |
| Canlı durum | `/admin/mobil/canli-durum` | mobileApp, then `venue` after UI-13 | x | x | (x after UI-13) | | moved from Mobil Uygulama |

**Katalog**

| Item | URL | Tabs | Section(s) | O | M | S |
| --- | --- | --- | --- | --- | --- | --- |
| Kafe menüsü | `/admin/menu` | | menu | x | x | |
| Ürünler | `/admin/urunler` | Ürünler `/admin/urunler` · Kategoriler `/admin/kategoriler` | products / categories | x | x | |
| Stok | `/admin/stok-hareketleri` | | stock | x | x | x |

**Pazarlama**

| Item | URL | Tabs | Section | O | M |
| --- | --- | --- | --- | --- | --- |
| Müşteriler | `/admin/musteriler` | | customers | x | x |
| Promosyonlar | `/admin/promosyon` | | promos | x | x |
| Bülten | `/admin/bulten/kampanya` | Kampanyalar `/admin/bulten/kampanya` · Aboneler `/admin/bulten` | newsletter | x | x |

**İçerik**

| Item | URL | Tabs | Section(s) | O | M |
| --- | --- | --- | --- | --- | --- |
| Slaytlar | `/admin/anasayfa-hero` | Anasayfa `/admin/anasayfa-hero` · Mağaza `/admin/magaza-hero` · Uygulama `/admin/mobil/slaytlar` | content / shopHero / mobileApp | x | x |
| Site metinleri | `/admin/icerik` | Metinler `/admin/icerik` · Hikaye `/admin/hikaye` · Basın `/admin/basin` | content / story / press | x | x |
| Uygulama akışı | `/admin/mobil/duyurular` | Duyurular `/admin/mobil/duyurular` · Gönderiler `/admin/mobil/gonderiler` | mobileApp | x | x |
| fA'L bildirimleri | `/admin/mobil/fal-bildirimleri` | | mobileApp | x | x |

(Name kept: the app's button says "Bildir" (`lafmobil src/i18n/screens/fal.ts`), so members' reports are "bildirim" on both sides.)

**Yönetim**

| Item | URL | Tabs | Section(s) | O | M |
| --- | --- | --- | --- | --- | --- |
| Raporlar | `/admin/raporlar` | | reports | x | x |
| Masalar | `/admin/masalar` | | tables | x | x |
| Ayarlar | first permitted tab | Site `/admin/ayarlar` (O) · Uygulama `/admin/mobil/ayarlar` (O, M) | settings / mobileApp | x | x |
| Kullanıcılar | `/admin/kullanicilar` | | adminUsers | x | |
| Yasal belgeler | `/admin/hukuk` | | legal | x | |
| Olay kaydı | `/admin/olay-kaydi` | | audit | x | |

**Counts:**
- Owner: 21 items in 5 groups (was 29 in 6).
- Manager: 18 items in 5 groups (was 25 in 5). Ayarlar points to `/admin/mobil/ayarlar` and draws no strip.
- Staff: 5 items in a flat list without group headers (Genel bakış, Siparişler, Karaoke, Kasa, Stok), plus Canlı durum after UI-13.
- Cashier: no sidebar, no hamburger, no drawer. The top bar shows the logo, the page title and the user menu (2FA, Çıkış).

**Invariant (test):** for every role, the union of item hrefs and tab hrefs equals today's visible hrefs on main: owner 29, manager 25, staff 5, cashier 1. UI-13 changes the staff set deliberately (+ `/admin/mobil/canli-durum`).

**Old name to new home** (all 29 kept as palette keywords):
- Genel bakış → Bugün.
- Menü → Kafe menüsü.
- Ürünler, Kategoriler → Ürünler.
- Mağaza Hero, Anasayfa slaytları, Mobil Slaytlar → Slaytlar.
- Site Metinleri, Hikaye, Basın → Site metinleri.
- Duyurular, Gönderiler → Uygulama akışı.
- Canlı durum, Siparişler, Karaoke, Kasa · damga → Bugün.
- fA'L bildirimleri → İçerik.
- Uygulama ayarları, Ayarlar → Ayarlar.
- Masalar · QR, Raporlar, Kullanıcılar, Yasal belgeler, Olay kaydı → Yönetim.
- Müşteriler, Promosyon, Bülten, Kampanya e-postası → Pazarlama.
- Stok → Katalog.

### 3.3 Tab rules

- Tabs are filtered by `canAccess` exactly like items. An item shows if any of its tabs is open to the role, and its href is its first permitted tab. With one permitted tab, no strip is drawn.
- The strip is a row of links: `aria-current="page"`, `LinkPending` for the pending mark, scrollable sideways on a phone, 44 px. These are not ARIA tabs, because they navigate.
- The strip is drawn only on tab-root paths, not on `/yeni` or `/[id]` pages, so it never pulls the operator away from a form.
- `activeNavHref` matches tab hrefs to their item. Inside an item, the longest matching tab is the active tab.
- `breadcrumbTrail` adds the tab crumb when it is not the item's first tab: "Slaytlar / Mağaza / Düzenle", "Ürünler / Kategoriler / Yeni". On the first tab it reads "Ürünler / Yeni".
- 7a's own settings tabs (`?sekme=`) remain the page's second row under the shell's "Site · Uygulama" strip.
- A one-time, dismissable note in the sidebar footer reads: "Menü sadeleşti: eski adlarla da ⌘K ile bulursun." It is stored in `localStorage` inside try/catch.
- An **"İçeriğe geç"** skip link is the first focusable element of the shell (WCAG 2.4.1) and targets `<main id="admin-main">`.

### 3.4 Page header pattern

```
[top bar]   ≡  Breadcrumbs ................  [Ara ⌘K]  [köşk chip]  [alert bell]  [user]
[strip]     Tabs (only on merged items, tab roots only)
[page]      H1 (nav label, or the record's name)  [status badges]       [secondary] [Primary] [⋯]
            One line, at most 12 words (optional)
            ▸ Nasıl çalışır?      <- <details>, closed; rules, caveats, policy text
            then: StatusTabs → FilterBar → DataTable → Pagination   (lists)
                  Sections                                          (records)
                  Card form, save bar at the bottom                 (forms)
```

- `PageHeader` (in `forms.tsx`) gains optional props only:
  - `help` (ReactNode, the disclosure);
  - `meta` (record facts such as date, SKU or order number; replaces the eyebrow on record pages);
  - `primary` / `secondary` (`{ href, label } | ReactNode`, rendered with `BUTTON.primary` / `BUTTON.ghost`; `primary` carries `data-admin-new` for the `n` shortcut);
  - `menu` (ActionMenu children for the ⋯ overflow).
  `eyebrow`, `title`, `description` and `action` keep working unchanged. The eyebrow is drawn as 12 px sentence-case muted text (no uppercase tracking).
- One solid button per screen. Destructive and rare actions (CSV indir, İçe aktar, Yazdır, Sil) go in ⋯.
- `PageShell` (new `ui/page-shell.tsx`) has three widths: `list` = `max-w-7xl`, `detail` = `max-w-6xl`, `form` = `max-w-3xl`. Padding is `px-4 py-6 sm:px-6 sm:py-8` and the header gap is `mb-5`, about 90 px more content above the fold. This replaces six container widths (7xl x32, 3xl x19, 5xl x8, 4xl x3, 6xl x1, md x2).
- `EmptyState` gains `action` (one link or button). A filtered empty state always offers "Filtreyi temizle".
- Badge and KeyValueGrid labels: 12 px, weight 500, sentence case (was 10 px uppercase tracked). The tone pairs are unchanged, so AA holds.
- Record pages (orders, karaoke) use the same header with `meta` and badges instead of their hand-rolled ones (in the sweep).
- `BUTTON.icon`: a 44 px square for icon-only controls, always with `aria-label`.

### 3.5 Copy rules (the sweeps and every new screen)

1. **One name per thing:** nav label = h1 = tab = breadcrumb = palette entry. Sentence case ("Kafe menüsü", not "Kafe Menüsü").
2. **Description:** one line, at most 12 words, saying what the page is for. Rules, policies and "how it is computed" go into `help`, or into the one field hint where they matter. Money caveats (refund, prepay) stay visible next to the control that triggers them. The sweep moves text; it never deletes policy text.
3. **No group names in eyebrows.** No English in operator copy (Hero, slider, Shop, CRM, lifetime value, "Resend" as a word on screen).
4. **"Bildirim" is always qualified:** "fA'L bildirimi" (a member's report, the app's "Bildir"), "sipariş bildirimi e-postası" (staff mail), "talep bildirimi e-postası" (karaoke). Every carousel item is a "slayt".
5. **Buttons:** verb first, at most 3 words, no "+" glyph ("Yeni ürün", not "+ Yeni ürün ekle"). One verb set: Yeni, Kaydet, Düzenle, Sil, Yayınla, Vazgeç.
6. **Field hints:** at most 10 words, only when the field changes behaviour. A longer explanation goes in the section description.
7. **Empty state:** one sentence and one action ("Henüz kampanya yok." + "Yeni kampanya").
8. **Repeated row actions:** the row title links to the record. At most one visible text action per row; the rest go in ⋯. On Yasal belgeler, the title opens Düzenle, and "Yayındakini aç" becomes an icon link with `aria-label`.
9. **Plain Turkish, no long dashes** (U+2013/U+2014 fail the tests). Amounts and codes in `NUMERIC_STYLE`; dates on the Istanbul clock.
10. **Modal vs page:** a decision or at most 4 short fields without an upload is an `ActionModal`. Anything with images, rich text, more than 4 fields, or worth bookmarking is a page at `/x/[id]`. New pages never add `/duzenle`; existing ones stay. Basın and Hikaye move their inline create forms into a "Yeni" modal (in UI-20).

### 3.6 Density

- Default stays as audited: 44 px buttons, fields, tabs and pagination cells.
- The space is won elsewhere: shorter chrome (3.4), descriptions folded into `help`, one-line hints, empty detail sections collapsed to one line inside their parent card, low-value columns hidden below `lg` (in the sweeps).
- "Sıkı görünüm" (UI-9) is in the user menu and stored per browser. It sets `data-admin-density="compact"` on the admin root. Through kit Tailwind variants and only under `pointer-fine:`: table cells `py-3` → `py-2`, Card and Section `p-6` → `p-4`, controls 36 px (above WCAG 2.2's 24 px). On touch it does nothing and says so. There is no new rule in the shared `globals.css`.
- The collapsible rail at `lg` (UI-9): 64 px of icons, with a CSS tooltip on hover and focus-visible that Esc dismisses (`aria-label` on the link carries the name). It gives about 190 px more table width at 1024-1280. It adds no library code to the shell.

---

## 4. The ⌘K palette (UI-6, with the route in UI-2)

### 4.1 Shell and opening

- **Trigger:** replaces shell-nav's `TopBarSearch` with "Ara  ⌘K" (or "Ctrl K"; the label is decided after mount with no hydration mismatch). It is a small always-loaded client component.
  - Without JavaScript it is an `<a href="/admin/ara">`, shell-nav's results page.
  - It carries `aria-haspopup="dialog"` and `aria-keyshortcuts="Meta+K Control+K"`.
  - The cashier gets no trigger (they have no searchable section and one page).
- **Host:** the kit's native `<dialog>` with `showModal()`, rendered through `adminPortalRoot()` (`[data-admin-portal]`, inside `[data-admin-root]`, so the `--admin-*` tokens and the reset rollback apply). This is **one modal system**: there is no React Aria Modal or Dialog.
  - The palette does not open while another `dialog[open]` exists (an ActionModal or the drawer).
  - Focus returns to the trigger on close; this is done explicitly, not left to the browser.
- **Lazy loading:** the list (`palette.tsx`) loads through `next/dynamic` (called from the client trigger) on ⌘K/Ctrl+K, click, `pointerenter`, `focus` or `touchstart` of the trigger. The dialog opens at once with "Yükleniyor…" until the chunk arrives.
- **List:** React Aria `Autocomplete` + `SearchField` + `ListBox` with sections and headers (sub-path imports), inside `<I18nProvider locale="tr-TR">`.
  - No `Modal`, `Dialog`, `Popover`, `Menu` or `RouterProvider`. Items navigate through `onAction` → `router.push(href)`.
  - No prefetch on virtual focus: admin pages are dynamic, and prefetching would cost a server render and DB reads per arrow key.
  - Filtering is done by `palette-core` (pure), not by React Aria. `Autocomplete` gets no `filter`; the list is computed from the input.
- **Esc:** the first Esc clears the text (React Aria SearchField). Esc on an empty field closes the dialog (native `cancel`). Verify this in the browser pass.

### 4.2 Sections, in order

1. **Son açılanlar** (shown with an empty query): the last 8 record pages opened in this tab.
   - Stored in `sessionStorage` under `laf_admin_recent_v1:<accountKey>`.
   - Cleared on Çıkış: the logout form's `onSubmit` removes the key before the server action posts. Also cleared when the `accountKey` differs.
   - **Allow-list only:** `/admin/siparisler/<id>`, `/admin/mobil/karaoke/<id>`, product, menu item, category, slide, promo, campaign, table and post records.
   - Never `/admin/musteriler/**` (the URL carries the e-mail until D14), never `/admin/kullanicilar/**`, and never any label for which `piiLike` is true. The label is the page's first `<h1>` text, capped at 60 characters.
   - Re-filtered by `canAccess(section, role)` at render.
2. **Git:** every item and permitted tab of the role, with keywords. Keywords include:
   - old labels: "Mağaza Hero", "Anasayfa slaytları", "Kampanya e-postası", "Stok Hareketleri", "Site Metinleri", "Uygulama ayarları", "Masalar · QR", "Kasa · damga";
   - English: hero, slider, banner, shop, crm, qr;
   - synonyms: kupon → Promosyonlar, damga → Kasa, abone → Bülten, fal → fA'L bildirimleri, vitrin → Slaytlar.
   Each entry shows its shortcut where one exists.
3. **Oluştur** (role-gated, each an existing page):
   - Yeni sipariş `/admin/siparisler/yeni` (orders)
   - Yeni ürün `/admin/urunler/yeni` and "Ürünleri CSV ile içe aktar" `/admin/urunler/ice-aktar` (products)
   - Yeni menü ürünü `/admin/menu/yeni` (menu)
   - Yeni kategori `/admin/kategoriler/yeni` (categories)
   - Yeni promosyon `/admin/promosyon/yeni` (promos)
   - Yeni kampanya `/admin/bulten/kampanya/yeni` (newsletter)
   - Yeni anasayfa slaytı `/admin/anasayfa-hero/yeni` (content)
   - Yeni mağaza slaytı `/admin/magaza-hero/yeni` (shopHero)
   - Yeni uygulama slaytı, Yeni duyuru and Yeni gönderi under `/admin/mobil/*/yeni` (mobileApp)
   - Yeni masa `/admin/masalar/yeni` and "Masa kartlarını yazdır" `/admin/masalar/yazdir` (tables)
4. **Ayarlar içinde** (UI-12, after 7a): deep links to `/admin/ayarlar?sekme=<id>`, owner only. The ids are imported from 7a's `SETTINGS_TABS` (`general`, `hours`, `tax`, `shipping`, `karaoke`, `seo`, `notifications`, `email`). Labels and keywords include "Kargo ücreti", "KDV", "Çalışma saatleri", "Karaoke ücreti ve ön ödeme", "Sipariş bildirimi e-postası", "E-posta gönderen" and "Bakım modu" (if it lives in `general`).
   - Owner and manager also get "Uygulama ayarları" `/admin/mobil/ayarlar`, plus its tab ids if 6b exported them.
   - The settings deep links are built on the server in the layout and passed as plain props.
5. **Kayıtlar** (from 2 characters, debounced 200 ms, stale requests aborted with `AbortController`): shell-nav's `searchAdmin()` through the POST route (4.3).
   - Sections are role-gated by `searchSectionsFor(role)`, LIMIT 5 each.
   - Server hits are **not** filtered again on the client (a phone-number hit has a name as its title).
   - A group's "Listede gör" link (`listHref`, a `?q=` list URL) is shown only when `piiLike(q)` is false. Otherwise the route nulls it and the row reads "Listede ara" (the list without `q`).
   - There is **no "Tüm sonuçlar: <q>" row** that puts the query into a URL.
6. **Komutlar** (navigation and local preferences only):
   - Güvenlik / 2FA `/admin/2fa-kurulum`
   - Klavye kısayolları (UI-8)
   - Sıkı görünüm (UI-9)
   - Sipariş sesi (only once order-alerts lands; it toggles that spec's preference key)
   **No mutations in the palette**: no logout, no "mağazayı kapat", no order step.

### 4.3 Search transport: `POST /admin/ara/sonuc` (UI-2, security review)

- File `src/app/admin/ara/sonuc/route.ts`. It exports `POST` only, so Next answers other methods with 405.
- It reuses shell-nav's `src/lib/admin/search.ts` (`parseSearch`, `searchAdmin`, `searchSectionsFor`, `SEARCH_MIN_LENGTH`) unchanged. It follows the `siparisler/csv/route.ts` pattern.
- **Gates, in order:**
  1. Same-origin: `Sec-Fetch-Site` is `same-origin` when present; otherwise the `Origin` host equals the `Host` header. Failure → 403.
  2. `getAdminSession()` is null → 401.
  3. `searchSectionsFor(role)` is empty → 403.
  4. `Content-Type: application/json` and a body of at most 1 KB, `{ q: string }`. Anything else → 400.
  5. `parseSearch(q)` is null (under 2 characters) → 200 `{ groups: [] }`.
- **Response:** `{ groups }`, with `listHref` nulled when `piiLike(q)` is true. `Cache-Control: no-store`. A DB-unreachable error → 503 `{ error: "unavailable" }`.
- **Never log the query.** No `console.*` with the body. Errors log a code only.
- **Why POST and a route:**
  - Not GET: the query is often an e-mail or phone, which would land in history and Vercel request logs (rule 9).
  - Not a Server Action: Next 16 dispatches actions one at a time per client, so typeahead would queue behind badge polls and form submits, and actions cannot be aborted.
- **Client:** `fetch(..., { method: "POST", redirect: "manual", credentials: "same-origin" })`.
  - 401, or `opaqueredirect` (the proxy sends an expired session to `/admin/giris`) → "Oturumun kapandı." with a link to `/admin/giris?next=<current path>`.
  - 503 → "Arama şu an çalışmıyor."
  - Loading: "Aranıyor…". A live region announces the result count.

### 4.4 Matching and keyboard (Turkish)

- **Static entries** match on label + keywords + group:
  - `foldTr()` (`src/lib/admin/text-fold.ts`: tr-TR lower-casing, drop U+0307, ı → i), so İ/I/ı/i all meet;
  - **plus** a loose ASCII fold applied after `foldTr` on both sides: ç→c, ş→s, ğ→g, ö→o, ü→u, â→a, î→i, û→u. So "siparis" finds "Siparişler" and "musteri" finds "Müşteriler".
  - Ranking: label prefix > word prefix > keyword prefix > substring. Ties are sorted with `Intl.Collator("tr")`.
- **⌘K / Ctrl+K:** `event.key` lowered with `toLocaleLowerCase("tr-TR")` equals "k", with `metaKey` or `ctrlKey`, and `!altKey` (AltGr = Ctrl+Alt on Windows types @, €, { on Turkish-Q). It calls `preventDefault()` (Ctrl+K is the browser's search in Chrome and Firefox; verify Firefox on Windows). It works even inside inputs.
- **Single keys (UI-8):**
  - `/` focuses the list's lead search box (`[data-admin-search]`), otherwise it opens the palette (Shift+7 on Turkish-Q still arrives as "/").
  - `n` clicks the page's `[data-admin-new]` primary, otherwise it opens Oluştur.
  - `?` opens the shortcut sheet.
  - `g` sequences (second key within 1.5 s): `g b` Genel bakış, `g s` Siparişler, `g k` Karaoke, `g d` Kasa ("damga"), `g m` Kafe menüsü, `g u`/`g ü` Ürünler, `g r` Raporlar. Each is role-gated; a target the role cannot open does nothing.
  - The second key accepts both ü/u, ç/c, ş/s, ö/o and ğ/g. No binding on `i` or `ı`.
  - They are skipped when focus is in an input, textarea, select or contenteditable, while `isComposing`, while any `dialog[open]` exists, with any modifier, for the cashier, on `/admin/kasa`, and when the user switched them off.

---

## 5. "More capable": what is built, and its cost

| # | Feature | Value for the café + shop | Cost (changed lines incl. tests; client JS) | PR |
| --- | --- | --- | --- | --- |
| 1 | ⌘K palette: go to (with old names), create, record search, recents, commands | Every screen and record in 2-3 keys; the regroup does not break muscle memory | ~1,100 + route ~300; trigger ≤3 KB gz on every page, list ≤45 KB lazy | UI-6, UI-2 |
| 2 | Regrouped nav, shell tabs, flat staff list, no chrome for the cashier, skip link | 29 → 21 items; one place per concept; each role sees only its world | ~1,000; ~0 KB net (lucide replaces the hand-drawn ICONS map in the same client file) | UI-5 |
| 3 | Phone bottom bar for counter roles | One thumb tap instead of hamburger → drawer → item | ~450; ~2 KB | UI-7 |
| 4 | Inline forward-only order step on list rows and phone cards | The barista's most frequent click without opening the order | ~350; ~0 KB | UI-10 |
| 5 | Köşk quick status chip + Personel on Canlı durum | The day's most frequent micro-update from any page; the app's home stays true | ~650; ~2 KB | UI-13 |
| 6 | tr-TR date presets (plain links) + DateRangePicker on laptops | "Geçen ay" in one tap everywhere; `gg.aa.yyyy` on any browser locale | ~900; presets 0 KB; widget ≤45 KB lazy, only on `pointer: fine`, loaded on interaction | UI-14 |
| 7 | DateTimeField for the 10 publish-window boxes (6 forms) | 24-hour Turkish minute picking on laptops; native on phones | ~350 | UI-15 |
| 8 | Searchable pickers (ComboBox) for stock adjust and the manual order | Typing "sire" beats scrolling a 200-option select on a phone | ~650; ≤35 KB lazy | UI-16 |
| 9 | Keyboard shortcuts + `?` sheet + off switch | Mouse-free back office at rush hour | ~450; ~2 KB | UI-8 |
| 10 | Settings deep links in the palette | "Kargo ücreti nerede?" disappears | ~250 | UI-12 |
| 11 | Saved views on lists (orders first) | "Masa siparişleri", "Kargoya verilecek" in one tap | ~400; ~1 KB | UI-11 |
| 12 | Laptop rail + density | About 190 px more table width; about 20% more rows | ~450; ~1 KB | UI-9 |
| 13 | Unsaved-changes guard on the long forms | A 33-field form is not lost to one stray click | ~350 | UI-17 |
| 14 | Gün sonu print sheet | Closing the day without five screens | ~550 | UI-18 |
| 15 | Page pattern + copy sweeps | "Simpler": fewer words, one name per thing, policy behind "Nasıl çalışır?" | ~450 kit + ~2 x 1,100 sweeps | UI-4, UI-19, UI-20 |

**Phone bar (UI-7) details:**
- Shown below `lg` for owner, manager and staff; at most 5 slots with 44 px targets, icon plus label, and badges from the shared nav counts.
- Staff: Siparişler, Karaoke, Kasa, Stok, Genel bakış. After UI-13: Siparişler, Karaoke, Kasa, Canlı durum, and "Tümü", which opens the drawer.
- Owner and manager: Genel bakış, Siparişler, Karaoke, Kasa, Tümü.
- Hidden while the bulk bar is present, while any `dialog[open]` exists, and while a text field has focus on a coarse pointer (the on-screen keyboard is up).
- Uses `env(safe-area-inset-bottom)` (`viewportFit: "cover"` is already set).
- One shared `--admin-bottom-inset` on the admin root, set through a Tailwind `has-[[data-admin-tabbar]]:` arbitrary variant in the layout's shell class. The toast stack, the bulk bar and the order-alert sheet read it.
- Stacking order: the bulk bar replaces the tab bar; alerts sit above both.

**Köşk chip (UI-13) details:**
- In the top bar for roles with `venue`.
- The status is read through a polled server action (the `useNavCount` pattern, every 60 s while visible), **not** through a DB read in the layout.
- The popover holds Otomatik / Açık / Yoğun / Kapalı (radio) and boş masa −/+.
- It posts a new `saveVenueQuickAction` that updates only `manualOverride` and `freeTables`, in one SQL `UPDATE` (with `freeTables <= totalTables` checked in SQL), and writes an audit row. It never re-sends the other fields, so a colleague's concurrent Wi-Fi or note change survives.

Not built (explicitly):
- Drag-and-drop ordering.
- Mutations in the palette.
- Row keyboard navigation (j/k) in DataTable.
- React Aria `Table`/`Toast`/`Tabs`/`NumberField` (money stays text, rule 24).
- Dark mode.
- A customer lookup in the manual order (it would expose customers to staff).
- Inline karaoke row steps (3a/3b own those rows and their money states).

---

## 6. PR plan

Rules for every PR:
- Draft. CI green (typecheck, tests, build).
- `$HEAVY npx vitest run <touched tests> --maxWorkers=1`, `$HEAVY npx tsc --noEmit`, `$HEAVY npx eslint --max-warnings=0 <changed files>`.
- Screenshots at 390 / 1024 / 1280 of every screen touched.
- The PR body gets the browser-pass checklist and, for PRs that add client code, bundle numbers before and after.
- No long dashes. Say "no customer surface, no `/api/mobile/v1`, no migration" unless untrue.
- Sizes exclude `package-lock.json`.
- Kit public props never change; additions are optional.

**Phase 1: can start right after shell-nav (1c) merges**

| ID | Slug | Branch | Owned files | Depends on | Tests | Size | Review |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UI-1 | foundation | `feat/admin-ui-foundation` | `package.json`, `package-lock.json` (lucide-react 1.51.0); new `src/components/admin/ui/icons.tsx`; `ui/index.ts`; `eslint.config.mjs` (no-restricted-imports of lucide-react, react-aria-components, @internationalized/date outside `src/components/admin/**` and `src/app/admin/**`); delete `components.json`; CLAUDE.md (one paragraph "Admin arayüz kütüphaneleri") | shell-nav | new `tests/admin-ui-deps.test.ts`: exact pins; one lockfile version per allow-listed package; the import scope; RAC/date imports only in `"use client"` files via sub-paths; server-safe kit files (data-table, status-tabs, pagination, badge, detail, styles, forms) import none; `components.json` absent | ~250 | standard |
| UI-2 | search-route | `feat/admin-ui-search-route` | new `src/app/admin/ara/sonuc/route.ts`; `piiLike()` in a new client-safe `src/lib/admin/pii-like.ts` | shell-nav | new `tests/admin-search-route.test.ts`: 401, 403 cashier, 403 cross-origin, 405 GET, 400 bad body, 200 staff (no customers group), no-store, query never in `console.*` (spy), `listHref` null for `a@b.co` and `0532 123 45 67` | ~300 | **security** |
| UI-3 | landing | `feat/admin-ui-landing` | `src/lib/admin/roles.ts` (staff → `orders`, `SECTION_PATH.orders = "/admin/siparisler?durum=acik"`, new `deniedPathFor(role)` that joins with `?` or `&`); `src/lib/admin/auth.ts` (`requireRole` uses `deniedPathFor`); `src/app/admin/ara/page.tsx` (same) | shell-nav, shell-access | `tests/admin-roles-matrix.test.ts` landing test rewritten deliberately; new cases: `deniedPathFor` has no double `?`; shell-nav `withoutDenied` keeps `durum=acik`; staff denied on `/admin/menu` lands on `/admin/siparisler?durum=acik&denied=1`; owner, manager and cashier unchanged | ~150 | **security** |
| UI-4 | page-pattern | `feat/admin-ui-page-pattern` | `src/components/admin/forms.tsx` (PageHeader `help`/`meta`/`primary`/`secondary`/`menu`, eyebrow style); new `ui/page-shell.tsx`; `ui/detail.tsx` (`EmptyState.action`, KeyValueGrid labels); `ui/badge.tsx` (12 px sentence case); `ui/styles.ts` (`BUTTON.icon`, EYEBROW style); `ui/index.ts`. **No page adoption** | shell-nav | `tests/admin-ui-kit.test.ts` additions: header markup with and without new props (old props render as before), `data-admin-new` on primary, `PageShell` widths, EmptyState action, contrast pairs unchanged | ~450 | standard |

**Phase 2: after the shell is settled (3a for the shared test file)**

| ID | Slug | Branch | Owned files | Depends on | Tests | Size | Review |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UI-5 | nav | `feat/admin-ui-nav` | `src/app/admin/layout.tsx` (NAV_GROUPS: 5 groups, `tabs`, `keywords`, icons; karaoke literal kept); `src/components/admin/admin-sidebar.tsx` (lucide icons replace ICONS, flat list ≤6, cashier no chrome, tab strip slot, skip link, one-time note); `src/lib/admin/nav-match.ts` (tabs in `activeNavHref` and `breadcrumbTrail`); new `ui/section-tabs.tsx`; `ui/breadcrumbs.tsx` (tab crumb) | shell-nav, karaoke-panel, foundation | new `tests/admin-nav-ia.test.ts`: per-role counts 21/18/5 flat/0; per-role href union equals the main snapshot; every nav/tab href has a `page.tsx`; every admin `page.tsx` reached (except giris, iki-asama, 2fa-kurulum, ara, `[...rest]`, masalar/yazdir); tabs filtered by `canAccess`; tab path lights its item; breadcrumbs through tabs; strip only on tab roots; no empty group. Update `tests/admin-shell-nav.test.ts` and `tests/admin-panel-shell.test.ts` group expectations, and `tests/admin-karaoke-panel.test.ts:726` (ICONS keys still each have their own icon, in the new map form) | ~1,000 | standard |
| UI-6 | palette | `feat/admin-ui-palette` | `package.json`/lock (react-aria-components 1.21.1); new `src/components/admin/palette/trigger.tsx`, `palette.tsx`, `recents.ts`; new `src/lib/admin/palette-core.ts`; `admin-sidebar.tsx` (trigger replaces TopBarSearch; logout clears recents; recents recorder effect); `layout.tsx` (palette props + server-computed `accountKey`, an HMAC of the e-mail with `ADMIN_SESSION_SECRET`, first 16 hex, never the e-mail) | nav, search-route | new `tests/admin-palette-core.test.ts`: fold cases (siparis → Siparişler, İade/iade, findik/Fındık, IRMAK/ırmak, musteri → Müşteriler); old names (mağaza hero, kupon, damga, qr); ranking; role-gated Git/Oluştur (staff gets only Yeni sipariş; cashier gets nothing); recents refuse customers, users and `piiLike` labels; account isolation; `canAccess` re-filter. Markup: trigger SSR is a link to `/admin/ara` with `aria-keyshortcuts`; palette files import no server action (source grep); deps test extended | ~1,100 | standard |
| UI-7 | phone-bar | `feat/admin-ui-phone-bar` | new `ui/bottom-bar.tsx`; `admin-sidebar.tsx` (bar shares badge counts); `layout.tsx` shell class (`--admin-bottom-inset` via `has-[]`); `ui/toast.tsx` and `bulk.tsx` (read the inset; additive) | nav, palette, order-alerts | new `tests/admin-bottom-bar.test.ts`: slots per role (pure), cashier none, markup has `data-admin-tabbar`, 44 px classes, hide classes for bulk bar/dialog, inset read by toast and bulk bar | ~450 | standard |
| UI-8 | shortcuts | `feat/admin-ui-shortcuts` | new `src/lib/admin/shortcut-core.ts`, `src/components/admin/shortcuts.tsx`, `ui/shortcut-sheet.tsx` (native dialog); `admin-sidebar.tsx` (user-menu switch); `ui/filter-bar.tsx` (`data-admin-search` on the lead search box) | palette | new `tests/admin-shortcuts.test.ts` (pure matcher): skipped in inputs, contenteditable, IME, open dialog, with modifiers, Ctrl+Alt, cashier, `/admin/kasa`; g-sequence timing; ü/u aliases; no i/ı binding; off switch | ~450 | standard |
| UI-9 | rail-density | `feat/admin-ui-rail-density` | `admin-sidebar.tsx` (lg rail, CSS tooltips, density toggle); `ui/data-table.tsx`, `ui/detail.tsx`, `forms.tsx` (Card), all via `pointer-fine:` and `[data-admin-density=compact]` variants | nav, page-pattern, shortcuts | markup: default classes unchanged (44 px tests hold); compact variants present only with `pointer-fine:`; rail links have `aria-label`; rail state key parsing (pure) | ~450 | standard |

**Phase 3: waits for the wave-4 owners of the files it adopts in**

| ID | Slug | Branch | Owned files | Depends on | Tests | Size | Review |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UI-10 | row-steps | `feat/admin-ui-row-steps` | `src/components/admin/orders-list.tsx` (row and phone card: one inline button, the first enabled of `start_preparing`, `mark_shipped`, `complete` from the server-decided `orderActions`, through the existing action) | orders-ui | markup: owner and staff rows show the step; `mark_paid`, `check_pos`, `ship`, `cancel`, `refund`, `release_stock` never render inline; disabled reason kept | ~350 | standard |
| UI-11 | saved-views | `feat/admin-ui-saved-views` | new `src/lib/admin/saved-views.ts` (pure); `ui/filter-bar.tsx` (optional `views?: { key: string }`, "Görünümler" ActionMenu after mount); adoption on the orders list only | orders-ui, palette | sanitizer: drops `q`, page, any value with `@` or 7+ digits; name ≤30 characters; max 8; key per `accountKey` + list; FilterBar markup without `views` is unchanged | ~400 | standard |
| UI-12 | palette-settings | `feat/admin-ui-palette-settings` | `palette-core.ts` (Ayarlar içinde); `layout.tsx` (entries from 7a's `SETTINGS_TABS`; app-settings tab ids if 6b exported them) | palette, system-settings | every deep-link id exists in `SETTINGS_TABS`; owner only for `/admin/ayarlar`; manager gets only Uygulama ayarları | ~250 | standard |
| UI-13 | venue-quick | `feat/admin-ui-venue-quick` | `src/lib/admin/roles.ts` (`venue: owner, manager, staff`); `src/lib/admin/role-summary.ts` (label); `src/app/admin/mobil/canli-durum/{page.tsx,actions.ts,venue-status-form.tsx}` (`requireRole("venue")`; `totalTables` read-only and ignored for staff; new `saveVenueQuickAction`); `src/lib/mobile/venue.ts` (new `patchVenueStatus`, one SQL `UPDATE`); new `src/components/admin/venue-quick.tsx`; `layout.tsx` (Canlı durum section `venue`, chip in the `actions` slot) | content-app, nav | roles matrix (venue for staff; `mobileApp` still owner/manager); action gates (cashier denied; staff allowed; staff `totalTables` ignored); quick action keeps wifi/noise/power/note; audit row; `admin-role-summary`; nav-ia staff set (+ canli-durum) | ~650 | **security** |
| UI-14 | date-fields | `feat/admin-ui-date-fields` | `package.json`/lock (@internationalized/date 3.12.4); new `src/lib/admin/date-presets.ts`, `ui/overlay.ts` (the only `UNSTABLE_`/`UNSAFE_` use), `ui/date-range-field.tsx`, `ui/date-time-field.tsx`; `ui/filter-bar.tsx` (preset links + lazy widget on `pointer: fine`) | palette, orders-ui, karaoke-panel, system-audit-log | presets at 21:30Z and 00:30 Istanbul (rule 22); FilterBar SSR keeps the `bas`/`bit` native inputs and values; preset hrefs; DateTimeField value round-trips through `parsePublishInstant`; deps test (use client, sub-path) | ~900 | standard |
| UI-15 | datetime-adopt | `feat/admin-ui-datetime-adopt` | `src/components/admin/promo-form.tsx`, `src/app/admin/bulten/kampanya/campaign-mail-form.tsx`, `src/app/admin/anasayfa-hero/slide-form.tsx`, `src/app/admin/mobil/{slaytlar/slide-form,duyurular/announcement-form,gonderiler/post-form}.tsx` (10 boxes) | date-fields, people-lists, content-app | `tests/frontend-form-contract.test.ts` and each form's tests: names, values, min/max unchanged; SSR still renders a native `datetime-local` | ~350 | standard |
| UI-16 | combobox | `feat/admin-ui-combobox` | new `ui/combobox-field.tsx` (lazy RAC ComboBox; SSR native `<select>` with the same name and options; foldTr filter in a pure helper); `src/components/admin/stock-adjust-form.tsx`, `src/components/admin/manual-order-form.tsx` | palette, catalog-lists, orders-ui | form names unchanged (form contract); SSR fallback markup equals the old select; filter helper (fold cases) | ~650 | standard |
| UI-17 | unsaved-guard | `feat/admin-ui-unsaved-guard` | new `ui/unsaved-guard.ts` (dirty snapshot, `beforeunload`, capture-phase same-origin link click → `confirm`, exported `isPanelDirty()` that the palette checks); adoption in `ayarlar/settings-form.tsx`, `mobil/ayarlar/app-config-form.tsx`, `legal-doc-form.tsx`, `campaign-mail-form.tsx` | system-settings, content-app, content-legal, people-lists, palette | pure dirty-compare and link-filter helpers; adoption markup | ~350 | standard |
| UI-18 | day-close | `feat/admin-ui-day-close` | new `src/app/admin/raporlar/gun-sonu/page.tsx` (`requireRole("reports")`, the `[data-print-receipt]` print scope); reuse 7b's report functions, plus at most one read in `store.ts` beside them; a link in the Raporlar header and the palette | system-insights, page-pattern | role gate (staff and cashier denied); Istanbul-day bounds; figures equal 7b's for the same day | ~550 | **security** |

**Phase 4: after all of wave 4 and wave 5 have merged**

| ID | Slug | Branch | Owned files | Depends on | Tests | Size | Review |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UI-19 | copy-ops | `feat/admin-ui-copy-ops` | page headers, PageShell, EmptyState and copy rules on the Bugün, Katalog and Pazarlama pages; record headers for orders and karaoke; `views` prop on the karaoke list | orders-ui, people-customers, people-lists, catalog-forms, catalog-lists, karaoke-refund-policy, system-site-settings, page-pattern, nav | copy assertions in existing tests updated; a new test that every admin h1 equals its nav or tab label (list pages) | ~1,100 | standard |
| UI-20 | copy-content | `feat/admin-ui-copy-content` | the same on the İçerik and Yönetim pages; Basın and Hikaye create into an ActionModal; Yasal belgeler row pattern; one "Karaoke ayarları" link per role on the bookings page | copy-ops, content-legal, content-app, system-audit-log, system-insights, system-settings | as UI-19; the legal list renders one text action per row | ~1,100 | standard |

**Order:**
- After 1c: UI-1, UI-2, UI-4 in parallel; UI-3 once 1d is in.
- Then UI-5 (needs 3a and UI-1), then UI-6, then UI-8. UI-7 after UI-6 and order-alerts; UI-9 after UI-8 and UI-4.
- Phase 3 items as their owners merge.
- UI-19, then UI-20, last.
- `admin-sidebar.tsx` and `layout.tsx` are touched by UI-5, 6, 7, 8, 9 and 13: build them one at a time on the previous one's merge (or rebase textually), never in parallel worktrees.

**Inputs for in-flight work** (the orchestrator forwards them):
- **shell-nav (1c) review:** `GET /admin/ara?q=` puts e-mails and phones into history and request logs. Keep it as the no-JS path but note it in the PR; the palette never uses it.
- **7b system-insights:** dashboard tiles link to filtered lists. Drop "Toplam ürün" and "Kategori". Add an owner/manager "Dikkat" strip (orders with attention, refunds owed, karaoke waiting, items out of stock, e-mail health). No revenue for Personel (SHE-14).
- **order-alerts:** the bell sits in the top-bar `actions` slot, for orders roles only (not the cashier). The phone sheet reads `--admin-bottom-inset` and sits above the bottom bar.
- **6b content-app:** export the Uygulama ayarları tab ids from a client-safe core (as 7a did in `settings-core.ts`), so UI-12 can deep-link. Keep the Canlı durum action's FormData names (UI-13 regates them).
- **Wave-4 builders, once UI-4 merges:** use `PageHeader` `primary`/`help`, `PageShell` and `EmptyState.action` in pages you already own. Pass no eyebrow that repeats the nav.

---

## 7. Risks and fallbacks

| # | Risk | Mitigation | Fallback |
| --- | --- | --- | --- |
| 1 | shell-nav's API (actions slot, `breadcrumbTrail`, collapse key, `TopBarSearch`) changes before it merges | Nothing in the shell starts before 1c is on main; rebase on its final API | none needed |
| 2 | React Aria Autocomplete inside a native `<dialog>` (focus, Esc order, virtual focus on iOS VoiceOver) | Browser pass on Chrome, Safari and Firefox plus VoiceOver; the list is a leaf over the pure `palette-core` | Swap `palette.tsx` for a hand-built ARIA 1.2 combobox (minimal's spec: listbox, `aria-activedescendant`, live count) on the same core and dialog; drop the RAC pin if nothing else uses it yet |
| 3 | `UNSTABLE_portalContainer` / `UNSAFE_PortalProvider` change between React Aria releases | Exact pins; all such use in `ui/overlay.ts`; upgrades one minor at a time with the browser pass | The widget renders the native input (feature switch in `overlay.ts`) |
| 4 | Bundle over budget (palette over 45 KB, a widget over its budget, or the shell over 8 KB) | Numbers in every PR body; lazy loading on interaction; no RAC in the shell | Drop that widget (the native control stays) or the hand-built palette (risk 2) |
| 5 | Muscle memory after the regroup | URLs unchanged, old names as palette keywords, breadcrumbs, the one-time note, a line in the release note | none needed |
| 6 | A tab or item shown to a role that cannot open it | Same `canAccess` filter; per-role href-union test; pages keep `requireRole` | revert UI-5 (no URL depends on it) |
| 7 | Tests that pin source text (`admin-karaoke-panel` layout literal and ICONS regex, `admin-roles-matrix`, `admin-shell-nav`, copy assertions) | UI-5 waits for 3a and keeps the karaoke literal; landing changed deliberately in UI-3; sweeps last | none needed |
| 8 | Landing path with a query yields `?durum=acik?denied=1` | `deniedPathFor` in UI-3 plus tests, used in `auth.ts` and `ara/page.tsx` | keep staff on `/admin` (revert one map entry) |
| 9 | Bottom edge crowding (bar, bulk bar, toasts, alert sheet, keyboard) | One `--admin-bottom-inset`; explicit stacking; hide on dialog, bulk bar and text focus; test at 390 with the keyboard open | UI-7 off by default behind a user-menu switch |
| 10 | PII through the palette (query in URL or logs, recents, saved views on a shared counter device) | POST + no-store + never logged; `piiLike` strips list links; recents allow-list in `sessionStorage` per account, cleared on Çıkış, re-filtered by role; saved views sanitized and per account | disable recents (one flag) |
| 11 | Personel misusing Canlı durum, or two people overwriting each other | Narrow `venue` section, `totalTables` kept from staff, partial SQL update, audit row | revert UI-13 (one roles line + the gate) |
| 12 | Shortcuts clash with screen readers, scanners or Turkish-Q | Off switch, never in fields, IME, dialogs, Kasa or for the cashier; no AltGr combos; no i/ı | turn single keys off by default (one constant) |
| 13 | Supply chain churn (lucide daily, React Aria monthly) | Exact pins, `--before`, lockfile single-version test, ESLint scope guard, deliberate upgrade PRs; verify each lucide icon name at install | pin the previous version |
| 14 | Copy sweeps collide with in-flight pages | Sweeps only after all of W4 and W5 have merged; copy only | split further per group |
| 15 | The unsaved guard misses a navigation (App Router `router.push`, back button) | Capture-phase anchor check, `isPanelDirty()` checked by palette and shortcuts, `beforeunload` for reloads and closes | `beforeunload` only |
| 16 | No DOM tests, so interaction regressions slip | Every rule is pure and node-tested; SSR markup tests; a written browser-pass checklist per PR | adopt the order-alerts DOM environment if it lands |
| 17 | Gün sonu figures disagree with Raporlar | Reuse 7b's functions only; a test compares the figures | drop UI-18 |

---

## 8. What is deliberately not done

- No swap of ActionMenu, ActionModal, ConfirmButton, Toast, DataTable, StatusTabs or Pagination onto any library.
- No Radix, no cmdk, no shadcn, no `shadcn init`, no shadcn tokens in `globals.css`.
- No route-group or folder moves. No `next.config.ts` or CSP edit. No `/api/mobile/v1` or docs/API-MOBILE.md change. No migration (UI-13 changes no column; UI-18 only reads).
- No card files (rule 28), no store functions outside the ones named, no customer surface.

## 9. Claims checked for this design

- **Nav and roles:** `NAV_GROUPS` (`src/app/admin/layout.tsx:90-196`, 29 items in 6 groups) and `SECTION_ROLES` (`roles.ts:57-103`, no `venue` today). `landingPathFor` is at `roles.ts:117-125`. The `` `${landingPathFor(role)}?denied=1` `` redirect is at main `auth.ts:499` and on shell-access `auth.ts:631`, and in shell-nav `ara/page.tsx:111`.
- **Pinned tests:** `tests/admin-roles-matrix.test.ts:56` pins the dashboard landing. `tests/admin-karaoke-panel.test.ts:689` greps the karaoke literal in layout.tsx, and `:726` greps the sidebar ICONS keys. karaoke-panel (3a) edits that test file and `admin-confirm-ui.test.ts`.
- **In-flight branches:** shell-nav has 12 commits on `fix/admin-audit-shell-nav` (committed, not merged). It edits layout.tsx, admin-sidebar.tsx, nav-match.ts and page.tsx, and adds `ui/breadcrumbs.tsx` and `lib/admin/search.ts`. Its search is a GET form to `/admin/ara`, and `listHref` builds `?q=` list URLs. shell-access edits only `auth.ts` among the shell files.
- **Settings and venue:** 7a `settings-core.ts` has tab ids general, hours, tax, shipping, karaoke, seo, notifications and email, with `SETTINGS_TABS` and `?sekme=`. `saveVenueStatusAction` gates on `mobileApp`, posts 7 fields (manualOverride, freeTables, totalTables, wifi, noise, power, note) and writes an audit row. `updateVenueStatus` upserts the whole row (`src/lib/mobile/venue.ts:314`).
- **Inputs and filters:** 10 `type="datetime-local"` inputs in 6 files. A `date-range` field only in order-filters, karaoke-panel and audit-view. The `acik` tab is at `order-filters.ts:91`. `OrderActionId` includes `start_preparing`, `mark_shipped` and `complete`.
- **Kit and config:** `vitest.config.mts` uses `environment: "node"`, with no jsdom or happy-dom in `package.json`. `components.json` is present. `adminPortalRoot()` is at `ui/toast.tsx:62`. Client kit files are action-menu, action-modal, filter-bar, link-pending and toast. CSP is at `next.config.ts:49-57`. CI lints with `--max-warnings=0`.
- **Pages and gates:** 12 `/yeni` pages, `urunler/ice-aktar` and `masalar/yazdir` exist. Their gates are orders, products, tables and content as listed.
- **App wording:** lafmobil's fA'L report button is "Bildir".
- **npm (18 Oct):**

  | Package | Version | Published |
  | --- | --- | --- |
  | lucide-react | 1.51.0 | 2026-10-03 |
  | lucide-react | 1.52.0 | 2026-10-04, exactly 14 days, not used |
  | react-aria-components | 1.21.1 | 2026-09-04 |
  | react-aria-components | 1.22.x | 8-9 Oct |
  | react-aria | 3.52.1 | 2026-09-04 |
  | react-stately | 3.50.0 | 2026-09-01 |
  | @internationalized/date | 3.12.4 | 2026-09-01 |
  | cmdk | 1.1.1 (latest) | 2025-03-14 |

  All React peers accept 19.2.4.
