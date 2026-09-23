"use client";

import { useEffect, useRef, useState } from "react";

import { HOME_SLIDES, type HomeSlideAction } from "./data";

const AUTOPLAY_MS = 7000;

/**
 * The home hero, laid out to the reference the operator supplied.
 *
 * A cream band under the white nav; on the left an eyebrow, an oversized
 * cocoa headline broken over two lines, four lines of body copy and a thin
 * outlined call to action; on the right the drink cut out and floated over a
 * deep-green disc that runs off the right edge of the frame. Under the copy,
 * the other drinks as thumbnails with a rating pill, the active one carrying
 * a quantity stepper; under the whole thing, the slide dots.
 *
 * The disc is an ellipse, not a rounded rectangle - that is what makes the
 * shape read as a shape rather than as a panel, and it is why the cup is
 * allowed to hang off its lower left rather than sit inside it.
 *
 * Autoplay is deliberately conservative. It stops for good the first time the
 * visitor touches a control (rather than resuming and yanking the slide out
 * from under them mid-read), it pauses while the pointer is over the slider or
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
      set them - the rewrite had orphaned both fields, so the panel was
      offering two controls that changed nothing. */
  content?: Record<string, string>;
  /** Ayarlar → "Hero görsel URL": overrides the first slide's photograph. */
  heroImageUrl?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  /* Set once, when a control is used. Autoplay never comes back after it. */
  const [stopped, setStopped] = useState(false);
  /* The stepper on the active thumbnail. Cafe drinks are not orderable from
     the web (the cart carries shop products), so this is the reference's
     control kept as a quantity the CTA carries into the menu - never a
     silent add to a basket that could not become an order. */
  const [qty, setQty] = useState(1);
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
    setQty(1);
    setIndex(
      ((next % HOME_SLIDES.length) + HOME_SLIDES.length) % HOME_SLIDES.length,
    );
  };

  const slide = HOME_SLIDES[index];
  // Only the leading slide is operator-editable; the others are fixed
  // editorial. `index === 0` rather than "the first render" so the panel's
  // copy follows its own slide when the carousel comes back round.
  const kicker = (index === 0 && content?.["home.hero.eyebrow"]) || slide.kicker;
  const text = (index === 0 && content?.["home.hero.lede"]) || slide.text;
  const photo = (index === 0 && heroImageUrl) || slide.photo;

  return (
    <section className="hero-x" aria-label="Öne çıkanlar">
      <div className="wrap">
        <div
          className="hero-x-frame"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          aria-roledescription="karusel"
        >
          {/* The mark, blown up and barely inked - the reference's watermark. */}
          <span className="hero-x-watermark" aria-hidden="true" />

          <div className="hero-x-copy">
            <p className="hero-x-kicker">{kicker}</p>
            <h2 className="hero-x-title">
              <span>{slide.title[0]}</span>
              <span>{slide.title[1]}</span>
            </h2>
            <p className="hero-x-text">{text}</p>
            <div className="hero-x-actions">
              <button
                type="button"
                className="hero-x-cta"
                onClick={() => onAction(slide.primary.action)}
              >
                {slide.primary.label}
              </button>
              <button
                type="button"
                className="hero-x-cta ghost"
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
                  <li key={s.photo} className={`hero-x-thumb ${on ? "on" : ""}`}>
                    <button
                      type="button"
                      className="hero-x-thumb-btn"
                      onClick={() => goTo(i)}
                      aria-current={on || undefined}
                      aria-label={s.title.join(" ")}
                    >
                      {/* Same file as the stage photo below, which can be
                          the panel's hero URL; a plain <img> lets both share
                          one cached download. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.photo} alt="" loading="lazy" width={581} height={942} />
                    </button>
                    {on ? (
                      <div className="hero-x-stepper">
                        <button
                          type="button"
                          onClick={() => setQty((q) => Math.max(1, q - 1))}
                          aria-label="Adet azalt"
                          disabled={qty <= 1}
                        >
                          −
                        </button>
                        <span aria-live="polite" aria-label={`Adet ${qty}`}>
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty((q) => Math.min(9, q + 1))}
                          aria-label="Adet artır"
                          disabled={qty >= 9}
                        >
                          +
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="hero-x-stage">
            <span className="hero-x-disc" aria-hidden="true" />
            <span className="hero-x-sparkle a" aria-hidden="true">
              ✦
            </span>
            <span className="hero-x-sparkle b" aria-hidden="true">
              ✦
            </span>
            <span className="hero-x-sparkle c" aria-hidden="true">
              ✦
            </span>
            {/* The first slide's photo can be the panel's "Hero görsel URL",
                an arbitrary host next/image would need a wildcard
                remotePattern for. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="hero-x-photo"
              /* Keyed on the photo so a slide change remounts the image and
                 replays the rise; without it React reuses the node and the
                 drink swaps in place with no transition at all. */
              key={photo}
              src={photo}
              alt={slide.alt}
              /* The first drink is the LCP element. */
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"}
              width={581}
              height={942}
            />
          </div>

          <div className="hero-x-dots">
            {HOME_SLIDES.map((s, i) => (
              <button
                key={s.photo}
                type="button"
                className={`hero-x-dot ${i === index ? "on" : ""}`}
                onClick={() => goTo(i)}
                aria-label={`${i + 1}. slayt`}
                aria-current={i === index || undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
