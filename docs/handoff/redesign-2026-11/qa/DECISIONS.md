# Redesign decision record (21-22 Kas 2026) — for the docs update

Branch: claude/peaceful-ramanujan-3os0qj (base 4962da2 = main at start). `git diff 4962da2..HEAD` is the whole change.

## Operator's words (Turkish, quote verbatim where docs quote the operator)
1. "sitedeki tüm ölü cssleri sil ve sana tasarım verecğeim hatta tüm tasarım dosyalarını vs. temizle sna yeni tasarım örneği atacağım site ordan tek tek çekeceksin" → chose "Sıfırla, iskelet kalsın".
2. "burdaki herodaki videoyu birebir çek kullan https://goodboybob.com/ ve bu site tasarımını da birebir al bize uygun olan görselleri de çek marka belirtilmeyen premiuum olsun her şeyi birebir uyarla ve bizde olan özellikleri de bu tasarımlara göre yap https://bluebottlecoffee.com/us/eng ... tasarımdaki overlapler testler vs. yaptıktan sonra karaoke sayfasının wizardını falan ona göre ayarla ve mobil versiyonlarına da aşırı dikkat et." (also: push to main when everything is done)
3. "sen benim yaptığımı sil sana verdiğim sitelerdeki ile birebir git 1:1 lütfen bendeki her tasarımı sil elementi verdiklerimden al ve onlarla uyumlu git olmayanlrı da sana attığım bluebotter sitesi ile uyumlu oluştur."

## What was NOT copied (and why) — keep this in the docs
The reference companies' assets are theirs: Good Boy Bob's hero films, Blue Bottle's photographs, logo/bottle mark, and their licensed typefaces (Blue Bottle uses Dinamo's ABC Marfa + ABC Diatype, commercial licences). Only the design LANGUAGE was taken (layout, type scale and treatment, spacing, components, interactions). Same policy as before: the 11 Kas roast restyle took "nothing but proportions"; the journey film avoided a reference's final frame because it was another company's logo.

