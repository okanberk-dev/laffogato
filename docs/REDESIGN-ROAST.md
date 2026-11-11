# Roast: the site's look since 11 Kas 2026

> Operator, 11 Kas 2026: _"siteyi tamamen https://coffee-beans-swart.vercel.app/
> bu sitedeki gibi landingleri diğer sayfaları yap, three js vs. ne varsa kullan,
> aynı birebir yap ve bizde daha fazla özellik olduğu için de bize uyarlayarak
> yap."_
>
> This file is the design source for that instruction: what the reference
> page is, measured, and how each part of it lands on our site. Values live in
> `src/app/globals.css :root`; this file explains them. `docs/BRAND.md` §0
> points here.

## 1. The reference, measured

One landing page ("Coffee Beans - Wake The Beans"), React + Tailwind. Its film
(a 96-frame bean sequence scrubbed by the scroll, two looping clips with an
alpha matte) is pre-rendered; **we copy none of its files, text or code**. We
take its proportions, type, colour and motion, and draw our own subjects live
in three.js.

**Colour.** Canvas `#FAF7F2`. One espresso `#23120B` for ink, for every filled
button and for the footer. Amber `#DE853A` for hover and for one warm button
("Join"). Selection `#E8DFD1`. Secondary text is a warm stone (their
`stone-700`), footer text `stone-400/300`.

**Type.** Titles: Abril Fatface 400, UPPERCASE, tracking -0.025em (hero
-0.03em), leading 0.84-0.92. Everything else: Plus Jakarta Sans 500/700/800.
- Hero words: 5.2rem (phone, 6rem from 390px) · 7.5rem (640) · 8.5rem (768) ·
  11rem (1024) · 12.5rem (1280).
- Section title, large (their sections 5-6): 1.85rem · 3.75rem (640) · 4.5rem
  (1024), leading 0.92. Medium (section 4): 2.25rem · 3rem · 3.25rem. Small
  band (section 3): 1.5rem · 1.875rem · 2.25rem, leading 1.
- Kicker ("SECTION 2"): 10-12px bold, tracking 0.16-0.18em, uppercase, ink.
- Paragraph: 11-14px, stone, leading 1.625, max-width 290-384px (ours: 15-17px).
- Ghost numeral behind an opener ("12", "4", "05"): title face, ink at 15 %,
  3rem (small band) to 8rem (large).

**Buttons.** Pill. Filled: espresso, cream label, 12px bold uppercase tracking
0.05em, padding 12px 24px, soft shadow, an arrow that slides 4px on hover.
Outlined: 1px ink border, fills espresso on hover. Round icon button: 36px,
1px ink border at 80 %.

**Top bar.** Fixed, full width, content `max-width 80rem`, padding
24/40/56px. Transparent with 24-32px top padding at the top of the page; after
30px of scroll: canvas at 95 % + 12px blur, shadow `0 2px 20px
rgba(35,18,11,.06)`, a 1px stone hairline, 14-16px padding (0.3s). Left: a
32px round mark + a two-line wordmark (13px extrabold, tight). Centre: links
12px bold uppercase tracking 0.12em, gap 28-36px, hover amber, the current one
underlined with a 2px ink rule. Right: 36px round search button, "LOG IN" as
text, an outlined pill with a label and a three-line icon. Phone: mark +
one round menu button.

**Hero.** 360vh tall (330vh phone), content pinned for the whole of it. See
`home-roast.tsx` and "Roast hero" in globals.css: built, do not rebuild.

**Band A (their sections 2-4): the pour.** Three stacked blocks under one
tall drawing that overlays all three, centred, `max-width 800px`, 9:16,
aligned to the top, `pointer-events: none`, above the text:
1. a short plain band, `36vh` (min 260, max 380px; phone 18vh, 130-180px);
2. a band `37vh` (min 300, max 420px; phone 28vh, min 220px) with, **left**,
   a small opener (ghost numeral + kicker, title small, 2-3 lines of
   paragraph clamped, a small filled pill) and, **right**, a 288px frosted
   card: a header row (kicker + chevron, 1px rule under it) that folds a list
   of four rows (14px icon + 12px medium label, hover amber). The middle
   (288px on wide screens) is left empty for the drawing. Their band has a
   terracotta block behind its left half; on a phone a solid amber band
   144px tall sits behind the cup instead;
3. a block `82vh` (min 620px), drawing's cup on the left half, **right** a
   medium opener (kicker, title medium, paragraph max 290px, filled pill),
   raised 96-128px above centre.

**Band B (their sections 5-6): the cup.** Two full-screen blocks under one
tall drawing that overlays both, 9:16, pushed right (translate-x 7-18rem),
and down 2.5-4rem:
1. left: three small dots (one filled) in the margin, ghost numeral "4" +
   kicker on one baseline, title large on two lines, paragraph max 384px,
   filled pill;
2. left: ghost numeral "05" + a two-line kicker, title large on three lines,
   paragraph, filled pill.
On a phone the copy keeps a narrow left column (`30vw + 36px`) and the
drawing fills the right.

**Footer.** Espresso, `padding 64px 24-64px 48px`, content `max-width 80rem`.
A 12-column grid, gap 40px, bottom rule: brand (5 cols: mark + wordmark, a
two-line blurb in stone-400, max 384px), two link columns (4 cols; a 12px
bold tracked uppercase title in stone-300 over 12px links in stone-400, hover
amber), newsletter (3 cols: title, one line, a pill field on stone-900 with a
stone-700 border + an amber pill button). Below the rule: copyright left,
three plain links and "Back to top ↑" right, 12px stone-500.

