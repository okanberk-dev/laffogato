"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { HOME_SLIDES, type HomeSlideAction } from "./data";
import { isLocalStatic } from "./local-image";
import { SCENES } from "./scenes";
import { cx } from "./cx";

const AUTOPLAY_MS = 7000;

/**
 * The home hero: the app's product stage, at browser scale.
 *
 * lafmobil draws a product on porcelain in a pastel halo of its own colour,
 * with a soft floor under it and the name beside it in Poppins (DESIGN-GLASS
 * §4.4, §13.8). The same here: each slide carries its scene family, the halo
 * cross-fades with the slide, the drink rises onto its floor, and the other
 * drinks wait as glass thumbnails under the copy.
 *
 * The quantity stepper that used to sit under the active thumbnail is gone:
 * cafe drinks are not orderable from the web (the cart carries shop
 * products), and the number it held was never passed anywhere.
 *
 * Autoplay is deliberately conservative. It stops for good the first time the
 * visitor touches a control, it pauses while the pointer is over the slider or
 * the keyboard focus is inside it, it pauses while the tab is hidden, and it
 * never starts at all under `prefers-reduced-motion`.
 */
export function HomeHeroSlider({
  onAction,
  content,
  heroImageUrl,
}: {
  onAction: (action: HomeSlideAction) => void;
  /** Admin-editable copy (/admin/icerik). The first slide's kicker and body
      come from `home.hero.eyebrow` / `home.hero.lede` when an operator has
      set them. */
  content?: Record<string, string>;
  /** Ayarlar → "Hero görsel URL": overrides the first slide's photograph. */
  heroImageUrl?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  /* Set once, when a control is used. Autoplay never comes back after it. */
  const [stopped, setStopped] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduced.current) setStopped(true);
  }, []);

  useEffect(() => {
    if (stopped || paused) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % HOME_SLIDES.length),
      AUTOPLAY_MS,
    );
    return () => window.clearInterval(id);
  }, [stopped, paused]);

  // A slider advancing in a background tab is invisible motion that still
  // costs a paint on every tick.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const goTo = (next: number) => {
    setStopped(true);
    setIndex(
      ((next % HOME_SLIDES.length) + HOME_SLIDES.length) % HOME_SLIDES.length,
    );
  };

  const slide = HOME_SLIDES[index];
  // Only the leading slide is operator-editable; the others are fixed
  // editorial. `index === 0` rather than "the first render" so the panel's
  // copy follows its own slide when the carousel comes back round.
  const kicker =
    (index === 0 && content?.["home.hero.eyebrow"]) || slide.kicker;
  const text = (index === 0 && content?.["home.hero.lede"]) || slide.text;
  const photo = (index === 0 && heroImageUrl) || slide.photo;
  const scene = SCENES[slide.scene];

  return (
    <section className="hero-x" aria-label="Öne çıkanlar">
      <div className="wrap-wide">
        <div
          className="hero-x-frame"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          aria-roledescription="karusel"
          style={
            {
              "--scene-core": scene.core,
              "--scene-mid": scene.mid,
              "--scene-edge": scene.edge,
              "--scene-floor": scene.floor,
            } as React.CSSProperties
          }
        >
          <div className="hero-x-copy">
            <p className="hero-x-kicker">{kicker}</p>
            <h2 className="hero-x-title" key={`t-${index}`}>
              <span>{slide.title[0]}</span>
              <span>{slide.title[1]}</span>
            </h2>
            <p className="hero-x-text">{text}</p>
            <div className="hero-x-actions">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => onAction(slide.primary.action)}
              >
                {slide.primary.label}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-lg"
                onClick={() => onAction(slide.secondary.action)}
              >
                {slide.secondary.label}
              </button>
            </div>

            {/* Thumbnails. Each is the slide it selects, so the row doubles as
                the carousel's own control and never becomes decoration. */}
            <ul className="hero-x-thumbs">
              {HOME_SLIDES.map((s, i) => {
                const on = i === index;
                return (
                  <li key={s.photo}>
                    <button
                      type="button"
                      className={cx("hero-x-thumb", on && "on")}
                      onClick={() => goTo(i)}
                      aria-current={on || undefined}
                      aria-label={s.title.join(" ")}
                    >
                      <span
                        className="hero-x-thumb-light"
                        style={{
                          background: `radial-gradient(circle at 50% 42%, ${SCENES[s.scene].mid} 0%, ${SCENES[s.scene].edge} 70%)`,
                        }}
                        aria-hidden="true"
                      />
                      {/* An 80 px thumbnail of a 581 x 942 cut-out: next/image
                          sends a thumbnail-sized file (a few KB) instead of
                          the whole ~140 KB photo three times over. */}
                      <Image
                        src={s.photo}
                        alt=""
                        width={581}
                        height={942}
                        sizes="80px"
                      />
                      <span className="hero-x-thumb-name">
                        {s.title.join(" ")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
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
                sizes="(max-width: 760px) 70vw, 440px"
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="hero-x-photo"
                key={photo}
                src={photo}
                alt={slide.alt}
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
                width={581}
                height={942}
              />
            )}
          </div>

          <div className="hero-x-dots" role="group" aria-label="Slaytlar">
            {HOME_SLIDES.map((s, i) => (
              <button
                key={s.photo}
                type="button"
                className={cx("hero-x-dot", i === index && "on")}
                onClick={() => goTo(i)}
                aria-label={`${i + 1}. slayt: ${s.title.join(" ")}`}
                aria-current={i === index || undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
