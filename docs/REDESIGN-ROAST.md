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
(`rgba(35, 18, 11, …)`), never black. A see-through tint of a token is
derived from it (`color-mix(in srgb, var(--matcha) 16%, transparent)`), not
rewritten as `rgba()`: `#1d6d56` is `--matcha` and nothing else, and the 5 Kas
greens are gone from the stylesheet in every notation
(`tests/brand-theme.test.ts`). Contrast pairs: `tests/contrast.test.ts`
("the Roast's own pairs"). "Open" is `--matcha`; "closed" is quiet ink,
never `--rose`.

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

**Furniture** (globals.css "Section furniture"): `.frost-card`,
`.scroll-hint` + `.scroll-hint-mouse`. The ghost numeral (`.ghost-n`), the
dot trio (`.dots-trio`) and the "Bölüm N:" counter went on 12 Nov 2026
(below). Background leaf shadows: `/brand/roast-shadow.svg`
(use as `background: var(--bg) url(...) center / cover`).

**Motion kit.**
- `<RevealText as by on delay stagger className id>` (`reveal-text.tsx`,
  server safe). `by="chars"` for a title, `"words"` for a paragraph. `on="load"`
  for the title at the top of a page (CSS plays it from the first frame),
  default `"view"` (armed by `<RevealMotion>` only when below the fold).
  Children: text and `<br />`. Delays as in §1 (title 150-250ms, paragraph
  350ms). Ours travels further than the reference: a glyph from
  `translateY(145%) rotate(7deg)`, a word from `110%`, because the mask is
  padded (0.22em) so the marks on Turkish capitals are not cut. Transform
  only, never opacity (the title is the largest paint). A heading is named
  by its whole line (`aria-label`); `<RevealMotion>` restores the kerning a
  glyph-split title loses.
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
It is ONE switch: pressing any control holds every drawing, and it renders
nothing until a drawing is really running (no WebGL 2, save-data or
reduced motion: no control, because nothing moves). Under the canvas each
stage carries a flat SVG drawing of the same subject, so the page is
composed before and without WebGL. A band's drawing starts only when the
band nears the screen; a phone gets no shadow pass, no pointer and no far
beans.
Subjects: `bean` = the bean parts along its crease → the espresso it holds
bursts out → a moka pot comes up through it between two beans; `pour` = a
chromed portafilter's two thin streams into a fluted, espresso-glazed cup;
`affogato` = espresso from a small glass pitcher over fior di latte in the
waffle cup.

**A photograph of things, not an illustration of an idea** (operator, 12 Nov
2026: _"yapay zekaymış gibi gözükmesin"_). The first cut had the marks of a
generated scene: a golden glow inside the bean, amber orbit lines, sparkles,
dust motes, bead-like drops left hanging in the air, a thick caramel ribbon
for a pour, a white strand of "cream" wound round the espresso, cups that
bobbed. All of it is gone. The rules the scenes are now drawn by:

- Nothing glows, orbits or sparkles; nothing is in the air that would not be
  there. A burst is liquid: a body of espresso, a crown of short tongues,
  drops drawn out along their flight that fall and are gone.
- What moves is what moves in a bar: liquid. A cup stands still on its
  saucer, the portafilter hangs where the group head holds it, a stream
  wavers and a foam drifts. Only the hero's bean and pot float.
- Real materials: cast aluminium with its grain (in a room that is darker
  where the camera stands: in an evenly white room polished metal is simply
  white), chromed steel, bakelite, glazed clay and satin stoneware, a satin
  dark roast, glass lit "bright field" (clear body, dark edge, a small white
  highlight). Espresso falls as two thin streams with tawny stripes, and a
  pitcher is tipped as a hand tips it, its espresso level with the lip.
- No two far beans are one colour.

## 3. The landing, section by section

| # | Reference | Ours |
|---|---|---|
| 1 | Hero "WAKE / THE BEANS" | `HomeRoast`: "UYAN / KAHVE HAZIR", kicker "Bölüm 1: Bologna 1897'den Tuzla'ya", open/closed line (a still dot), scroll hint, "Menüyü keşfet"; 330vh, 360vh from 640px, one screen under reduced motion |
| 2-4 | Band A, the pour | `pour` drawing over: a short band; the **statement** (panel kicker + lede, `home-intro`) as the small opener with the **four doors** as the frosted card's rows; the **bar** opener ("Şimdi barda") with the way to the menu |
| 5-6 | Band B, the cup | `affogato` drawing beside: the **signature** ("İçilir, sonra kupası yenir", stats, panel body) and the **rewards** (stamps) openers |
| after | (none) | Our other features, in the same language (ghost numeral, kicker, title, paragraph, pill): karaoke, campaigns banner, bar rail, take-home, app, visit |

Kickers are plain words in sentence case in the markup ("Menü", "İmza
ürün", "Bologna 1897’den Tuzla’ya"). Until 12 Nov 2026 they followed the
reference's numbering ("Bölüm 2: …") beside a ghost numeral, with a dot
trio in the margin: a chapter number tells a café's visitor nothing, and
printed twice in two sizes it read as a templated landing (operator: _"yapay
zekaymış gibi gözükmesin"_). The same pass put /hikayemiz and /ziyaret into
Turkish (their kickers and two headings were Italian and English), dropped a
stat row whose figures were wrong ("93°C servis sıcaklığı") or not figures
("∅0"), and made the hero's words fluid: from 640px to about 1500px the
fixed steps ran "KAHVE" off the right edge.

## 4. What guards it

- `tests/brand-theme.test.ts`: the palette, radii, shadows, the two faces and
  the bans on every retired colour and face (re-pinned on 11 Kas 2026).
- `tests/contrast.test.ts`: AA for every ink on its ground, the caramel /
  amber split.
- `tests/home-roast.test.ts`: three.js only through `import()`, the scene's
  manners (off screen, hidden tab, pause, reduced motion, disposal), the
  server-rendered words, one pause control per drawing.
- `tests/home-landing.test.ts`: the landing's sections and the still status
  dot.
- Not moved by this redesign, on purpose: e-mails, link preview cards, icons,
  the PayNkolay bridge page, and `/admin`.
