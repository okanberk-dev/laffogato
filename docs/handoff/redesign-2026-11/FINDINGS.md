# Açık bulgular (22 Kas 2026)

Bu dosya, devredilen oturumun yarıda kalan iki denetiminin **tamamlanmış** kısmının çıktısıdır. Bulgular ajanların raporudur, **henüz doğrulanmadı ve uygulanmadı**: her birini koda ve ekran görüntüsüne bakarak doğrula, sonra düzelt. Dosya ve satır numaraları `26d59ec` (+ belge commit'leri) üzerindedir.

- Tasarım denetimi (8 sayfa grubundan 2'si bitti): ana sayfa ve krom (üst çubuk, panel, mobil menü, arama, sepet, çerez, footer). Kalan 6 grup (katalog, menü, hikâye/ziyaret/kampanyalar, rehber/hukuk/küçük sayfalar, karaoke sihirbazı, ödeme ve üye alanı) hiç denetlenmedi.
- Kod denetimi (6 boyuttan 1'i bitti, doğrulama aşamasına geçmedi). Kalan boyutlar: ön yüz sözleşmesi ve kaybolan işlevler, erişilebilirlik, performans, mantık hataları, kalıntılar (tanımsız token, stilsiz sınıf, ölü CSS).

## Kod denetimi

### [high] ✅ DÜZELTİLDİ (devir commit'i): Pre-contract legal text dropped below the 16px floor: legal tables (checkout pre-info, ÖBF/MSS) at 15px, karaoke seller line at 14px

- **Dosyalar:** src/styles/pages.css, src/styles/karaoke.css, src/styles/foundation.css, src/app/odeme/checkout-preinfo.tsx, src/app/odeme/checkout-documents.tsx, src/components/laffogato/karaoke-booking.tsx
- **Kanıt:** src/styles/pages.css:629-633 `.legal-table { width: 100%; border-collapse: collapse; font-size: 15px; }`, and no th/td size, so cells inherit 15px (base 4962da2 globals.css:9839-9849 had 16px on .legal-table and on .legal-table th). src/styles/karaoke.css:356-359 `.karaoke-seller { font-size: 14px; color: var(--muted); }` (base globals.css:12814-12816 had 16px). karaoke.css:323-331 `.karaoke-preinfo h3 { ... font-size: 15px }` (was 18px). The kept floor in foundation.css:671-679 lists `.checkout-consent label, .checkout-consent-note, .legal-section p, .legal-bullets li, .legal-ordered li, .karaoke-preinfo` but leaves out `.legal-table` and `.legal-table th`. The removed guard (git show 5d777bb:tests/legal-text-size.test.ts:34-52) required >=16px for both. Where the 15px tables appear: checkout-preinfo.tsx:193-194 `<table className="legal-table co-facts-table">` (the payment step's "Bu siparişin bilgileri" table: buyer, lines, total, payment method, date); checkout-documents.tsx:62-63 (the documents panel); /hukuk/[slug]. The seller line is karaoke-booking.tsx:1300-1305 `<p className="karaoke-seller">{seller}…` under the comment "Who sells stays in sight… (MSY m.5/1-b, c)". Runtime measurements: on /hukuk/on-bilgilendirme-formu, `.legal-table td` and `th` compute to 15px (first cell "NEXTGEN YAZILIM … LİMİTED ŞİRKETİ") while `.legal-section p` computes to 16px. With checkout markup injected, `.co-facts .co-facts-table td` = 15px and `.co-docpanel-body .legal-table td` = 15px. `.karaoke-seller` = 14px.
- **Senaryo:** A customer at the payment step opens the pre-information. The order's own facts table (seller, products, total, payment method) and every table in the ÖBF and the Mesafeli Satış Sözleşmesi render at 15px, below MSY m.6/1's 12pt = 16px minimum, which the operator set in decision ASK-OTH-2. A karaoke payer sees the seller's identity line at 14px. If the pre-information is ever disputed (a chargeback or a consumer complaint), it no longer meets the form requirement that the old CSS met.
- **Durum:** `.legal-table` (th/td dahil), `.karaoke-seller` ve `.karaoke-preinfo h3` 16px yapıldı ve `foundation.css`'teki hukuki asgari bloğuna eklendi; tarayıcıda 16px ölçüldü. Ödeme tarafındaki `co-*` metinleri zaten 16px'ti.
- **Öneri (orijinal):** Set `.legal-table { font-size: 16px; }` and give `.legal-table th, .legal-table td` 16px explicitly. Set `.karaoke-seller` to 16px and `.karaoke-preinfo h3` to at least 16px. Add `.legal-table`, `.legal-table th`, `.karaoke-seller` (and `.co-docs`, `.co-docs-seller`, `.co-ship-method-meta`, `.co-accepted`, `.co-docpanel-*`, `.co-brief`, `.co-withdrawal`) to the legal-minimum block in foundation.css:671 so the floor is kept in one place.

### [high] Shop hero carousel (/admin/magaza-hero slides) no longer advances, and its text colours are inverted

- **Dosyalar:** src/styles/catalog.css, src/components/laffogato/shop-hero-slider.tsx, src/styles/foundation.css, src/app/admin/magaza-hero/slide-form.tsx
- **Kanıt:** shop-hero-slider.tsx is unchanged. It renders every slide inside `<div className="shop-hero-track">` (line 86) with no transform, and it marks the current slide only with `data-active` / `aria-hidden={!active}` (204-206). The base CSS (4962da2 globals.css:10451-10476) stacked the slides (`position:absolute; inset:0; opacity:0`) and showed `.shop-hero-slide[data-active="true"] { opacity: 1 }`. The new catalog.css:1029-1041 lays them out as `.shop-hero-track { display: flex; transition: transform … }` / `.shop-hero-slide { flex: 0 0 100%; … }` and has no `[data-active]` rule. Theme colours: in the component, `isLight = textTheme === "light"` means light text on `var(--roast)` (lines 182-188), and the base CSS had `[data-theme="light"] { color: var(--bg) }` and `[data-theme="dark"] { color: var(--ink) }`. The new catalog.css:1066 sets `.shop-hero-slide[data-theme="dark"] .shop-hero-content { color: var(--on-dark) }`, which is the reverse. The grounds and accent colours `var(--roast)`, `var(--bg-stone)`, `var(--amber)` and `var(--accent)` (lines 188 and 199) are no longer defined in foundation.css. The light theme's CTA is `btn-light` (line 242: white text and white border). Runtime: the slider markup was injected on /magaza at 1440px with slide 2 marked active. Slide 1 stayed in view at x=0 and slide 2 sat off-screen at x=1440. Slide backgrounds computed to rgba(0,0,0,0). The dark-theme slide's text computed to rgb(255,255,255) over the band's rgb(246,246,243). The panel's preview imports the same component (admin/magaza-hero/slide-form.tsx:26 `import { Slide }`).
- **Senaryo:** The operator publishes three slides in /admin/magaza-hero. /magaza always shows slide 1. The arrows, dots and 6.5s autoplay only change the "02 / 03" counter and the dot, and screen readers are told slide 1 is hidden while it is the one on screen. A "dark" text-theme slide shows white title text on the near-white band. A "light" slide without a photo shows its white `btn-light` CTA invisibly on the same band. The panel's Önizleme shows the same broken colours, so the operator cannot see the problem before publishing.
- **Öneri:** In catalog.css, stack the slides again: `.shop-hero-track{display:grid}` `.shop-hero-slide{grid-area:1/1;opacity:0;pointer-events:none;transition:opacity .6s var(--ease)}` `.shop-hero-slide[data-active="true"]{opacity:1;pointer-events:auto}`. Map `[data-theme="light"] .shop-hero-content{color:var(--on-dark)}` and `[data-theme="dark"] … {color:var(--ink)}`. Replace `--roast`, `--bg-stone`, `--amber` and `--accent` in shop-hero-slider.tsx:188 and :199 with tokens that exist (for example `var(--charcoal)` / `var(--band)`, accent `currentColor`), or alias them in foundation.css.

### [medium] Panel's home intro fields broke: "Ana sayfa giriş etiketi" is rendered nowhere, "giriş metni" replaced the app section's pitch

- **Dosyalar:** src/components/laffogato/home-page.tsx, src/lib/admin/content-fields.ts
- **Kanıt:** The base home (git show 4962da2:src/components/laffogato/home-page.tsx:215-216, 305-340) rendered an intro band under the hero: kicker `home.hero.eyebrow`, lead and rest of `home.hero.lede`, with the band hidden when the lede was empty. The new home-page.tsx:110-112 reads only `content?.["home.hero.lede"]` and passes it into the app section: `intro={introLead ? [introLead, introMore]… : ""}` (261-266), then `{intro || "Siparişini uygulamadan ver, …"}` (500-503). `home.hero.eyebrow` is no longer read anywhere in src (grep finds only content-fields.ts). The panel's hints, in a backend file a frontend PR cannot change (content-fields.ts:30-47), still describe the old behaviour: "Slaytların altındaki tanıtım bandının üstündeki kısa satır" and "Boş bırakırsan bant gizlenir". Runtime: curl of / shows the #uygulama block as "L'Affogato uygulaması | İtalya’dan ithal kahve barı konsepti. Tek-origin Sirena espresso’yu … kupu yiyorsunuz."
- **Senaryo:** Out of the box, the home page's app section describes the waffle cup instead of the app, because the default lede is the brand blurb. If the operator edits "Ana sayfa giriş etiketi" in /admin/icerik, nothing changes on the site. If they empty "Ana sayfa giriş metni" to hide the band, as the hint says, no band disappears; the app section switches back to its own text instead.
- **Öneri:** Restore an intro section under HomeHero: the eyebrow as the kicker, then the lede with its first sentence emphasised, rendered only when the lede is non-empty (as before). Let AppBlock always use its own app copy. Drop the `intro` prop.

### [medium] Product page "Bunları da sevebilirsin": desktop visitors can no longer add a related product to the cart

- **Dosyalar:** src/styles/catalog.css, src/components/laffogato/product-detail.tsx, src/components/laffogato/ui.tsx
- **Kanıt:** catalog.css:101-109 says "a wide screen opens the card", and `@media (min-width: 1024px) { .product-grid .p-card-add { display: none; } }`. The PDP's related row also uses that grid: product-detail.tsx:425-432 `<div className="product-grid">… <ProductCard … addToCart={addRelated} />`, with no `onOpen`. So the card is a plain link (ui.tsx:224-227) and its only add control (ui.tsx:263-272) is hidden. Base: the related row used `.shop-grid-3`, and `.product-card-add` (4962da2 globals.css:5861) was visible at every width. Runtime at 1440px on /magaza/urun/sirena-espresso-blend: `.pdp-related .p-card-add` ("Sepete ekle") has computed display:none. The `addRelated` handler and its `relatedNote` live region are now reachable only below 1024px.
- **Senaryo:** A desktop shopper on a product page wants the moka pot shown under "Bunları da sevebilirsin". There is no add button, and clicking the card leaves the current product page. The one-click cross-sell add the page had before is gone for every visitor at 1024px or wider.
- **Öneri:** Scope the hide to grids whose cards open a quick look, e.g. `.collection .product-grid .p-card-add { display: none }` at >=1024px, or add a `product-grid--quicklook` modifier in shop-page.tsx. Leave `.pdp-related` showing the button.

### [medium] Loyalty rule misstated on home; new site-wide line promises a stamp on every order

- **Dosyalar:** src/components/laffogato/home-page.tsx, src/components/laffogato/chrome.tsx, src/lib/mobile/loyalty-core.ts, src/components/laffogato/campaigns-page.tsx
- **Kanıt:** home-page.tsx:482 `body: `${min} TL'den itibaren her ${step} TL bir damga. …`` renders "140 TL'den itibaren her 320 TL bir damga". The rule in loyalty-core.ts:93-97 is `goods < STAMP_MIN_ORDER_MINOR ? 0 : Math.ceil(goods / STAMP_STEP_MINOR)`, i.e. one stamp per started ₺320 (comment at 62-69: "₺140-₺320 → 1, ₺320,01-₺640 → 2"). Base home had the explicit "320 TL'ye kadar bir, 640 TL'ye kadar iki" (old home-page.tsx:450-454) and "başlayan her 320 TL" (old home-app-intro.tsx). campaigns-page.tsx:47 still has the correct sentence. New chrome.tsx:277 shows "Her siparişte damga topla" above every page, but loyalty.ts:188-190 awards stamps only when `orderChannel(order) === "app" && orderKind(order) === "cafe"` (never for web shop orders, none under ₺140). The home app section also lost base home-app-intro's "Sipariş, damga, masa QR'ı ve karaoke Tuzla köşkü içindir." while the Marina branch is advertised in the nav and footer.
- **Senaryo:** A visitor planning a ₺200 app order reads that a stamp needs ₺320 and concludes it earns nothing; the code gives one stamp. A ₺400 order reads as one stamp and gets two. A shopper buying beans through the site's own checkout is told "Her siparişte damga topla" and earns no stamp. A Marina visitor gets no warning that the app and stamps work only at the Tuzla köşk.
- **Öneri:** Reuse the campaigns-page sentence on home ("Uygulamadan verilen 140 TL ve üzeri kafe siparişi damga kazandırır: 320 TL'ye kadar bir, 640 TL'ye kadar iki"). Reword the announcement, e.g. "Uygulamadan kafe siparişlerinde damga topla". Put the Tuzla-only note back in the app section.

### [medium] Offsets for the sticky header and the karaoke phone bar were not ported: anchor jumps and focused fields land under the chrome

- **Dosyalar:** src/styles/chrome.css, src/styles/pages.css, src/styles/karaoke.css, src/app/rehber/[slug]/page.tsx, src/components/laffogato/karaoke-booking.tsx
- **Kanıt:** The header is sticky (chrome.css:69-74; --header-h 84px, 56px plus the 48px quick-link row on phones). No rule in src/styles sets scroll-margin-top or scroll-padding-top; the only hits are checkout.css:472 and :1512. Base globals.css had: `.guide-section`, `.guide-section h2`, `.guide-recipe` scroll-margin-top 96px (9338-9351, 9424); recipe steps 110px (9463); `.shop-head-wrap` (#products, 6304); `.karaoke-flow` and `.kw-step-title` calc(var(--header-h)+12px) (12357, 12390); `html:has(.karaoke-page[data-wizard="on"]) { scroll-padding-bottom }` and `body:has(…) .footer { padding-bottom }` (13153-13162). New karaoke.css:569-578 fixes `.kw-nav` to the bottom on phones but only pads `.karaoke-page` (606-609). `.site-footer` keeps 36px bottom padding (chrome.css:385). Anchors that depend on this: the guide TOC links `#bolum-N` / `#tarif` (rehber/[slug]/page.tsx:124-146), HowToStep URLs (guide-structured-data.ts:138), and the wizard's `flowRef.scrollIntoView({block:"start"})` (karaoke-booking.tsx:401-410). Runtime: clicking a TOC link on /rehber/affogato-nedir puts the heading at top 0, bottom 56 under a header ending at 84 (1440px), and 0-84 under 104 on a 390px phone, so the heading is fully hidden. Karaoke on a phone, "Devam": flow top 0 and the progress bars hidden under the 104px header. Details step, Tab: `contactEmail` sits at 616-664 under the bar at 575-664, and `contactPhone` is half covered. At the bottom of /karaoke on a phone, the footer's "© 2026 L'Affogato - NextGen Yazılım Ltd." line (760-808) is under the bar (771-844).
- **Senaryo:** A reader taps "Tarif" in a guide's table of contents, or arrives from a Google recipe-step result, and the heading they wanted is hidden behind the bar. A keyboard user booking karaoke on a narrow screen tabs into the e-mail field and cannot see it (WCAG 2.4.11). After each "Devam", the step progress sits under the header.
- **Öneri:** Add `html { scroll-padding-top: calc(var(--header-h) + 16px); }` (plus 48px below 1024px for the quick-link row), or restore the per-element scroll-margin-top rules. Restore `html:has(.karaoke-page[data-wizard="on"]) { scroll-padding-bottom: calc(73px + 12px + env(safe-area-inset-bottom)) }` and `body:has(.karaoke-page[data-wizard="on"]) .site-footer { padding-bottom: … }` in the phone media query.

### [low] Busy indicator invisible everywhere; the footer newsletter button shows nothing while sending

- **Dosyalar:** src/styles/foundation.css, src/components/laffogato/busy-dots.tsx, src/components/laffogato/newsletter-form.tsx
- **Kanıt:** busy-dots.tsx:14 renders `<span className="lf-dots" aria-hidden="true"><i /><i /><i /></span>`. The new rule, foundation.css:356-384, targets `.busy-dots span`: wrong class and wrong child. Base globals.css:610-643 styled `.lf-dots` and `.lf-dots i`. The only remaining `.lf-dots` rule is a margin (checkout.css:321). The redesigned newsletter button (newsletter-form.tsx:37-41) shows only `<BusyDots />` plus sr-only text while pending. Runtime: in the footer button, `.lf-dots` and each `i` measure 0×0. BusyDots is used by 15 customer forms (login, register, checkout, karaoke, account).
- **Senaryo:** A visitor submits the footer newsletter form. The 44px button goes disabled and visually blank until the action returns, with no sign that anything is happening. In every other form, the three animated dots next to "Gönderiliyor…" are gone.
- **Öneri:** Rename the rule to `.lf-dots { display:inline-flex; gap:4px } .lf-dots i { width:5px; height:5px; border-radius:50%; background:currentColor; opacity:.3; animation: busy-dot 1s infinite }`, with nth-child delays.

### [low] Status colours lost on unchanged member screens: order status chips, coupon badges and success/error messages all render neutral

- **Dosyalar:** src/styles/karaoke.css, src/styles/foundation.css, src/app/uye/hesap/page.tsx, src/app/uye/hesap/siparislerim/page.tsx, src/app/uye/hesap/promosyonlar/page.tsx, src/components/customer/verify-notice.tsx
- **Kanıt:** Order chips use `<span className="status-chip" data-tone={o.status}>` (uye/hesap/page.tsx:294, siparislerim/page.tsx:54, siparislerim/[orderNo]/page.tsx:126). The new karaoke.css:752-766 styles only tones `ok`, `warn` and `bad`. Base globals.css:8323-8350 coloured pending_payment, paid, preparing, shipped, completed, cancelled and refunded. Unchanged inline styles use tokens the new foundation does not define (DECISIONS says older names resolve, but only the font names were aliased): promosyonlar/page.tsx:44-66 coupon badges `var(--bg-stone)` / `var(--ink-mute)` vs `var(--green-mist)` / `var(--matcha)`; verify-notice.tsx:76 and :81 success `var(--matcha)`, error `var(--rose)`; adreslerim/page.tsx:95 and favorilerim/page.tsx:93 delete actions `var(--rose)`. Other uses include `--ink-soft`, `--ink-line`, `--gold-deep` and `--accent`.
- **Senaryo:** A member scanning "Siparişlerim" cannot tell a cancelled or refunded order from a paid one except by reading every label. In Promosyonlar, "Kullanıma hazır" coupons look the same as "Kullanıldı" or "Süresi doldu" ones. After "Bağlantıyı yeniden gönder", the success and error messages render in the same colour.
- **Öneri:** Port the per-status `.status-chip[data-tone=…]` rules (map paid/completed to var(--success), cancelled/refunded to var(--error), the rest to muted). Alias the retired tokens in foundation.css :root (`--rose: var(--error); --matcha: var(--success); --ink-soft: var(--muted); --ink-mute: var(--muted); --ink-line: var(--line); --bg-stone: var(--band); --bg-warm: var(--band); --green-mist: color-mix(in srgb, var(--success) 12%, white); --gold-deep: var(--ink)`), or update the inline styles.

## Tasarım denetimi

### [high] / @ all widths (360–1440)

In the FAQ/SEO block above the footer, the 12 guide links under 'DAHA FAZLASI - REHBER' render as one vertical column of bordered boxes, one per row and about 400px tall. At 768px and up the column hangs to the right of the label; on phones it sits under it. Cause: `.seo-guides` is the flex-wrap container, but the chips sit inside an unstyled <ul>. That <ul> is the only flex item beside the <h3>, and its <li>s are block boxes, so every `.chip-link` takes its own line. Two smaller problems in the same row: only 16px separates it from the facts grid above (40px is used elsewhere in the block), and the label is a link that doesn't look like one (muted grey, no underline).

- **Nerede:** src/styles/pages.css `.seo-guides` (l.488) and `.chip-link` (l.494); markup in src/components/laffogato/seo-content.tsx l.113-126
- **Öneri:** .seo-guides { display: grid; gap: 12px; margin-top: 40px; } .seo-guides ul { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; } Also give the label link `text-decoration: underline; text-underline-offset: 4px`, or drop that link and put a 'Tüm rehberler' `.link-u` after the chips.

### [high] / @ 600–1440 (seen at 768, 1024, 1280, 1440)

In the 'Rehberler' tiles, a fifth line of the excerpt is still drawn under the line-clamp ellipsis. At 1440 it reads '…klasik oranı ve evd…' and then 'yapımı bu rehberde.'; at 1280, tile 2 reads '…doğru su sıcaklığı ve evde…' and then 'matcha latte tarifi.'; at 768 and 1024 it happens the same way. Cause: the clamped `.t-small` sits in the `1fr` row of `.guide-tile-body` (grid-template-rows: auto 1fr auto), which stretches it to 98px (measured). Four 20px lines need only 80px, so overflow:hidden shows almost all of line 5. Phones are not affected because the tile stacks there.

- **Nerede:** src/styles/sections.css `.guide-tile-body .t-small` (l.459), inside `.guide-tile-body` (l.453)
- **Öneri:** `.guide-tile-body .t-small { align-self: start; }` (or `max-height: 80px`). The 1fr row still pins 'Devamını oku' to the bottom.

### [high] / @ 768–1023 (768x1024), landscape phone 844x390; 4px sliver at ≤767

The hero height formula doesn't match the bars above it.
- 768x1024: the hero ends at y=1072, so the title, link and 01/02/03 pager (y=1011–1040) are cut by the fold on first load. Between 768 and 1023px the sticky header also carries the quick-link chip row (48px), so the chrome is announce 32 + header 104 = 136px. `.hero-film` subtracts only --header-h + --announce-h (88px), and the extra `- 52px` correction applies only at ≤767px.
- Landscape phone 844x390: `min-height: 520px` puts the whole caption below the fold (hero bottom 656, title bottom 624).
- ≤767px: the `- 52px` is 4px more than the real 48px row, so the hero ends 4px short and a 4px white sliver of the next section shows under the film.

- **Nerede:** src/styles/home.css `.hero-film` (l.6-14) and `@media (max-width: 767px) .hero-film` (l.115-119). The chip row is chrome.css `.nav-quick`, hidden only at ≥1024px.
- **Öneri:** Add `--quick-h: 48px` to :root under `@media (max-width: 1023px)` (0 above that). Use one formula: `height: calc(100svh - var(--announce-h) - var(--header-h) - var(--quick-h, 0px))`, and drop the 767px `- 52px` override. Cap min-height to the available space, e.g. `min-height: min(520px, calc(100svh - var(--announce-h) - var(--header-h) - var(--quick-h, 0px)))`, or use about 360px under `@media (orientation: landscape) and (max-height: 500px)`.

### [high] / @ 360, 390 (all ≤767)

In the 'Şimdi barda' phone row, the first card's photo, price and name start at x=0, touching the screen edge. The section title, the 'Görseller temsilidir' note and the 'Tüm menü' button all sit on the 20px gutter, and Blue Bottle's phone row starts on the gutter too. Cause: the row has `scroll-snap-type: x mandatory` and `scroll-snap-align: start`, with the gutter as padding-inline but no scroll-padding. On load the browser snaps the first card to the scrollport edge (measured scrollLeft 20, first card x 0). At the end of the row the last card does end on the right gutter.

- **Nerede:** src/styles/sections.css `@media (max-width: 767px) .card-row` (l.80-97)
- **Öneri:** Add `scroll-padding-inline: var(--gutter);` to `.card-row` in that media block.

### [medium] / @ 768–1439 (seen at 768, 1024, 1280, 1440)

Regression from commit 26d59ec (09:32 today): the M/L price pairs in 'Şimdi barda' now break across two lines, '180₺ /' over '200₺' and '165₺ /' over '185₺'. This shows on Strawberry Matcha at 1440 and on most cards at 1280, 1024 and 768. The name wraps as well, so the card heads are ragged and the descriptions start at different heights. Cause: the commit sets `.p-card-head .t-price { white-space: normal }` at every width, but the column layout it was written for applies only at ≤767px and to `.product-grid--4` (the menu). The home `.card-row` keeps the name and price side by side from 768px up. In my 09:27 screenshots, before the commit, the price stayed on one line.

- **Nerede:** src/styles/sections.css l.491-508: `.p-card-head .t-price` (l.506), `.product-grid--4 .p-card-head` (l.501)
- **Öneri:** Give the home row the menu's layout: `.card-row .p-card-head { flex-direction: column; align-items: flex-start; gap: 2px; }`, so M/L sits under the name. Apply `white-space: normal` only inside the column layouts (`@media (max-width: 767px)` and `.product-grid--4`) and keep `nowrap` wherever the head stays a row.

### [medium] / @ all

The 'Rehberler' tiles are white panels (`.guide-tile { background: var(--surface) }`) on a white section, so the panel can't be seen. The title, excerpt and link float next to the photo, and because they are padded 32px 20px inside an invisible box they look indented off the grid. On a phone the text starts at x=40 under a photo at x=20; on desktop it starts 20px right of the image edge. Blue Bottle's 'Explore our brew guides' row is white tiles on the #f6f6f3 band. On our home page the bands alternate so that the guides section is a plain `.section`.

- **Nerede:** src/styles/sections.css `.guide-tile` (l.442); src/components/laffogato/home-page.tsx l.270 (guides `<section className="section">`)
- **Öneri:** Draw the tile on the band when its section is white: `.section:not(.section--band) .guide-tile { background: var(--band); }`. Alternatively put the guides section on the band and make the visit section white, which also fixes the merged-band finding.

### [medium] / @ all

'Bizi ziyaret edin' is a `section--band`, and the SEO/FAQ block right after it is also on the band (`.seo-block { background: var(--band) }`). At 1440 the two read as one 1904px band (y 6256–8160), with 192px of empty band (96 + 96 padding) between the visit card and 'SIKÇA SORULAN SORULAR', and nothing marking where one section ends.

- **Nerede:** src/styles/pages.css `.seo-block` (l.443); src/components/laffogato/home-page.tsx l.312-315 (visit section)
- **Öneri:** On the home page, put the SEO block on white: `.page-home + .seo-block { background: var(--bg); }` (the #sss section is the next sibling of `.page-home` inside main). Or swap the bands: visit on white, guides on the band.

### [medium] / @ all

The paragraph under 'L'AFFOGATO UYGULAMASI' describes the café, not the app: 'İtalya'dan ithal kahve barı konsepti. Tek-origin Sirena espresso'yu fior di latte gelato üzerine, 1994 patentli yenilebilir waffle kup içinde döküyoruz…'. Cause: `AppBlock intro` is filled from `content["home.hero.lede"]`, the panel field 'Ana sayfa giriş metni', which always has that default. As a result the app text written as the fallback ('Siparişini uygulamadan ver, hazır olunca gel al…') never shows.

- **Nerede:** src/components/laffogato/home-page.tsx l.110-112 (`splitLead(content["home.hero.lede"])`), l.265 (`intro=`), l.500-502
- **Öneri:** Stop passing the hero lede to AppBlock. Show the app text, or read a dedicated content key (e.g. `home.app.body`; adding it to CONTENT_FIELDS is a separate back-end PR). Note that the panel hint for home.hero.lede ('Slaytların altındaki tanıtım bandı… Boş bırakırsan bant gizlenir') is also out of date.

### [medium] / @ all (measured at 1440 and 390)

The 42% bottom shade isn't enough on the two bright clips. I measured each clip's frames with the caption hidden, at 4 moments per clip.
- Slide 2 (espresso into a glass over a white drip tray) at 1440: title 3.7:1 median and 2.9:1 on its brightest 10%; the inactive pager digits (12px, 72% white) 3.4–3.8:1.
- At 390: inactive digits 2.6–4.5:1 on slides 2–3; slide 3 title 4.6:1 median, 2.9:1 brightest.
12px text needs 4.5:1. Slide 1 passes (7–14:1).

- **Nerede:** src/styles/home.css `.hero-film-shade` (l.36-42), `.hero-film-dot` (l.81-89, color var(--on-dark-muted))
- **Öneri:** Make the shade taller and darker, e.g. `height: 50%; background: linear-gradient(to top, rgba(0,0,0,.62), rgba(0,0,0,.28) 45%, rgba(0,0,0,0));`. Set the inactive digits in full white (`color: var(--on-dark)`) and mark the current one by its underline only, or set the digits at 14px.

### [medium] / @ 360, 390 (and 768 touch)

Tap targets under 44px on the phone:
- hero link 'Menüyü gör' 87×22
- pager digits 26×24, 2px apart
- pause button 32×32
- karaoke free-hour chips (`a.tag`) 57×32
- 'Devamını oku' 87×20
- SEO chip links 32px tall
- SEO phone and e-mail links 18px tall
- the 'Daha fazlası - Rehber' label link 14px tall

- **Nerede:** src/styles/home.css `.hero-film-link` (l.70), `.hero-film-dot` (l.81), `.hero-film-pause` (l.95); src/styles/foundation.css `.tag` (l.407), `.link-u` (l.345); src/styles/pages.css `.chip-link` (l.494) and the `.seo-facts` links
- **Öneri:** Under `@media (max-width: 767px)`:
- `.hero-film-dot { min-width: 44px; min-height: 44px; }`
- `.hero-film-pause { width: 44px; height: 44px; }`
- `.hero-film-link { padding-block: 11px; }`
- `.tag, .chip-link { min-height: 44px; }`
- `.link-u { padding-block: 12px; margin-block: -12px; }`, which keeps the visual rhythm
- `display: inline-block; padding-block: 13px` on the SEO links

### [low] / @ all (verified at 390 with autoplay refused, simulated)

When the browser refuses autoplay (e.g. iOS Low Power Mode), the button reads 'Videoyu oynat' but the first tap does nothing; a second tap plays the film. Cause: `toggle` flips `userPaused` without looking at the real state. The first tap moves it from false to true, which pauses an already paused video. Only the second tap sets it back so play() runs. I verified this with a play() stub that rejects without user activation: after tap 1 the video was still paused with label 'Videoyu oynat'; after tap 2 it was playing.

- **Nerede:** src/components/laffogato/home-hero.tsx l.163 (`toggle`) and the button at l.245-262
- **Öneri:** Decide from `playing`: `const toggle = () => { if (playing) setUserPaused(true); else { setUserPaused(false); videoRefs.current[index]?.play()?.catch(() => {}); } };`. Calling play() inside the tap keeps the user activation.

### [low] / @ 1024, 1280, 1440

The hero caption uses a fixed 32px inset, while the header links and icons and every section below align to --gutter (43px at 1024, 54px at 1280, 60px at 1440). The title starts 28px left of the 'MENÜ' link above it, and the pause button ends about 30px right of the bag icon. At 32px the title is also bigger than every other heading (section titles are 24/32) and off the type scale (line-height 1.2), whereas the Good Boy Bob reference title is small.

- **Nerede:** src/styles/home.css `.hero-film-caption` (l.43-53), `.hero-film-title` (l.54-64)
- **Öneri:** `.hero-film-caption { padding: 0 var(--gutter) 32px; }`. Optionally set the title to `font-size: 24px; line-height: 32px` so it sits on the scale.

### [low] / @ all

`.hero-film-title` has `text-shadow: 0 1px 12px rgba(0,0,0,.2)`. My DOM audit found it is the only shadow left on the page; the design language allows no shadows, and the hero's bottom shade is the one permitted legibility aid.

- **Nerede:** src/styles/home.css `.hero-film-title` l.63
- **Öneri:** Remove the text-shadow and rely on the strengthened `.hero-film-shade` from the contrast finding.

### [low] / @ 360, 390

With motion allowed, the phone controls row has three children under `justify-content: space-between`, so the 01/02/03 pager floats in the middle of the row (x≈181–253 at 360), between the link and the pause button. With reduced motion there is no pause button and the same pager sits at the right edge. The brief places pager and pause together at the bottom right.

- **Nerede:** src/styles/home.css `@media (max-width: 767px) .hero-film-controls` (l.126-129)
- **Öneri:** In that block use `justify-content: flex-start` and add `.hero-film-pager { margin-left: auto; }`, so the link stays left and pager + pause sit together on the right.

### [low] / @ all

The title that changes with each slide is `aria-live="polite"`, so a screen reader announces a new title about every 8 seconds while the film plays. The WAI-ARIA carousel pattern turns the live region off while slides rotate automatically. The slides also lack role="group" and aria-roledescription="slide" under the section's carousel roledescription.

- **Nerede:** src/components/laffogato/home-hero.tsx l.223 (`<p className="hero-film-title" aria-live="polite">`) and the `.hero-film-slide` divs
- **Öneri:** Use `aria-live={playing ? "off" : "polite"}`, and add `role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${slides.length}`}` to each slide.

### [low] / @ all

The App Store button in the app block is 156px wide at every width (measured at 1440 and 390). Every other button on the page is 350px on desktop and full width on a phone. Cause: its `min-width: min(350px, 100%)` and the phone `width: 100%` are measured against `.app-links`, which shrinks to fit its content because `.app-block-copy` has `justify-items: start`.

- **Nerede:** src/styles/home.css `.app-block-copy` (l.139-143), `.store-btn` (l.152-162), `@media (max-width: 767px) .store-btn` (l.206-211)
- **Öneri:** Add `.app-block-store { justify-self: stretch; }` so `.app-links` takes the whole column. Then `width: 100%` works on phones and `min(350px,100%)` resolves on desktop.

### [low] / @ all

The 'Ziyaret bilgileri' button changes width oddly. At 1024px and up it is about 180px wide, because its auto grid column collapses `min(350px,100%)`. At 768 the single-column grid stretches it to 696px. On every width `.visit-card { padding-inline: 4px }` insets it 4px from the photo edges (24–336 against 20–340 at 360). No other button on the page behaves like this.

- **Nerede:** src/styles/home.css `.visit-card` (l.248-255) and `@media (max-width: 1023px) .visit-card` (l.264-269)
- **Öneri:** From 768px up: `.visit-card .btn { min-width: 350px; justify-self: start; }`. At ≤767: `justify-self: stretch` and move the 4px padding onto the text column only.

### [low] / @ 1024–1440

Open FAQ answers run the full 1320px container width at 15px, about 190 characters per line at 1440. The sizes are also off the type scale: answers are 15px/24px and the lede 16/24, against 16/22 for body text and 14/20 for small text.

- **Nerede:** src/styles/pages.css `.seo-faq details p` (l.436-440), `.seo-block-lede` (l.459-463)
- **Öneri:** `.seo-faq details p { max-width: 72ch; font-size: 16px; line-height: 22px; }` and `.seo-block-lede { line-height: 22px; }`.

### [low] / @ 1024–1199

At 1024 the app block's photo (6:5 at 58% width, 453px tall) ends about 210px above the bottom of the text column (title, body, store button, three ruled points). That leaves an empty block of band under the photo and the two columns look unbalanced. It looks fine from 1280 up.

- **Nerede:** src/styles/home.css `.app-block` (l.133-138) and its `@media (max-width: 1023px)` block (l.198-205)
- **Öneri:** Stack the block up to 1199px by raising that breakpoint, or at 1024–1199 use `align-items: center` or let `.app-block-media` stretch to the column height.

### [low] / @ 360, 390

Three bad line breaks on phones:
(a) the 'Evde L'Affogato' product name breaks as 'SİRENA ESPRESSO BLEND 250' with 'G' alone on the next line, at both 360 and 390;
(b) at 360 the karaoke facts line wraps so that a separator starts the line ('· RUBY üyelere %15 indirim');
(c) at 360 the SEO e-mail 'info@nextgenlab.com.tr' runs 4px past its grid column into the gutter (x 192–344 against a column edge at 340).

- **Nerede:** src/components/laffogato/home-page.tsx l.435 (TakeHome `.t-title`) and l.569 (`lines.join(" · ")`); src/styles/pages.css `.seo-facts` (l.464)
- **Öneri:** (a) `.feature-copy .t-title { text-wrap: balance; }` plus a non-breaking space between the quantity and its unit. (b) Render each fact in its own `white-space: nowrap` span, with the separator attached to the item before it. (c) `.seo-facts a { overflow-wrap: anywhere; }`.

### [low] / @ all

Straight and curly apostrophes are mixed in display copy (9 straight, 13 curly on the page). 'EVDE L'AFFOGATO', 'L'AFFOGATO UYGULAMASI', 'TUZLA'DA…' and the FAQ questions use the straight ' (U+0027). 'L’AFFOGATO HAKKINDA MERAK EDİLENLER' and the body copy use ’. So the brand name appears in two forms in titles a few sections apart.

- **Nerede:** src/components/laffogato/home-page.tsx l.433 and l.498 (`L&apos;`); the HERO_SLIDES titles in home-hero.tsx; the FAQ questions in src/lib/seo/faq.ts
- **Öneri:** Use ’ (&rsquo;) everywhere in customer-facing copy.

### [low] / @ all

The photo badge reads 'YENİ' (and 'İMZA') in capitals, set in the text face at 12px. The reference's badge is sentence case in the text face ('Best Seller'), and the design language keeps capitals for the tracked headline face.

- **Nerede:** src/components/laffogato/page-shared.ts MENU_TAG_LABELS (l.23-26); src/styles/foundation.css `.badge` (l.632)
- **Öneri:** Use sentence-case labels 'Yeni' / 'İmza'. If capitals are wanted, set `.badge` in the headline face with the 1.6px tracking instead.

### [low] / @ all

Each 'Şimdi barda' card link has `aria-label="<name>, <category> menüsünde"`. That label replaces the card's content for screen readers, so the price and description are never read out.

- **Nerede:** src/components/laffogato/home-page.tsx l.151-155
- **Öneri:** Drop the aria-label, since the h3 name already leads the link text. Or include the price: `${name}, ${price}, ${catLabel} menüsünde`.

> Denetçi notu: Commit 26d59ec landed at 09:32, while I was reviewing. It changed `.p-card-head` in sections.css and causes the price-wrap finding. My full-*.png shots were taken at 09:27, before it; the sec/*, full2-*, cardrow-* and interaction shots were taken after it, and every card-row finding was checked against the post-commit tree.

What passed: no horizontal overflow at any width; no rounded corners, box-shadows, blur, old cream/amber/espresso colours or serif/Abril fonts anywhere on the home page. The only gradient is the hero shade and the only shadow is the hero title's text-shadow (reported). Section padding is a consistent 96px on desktop and 56px on phones, and every title sits 32px above its content. Section titles are 24px (20px on phones) in uppercase Archivo at weight 400. Hover and focus states are visible. On desktop and on phones (≤767) the hero fills the space under the header (4px short on phones, reported); it overflows at 768–1023px and on landscape phones (reported). The video plays, its time advances and the pause button toggles it.

Scripts are in /tmp/claude-0/-home-user-laffogato/eb5d3011-e51d-599e-a65a-cf7f6e123d46/scratchpad/qa/review/home/: hero.cjs, video.cjs, contrast.cjs, sections.cjs, audit.cjs, interact.cjs, refused.cjs, land.cjs, cardrow.cjs, probe.cjs.

### [medium] /hikayemiz, /magaza (footer on every page) @ 1024 (cramped up to 1279)

From 1024 to 1279px the footer keeps the desktop grid: four link columns plus a 410px newsletter column. Each link column is only 92px wide at 1024 (109 at 1100, 132 at 1200, 150 at 1279). At 1024 the address runs over six lines, the phone number breaks across two lines ('+90 536 429 / 09 19', up to about 1199px), 'info@nextgenlab.com.tr' sticks 60px into the ÜYELİK column (still 20px at 1200), and most KURUMSAL items wrap. The footer looks broken on tablet landscape and small laptops.

- **Nerede:** src/styles/chrome.css .footer-main (grid-template-columns: minmax(0,1fr) minmax(0,410px)) and the @media (max-width: 1023px) block that stacks it
- **Öneri:** Raise the stacking breakpoint so the newsletter goes under the links below 1280: @media (max-width:1279px){.footer-main{grid-template-columns:1fr;gap:48px}}. That keeps the four link columns at about 210px each at 1024. As guards, add white-space:nowrap to the tel: link and overflow-wrap:anywhere to .footer-col-list li.

### [medium] search panel (opened on /hikayemiz, /magaza) @ 360, 390

A no-results query with no spaces (a pasted code, 'yenilebilirkupakutusu…') never wraps. The uppercase title '“…” İÇİN SONUÇ YOK' is 486px wide on a 360px screen, so the panel scrolls sideways (scrollWidth 502). .search-empty is an auto-sized grid, so the sub-line and the chips are centred on that 486px track: 'Başka bir kelime dene ya da bunlardan bir…' and the last chip are cut off at the right edge.

- **Nerede:** src/styles/catalog.css .search-empty, .search-empty-title
- **Öneri:** .search-empty{grid-template-columns:minmax(0,1fr)} .search-empty-title{overflow-wrap:anywhere;max-width:100%}. Optionally clip the echoed query to about 40 characters in search-overlay.tsx.

### [medium] /hikayemiz (any page, first visit before the cookie choice) @ 390, 360

The burger sheet (z-index 45) opens under the cookie strip (z-index 70). Expand MENÜ and scroll the sheet to its end: ZİYARET & KEŞFET and the account links (Hesabım, Siparişlerim, Uygulamayı indir) stay under the 252px strip. A tap where 'Uygulamayı indir' sits lands on the strip's 'Tümünü kabul et' button. The sheet's 40px bottom padding cannot clear the strip, so every first-time phone visitor loses the end of the menu.

- **Nerede:** src/styles/chrome.css .mobile-sheet.open {z-index:45} vs .cookie-banner {z-index:70}; .sheet-account padding
- **Öneri:** Hide the strip while the sheet is open (html:has(.mobile-sheet.open) .cookie-banner{visibility:hidden}). Or pad the sheet by the strip's height: html:has(.cookie-banner) .mobile-sheet.open{padding-bottom:260px}, or have cookie-consent.tsx publish the strip height as a CSS variable.

### [medium] /magaza, /hikayemiz (cart drawer, quick look then cart, search) @ 1440, 390

Three focus bugs in the shared dialog hook, each checked with the keyboard. (1) In the cart drawer, pressing − / + or 'Sil' moves focus to 'Kapat', so a keyboard user cannot press + twice. Cause: useDialog's effect depends on onClose, and app.tsx passes a new inline onClose on every render. Each cart change re-runs the effect, which records the opener again and focuses the first control. (2) 'Sepete ekle' in the quick look opens the drawer and focuses 'Kapat'. The closing modal's restore effect then runs and puts focus back on the product card behind the open aria-modal drawer. (3) Closing search (Esc or Vazgeç) leaves focus on <body>. The input's autoFocus fires before the effect, so the recorded opener is the input itself, which is unmounted on close.

- **Nerede:** src/components/laffogato/use-dialog.ts (deps [open, onClose, panelRef], about line 80; opener read from document.activeElement inside the effect); src/components/laffogato/app.tsx lines 383/392/400 (inline onClose); src/components/laffogato/search-overlay.tsx line 361 (autoFocus)
- **Öneri:** In useDialog, keep onClose in a ref (closeRef.current = onClose) and depend on [open] only. Skip the restore when focus is already inside another open dialog: if (document.activeElement?.closest('[aria-modal="true"]')) return. Remove autoFocus from the search input; useDialog already focuses it because it is the panel's first focusable element.

### [medium] /magaza, /hikayemiz (cart drawer; same for the shop filter sheet) @ 1440, 390

With prefers-reduced-motion: reduce, opening the cart drawer (bag button or 'Sepete ekle') leaves focus on the button behind it. The drawer is announced as an aria-modal dialog, but keyboard and screen-reader focus never enters it. Without reduced motion, focus does move to 'Kapat'. Likely cause: the global reduced-motion rule forces transition-duration to 0.01ms !important. That turns the drawer's instant 'visibility 0s' switch into a tiny transition that starts at hidden. useDialog calls focus() in the same tick, before the close button is focusable. .sheet uses the same transition.

- **Nerede:** src/styles/foundation.css @media (prefers-reduced-motion: reduce) (lines 688-697); src/styles/catalog.css .sheet/.cart-drawer and their .open transitions; use-dialog.ts initial focus
- **Öneri:** @media (prefers-reduced-motion: reduce){.cart-drawer,.sheet,.cart-drawer.open,.sheet.open{transition:none !important}}. Also defer the initial focus in useDialog: requestAnimationFrame(() => (first ?? panel)?.focus()).

### [medium] /?cart=empty (any /?cart=… or /?hesap=silindi notice from the shell) @ 1440, 390

The shell's notice toast is left over from the previous design: a black (#000, not charcoal) full pill (border-radius 999px) with a drop shadow (var(--shadow-lg) resolves to Tailwind's shadow), 13px text and a round, translucent 24px close button. It is fixed at top:96px. On a phone it sits on the quick-link chips (covering Karaoke and Mağaza); on desktop it straddles the bar's bottom edge right under the logo. The degraded-mode strip next to it (DegradedNotice) is also black with 13px text.

- **Nerede:** src/components/laffogato/app.tsx: the role="alert" inline-styled block (about lines 404-452) and DegradedNotice (lines 74-91)
- **Öneri:** Move both to a CSS class in chrome.css: square corners, background var(--charcoal), no shadow, 14px/20px text, and a square icon-btn with the drawn X as the close. Place it under the sticky header: top: calc(var(--header-h) + 12px) on desktop and below the chips row under 1024px. Alternatively, render it as a full-width band under the header.

### [medium] /hikayemiz, /magaza (phone chrome) @ 390, 360

Many phone chrome controls are shorter than 44px: quick-link chips 36px; sheet sub-links 42px; sheet account links 37px; account-menu items 32px; search tags 32px and 'Vazgeç' 37px; cart −/+ 32×32, 'Sil' 16×21 and the cart close 32×32; cookie-modal buttons 36px and its close 28-32px; footer links 18px (on 28px rows) and footer social icons 20×20; the announcement 'Kampanyalar' link 72×16; 'Başa dön' 14px tall.

- **Nerede:** foundation.css .chip, .icon-btn--boxed, .btn-sm; chrome.css .sheet-sub a, .sheet-account a, .nav-account-item, .footer-col-list li, .footer-social a, .announce-link, .cookie-modal-close; catalog.css .search-chip, .search-close, .cart-qty-stepper button, .cart-item-remove
- **Öneri:** Below 1024px, give each control a 44px hit area without changing how it looks. Use min-height:44px with inline-flex centring for chips, tags and links (or padding plus a negative margin). .cart-qty-stepper button{width:44px;height:44px}. .cart-item-remove and .footer-social a: padding:12px; margin:-12px. .footer-col-list a{display:inline-block;padding-block:12px} with less li padding. .icon-btn--boxed: position:relative plus a ::after with inset:-6px.

### [medium] SPA routes (/magaza, /hikayemiz, /menu, /ziyaret, /) @ all (1440 shown)

In next dev, every full page load of an SPA route empties the stored cart. A cart seeded in localStorage before load (as member.cjs withCart=1 does) or built in the shop is gone after a reload: the bag reads 'Sepet, boş' and laffogato_cart_v1 is removed. Cause: the hydration effect sets hydratedRef.current = true before the write-back effect's first run. That first run sees the initial cart = [] and calls removeItem, and StrictMode's second mount then reads the emptied storage. In production the same order removes the key and writes it back one render later, which sends two storage events to other open tabs. Note for QA: SPA-page cart screenshots taken with member.cjs withCart=1 show an empty cart.

- **Nerede:** src/components/laffogato/app.tsx: hydration effect (lines 186-224, setCart(readStoredCart()) then hydratedRef.current = true) and write-back effect (lines 228-238, if (!hydratedRef.current) return; … removeItem)
- **Öneri:** Gate the write-back on state that changes in the same batch as setCart(stored): useEffect(() => { if (!mounted) return; … }, [cart, mounted]). Alternatively, let the write-back effect skip its own first run before trusting the ref.

### [low] /hikayemiz (phone sheet; cookie preferences modal) @ 390 (sheet); 1440, 390 (cookie modal)

The phone menu sheet does not behave as a dialog. After its last link, Tab moves into the page hidden behind it ('Menüyü gör', then footer links), because main and the footer are not inert. The cookie preferences modal is aria-modal, yet Tab leaves it after 'Tümünü kabul et' (to the skip link, announcement and nav). It also does not lock scrolling: a mouse wheel scrolled the page 600px behind it.

- **Nerede:** src/components/laffogato/chrome.tsx #mobile-sheet; src/components/laffogato/cookie-consent.tsx .cookie-modal
- **Öneri:** Build both on useDialog (Tab loop, Escape, scroll lock, focus return), or set inert on main and footer while they are open. Give the sheet role="dialog" aria-modal="true" aria-label="Menü".

### [low] /hikayemiz, /magaza (desktop bar, keyboard) @ 1440, 1280

The keyboard caret (.nav-caret) is absolutely positioned inside the 24px gap between links. When it has focus, its 2px outline (2px offset) covers the Ü of MENÜ and touches the M of MAĞAZA. After a panel opens from the caret, the next Tab goes to MAĞAZA rather than into the panel. #nav-panel comes after the logo, search, account and bag in the DOM, so its first link is nine Tabs away.

- **Nerede:** src/styles/chrome.css .nav-caret (position:absolute; right:-18px) and .nav-links > ul {gap:24px}; src/components/laffogato/chrome.tsx (#nav-panel rendered after .nav-quick)
- **Öneri:** Give the caret its own space (position:static; margin-left:4px; widen the gap to 28-32px) or use outline-offset:0. When the caret opens a panel, move focus to the panel's first link, or render #nav-panel straight after the <nav className="nav-links"> in DOM order.

### [low] /magaza (any section page) @ 1440, 1280

The current-page marker and the open/hover state use the same underline. Hovering MENÜ on /magaza underlines both MENÜ and MAĞAZA (likewise ZİYARET & KEŞFET and MAĞAZA), which reads as two open items.

- **Nerede:** src/styles/chrome.css .nav-link:hover, .nav-link.is-open, .nav-link[aria-current="page"]
- **Öneri:** Drop the current-page underline while another item is open or hovered: .nav-links:has(.nav-link.is-open, .nav-link:hover) .nav-link[aria-current="page"]:not(.is-open):not(:hover){text-decoration-line:none}.

### [low] /magaza (mega panels) @ 1440, 1280

In the MENÜ panel, the first six categories carry an Italian sub-line and the last six (MENU_MORE) carry none. Rows 1-2 are 44px tall and rows 3-4 are 22px, so the grid changes rhythm halfway down. The panel also stays open while the pointer rests on the logo, search, account or bag; only leaving the header or hovering KARAOKE closes it.

- **Nerede:** src/components/laffogato/chrome.tsx panelLinks('menu') (MENU_MORE has sub: '') and NavPanel; the header's onMouseLeave; chrome.css .nav-panel-list
- **Öneri:** Give the MENU_MORE entries a sub-line, or render them as a separate compact group (for example a fourth column 'Diğer' with label-only rows). Close the panel on onMouseEnter of .nav-brand and .nav-tools, as KARAOKE already does.

### [low] /hikayemiz (account menu, guest and member) @ 1440, 390

The account card hangs from the 44px icon (top: calc(100% + 8px)). On desktop its top edge starts 12px inside the header band (y=104, while the band ends at 116). On a phone it lands across the quick-link chips row, leaving chip pieces ('Menü' on the left, '…panyalar' on the right) on both sides of the card.

- **Nerede:** src/styles/chrome.css .nav-account-menu
- **Öneri:** Hang the card from the bar's bottom edge instead of the icon (desktop: top: calc(100% + 20px), or position it against .site-header). Under 1024px, make it a full-width panel under the whole header (fixed, left:0, right:0, top at the header bottom, hairline border-top), or hide the chips row while it is open.

### [low] /magaza, /hikayemiz (desktop bar) @ 1280-1439 (1366, 1400)

To keep clear of the logo, the nav drops to 14px with 1.2px tracking across the whole 1280-1439 band. 16px/1.6px already fits from about 1360px (44px gap to the logo at 1366; 78px at 1440). The most common laptop widths therefore get a nav smaller than the language's 16px. No collision was found anywhere in 1280-1439 (smallest gap 81px).

- **Nerede:** src/styles/chrome.css @media (min-width:1280px) and (max-width:1439px)
- **Öneri:** End the step at max-width:1359px, or use fluid values such as font-size: clamp(14px, 0.65vw + 7.5px, 16px) with letter-spacing scaled from 1.2px to 1.6px.

### [low] /hikayemiz (every page) @ 1600, 1920 (outside the requested widths)

The bar's container is 120px wider than the page container (.nav max-width = content + 2×gutter + 120px). From about 1560px, the links and the bag sit 60px outside the content edges: first link at x=240 against content at x=300 at 1920, and 80 against 140 at 1600. At 1440 and below they line up.

- **Nerede:** src/styles/chrome.css .nav {max-width: calc(var(--content) + 2 * var(--gutter) + 120px)}
- **Öneri:** Use the same width as .wrap: max-width: calc(var(--content) + 2 * var(--gutter)).

### [low] /hikayemiz, /magaza (phone bar) @ 390, 360 (and 320)

The four quick-link chips need 402px. At 390 only a 12px sliver of 'Kampanyalar' is clipped, which reads as a mistake rather than a hint to scroll. Once scrolled, the last chip sits flush against the screen edge, because the row's right gutter is outside the scroll area (scrollWidth 402 = 20px left padding + 382px of chips). At 320 the three 44px icons no longer fit their 1fr column, and the search button's box starts right at the logo's edge (x=170).

- **Nerede:** src/styles/chrome.css .nav-quick (padding is on the scroller), .nav-quick ul; .nav grid and .nav-tools
- **Öneri:** Put the gutter inside the scrolling content: .nav-quick{padding-inline:0} .nav-quick ul{padding-inline:var(--gutter);width:max-content}. Then either tighten the chips at ≤400px (padding-inline:12px makes all four fit at 390) or let the last chip visibly bleed off the edge. At ≤340px, set .nav-tools gap to 0 and use 40px icon buttons.

### [low] /hikayemiz (burger sheet) @ 390, 1024

While the sheet is open, the quick-link chips stay visible above it. The navigation appears twice and the sheet starts 48px lower than the bar. .site-header.is-sheet-open is set but no CSS uses it. From 768 to 1279px the same phone list spans the full width: at 1024 the labels sit at the left edge and their chevrons are about 930px away.

- **Nerede:** src/styles/chrome.css .mobile-sheet.open and .nav-quick; src/components/laffogato/chrome.tsx (header class is-sheet-open)
- **Öneri:** .site-header.is-sheet-open .nav-quick{display:none}, and re-measure --sheet-top after hiding the row. At ≥768px, cap the sheet width (max-width:480px; right:auto; border-right:1px solid var(--line)) and dim the rest with a scrim.

### [low] all (cart drawer, cookie strip, phone sheet) @ 390 (iPhone with home indicator)

layout.tsx sets viewportFit: 'cover', but the fixed chrome at the bottom of the screen never adds env(safe-area-inset-bottom). The cart's 'Ödemeye geç' (20px from the bottom), the cookie strip's 'Tümünü kabul et' and the sheet's last links can end up under the iPhone home indicator. Found from the code; there is no iOS emulation here. checkout.css and karaoke.css already pad their sticky bars this way.

- **Nerede:** src/styles/catalog.css .cart-drawer-foot, .sheet-foot; src/styles/chrome.css .cookie-banner, .sheet-account
- **Öneri:** padding-bottom: calc(20px + env(safe-area-inset-bottom)) on those four. In landscape, also use max(var(--gutter), env(safe-area-inset-left/right)) for the bar's side padding.

### [low] /hikayemiz, /magaza @ 1440 (classic scrollbars)

On desktops with classic scrollbars (Windows, many Linux setups), opening search or the cart drawer hides the scrollbar (body.is-no-scroll {overflow:hidden}). The whole page behind it, header included, jumps right by 7-15px: measured logo x 686 → 693, bag 1331 → 1346, with the scrollbar shown.

- **Nerede:** src/styles/chrome.css body.is-no-scroll; foundation.css html
- **Öneri:** html { scrollbar-gutter: stable; }

### [low] /ziyaret#marina (from the ZİYARET panel, the sheet and the footer's 'L'Affogato Marina'); also 'Başa dön' (#main) @ 1440, 390

Nothing offsets in-page jumps for the sticky header, so targets land underneath it. Following the chrome's own 'L'Affogato Marina' link puts the #marina card's top at y=0, with its first 84px (desktop) or 104px (phone: bar plus chips) hidden behind the header.

- **Nerede:** src/styles/foundation.css html
- **Öneri:** html{scroll-padding-top:84px} @media (max-width:1023px){html{scroll-padding-top:104px}}. Better, define a single --sticky-h token and use it in both places.

### [low] search panel @ 1440, 390

(a) The key hints in the panel's foot are bare <kbd> elements (Tailwind preflight gives them ui-monospace and no box), so '↑↓ gezin ↵ aç esc kapat' reads as unstyled text. The 'esc' chip next to Vazgeç is 11px monospace. (b) The five 'Hızlı geçiş' tiles sit in a four-column grid, leaving ZİYARET alone on a second row at 1440. These icon tiles have no counterpart in the reference, which shows 'Most popular' product cards in that spot. (c) On phones the search bar and body use a 16px side gutter; the rest of the site uses 20px.

- **Nerede:** src/styles/catalog.css .search-foot (kbd), .search-close-kbd, .search-quick, and @media (max-width:767px) .search-bar/.search-body; search-overlay.tsx QUICK
- **Öneri:** Style .search-foot kbd like .search-close-kbd (1px hairline box, 1px 6px padding, 12px), or drop the foot, which the reference does not have. At ≥1024px use .search-quick{grid-template-columns:repeat(5,minmax(0,1fr))}, or swap the tiles for a three-up row of popular product cards as in the reference. Pad .search-bar and .search-body with var(--gutter) on phones.

### [low] cookie strip and preferences modal (first visit, any page) @ 1440, 390, 360

The cookie controls are the only chrome buttons off the language's button spec. Strip buttons: 13px text, 10px 16px padding, 44px tall. Modal buttons: btn-sm, 14px, 36px tall. Strip text (13px/19px) and category titles (13px) are also off the 12/14/16 scale. The modal's close is a text '×' in a 32px box, while the cart uses the drawn X, and at 360 it shrinks to 28px wide because the modal head is a flex row. The modal keeps 32px padding on a 328px phone. 'ÇEREZ TERCİHLERİ', 'ZORUNLU ÇEREZLER' and 'Her zaman açık' wrap to two lines, and the action buttons fall below the modal's visible area.

- **Nerede:** src/styles/chrome.css .cookie-banner-actions .btn, .cookie-banner-text, .cookie-cat-title, .cookie-modal, .cookie-modal-close; src/components/laffogato/cookie-consent.tsx (btn-sm classes, the '×' glyph)
- **Öneri:** Use the standard .btn (16px text, 48px tall; padding-inline:24px is enough on the strip). Set the strip text to 14px/20px and category titles to the 12px t-label style. Make the close an icon-btn icon-btn--boxed with the SVG X and flex-shrink:0. Add @media (max-width:599px){.cookie-modal{padding:24px 20px}}.

### [low] /hikayemiz (bag button with items) @ 390, 1440

The bag's item count is 10px Geist in a 16px dot. That is below the 12px minimum and hard to read on a phone.

- **Nerede:** src/styles/chrome.css .nav-cart-count
- **Öneri:** Use 12px/18px text in an 18-20px dot (min-width 18px), or print the count inside the bag outline as the reference does.

### [low] footer newsletter (every page) @ 1440, 390

The newsletter consent box is the browser's native checkbox (appearance auto, accent-color white): a default white box with rounded corners on the charcoal block, and the only rounded element in the footer.

- **Nerede:** src/styles/chrome.css .newsletter-consent input (and foundation.css input[type="checkbox"])
- **Öneri:** Draw it in the language: appearance:none; 18px square; 1px solid var(--on-dark); border-radius:0; transparent ground. Add a checked state (var(--on-dark) fill with an SVG tick mask) and keep the white focus outline.

### [low] cart drawer, empty (/magaza, /hikayemiz) @ 1440, 390

The empty drawer holds the title, one sentence and the button at the top, then about 650px of empty band. The reference's empty cart fills the sheet with 'We think you may like' product cards and keeps 'Return to shop' at the bottom.

- **Nerede:** src/components/laffogato/ui.tsx CartDrawer empty state; src/styles/catalog.css .cart-empty
- **Öneri:** Add a 'Beğenebileceklerin' row of two or three product cards (CartDrawer already receives products). Move 'Mağazaya dön' into a bottom slot styled like .cart-drawer-foot.

> Denetçi notu: All screenshots and Playwright scripts are in /tmp/claude-0/-home-user-laffogato/eb5d3011-e51d-599e-a65a-cf7f6e123d46/scratchpad/qa/review/chrome/. Run the scripts with NODE_PATH=/opt/node22/lib/node_modules, because playwright is installed globally and not in the repo. No repository file was edited and the dev server was not touched; the four modified docs in git status were already changed by the parent session.

What passed:
- **Sticky header:** works at every width. The announcement line scrolls away; the bar sticks at top:0 (84px at 1024 and up, 56px bar plus 48px chips below 1024).
- **Logo collision:** none anywhere from 1280 to 1439. The smallest gap is 81px at 1280 with the 14px nav, and 78px at 1440 with the 16px nav.
- **Looks right:** no shadows, blur, rounded buttons or serif type in the header, panels, sheet, drawer, search or footer. The one leftover is the notice toast in app.tsx, reported above.
- **Horizontal scroll:** none on /hikayemiz or /magaza at 360 and 390, except the long search query, reported above.

Things to know:
- **Transient width reading:** the very first header run reported a window width of 393/408px on /magaza at 360/390 (a hint of horizontal overflow, not a measured overflow). It did not come back in three re-runs, so I treated it as a dev-compile artefact; it was not the chrome either way.
- **Cart seeding:** seeding the cart before page load, the way member.cjs withCart=1 does, leaves SPA pages with an empty cart in dev (finding 8). Other reviewers' SPA cart screenshots made that way will show 'Sepetin boş'. I seeded after mount instead, by writing localStorage and dispatching a storage event.
- **Not a mega-menu reference:** bb-mega.jpg and the top panel of bb-interact.jpg show the header only, not an open panel. The mega panel was judged against the language, not a screenshot.
- **Safe-area finding:** comes from the code; there is no iOS emulation here to confirm it on screen.
