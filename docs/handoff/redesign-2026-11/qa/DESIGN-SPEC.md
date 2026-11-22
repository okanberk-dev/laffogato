# L'Affogato redesign — reviewer brief

The customer site (not /admin) was rebuilt on 21-22 Kas 2026 to follow
bluebottlecoffee.com's design language one to one, with a goodboybob.com-style
full-bleed video hero on the home page. Repo: /home/user/laffogato (Next.js 16,
Tailwind v4 present but the site uses semantic CSS). A dev server with a local
test database is running at http://localhost:3000 — do NOT restart it, do NOT
run `npm run dev`/`build`, do NOT edit any file during review.

Scratch dir (for your screenshots): S=${QA_DIR}
Write your own screenshots under $S/qa/review/<your-label>/ (mkdir -p first).

## Reference (what "right" looks like)
Blue Bottle screenshots (chunked, viewable with the Read tool):
- Home desktop: $S/ref/bb-home-d-00.jpg … bb-home-d-05.jpg; mobile: bb-home-m-00 … 05
- Collection (shop grid): bb-coll-d-00…04, mobile bb-coll-m-00…03
- Product page: bb-pdp-d-00…04, mobile bb-pdp-m-00…03
- Cafés (our /ziyaret): bb-cafes-d-00…03, mobile bb-cafes-m-00…02
- Story: bb-story-d-00…04; Brew guides hub: bb-guides-d-00…02; guide: bb-guide-d-00…01; FAQ: bb-faq-d-00…03
- Mega menu, cart drawer, search panel: bb-interact.jpg (three stacked)
- Good Boy Bob hero: $S/ref/gbb-desktop.png (full-bleed film, small title bottom-left, underlined link bottom-right)

## The language (implemented in src/styles/*.css; tokens in src/styles/foundation.css)
- Grounds: page white #fff; alternate band #f6f6f3 (also header, product photo ground, cart sheet).
- Ink: #000 text; muted #6c6864 secondary; charcoal #333 = every filled button + the footer ground.
- Square corners everywhere (radius 0). Exceptions: the phone's quick-link chips row and category chips are pills; dots are round.
- No shadows, no blur, no gradients (except the hero's soft bottom shade).
- Hairlines #dcdcd6 between rows; control edges #333.
- Type: titles/nav/prices/labels = headline face (Archivo, wide, `font-variation-settings: "wdth" 118`), ALWAYS uppercase, tracked 1.6px, weight 400.
  Section titles 24px/32px (20/28 on phone); card titles 16/22; labels 12/24; prices 14/20.
  Sentences = Geist 16/22; small 14/20 muted; micro 12/16.
- Buttons: 48px tall, padding 12px 36px, sentence-case label in the text face; filled charcoal (decided action) or white with a 1px #333 edge; CTA width 350px on desktop, full width on a phone.
- Layout: gutters 60px on wide screens → 20px on a phone; sections 96px top/bottom (56px phone); container 1320px.
- Header: announcement line (12px) on the band; bar 84px (56px <1024): 4 uppercase links left, L'Af logo centred, search/account/bag right; burger + quick-link chips under 1280/1024.
- Footer: charcoal block, white text, 4 link columns + newsletter (underline field + arrow), company legal lines, bottom row.

## Accepted, intentional differences (do NOT report)
- Our own logo (L'Af mark), our photos, licensed stock videos/stills (Mixkit), Turkish copy.
- Our extra features in the same language: cafe menu, karaoke booking wizard, campaigns, guides, table (QR) page.
- The Next.js dev "N" badge bottom-left, and fixed bars appearing mid-page in FULL-PAGE screenshots (a screenshot artefact).
- Local test data (8 products, 16 menu items, photos reused as product images).

## Report
- Overlaps / collisions / clipped or cut text; horizontal scroll; elements off-screen.
- Anything that looks unstyled (browser-default links, bullets, buttons, form controls, blue underlines, Times font).
- Leftovers of the previous design: rounded or pill-shaped BUTTONS, drop shadows, cream/amber/caramel/espresso-brown colours, Abril/serif display type, decorative arrows "→" in labels, drawn illustrations, glass/blur.
- Typography inconsistent with the language (titles not uppercase headline face, wrong sizes, bold where it should be 400, inconsistent kicker styles).
- Spacing/alignment problems vs. the reference (cramped or huge gaps, misaligned columns, card grid irregularities, inconsistent section padding).
- Mobile ergonomics: tap targets under 44px, sticky bars covering content/inputs, unreadable text (<12px), long words breaking layout, horizontal overflow at 360px.
- Accessibility smells visible in the DOM: missing labels, focus not visible, contrast below AA.

For each finding give: page path, viewport width, severity (high = broken/unusable/clearly wrong; medium = visibly off vs reference; low = polish), a precise description, WHERE to fix (CSS file + selector, or component file), and a concrete suggested fix. Do not report the same root cause twice — group it.

## Tools
- Screenshot (public pages): `node $S/qa/shot.cjs "http://localhost:3000<path>" <outPrefix> <width> <height> <isMobile 0|1>` → writes <outPrefix>.png (full page) and prints JSON {overflowX, errors}. Env SHOW_COOKIE=1 keeps the cookie strip.
- Screenshot as a signed-in member: `node $S/qa/member.cjs <path> <outPrefix> <width> <height> <isMobile> <withCart 0|1>`.
- Split a tall PNG into viewable JPGs: `python3 -I $S/qa/chunks.py <dir> <name-without-.png> <chunkHeightPx> <scale> [maxChunks]` → <name>-00.jpg …
- For interactions (open drawer, hover menu, step through the karaoke wizard) write your own small Playwright script under your review dir (require('playwright'), chromium.launch(); set the consent cookie like shot.cjs does). Use reducedMotion 'reduce' where animation gets in the way.
- Read component/CSS source freely (src/components/laffogato, src/app/**/page.tsx, src/styles/*.css).