## The new language (src/styles/foundation.css tokens)
- --bg #ffffff, --band #f6f6f3, --surface #fff, --ink #000, --muted #6c6864 (5.5:1 on white, 5.1:1 on the band), --charcoal #333333 (filled buttons, footer; white on it 12.6:1), --charcoal-deep #1f1f1f (hover), --line #dcdcd6, --line-strong #333, --error #b42318, --success #1f6b4a, --on-dark #fff, --on-dark-muted rgba(255,255,255,.72).
- Type: --headline = Archivo (next/font, variable wdth/wght; used at `font-variation-settings: "wdth" 118`, weight 400, uppercase, letter-spacing 1.6px = --track); --sans/--display = Geist. next/font variable names kept: --font-display (Geist), --font-headline (Archivo) because the admin's site preview reads them. Older names (--display, --serif, --mono) resolve; the admin repoints --sans/--display/--headline/--serif/--mono to Inter inside its wrapper (unchanged).
- Scale: section titles 24/32 (20/28 phone), card titles 16/22, labels 12/24, prices 14/20, body 16/22, small 14/20 muted, micro 12/16. Classes: .t-display .t-title .t-label .t-kicker .t-price .t-nav .t-body .t-small .t-micro .t-muted.
- Controls: .btn (48px, 12px 36px, 1px #333 edge, radius 0) + .btn-dark (= .btn-primary/.btn-ink/.btn-amber legacy aliases) + .btn-wide (350px; full width on a phone) + .btn-block + .btn-light (on dark); .chip (pill, the phone quick links and category chips), .tag (square filter tag), .icon-btn(--boxed), .link-u (underlined small link), .input/.select/.textarea.
- Layout: --gutter clamp(20px, 4.2vw, 60px); --section-y clamp(56px, 6.7vw, 96px); --content 1320px; header 84px (56px <1024) + 32px announcement line.
- Square corners, no shadows, no blur, no gradients (except the hero's bottom shade).
- CSS files: src/app/globals.css (imports + admin + print rules only) → src/styles/foundation.css, chrome.css, sections.css, home.css, catalog.css, pages.css, karaoke.css, checkout.css, account.css. Checkout/account rules were ported from the old file with the layout kept and the look rewritten (scratchpad script), everything else written new.
- Legal minimums kept in foundation.css: 16px on .checkout-consent label, .checkout-consent-note, .legal-section p, .legal-bullets li, .legal-ordered li, .karaoke-preinfo (MSY m.6/1, 12pt=16px); iOS 16px fields; the cookie card's pre-hydration hide rule (html[data-consent="set"] .cookie-banner[data-pending]); admin rollbacks and print rules verbatim.

## Pages and components
- Home: home-hero.tsx (new) = full-bleed film, 3 clips in turn (public/video/hero-{1,2,3}-{wide,tall}.mp4 + .webp posters), title bottom-left, link + 01/02/03 pager + pause bottom-right; server renders the first poster (LCP), film starts after hydration only when not reduced-motion, not Save-Data, on screen and tab visible; the next clip is fetched at 50% of the current one; phone gets the upright cut. Then (home-page.tsx): "Şimdi barda" card row (live menu, photographed items first, 4) → signature split → "Kategoriler" 4 tiles → "Evde L'Affogato" feature (featured/espresso/first beans product) → karaoke block (facts from settings + today's free hours live) → app block (ruled points, App Store button) → "Rehberler" (2 guides) → "Bizi ziyaret edin" (photos, address, live open line) → FAQ block. home-app-intro.tsx, home-take-home.tsx, home-karaoke.tsx were folded into home-page.tsx. The admin's home slides (/admin/anasayfa-hero) are still not on the page (as during the journey).
- Chrome (chrome.tsx rewritten): announcement line ("Her siparişte damga topla | Kampanyalar"), 4 nav links (Menü, Mağaza, Karaoke, Ziyaret & keşfet) left with hover panels (category links + a feature picture), logo centre, search/account/bag right; <1280 burger + full-height sheet; <1024 quick-link chips row; footer charcoal: mark + wordmark, 4 columns (Keşfet, Ziyaret, Üyelik, Kurumsal), newsletter (underline field + arrow; email+consent names unchanged, box unticked), socials, category doors (Menüde/Mağazada), company legal lines (ETHS m.5/1, 6563 m.3/1), bottom row. Kampanyalar left the main nav (announcement line, visit panel, footer).
- PageHero (page-hero.tsx): wide photo (3.2:1, 4:3 on a phone) + title + lede; props eyebrow/title/lede/image/children (scene/art removed).
- Shop (shop-page.tsx): photo or the admin's shop slides, title + "Filtre" button + sort select, category chips, 3-col grid (2 on phone), filter sheet from the right on every width, featured set split, trust row. ProductCard (ui.tsx): 5:4 photo on the band, badge, name + price (struck price + discount days, Ticari Reklam Yön. m.14/1), add button only on phones (<1024).
- Menu (menu-page.tsx): collection layout, chips, search box, 4-col card grid, M/L prices, allergens, guide link, photo note, price-date note (Fiyat Etiketi Yön.), notes band.
- PDP (product-detail.tsx): classes swapped; gallery left sticky, buy column right (qty stepper + "Sepete ekle | price" dark button + "Hemen satın al"), accordions.
- Quick look, cart drawer (now shows each line's photo by product id; stored cart format unchanged), search panel, filter sheet, cookie strip + preferences modal: new CSS.
- Story, visit, campaigns, guides hub/article, legal, 404/error/global-error, table banner: new markup/CSS. 404 lost its drawn signpost.
- Karaoke wizard: CSS only (form fields/names untouched) + hero still (hero-karaoke.webp).
- Checkout + member area: ported CSS + title overrides; markup only lost PaymentsArt drawings and EmptyState `art`.
- visuals.tsx reduced to ProductSurface + MenuPlate (photo or the plain band ground). Removed: journey/ (film, renderers, frames), roast-stage.tsx, roast-scene.ts, reveal-text.tsx, scramble-text.tsx, reveal-motion.tsx, footer-night.tsx, menu-visuals.tsx, illustration.tsx (+ 30 SVGs in public/illustrations; karaoke-room.webp and karaoke-mic-cut.webp stay: lib/admin/home-hero-core.ts and lib/seo/og-pages.tsx read them), payments-art.tsx, docs/REDESIGN-ROAST.md, docs/JOURNEY.md, docs/journey/, .claude/skills/design-1-1-fidelity, public/photos/affogato-tray.webp, public/brand/app-screen-campaigns.webp (both unreferenced). `three` stays in package.json (unused now; removing it changes the lock file — a separate job, like vitest).
- Backend untouched: src/lib, src/app/api, actions, routes, proxy, db, scripts unchanged.

## Media provenance (for docs/MEDIA-LICENSES.md)
Mixkit (mixkit.co), "Mixkit Stock Video Free License" (free for commercial and non-commercial projects, no attribution required, no redistribution as standalone stock). Clips used (downloaded 1080p, re-encoded H.264, no audio, faststart):
- hero-1: Mixkit #207 "Coffee creamer swirling in coffee" — 8 s from 1.0 s; wide 1920px CRF 26 (1.29 MB), tall 720×1280 crop CRF 24 (0.98 MB)
- hero-2: Mixkit #88007 "Closeup of an espresso coffee machine pour" — 8 s from 24 s, 24 fps; wide 1.07 MB, tall 0.52 MB
- hero-3: Mixkit #1736 "Latte leaf drawing in a cup, macro close-up" — 7.4 s; wide 1.18 MB, tall 0.38 MB
- Posters: first frame of each cut, WebP q78.
- Stills (public/photos): hero-menu.webp (from #88007 at 60 s), hero-shop.webp (Mixkit #100248 "Creamy coffee pour in glass mug" at 14 s), hero-story.webp (Mixkit #3576 "Frothing milk seen in detail" at 5 s), hero-karaoke.webp (Mixkit #2850 "Microphone viewed closely" at 5/8 of its length). All 1920×1080 WebP q80.
- Rejected: one Mixkit clip under the "Restricted" license (#21882) and #24621 (restricted) were not used.
- Our own photographs: public/photos (köşk), public/menu (menu stock squares — sources in docs/MENU-PHOTOS.md), public/rehber (guide photos; credits in src/lib/seo/guide-content.ts).
Bandwidth (Vercel): first home visit ≈ 1.3 MB film (wide) / 1 MB (phone) + posters; all three clips 3.5 MB wide / 1.9 MB tall; the journey film it replaces was 1.44 MB / 1.17 MB.

## QA environment (do not document as a project requirement)
Local Postgres + seeded sample rows in the session container only; nothing touched the live database.
