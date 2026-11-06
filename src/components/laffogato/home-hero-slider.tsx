"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  HOME_SLIDES,
  slideText,
  type HomeSlide,
  type HomeSlideAction,
  type HomeSlideButton,
} from "./data";
import type { KaraokeFacts } from "./karaoke-today";
import { isLocalStatic } from "./local-image";
import { ROUTE_PATHS } from "./route-paths";
import { SCENES } from "./scenes";
import { splitLead } from "./split-lead";
import { useClientValue } from "./use-client-value";
import { openStatusDetail, useOpenStatus } from "./use-open-status";
import { cx } from "./cx";

/** How long a slide stays up - the length of the progress line's run. */
const AUTOPLAY_MS = 7000;

/** A touch drag this long, and mostly sideways, changes the slide. */
const SWIPE_PX = 44;

/**
 * The home hero: the app's product stage, at browser scale.
 *
 * Since 6 Kas 2026 (owner's brief: an oversized name over a full-bleed
 * photograph, a serif line, a dark grade) the stage stands on the köşk's
 * night front: "L'Affogato" across the width, the slide's drink in front
 * of it, the slide's words and buttons below. The slides, their order and
 * every control are unchanged; only the ground moved. No 3D (the 3D cup
 * was dropped on purpose, 382c4867): a slow zoom on the photo (CSS, off
 * under reduced motion) is all the motion the ground has.
 *
 * lafmobil draws a product on porcelain in a pastel halo of its own colour,
 * with a soft floor under it and the name beside it in Poppins (DESIGN-GLASS
 * §4.4, §13.8). The same here: each slide carries its scene family, the halo
 * cross-fades with the slide, the drink rises onto its floor, and the other
 * drinks wait as glass thumbnails under the copy.
 *
 * Every slide speaks for its own drink - kicker, title and text all come
 * from the slide. The panel's "Hero üst etiket" / "Hero açıklama" used to
 * replace the first slide's kicker and text, which set the espresso-and-
 * waffle-cup brand paragraph under a strawberry matcha; they now open the
 * page as the statement band right under the hero (home-page.tsx).
 *
 * The thumbnails are the carousel's control (the page dots that repeated
 * them are gone), and the selected one carries the autoplay's progress line.
 * That line is the clock: its CSS animation runs for AUTOPLAY_MS and its end
 * advances the slide, so pausing the animation pauses the carousel exactly
 * where it stood - no interval to drift from what the visitor sees.
 *
 * Autoplay is deliberately conservative. It stops for good the first time the
 * visitor touches a control (or swipes the stage), it pauses while the
 * pointer is over the slider or the keyboard focus is inside it, it pauses
 * while the tab is hidden, and it never starts at all under
 * `prefers-reduced-motion`. A single slide has no thumbnails and no clock.
 *
 * The slides come from /admin/anasayfa-hero (`slides`); without them the
 * bundled HOME_SLIDES stand in. A panel slide's button is either one of the
 * action codes below or a link the panel and the server have already
 * checked (a same-site path or an https URL).
 */
