"use client";

import { useCallback, useEffect, useRef } from "react";

import { cx } from "./cx";
import { RevealText } from "./reveal-text";
import { RoastPause, RoastStage, type RoastScrub } from "./roast-stage";
import { ROUTE_PATHS } from "./route-paths";
import { ScrambleText } from "./scramble-text";
import { openStatusDetail, useOpenStatus } from "./use-open-status";

/** The drawing plays over this much scroll, in screens (more on a phone). */
const SCRUB_SCREENS = { wide: 1.5, phone: 2.1 } as const;
/** After this many screens the words begin to part (wide screens only). */
const PART_FROM_SCREENS = 1.7;
/** How much of the gap to the target the eased scroll closes each frame. */
const EASE = 0.14;

/**
 * The home page's first screen (operator, 11 Kas 2026: the landing takes
 * the look of coffee-beans-swart.vercel.app, drawn in three.js and adapted
 * to the köşk). Three words in the title face, set as large as the screen
 * allows - "UYAN" on the left, "KAHVE HAZIR" on the right - with one
 * roasted bean between them. The section is three and a half screens tall
 * and its content is pinned: scrolling does not move the page, it plays
 * the drawing (the bean parts along its crease, the espresso it holds
 * bursts out, and a moka pot comes up through it between two beans), and
 * over the last stretch the words part and fade as the drawing comes
 * forward.
 *
 * The words never wait for the scene. They, the kicker, the live
 * open/closed line, the way to the menu and the scroll hint are
 * server-rendered over a CSS ground; the canvas arrives later and only
 * where it can (roast-stage.tsx). The page's one h1 is the sr-only line
 * home-page.tsx renders above this; these words are its picture.
 *
 * Under prefers-reduced-motion the section is one screen tall and the
 * drawing is one still frame, the pot between its beans. Otherwise the
 * scroll is eased (the reference's 0.14 per frame) and the two CSS values
 * that carry it - the drawing's progress and `--hp` for the parting words -
 * are the only things written per frame.
 */
export function HomeRoast({
  hours,
  onMenu,
  onVisit,
}: {
  /** Opening-hours rows (the visit block's), for the live open/closed line. */
  hours?: ReadonlyArray<readonly [string, string]>;
  onMenu: () => void;
  onVisit: () => void;
}) {
  const trackRef = useRef<HTMLElement>(null);
  const scrub = useRef<RoastScrub | null>(null);
  const bindScrub = useCallback((next: RoastScrub | null) => {
    scrub.current = next;
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const wide = window.matchMedia("(min-width: 640px)");
    let target = 0;
    let eased = 0;
    let frame = 0;
    let written = "";

    const apply = () => {
      const screen = window.innerHeight;
      const run =
        screen * (wide.matches ? SCRUB_SCREENS.wide : SCRUB_SCREENS.phone);
      scrub.current?.(Math.min(1, eased / run));
      const from = screen * PART_FROM_SCREENS;
      const end = track.offsetHeight - screen;
      const part =
        wide.matches && end > from
          ? Math.min(1, Math.max(0, (eased - from) / (end - from)))
          : 0;
      const value = part.toFixed(4);
      if (value !== written) {
        written = value;
        track.style.setProperty("--hp", value);
      }
    };
    const step = () => {
      eased += (target - eased) * EASE;
      if (Math.abs(target - eased) < 0.5) eased = target;
      apply();
      frame = eased === target ? 0 : requestAnimationFrame(step);
    };
    const read = () => {
      const end = track.offsetHeight - window.innerHeight;
      target = Math.min(end, Math.max(0, -track.getBoundingClientRect().top));
      if (!frame) frame = requestAnimationFrame(step);
    };

    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, []);

  const plain = (event: React.MouseEvent) =>
    !(event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0);

  return (
    <section ref={trackRef} className="roast-hero" aria-label="L'Affogato">
      <div className="roast-hero-pin">
        <div className="roast-hero-ground" aria-hidden="true" />

        <div className="roast-hero-words">
          <div className="roast-hero-side roast-hero-side--left">
            <ScrambleText
              as="p"
              on="load"
              className="roast-hero-kicker"
              text="Bologna 1897’den Tuzla’ya"
            />
            <RevealText as="span" on="load" delay={250} className="roast-word">
              Uyan
            </RevealText>
          </div>
          <div className="roast-hero-side roast-hero-side--right">
            <RevealText as="span" on="load" delay={420} className="roast-word">
              Kahve
            </RevealText>
            <RevealText as="span" on="load" delay={540} className="roast-word">
              Hazır
            </RevealText>
          </div>
        </div>

        <RoastStage
          kind="bean"
          className="roast-hero-stage"
          onScrub={bindScrub}
        />

        <div className="roast-hero-foot">
          <RoastStatus hours={hours} onVisit={onVisit} />
          <button
            type="button"
            className="scroll-hint roast-hero-hint"
            onClick={() =>
              trackRef.current?.nextElementSibling?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
              })
            }
          >
            Kaydır ve keşfet
            <span className="scroll-hint-mouse" aria-hidden="true" />
          </button>
          <div className="roast-hero-actions">
            <RoastPause />
            <a
              className="btn btn-ghost btn-sm roast-hero-go"
              href={ROUTE_PATHS.menu}
              onClick={(event) => {
                if (!plain(event)) return;
                event.preventDefault();
                onMenu();
              }}
            >
              Menüyü keşfet
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * "Şu an açık · Kapanış 02:00" - the one fact a café's front page owes
 * someone deciding whether to come now. Read live on the visitor's clock in
 * the köşk's time zone, from the same rows as the hours on /ziyaret, and
 * nothing at all until the browser has answered. It opens the visit page.
 */
function RoastStatus({
  hours,
  onVisit,
}: {
  hours?: ReadonlyArray<readonly [string, string]>;
  onVisit: () => void;
}) {
  const st = useOpenStatus(hours);
  // The slot is kept either way so the foot's three columns do not jump.
  if (!st)
    return <span className="roast-status is-pending" aria-hidden="true" />;
  const detail = openStatusDetail(st);
  return (
    <a
      href={ROUTE_PATHS.visit}
      className={cx("roast-status", st.open ? "is-open" : "is-closed")}
      onClick={(event) => {
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.button !== 0
        )
          return;
        event.preventDefault();
        onVisit();
      }}
    >
      <span className="roast-status-dot" aria-hidden="true" />
      <span>
        <strong>{st.open ? "Şu an açık" : "Şu an kapalı"}</strong>
        {detail && <span className="roast-status-detail"> · {detail}</span>}
      </span>
    </a>
  );
}
