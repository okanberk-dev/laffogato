# The journey: the home page's opening since 17 Kas 2026

> Operator, 17 Kas 2026: _"sitede aşağıdaki promptu uygula ve kahveciye uygun
> hale getir sonra maine gönder"_, followed by the "alpha project" build
> prompt (uberdesigner prompt format v1, v1.0.1).
>
> This file is the design source for that instruction: what the prompt asks
> for, what was taken from it as written, what was made a café's, and where
> the site's own rules changed it. The code is
> `src/components/laffogato/journey/`; the film is produced by the three
> scripts in `docs/journey/`. `docs/BRAND.md` §0 and `docs/REDESIGN-ROAST.md`
> §3 point here.

## 1. The prompt, in one paragraph

A one-page scroll site for a fictional studio: one pinned full screen, a film
of 120 rendered frames that the scroll scrubs through (a journey into a blue
ice cave ending at an ice sculpture of the studio's mark), drawn in WebGL
with a depth map per frame so the picture shifts in parallax with the
pointer. It opens under a frost-blue preloader (a large italic percentage
bottom left, a thin progress line along the bottom edge) that melts away
from the centre along a noisy edge with a white rim. Then the header rises
in and a two-line headline blurs in word by word; the scroll takes it away,
brings a second, then two frosted-glass cards and a third headline in front
of the subject. A ring cursor trails the pointer and names the button it is
over. Instrument Sans (at 91 % width) and Instrument Serif italic; every
size a design pixel of a 1440 x 900 (or, under 1024px, 415-wide) design.

The prompt names what a user is meant to change ("Make it yours"): the
copy, the logo and the button colour, the preloader's colour, the imagery
(any camera move rendered as numbered frames with a depth map each) and the
pacing. Everything else is "match exactly".

## 2. What is as written

Layout, type, motion and their numbers are the prompt's; they live in
`journey/config.ts` (motion) and `journey/journey.module.css` (everything
visual):

- 380vh of scroll, the stage pinned for all of it; the shade over the
  picture; three copy blocks in one place (803 + 330 design px columns, the
  headline 80 / 92 with trimmed text boxes, the paragraph 18 / 21.96); two
  glass cards 330 wide at 22 % and 49 %; the counter 92 italic, its
  baseline 36.8 above the foot; the 4px progress line.
- The phone design under 1024px: one column, 49.8 / 57.27 headline that
  wraps, cards at 16 % and 39 %.
- Motion: scroll eased 0.09 per 60 fps frame, pointer 0.055, cursor 0.2,
  all frame-rate independent; the blocks' windows (`TIMING`), the 24 px
  rise and 16 px lift, the word-by-word reveal (0.58 spread, 0.34 ramp,
  0.58 s linear); the counter (1.5 s minimum, waits at 99, 8 s timeout);
  the burn (1.15 s, ease-in-out cubic, the same field, noise and `reach`),
  the intro's keyframes and delays; the cursor's ring, dot and label.
- The depth shader (per frame; see §4 for the dissolve between two), the
  cover fit, the glass as blurred copies of the
  picture (not `backdrop-filter`), canvases created inside the effect and
  disposed with it, one mount effect driving the whole sequence.
- Reduced motion: no burn (the sheet fades), instant intro, no parallax;
  the frames and the copy still follow the scroll.

## 3. What is a café's

**The film.** The prompt's ice cave cannot be ours (its last frame is
another firm's mark) and its host was not reachable from where this was
built. The film is our own, rendered in Blender (Cycles) by
`docs/journey/scene.py`: a probe lens deep in a mound of roasted beans on
the bar, the affogato glimpsed through the mouth of the bore; out of the
mouth and along an oiled walnut bar strewn with beans; to the affogato in
its biscuit cup on its bamboo coaster, the L'Af mark on its paper sleeve,
under the terrace's string lights at night. The subjects are the house's
own (`public/photos/affogato-cup.webp`). It follows the roast's rule for
drawings (`docs/REDESIGN-ROAST.md` §2, "a photograph of things"): real
materials, nothing glows or floats, and no stream of espresso hangs in the
air (a still one read as a wire, and it went).

Night, because the type on it is white: on a sunlit terrazzo table the
headline could not be read. The picture's blacks sit on the roast's
espresso, its lights are the amber.

**Two cuts.** `wide` (16:9) for screens wider than they are tall, `tall`
(9:16) for phones, each framed for its screen (`PORTRAIT_QUERY`). A phone
cropping the wide cut would have shown the cup wider than the screen, and
downloaded three times the pixels it draws.

**Copy** (Turkish, the site's own facts and words):

| Block | Line 1 (sans) | Line 2 (serif italic) | Paragraph |
|---|---|---|---|
| first | Çekirdekten başlar. | Kupada biter. | Tuzla'da 200 yıllık bir köşkte İtalyan kahve ve gelato barı. Çekirdek Bologna'da kavrulur, affogato masanda tamamlanır. + "Menüyü keşfet" |
| second | Önce gelato. | Sonra espresso. | Kupaya bir top fior di latte konur. Çift shot Sirena, masada üstüne dökülür. |
| third | Adını | bu kupadan alır. | Affogato, İtalyancada "boğulmuş" demek: espressoda boğulmuş gelato. Köşkün imzası da bu. |

Cards: **Kupa** ("Çıtır waffle kup, içi yenilebilir glaze. Bardak yok;
geriye atılacak bir şey kalmaz.") and **Espresso** ("Çift shot Sirena,
masada fior di latte'nin üstüne dökülür. İlk kaşık hem sıcak hem
soğuktur."). The cursor says "Aç" over the button. Over the first
paragraph stands the live open/closed line the old hero carried
(`useOpenStatus`): the one fact a café's front page owes a visitor.

**Colour.** The preloader is a sheet of the site's cream (`--bg`) with the
espresso for its counter and line, and it does not melt, it burns: the
paper browns towards the roast as the edge nears it and the edge is a line
of ember (the amber). The button is the amber under the espresso ink (white
on amber is 2.6:1; `--amber` carries `--roast` at 6.47:1). Card shadows are
espresso tinted. The glass is the prompt's.

## 4. Where the site's rules changed it

| The prompt | Here | Why |
|---|---|---|
| A header of its own inside the stage (logo, a glass pill of three links, a "Menu" pair that does nothing) | The site's own top bar, restyled while the picture is under it (`html[data-journey="over"]`, globals.css "Journey"): no frost, white ink, the six links in the glass pill (in the journey's sans, the first carrying the white fill), search and account as glass discs, the cart as the white button, the phone's menu button as the white disc. It is hidden under the sheet and rises in with the intro's keyframes. | One navigation, with search, account, cart and the section panels working for the three screens the picture is up. The pill's glass is `backdrop-filter` here: the bar is outside the stage. |
| 240 files (120 JPEG + 120 WebP), each its own request, from the prompt's CDN | Five packs per cut: the frames' WebP bytes end to end, `frames/index.json` saying where each starts, referenced with `new URL(…, import.meta.url)` so the bundler emits them under `_next/static/media` with a content hash | Vercel counts every request, and the account was paused for usage on 14 Kas 2026. A visit is 5 requests for the film, cached for a year and outside the proxy. Packs are fetched (`fetch` + `Blob.slice`), which the prompt forbids for its cross-origin CDN; ours is same origin. |
| Frames load on mount, all of them | Pack 0 (frames 0-7) at once and preloaded from the HTML; the rest when the sheet goes, in order, the pack the scroll asks for first. On Save-Data only what the scroll reaches. | Bytes. |
| 120 frames, the nearest loaded one drawn (`round(progress x 119)`) | The film keeps the prompt's 120-step timeline but carries a frame on every second step (61 frames per cut: 0, 2, … 118 and 119). While the scroll moves, the picture is the two frames either side of it dissolved into each other (`uMix`, each with its own depth map); when the scroll rests it settles on the nearer one, so a still picture is always one frame. | Half the bytes and half the render for motion that reads the same: a frame is on screen for a sixtieth of a second while scrolling, and the dissolve is what the eye follows. A pack lists the frames it has, so the missing steps can be rendered and added later without touching the code. |
| One cut, 1920 x 1080 | Two cuts; frames deep inside the mound are smaller than the ones the eye rests on (the first six and everything from the mouth on) | Bytes; a dark, defocused frame does not need them. The shader fits whatever size a frame has. |
| `html, body { cursor: none }`, the ring everywhere | The ring only over the stage | The top bar's panels and the rest of the page are cream; a white ring on them is invisible. |
| The page is the stage | The picture is followed by the home page. Past the end the copy and cards fade (so only the picture passes under the top bar) and the cream page comes up over its foot as a rounded sheet. The sheet is shown once per page load, not on every return to the home page, and not at all when the page opens scrolled past the journey. | The site has more to say. |
| White counter with a blue-tinted shadow; white button label | Espresso counter on cream, espresso label on amber | Contrast. |
| `<h1>` for the first headline | All three are `<h2>`; the page's one `<h1>` stays the visually hidden line that names the business | SEO: the slogan is not the page's subject. |
| Nothing under the copy but the picture | The copy stands on the cookie card while it is up (`--j-lift`), and on the phone's tab bar | A first visit shows both. |
| WebGL assumed | Without it the frames are drawn flat on a 2D canvas and the sheet fades; without `ctx.filter` (Safari before 18) the cards use `backdrop-filter`; without script the sheet is not shown and the first block stands on the espresso | The site must work everywhere. |

**Type.** The journey is the one place on the site set in Instrument Sans
and Instrument Serif italic. They are loaded in `src/app/page.tsx`, so only
the home route preloads them, and they reach the top bar because it takes
them while the picture is under it. The rest of the site keeps its two
voices (Abril Fatface, Plus Jakarta Sans). The site's `antialiased`
smoothing is put back to the browser's own inside the journey: with it the
white type is thinner than drawn.

## 5. The film: how it is made

Blender's Python module (`pip install bpy numpy pillow scipy OpenEXR`,
Python 3.13) on a machine with no GPU: about two minutes of one core per
frame, some two hours on four cores for both cuts.

```bash
# The scene: one multilayer EXR per frame (scene-linear colour + mist).
# (--frames 0-118:2,119 is the film as shipped; 0-119 renders every step.
#  --coarse-first renders every 16th frame first, then every 8th, ...)
python docs/journey/scene.py --frames 0-118:2,119 --coarse-first \
  --res 1440x810 --res-inside 960x540 --samples 44 --samples-inside 30 \
  --threshold 0.06 --out out/L
python docs/journey/scene.py --portrait --frames 0-118:2,119 --coarse-first \
  --res 720x1280 --res-inside 480x854 --samples 44 --samples-inside 30 \
  --threshold 0.06 --out out/P

# The grade: filmic curve, the lens's glow, the depth map from the mist.
python docs/journey/grade.py out/L --dest out/web-wide --quality 76 --depth-quality 60
python docs/journey/grade.py out/P --dest out/web-tall --quality 76 --depth-quality 60

# The packs and their index.
python docs/journey/pack.py --wide out/web-wide --tall out/web-tall \
  --dest src/components/laffogato/journey/frames
```

`scene.py` builds everything from numbers: six bean meshes (a domed back, a
flat belly with its S-shaped crease, the silverskin paler in it) instanced
about 14 000 times by a geometry-nodes modifier, three deep on a bore that
breathes and ribs every nine centimetres; a dark shell behind them with
five gaps that let the key lamp in (dark to the lens, shadowless to the
lamp); the bar; the cup turned on a lathe, its sleeve carrying
`docs/journey/tex/laf.png` (the brand's two SVG masks, rasterised); three
scoops with the espresso lying on them; four swags of bulbs far behind,
which the open lens turns into discs. The camera's way is seven points
(`WAY`): out of the mouth at about 0.62 of the scroll, then a long slow
push in. Inside the mound the lens holds the beans a hand's width ahead at
f/13 and carries a small lamp; coming out it racks to the cup and opens to
f/2.4. Frames deep inside (`inside > 0.9`, after the first six) are
rendered smaller, with fewer samples and bounces.

The depth map is the mist pass turned to disparity (near white, far black),
so a point's shift under the pointer is what it would be if the camera had
moved.

## 6. What a visit costs

Measured on the packs in the repository (`pack.py` prints them):

| Cut | Frames | Colour | Whole film |
|---|---|---|---|
| wide | 61 | 1440 x 810 (from the mouth on, and the first three), 960 x 540 (deep inside) | 1.44 MB |
| tall | 61 | 720 x 1280, 480 x 854 | 1.17 MB |

Five requests per visit for the film, plus two font files. A visitor who
leaves before the sheet has gone has fetched pack 0 only (about 90 KB).

## 7. What guards it

There is no test suite (CLAUDE.md, 16 Kas 2026). By hand, before a change
to the journey ships:

- typecheck, lint with `--max-warnings=0`, production build;
- in a browser at 1440 x 900, 1280 x 720, 1920 x 1080, 2560 x 1080,
  768 x 1024 and 375 x 667: nothing cut off, no horizontal scroll, the
  sheet counts and burns fully clear, the bar rises, the three blocks and
  the cards come and go, the bar goes back to the roast's when the cream
  page reaches it;
- with reduced motion: no burn, no intro animation, no parallax;
- no console errors, also in development (React's double mount);
- the network panel: five `.bin` requests for the film, none repeated.