export function HomeHeroSlider({
  slides: fromPanel,
  onAction,
  heroImageUrl,
  hours,
  karaoke,
}: {
  /** The panel's live slides; empty or undefined draws HOME_SLIDES. */
  slides?: readonly HomeSlide[];
  onAction: (action: HomeSlideAction) => void;
  /** Ayarlar → "Hero görsel URL": overrides the first slide's photograph. */
  heroImageUrl?: string;
  /** Opening-hours rows (the visit block's), for the live open/closed line. */
  hours?: ReadonlyArray<readonly [string, string]>;
  /** The karaoke room's settings: the karaoke slide's size and hours. */
  karaoke?: KaraokeFacts;
}) {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [hidden, setHidden] = useState(false);
  /* Set once, when a control is used. Autoplay never comes back after it. */
  const [stopped, setStopped] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  // `true` on the server and through hydration, so the server HTML carries no
  // running progress line; the browser then answers for itself.
  const reduced = useClientValue(
    () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    true,
  );

  // A slider advancing in a background tab is invisible motion that still
  // costs a paint on every tick.
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const slides = fromPanel && fromPanel.length > 0 ? fromPanel : HOME_SLIDES;
  const many = slides.length > 1;
  const autoplay = many && !reduced && !stopped;
  const goTo = (next: number) => {
    setStopped(true);
    setIndex(((next % slides.length) + slides.length) % slides.length);
  };

  // A shorter list (a slide that went off between renders) restarts at one.
  const at = index < slides.length ? index : 0;
  const slide = slides[at];
  const photo = (at === 0 && heroImageUrl) || slide.photo;
  const scene = SCENES[slide.scene] ?? SCENES.latte;
  const [lead, more] = splitLead(slideText(slide.text, karaoke));
  const buttons = [slide.primary, slide.secondary].filter(
    (b): b is HomeSlideButton => !!b,
  );

  return (
    <section className="hero-x" aria-label="Öne çıkanlar" data-ground="dark">
      {/* The night: the köşk's front at dusk, full bleed, graded down to
          the espresso ground so every word over it clears AA (globals.css
          .hero-x-bg). The page's largest paint, so it is preloaded. */}
      <div className="hero-x-bg" aria-hidden="true">
        <Image
          className="hero-x-bg-photo"
          src="/photos/facade-night.webp"
          alt=""
          fill
          preload
          loading="eager"
          fetchPriority="high"
          sizes="100vw"
        />
      </div>
      {/* The masthead: the name across the whole width, the slide's drink
          standing in front of it. The name is already the page's sr-only
          h1, so it is not read twice. */}
      <div className="hero-x-masthead">
        <p className="hero-x-name" aria-hidden="true">
          L&apos;Affogato
        </p>
      </div>
      <div className="wrap-wide">
        <div
          className="hero-x-frame"
          data-autoplay={
            autoplay ? (hovered || hidden ? "paused" : "on") : "off"
          }
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          onTouchStart={(e) => {
            const t = e.touches[0];
            touch.current = t ? { x: t.clientX, y: t.clientY } : null;
          }}
          onTouchEnd={(e) => {
            const start = touch.current;
            touch.current = null;
            const t = e.changedTouches[0];
            if (!many || !start || !t) return;
            const dx = t.clientX - start.x;
            const dy = t.clientY - start.y;
            if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy) * 1.5)
              return;
            goTo(at + (dx < 0 ? 1 : -1));
          }}
          aria-roledescription={many ? "karusel" : undefined}
          style={
            {
              "--scene-core": scene.core,
              "--scene-mid": scene.mid,
              "--scene-edge": scene.edge,
              "--scene-floor": scene.floor,
              "--autoplay-ms": `${AUTOPLAY_MS}ms`,
              "--thumbs": slides.length,
            } as React.CSSProperties
          }
        >
          <div className="hero-x-copy">
            {/* The house's line, in serif, over every slide. */}
            <p className="hero-x-tagline">
              Bologna 1897&apos;den Tuzla&apos;ya, iki yüz yıllık bir köşkte.
            </p>
            {slide.kicker && <p className="hero-x-kicker">{slide.kicker}</p>}
            <h2 className="hero-x-title" key={`t-${at}`}>
              <span>{slide.title[0]}</span>
              {slide.title[1] && <span>{slide.title[1]}</span>}
            </h2>
            <p className="hero-x-text">
              {lead}
              {more && <span className="hero-x-text-more"> {more}</span>}
            </p>
            <div className="hero-x-actions">
              {buttons.map((b, i) => (
                <SlideButton
                  key={`${at}-${i}`}
                  button={b}
                  className={cx(
                    "btn btn-lg",
                    i === 0 ? "btn-primary" : "btn-ghost",
                  )}
                  onAction={onAction}
                />
              ))}
              <HeroStatus hours={hours} onVisit={() => onAction("visit")} />
            </div>

            {/* Thumbnails. Each is the slide it selects, so the row is the
                carousel's own control and never becomes decoration. */}
            {many && (
              <ul
                className="hero-x-thumbs"
                aria-label="Slaytlar"
                data-dense={slides.length > 4 || undefined}
              >
                {slides.map((s, i) => {
                  const on = i === at;
                  const name = s.title.filter(Boolean).join(" ");
                  const light = SCENES[s.scene] ?? SCENES.latte;
                  return (
                    <li key={s.id ?? `${i}-${s.photo}`}>
                      <button
                        type="button"
                        className={cx("hero-x-thumb", on && "on")}
                        onClick={() => goTo(i)}
                        aria-current={on || undefined}
                        aria-label={`${i + 1}. slayt: ${name}`}
                      >
                        <span
                          className="hero-x-thumb-light"
                          style={{
                            background: `radial-gradient(circle at 50% 42%, ${light.mid} 0%, ${light.edge} 70%)`,
                          }}
                          aria-hidden="true"
                        />
                        {/* An 80 px thumbnail of a 581 x 942 cut-out:
                            next/image sends a thumbnail-sized file (a few
                            KB) instead of the whole ~140 KB photo three
                            times over. A panel upload (/gorsel/...) or an
                            https picture stays a plain lazy <img>. */}
                        {isLocalStatic(s.photo) ? (
                          <Image
                            src={s.photo}
                            alt=""
                            width={581}
                            height={942}
                            sizes="80px"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.photo}
                            alt=""
                            width={581}
                            height={942}
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                        <span className="hero-x-thumb-name">{name}</span>
                        {on && autoplay && (
                          <span
                            key={at}
                            className="hero-x-thumb-progress"
                            aria-hidden="true"
                            onAnimationEnd={(e) => {
                              if (e.target !== e.currentTarget) return;
                              setIndex((n) => (n + 1) % slides.length);
                            }}
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="hero-x-stage">
            <span className="hero-x-halo" aria-hidden="true" />
            <span className="hero-x-sphere a" aria-hidden="true" />
            <span className="hero-x-sphere b" aria-hidden="true" />
            <span className="hero-x-floor" aria-hidden="true" />
            {/* The site's own cut-outs go through next/image, sized to the
                stage. The first slide's photo can instead be the panel's
                "Hero görsel URL", an arbitrary host next/image would need a
                wildcard remotePattern for - that one stays a plain <img>.
                Keyed on the photo so a slide change remounts the image and
                replays the rise; the first drink is the LCP element. */}
            {isLocalStatic(photo) ? (
              <Image
                className="hero-x-photo"
                key={photo}
                src={photo}
                alt={slide.alt}
                width={581}
                height={942}
                sizes="(max-width: 760px) 60vw, 440px"
                loading={at === 0 ? "eager" : "lazy"}
                fetchPriority={at === 0 ? "high" : "auto"}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="hero-x-photo"
                key={photo}
                src={photo}
                alt={slide.alt}
                loading={at === 0 ? "eager" : "lazy"}
                fetchPriority={at === 0 ? "high" : "auto"}
                width={581}
                height={942}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * One of a slide's buttons. An action code goes through `onAction` (the
 * home page owns where each goes); a same-site path is a client-side link,
 * an https URL a plain one. The link was checked by the panel and again on
 * the server (home-hero-core.ts `slideButton`), so nothing here re-parses it.
 */
function SlideButton({
  button,
  className,
  onAction,
}: {
  button: HomeSlideButton;
  className: string;
  onAction: (action: HomeSlideAction) => void;
}) {
  if (button.action) {
    const action = button.action;
    return (
      <button
        type="button"
        className={className}
        onClick={() => onAction(action)}
      >
        {button.label}
      </button>
    );
  }
  if (button.href.startsWith("/")) {
    return (
      <Link href={button.href} className={className}>
        {button.label}
      </Link>
    );
  }
  return (
    <a className={className} href={button.href} rel="noopener noreferrer">
      {button.label}
    </a>
  );
}

/**
 * "Şu an açık · Kapanış 02:00" beside the hero's buttons - the one fact a
 * café's front page owes someone deciding whether to come now. Read live on
 * the visitor's clock in the köşk's time zone, from the same rows as the
 * hours table on /ziyaret (so the two cannot disagree), and nothing at all
 * until the browser has answered. It opens the visit page.
 */
function HeroStatus({
  hours,
  onVisit,
}: {
  hours?: ReadonlyArray<readonly [string, string]>;
  onVisit: () => void;
}) {
  const st = useOpenStatus(hours);
  if (!st) return null;
  const detail = openStatusDetail(st);
  return (
    <a
      href={ROUTE_PATHS.visit}
      className={cx("hero-x-status", st.open ? "is-open" : "is-closed")}
      onClick={(e) => {
        e.preventDefault();
        onVisit();
      }}
    >
      <span className="hero-x-status-dot" aria-hidden="true" />
      <span>
        <strong>{st.open ? "Şu an açık" : "Şu an kapalı"}</strong>
        {detail && <span className="hero-x-status-detail"> · {detail}</span>}
      </span>
    </a>
  );
}
