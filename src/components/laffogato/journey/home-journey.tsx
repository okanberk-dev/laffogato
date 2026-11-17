"use client";

import { useEffect, useRef, useState } from "react";

import { cx } from "../cx";
import { ROUTE_PATHS } from "../route-paths";
import { openStatusDetail, useOpenStatus } from "../use-open-status";
import { BurnRenderer } from "./burn-renderer";
import {
  BURN_MS,
  CARD_BLUR,
  FRAME_COUNT,
  INTRO_AT_MS,
  LOADER_TIMEOUT_MS,
  MIN_LOADER_MS,
  POINTER_SMOOTHING,
  PORTRAIT_QUERY,
  SCROLL_SMOOTHING,
  TIMING,
  type Timing,
} from "./config";
import { DepthRenderer } from "./depth-renderer";
import { FIRST_PACK_URL, type FrameCut } from "./frames";
import { canBlurCopies, drawGlass } from "./glass-blur";
import { JourneyCopy } from "./journey-copy";
import { JourneyCursor } from "./journey-cursor";
import styles from "./journey.module.css";
import { clamp, damp, easeInOutCubic, invLerp, stateStyle } from "./motion";
import { sequenceFor } from "./sequence";

type Phase = "loading" | "burning" | "ready" | "done";

/**
 * The sheet is shown once per page load. Coming back to the home page (a
 * client-side navigation) finds the frames already loaded and opens on the
 * picture.
 */
let introPlayed = false;

/** The top bar goes back to its own look once the picture's foot is this near the top. */
const HEADER_CLEAR_PX = 44;

/** Faces and glyphs the preloader waits for: both subsets, Turkish included. */
const FONT_SAMPLE = "Çekirdekten başlar. Kupada biter. ığüşöçİ 0123456789%";

/**
 * Without script: no sheet, the first block's words stand, one screen, and
 * the top bar keeps its frost (its ink is the espresso, the stage is dark).
 */
const NOSCRIPT_CSS = `[data-journey-root]{height:100svh!important}[data-journey-root] [data-part="preloader"]{display:none!important}[data-journey-root] [data-word],[data-journey-root] [data-detail]{opacity:1!important;transform:none!important;filter:none!important}.site-header::before{opacity:1!important}`;

/**
 * The home page's opening (operator, 17 Kas 2026: the "alpha project" build
 * prompt, applied to the site and made a café's). One pinned screen, 380vh
 * of scroll: a film of 120 frames that the scroll plays, from inside a mound
 * of roasted beans, out of its mouth and along the bar to the affogato in
 * its cup. Every frame has a depth map, so the picture shifts with the
 * pointer (depth-renderer.ts).
 *
 * It opens under a cream sheet with a counter (0 to 100 in at least a
 * second and a half, waiting at 99 for the first frame and the two faces),
 * which burns away from the middle (burn-renderer.ts). Then the top bar
 * rises in and the first headline comes up word by word. The scroll takes
 * that block away, brings a second, then two glass cards and the third in
 * front of the cup. A ring cursor trails the pointer over the picture.
 *
 * The whole sequence (counter, burn, the intro's timer) runs from the one
 * mount effect's closure and not from effects keyed on `phase`: an effect
 * that depended on `phase` would cancel the running burn when the phase
 * moves on. Every canvas is created inside the effect and removed by its
 * cleanup, so React's second mount in development never inherits a lost
 * WebGL context.
 *
 * The site's own chrome follows the journey through three attributes on
 * <html> (globals.css "Journey"): `data-journey-phase` hides the top bar,
 * the tab bar and the cart button under the sheet, `data-journey-intro`
 * plays their rise, and `data-journey="over"` gives the top bar its look
 * over the picture for as long as the picture is under it.
 *
 * Under prefers-reduced-motion there is no burn (the sheet fades), no intro
 * animation and no parallax; the frames and the copy still follow the
 * scroll, since the visitor drives them. Without WebGL the frames are drawn
 * flat and the sheet fades. Nothing here plays by itself for more than the
 * intro's three seconds, so there is nothing to pause.
 */
