"use client";

import { useEffect, useRef, useState } from "react";

import { HOME_SLIDES, type HomeSlideAction } from "./data";

const AUTOPLAY_MS = 7000;

/**
 * The home page hero — three slides on their own coloured grounds, copy on the
 * left and a venue photo on the right.
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
      set them — the rewrite had orphaned both fields, so the panel was
      offering two controls that changed nothing. */
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

  return (
    <section className="home-hero" aria-label="Öne çıkanlar">
      <div className="wrap">
        <div
          className="home-hero-frame"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          aria-roledescription="karusel"
        >
          <div
            className="home-hero-track"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {HOME_SLIDES.map((s, i) => {
              const hidden = i !== index;
              // Only the first slide is operator-editable; the other two are
              // fixed editorial.
              const kicker =
                (i === 0 && content?.["home.hero.eyebrow"]) || s.kicker;
              const text = (i === 0 && content?.["home.hero.lede"]) || s.text;
              const photo = (i === 0 && heroImageUrl) || s.photo;
              return (
                <div
                  className="home-hero-slide"
                  key={s.title}
                  style={{ background: s.bg }}
                  role="group"
                  aria-roledescription="slayt"
                  aria-label={`${i + 1} / ${HOME_SLIDES.length}`}
                  /* Off-screen slides stay in the DOM for the transition but
                     must not be reachable by tab or read out by a screen
                     reader. React 19 takes `inert` as a real boolean prop —
                     the string form it inherited from HTML is dropped, which
                     left the off-screen slides tabbable inside an aria-hidden
                     subtree (the worst of both worlds for a screen reader). */
                  inert={hidden}
                  aria-hidden={hidden || undefined}
                >
                  <div className="home-hero-copy">
                    <span
                      className="home-hero-kicker"
                      style={{ color: s.kickerInk }}
                    >
                      {kicker}
                    </span>
                    <h2 className="home-hero-title" style={{ color: s.ink }}>
                      {s.title}
                    </h2>
                    <p className="home-hero-text" style={{ color: s.bodyInk }}>
                      {text}
                    </p>
                    <div className="home-hero-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => onAction(s.primary.action)}
                      >
                        {s.primary.label}
                      </button>
                      <button
                        type="button"
                        className="btn"
                        style={{
                          border: `1.5px solid ${s.altBorder}`,
                          color: s.ink,
                        }}
                        onClick={() => onAction(s.secondary.action)}
                      >
                        {s.secondary.label}
                      </button>
                    </div>
                  </div>
                  <div className="home-hero-photo">
                    <img
                      src={photo}
                      alt={s.alt}
                      style={{ objectPosition: s.pos }}
                      /* The first slide is the LCP element; the other two are
                         off-screen until someone asks for them. */
                      loading={i === 0 ? "eager" : "lazy"}
                      fetchPriority={i === 0 ? "high" : "auto"}
                      width={765}
                      height={1020}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="home-hero-arrow prev"
            onClick={() => goTo(index - 1)}
            aria-label="Önceki slayt"
          >
            ‹
          </button>
          <button
            type="button"
            className="home-hero-arrow next"
            onClick={() => goTo(index + 1)}
            aria-label="Sonraki slayt"
          >
            ›
          </button>

          <div className="home-hero-dots">
            {HOME_SLIDES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                className={`home-hero-dot ${i === index ? "on" : ""}`}
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