**Motion.**
- Title: each glyph rises through the mask of its own line from
  `translateY(115%) rotate(7deg)`, 1.15s `cubic-bezier(.16,1,.3,1)`, 38ms
  apart; start delays 150-540ms. Paragraph: the same per word, from 70 %,
  14ms apart, delay 350ms. Buttons/cards: fade up 18px over 1s, delay 500ms.
- Kicker: decodes left to right, 32ms per glyph, each spinning 260ms.
- Scroll in the hero is eased 0.14 per frame.
- Everything is off under `prefers-reduced-motion`.

## 2. How it lands here

**Palette** (`:root`, measured contrast in the comments there). Names did not
move; values did. `--bg #faf7f2`, `--ink #23120b`, the whole `--green-*`
family is the espresso now (`--green-cta` = filled buttons), `--night` is the
espresso footer, `--accent #a35019` is the accent as TEXT on cream (the amber
is 2.6:1 there), `--accent-on-dark` / `--amber` `#de853a` is the amber as a
fill and on dark, `--matcha` stays green for success, `--rose` for error,
brass (`--gold*`) for rewards. New plain names: `--roast`, `--roast-raise`,
`--amber`, `--amber-raise`, `--ink-ghost`, `--frost`, `--frost-chrome`,
`--frost-blur`, `--frost-line`, `--ease-rise`, `--caps-button` (0.05em),
`--caps-nav` (0.12em), `--caps-kicker` (0.16em). Shadows are espresso-tinted
(`rgba(35, 18, 11, …)`), never black.

**Type.** `--headline` = Abril Fatface (ONE weight: 400), `--display` =
`--sans` = Plus Jakarta Sans (variable 200-800). Rules:
- Abril is a display face: 20px and up, never a sentence, never bold
  (`font-weight: 400`; a 600 would be smeared, and `html` now sets
  `font-synthesis-weight: none`). A small title that used `--headline` under
  20px moves to `--display` 700.
- Capitals are CSS (`text-transform: uppercase`), never typed: Turkish casing
  follows `<html lang="tr">`.
- Turkish capitals carry marks above (İ Ö Ü Ğ) and below (Ç Ş). Multi-line
  titles therefore use leading 0.96-1.0, not the reference's 0.86-0.92;
  only a line known to carry no marks may go tighter.
- `.h-display` 40-96px, `.h1` 31-72px, `.h2` 26-52px (all uppercase), `.h3`
  20-26px sentence case, `.eyebrow` 12px bold caps 0.16em, `.lede` 15-17px.

**Buttons.** `.btn` is the pill above; `.btn-primary` espresso, `.btn-ghost`
outlined-fills-on-hover, `.btn-outline` quiet outlined, `.btn-light` /
`.btn-glass-dark` on dark, `.btn-amber` the one warm button, `.btn-gold`
brass for rewards only. 44px tall (touch floor), `.btn-sm` 36px.

**Furniture** (globals.css "Section furniture"): `.ghost-n` (+ `.sm`),
`.frost-card`, `.dots-trio` (`<i class="on">`), `.scroll-hint` +
`.scroll-hint-mouse`. Background leaf shadows: `/brand/roast-shadow.svg`
(use as `background: var(--bg) url(...) center / cover`).

**Motion kit.**
- `<RevealText as by on delay stagger className>` (`reveal-text.tsx`, server
  safe). `by="chars"` for a title, `"words"` for a paragraph. `on="load"`
  for the title at the top of a page (CSS plays it from the first frame),
  default `"view"` (armed by `<RevealMotion>` only when below the fold).
  Children: text and `<br />`. Delays as in §1 (title 150-250ms, paragraph
  350ms).
- `<ScrambleText text as on delay className>` (`scramble-text.tsx`, client):
  the decoding kicker. `on="load"` at the top of a page.
- `.reveal` (+ `.r1`-`.r4`): the fade-up, for buttons, cards, media.
- Nothing may be hidden without script: do not write CSS that hides content
  by default. Nothing loops for ever without `<RoastPause>` in view.

**Live drawings.** `<RoastStage kind="bean" | "pour" | "affogato">`
(`roast-stage.tsx`) fills its nearest positioned parent
(`position:absolute; inset:0; pointer-events:none`) and lazy-loads
`roast-scene.ts` (the only module that imports three; only via `import()`).
`pour` and `affogato` are composed for a 9:16 box: give the stage a parent
with `aspect-ratio: 9 / 16`. `<RoastPause />` is the pause control; put one
in each band, in a corner, outside the stage (it needs pointer events).
Subjects: `bean` = bean → light → espresso burst → moka pot between two
beans; `pour` = portafilter stream into a fluted cup; `affogato` = espresso
from a small glass pitcher over fior di latte in the waffle cup.

## 3. The landing, section by section

| # | Reference | Ours |
|---|---|---|
| 1 | Hero "WAKE / THE BEANS" | `HomeRoast`: "UYAN / KAHVE HAZIR", kicker "Bölüm 1: Bologna 1897'den Tuzla'ya", open/closed line, scroll hint, "Menüyü keşfet" |
| 2-4 | Band A, the pour | `pour` drawing over: a short band; the **statement** (panel kicker + lede, `home-intro`) as the small opener with the **four doors** as the frosted card's rows; the **bar** opener ("Şimdi barda") with the way to the menu |
| 5-6 | Band B, the cup | `affogato` drawing beside: the **signature** ("İçilir, sonra kupası yenir", stats, panel body) and the **rewards** (stamps) openers |
| after | (none) | Our other features, in the same language (ghost numeral, kicker, title, paragraph, pill): karaoke, campaigns banner, bar rail, take-home, app, visit |

Kickers follow the reference's numbering ("Bölüm 2: …"), sentence case in the
markup.