export function HomeJourney({
  hours,
  onMenu,
}: {
  /** Opening-hours rows (the visit block's), for the live open/closed line. */
  hours?: ReadonlyArray<readonly [string, string]>;
  onMenu: () => void;
}) {
  const [phase, setPhase] = useState<Phase>(() =>
    introPlayed ? "done" : "loading",
  );
  const intro = phase === "ready" || phase === "done";

  const trackRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const caveRef = useRef<HTMLDivElement>(null);
  const preloaderRef = useRef<HTMLDivElement>(null);
  const burnRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const midRef = useRef<HTMLElement>(null);
  const finalRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    const probe = probeRef.current;
    const caveHost = caveRef.current;
    const preloader = preloaderRef.current;
    const burnHost = burnRef.current;
    const count = countRef.current;
    const bar = barRef.current;
    const hero = heroRef.current;
    const mid = midRef.current;
    const final = finalRef.current;
    const cards = cardsRef.current;
    const content = contentRef.current;
    if (
      !track ||
      !stage ||
      !probe ||
      !caveHost ||
      !preloader ||
      !burnHost ||
      !count ||
      !bar ||
      !hero ||
      !mid ||
      !final ||
      !cards ||
      !content
    )
      return;

    let alive = true;
    const root = document.documentElement;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const cut: FrameCut = window.matchMedia(PORTRAIT_QUERY).matches
      ? "tall"
      : "wide";
    const sequence = sequenceFor(cut);
    // On Save-Data the film is not fetched ahead: a pack loads when the
    // scroll reaches it.
    const thrifty =
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData === true;

    // The picture.
    const caveCanvas = document.createElement("canvas");
    caveCanvas.setAttribute("role", "img");
    caveCanvas.setAttribute(
      "aria-label",
      "Kavrulmuş kahve çekirdeklerinin içinden bardaki affogatoya uzanan yolculuk",
    );
    caveHost.append(caveCanvas);
    const renderer = new DepthRenderer(caveCanvas);
    const glass = canBlurCopies();
    if (!glass) stage.dataset.glass = "css";

    // One design pixel, in CSS pixels (not offsetWidth, which rounds).
    let unit = 1;
    const measure = () => {
      unit = probe.getBoundingClientRect().width / 100 || 1;
    };
    measure();

    // ── The scroll story ─────────────────────────────────────────
    let target = 0;
    let progress = 0;
    // Where the picture is on the film, as a frame number with a fraction.
    let shown = 0;
    let aimX = 0;
    let aimY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let frame = 0;
    let last = 0;
    let over = false;
    let leaving = "";
    let phaseNow: Phase = introPlayed ? "done" : "loading";
    const written = new Map<HTMLElement, string>();

    const readScroll = () => {
      const rect = track.getBoundingClientRect();
      target = clamp(
        -rect.top / Math.max(1, track.offsetHeight - window.innerHeight),
      );
      // Past the end the stage is no longer pinned and rides up under the
      // top bar: the copy and the cards go first, so only the picture
      // passes under it.
      const gone = clamp(
        (window.innerHeight - rect.bottom) / (window.innerHeight * 0.14),
      ).toFixed(3);
      if (gone !== leaving) {
        leaving = gone;
        content.style.opacity = (1 - Number(gone)).toFixed(3);
      }
      const nowOver = rect.bottom > HEADER_CLEAR_PX;
      if (nowOver !== over) {
        over = nowOver;
        if (over) root.dataset.journey = "over";
        else delete root.dataset.journey;
      }
      return rect.bottom > 0;
    };

    /** A block's opacity, lift and visibility; true if anything was written. */
    const place = (el: HTMLElement, timing: Timing) => {
      const { opacity, y, visible } = stateStyle(progress, timing);
      const next = `${opacity.toFixed(3)}|${(y * unit).toFixed(2)}|${visible}`;
      if (written.get(el) === next) return false;
      written.set(el, next);
      el.style.opacity = opacity.toFixed(3);
      el.style.transform = `translate3d(0, ${(y * unit).toFixed(2)}px, 0)`;
      el.style.visibility = visible ? "visible" : "hidden";
      return true;
    };

    const lateBlocks = [
      { el: mid, timing: TIMING.mid },
      { el: final, timing: TIMING.final },
    ].map(({ el, timing }) => ({
      el,
      timing,
      words: Array.from(el.querySelectorAll<HTMLElement>("[data-word]")),
      detail: el.querySelector<HTMLElement>("[data-detail]"),
      local: -1,
    }));

    /** The second and third blocks come in word by word with the scroll. */
    const reveal = (block: (typeof lateBlocks)[number]) => {
      const local = invLerp(
        block.timing.enter[0],
        block.timing.enter[1],
        progress,
      );
      if (local === block.local) return;
      block.local = local;
      const n = block.words.length;
      block.words.forEach((word, i) => {
        word.style.setProperty(
          "--reveal",
          clamp((local - (i / n) * 0.58) / 0.34).toFixed(3),
        );
      });
      block.detail?.style.setProperty(
        "--detail",
        clamp((local - 0.62) / 0.38).toFixed(3),
      );
    };

    const tick = (now: number) => {
      frame = 0;
      if (!alive) return;
      const dt = Math.max(0, now - last);
      last = now;
      const onScreen = readScroll();

      progress =
        Math.abs(target - progress) < 0.00005
          ? target
          : damp(progress, target, SCROLL_SMOOTHING, dt);
      // The picture follows the scroll between frames, the two either side
      // of it dissolved into each other; when the scroll rests it settles
      // on the nearer of them, so a still picture is always one frame.
      const position = progress * (FRAME_COUNT - 1);
      sequence.want(Math.round(position));
      const moving = progress !== target;
      const around = sequence.bracket(position);
      const aim =
        moving || !around ? position : around.mix < 0.5 ? around.lo : around.hi;
      shown =
        Math.abs(aim - shown) < 0.004
          ? aim
          : damp(shown, aim, moving ? 0.4 : 0.12, dt);
      const pair = sequence.bracket(shown);

      if (!reduced && renderer.parallax) {
        pointerX =
          Math.abs(aimX - pointerX) < 0.0005
            ? aimX
            : damp(pointerX, aimX, POINTER_SMOOTHING, dt);
        pointerY =
          Math.abs(aimY - pointerY) < 0.0005
            ? aimY
            : damp(pointerY, aimY, POINTER_SMOOTHING, dt);
      }
      const drew = pair ? renderer.draw(pair, pointerX, pointerY) : false;

      place(hero, TIMING.hero);
      for (const block of lateBlocks) {
        place(block.el, block.timing);
        reveal(block);
      }
      const cardsMoved = place(cards, TIMING.cards);
      if (glass && (drew || cardsMoved)) drawGlass(stage, caveCanvas);

      // Keep going while anything is still on its way; then rest until the
      // next scroll, pointer move or resize.
      const settled =
        !moving && shown === aim && pointerX === aimX && pointerY === aimY;
      if (onScreen && !document.hidden && !settled)
        frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (frame || !alive) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      readScroll();
      wake();
    };
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      aimX = (event.clientX / window.innerWidth - 0.5) * 2;
      aimY = (0.5 - event.clientY / window.innerHeight) * 2;
      wake();
    };
    const onLeave = () => {
      aimX = 0;
      aimY = 0;
      wake();
    };
    const onVisible = () => {
      if (!document.hidden) wake();
    };
    // A frame that arrives may be the one the picture is waiting for.
    const stopListening = sequence.onFrame(wake);

    // The cookie card sits where the copy does (a first visit shows both).
    // While it is up the copy stands on it: `--j-lift` is how far its top
    // edge is from the foot of the screen.
    let banner: Element | null = null;
    const lift = () => {
      const rect = banner?.getBoundingClientRect();
      // Measured from the foot of the stage (the copy's own ground), which
      // is the foot of the screen while the stage is pinned.
      const foot = stage.getBoundingClientRect().bottom;
      const up = rect && rect.height > 0 ? Math.max(0, foot - rect.top) : 0;
      track.style.setProperty("--j-lift", `${up ? Math.round(up + 12) : 0}px`);
    };
    const bannerSize =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(lift);
    const findBanner = () => {
      const found = document.querySelector(".cookie-banner");
      if (found === banner) return;
      if (banner) bannerSize?.unobserve(banner);
      banner = found;
      if (banner) bannerSize?.observe(banner);
      lift();
    };
    const bodyWatch = new MutationObserver(findBanner);
    bodyWatch.observe(document.body, { childList: true });
    findBanner();

    // ── The sheet, the burn, the intro ───────────────────────────
    let burn: BurnRenderer | null = null;
    let burnCanvas: HTMLCanvasElement | null = null;
    let loaderFrame = 0;
    const timers: number[] = [];

    // The sheet is skipped when it has been shown already, and when the
    // page opens scrolled past the journey (a reload half way down the
    // home page): there is nothing to cover.
    const skip = introPlayed || track.getBoundingClientRect().bottom <= 0;

    const go = (next: Phase) => {
      if (!alive) return;
      phaseNow = next;
      root.dataset.journeyPhase = next;
      // The chrome rises with the intro (not when the sheet was skipped).
      if (!skip && next !== "burning") root.dataset.journeyIntro = "1";
      setPhase(next);
    };

    const onResize = () => {
      measure();
      lift();
      written.clear();
      if (phaseNow === "loading") burn?.draw(0, performance.now() / 1000);
      readScroll();
      wake();
    };

    const startBurn = (canBurn: boolean) => {
      count.textContent = "100";
      bar.style.transform = "scaleX(1)";
      if (!thrifty) sequence.loadAll();
      if (!canBurn || !burn) {
        // No burn: straight to the intro, the sheet fades, and is gone.
        introPlayed = true;
        go("ready");
        timers.push(window.setTimeout(() => go("done"), 200));
        return;
      }
      const sheet = burn;
      go("burning");
      const began = performance.now();
      timers.push(
        window.setTimeout(() => {
          if (phaseNow === "burning") go("ready");
        }, INTRO_AT_MS),
      );
      const step = (now: number) => {
        if (!alive) return;
        const t = Math.min(Math.max(0, now - began) / BURN_MS, 1);
        sheet.draw(easeInOutCubic(t), performance.now() / 1000);
        if (t < 1) {
          loaderFrame = requestAnimationFrame(step);
          return;
        }
        introPlayed = true;
        go("done");
      };
      loaderFrame = requestAnimationFrame(step);
    };

    if (skip) {
      introPlayed = true;
      track.dataset.quick = "";
      go("done");
      if (!thrifty) sequence.loadAll();
    } else {
      root.dataset.journeyPhase = "loading";
      burnCanvas = document.createElement("canvas");
      burnHost.append(burnCanvas);
      burn = new BurnRenderer(burnCanvas);
      if (burn.draw(0, performance.now() / 1000)) preloader.dataset.burn = "on";
      const canBurn = burn.ok && !reduced;
      if (!canBurn) track.dataset.fade = "";

      let ready = false;
      const settle = () => {
        ready = true;
      };
      // The first family of each stack is the web face; what follows it is
      // next/font's metric-matched local fallback, which has nothing to
      // load (and rejects where the local face is missing).
      const face = (el: Element) =>
        getComputedStyle(el).fontFamily.split(",")[0].trim();
      const faces = Promise.all([
        document.fonts.load(`400 1em ${face(track)}`, FONT_SAMPLE),
        document.fonts.load(`italic 400 1em ${face(count)}`, FONT_SAMPLE),
      ]).catch((error: unknown) => {
        console.error("journey: a face did not load", error);
      });
      // Ready is frame 0 and both faces. A frame or a face that fails opens
      // the page anyway, and so does eight seconds of waiting.
      void Promise.all([sequence.first(), faces]).then(settle);
      timers.push(window.setTimeout(settle, LOADER_TIMEOUT_MS));

      const began = performance.now();
      const counting = (now: number) => {
        if (!alive) return;
        const elapsed = Math.max(0, now - began);
        const value = Math.floor(
          Math.min(elapsed / MIN_LOADER_MS, 1, ready ? 1 : 0.99) * 100,
        );
        count.textContent = String(value);
        bar.style.transform = `scaleX(${value / 100})`;
        if (value >= 100) {
          startBurn(canBurn);
          return;
        }
        loaderFrame = requestAnimationFrame(counting);
      };
      loaderFrame = requestAnimationFrame(counting);
    }

    readScroll();
    wake();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(loaderFrame);
      for (const timer of timers) window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVisible);
      stopListening();
      bodyWatch.disconnect();
      bannerSize?.disconnect();
      renderer.dispose();
      caveCanvas.remove();
      burn?.dispose();
      burnCanvas?.remove();
      delete preloader.dataset.burn;
      delete root.dataset.journey;
      delete root.dataset.journeyPhase;
      delete root.dataset.journeyIntro;
    };
  }, []);

  return (
    <section
      ref={trackRef}
      className={styles.journey}
      data-journey-root=""
      data-phase={phase}
      aria-label="Çekirdekten kupaya"
    >
      {/* The pack that holds frame 0, fetched alongside the scripts: the
          sheet waits for that frame. One cut per screen shape. */}
      <link
        rel="preload"
        as="fetch"
        crossOrigin="anonymous"
        href={FIRST_PACK_URL.wide}
        media={`not all and ${PORTRAIT_QUERY}`}
      />
      <link
        rel="preload"
        as="fetch"
        crossOrigin="anonymous"
        href={FIRST_PACK_URL.tall}
        media={PORTRAIT_QUERY}
      />
      <noscript>
        <style>{NOSCRIPT_CSS}</style>
      </noscript>

      <div ref={stageRef} className={styles.stage} data-journey-stage="">
        <div ref={probeRef} className={styles.probe} />
        <div ref={caveRef} className={styles.cave} />
        <div className={styles.shade} />

        <div ref={contentRef} className={styles.content}>
          <div ref={cardsRef} className={styles.cards}>
            <GlassCard side="left" title="Kupa">
              Çıtır waffle kup, içi yenilebilir glaze. Bardak yok; geriye
              atılacak bir şey kalmaz.
            </GlassCard>
            <GlassCard side="right" title="Espresso">
              Çift shot Sirena, masada fior di latte’nin üstüne dökülür. İlk
              kaşık hem sıcak hem soğuktur.
            </GlassCard>
          </div>

          <JourneyCopy
            blockRef={heroRef}
            intro={intro}
            line1="Çekirdekten başlar."
            line2="Kupada biter."
          >
            <OpenLine hours={hours} />
            <p className={styles.paragraph}>
              Tuzla’da 200 yıllık bir köşkte İtalyan kahve ve gelato barı.
              Çekirdek Bologna’da kavrulur, affogato masanda tamamlanır.
            </p>
            <a
              className={styles.button}
              href={ROUTE_PATHS.menu}
              data-cursor-label="Aç"
              onClick={(event) => {
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.button !== 0
                )
                  return;
                event.preventDefault();
                onMenu();
              }}
            >
              Menüyü keşfet
            </a>
          </JourneyCopy>

          <JourneyCopy
            blockRef={midRef}
            late
            line1="Önce gelato."
            line2="Sonra espresso."
          >
            <p className={styles.paragraph}>
              Kupaya bir top fior di latte konur. Çift shot Sirena, masada
              üstüne dökülür.
            </p>
          </JourneyCopy>

          <JourneyCopy
            blockRef={finalRef}
            late
            last
            line1="Adını"
            line2="bu kupadan alır."
          >
            <p className={styles.paragraph}>
              Affogato, İtalyancada “boğulmuş” demek: espressoda boğulmuş
              gelato. Köşkün imzası da bu.
            </p>
          </JourneyCopy>
        </div>

        <div
          ref={preloaderRef}
          className={styles.preloader}
          data-part="preloader"
        >
          <div ref={burnRef} className={styles.burn} />
          <div className={styles.loaderUi}>
            {/* Named once for a screen reader; the running number is for
                the eye. */}
            <p
              className={cx(styles.trim, styles.serif, styles.counter)}
              role="status"
              aria-label="Yükleniyor"
            >
              <span aria-hidden="true">
                <span ref={countRef}>0</span>%
              </span>
            </p>
            <div className={styles.track}>
              <div ref={barRef} className={styles.bar} />
            </div>
          </div>
        </div>
      </div>

      <JourneyCursor intro={intro} />
    </section>
  );
}

/** One of the two glass cards on the last screen. */
function GlassCard({
  side,
  title,
  children,
}: {
  side: "left" | "right";
  title: string;
  children: string;
}) {
  return (
    <article
      className={cx(
        styles.card,
        side === "left" ? styles.cardLeft : styles.cardRight,
      )}
    >
      <canvas className={styles.glass} data-blur={CARD_BLUR} />
      <div className={styles.cardText}>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardBody}>{children}</p>
      </div>
    </article>
  );
}

/**
 * "Şu an açık · Kapanış 02:00", read live on the visitor's clock in the
 * köşk's time zone from the same rows as the hours on /ziyaret. The slot is
 * kept, empty, until the browser has answered.
 */
function OpenLine({
  hours,
}: {
  hours?: ReadonlyArray<readonly [string, string]>;
}) {
  const st = useOpenStatus(hours);
  if (!st) return <p className={styles.status} aria-hidden="true" />;
  const detail = openStatusDetail(st);
  return (
    <p className={cx(styles.status, st.open && styles.statusOpen)}>
      <span className={styles.statusDot} aria-hidden="true" />
      <span>
        {st.open ? "Şu an açık" : "Şu an kapalı"}
        {detail ? ` · ${detail}` : ""}
      </span>
    </p>
  );
}
