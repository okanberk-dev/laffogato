"use client";

import { useEffect, useState } from "react";

import { useClientValue } from "./use-client-value";

const isBrowser = () => true;

export interface ShopHeroSlide {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  textTheme: "light" | "dark";
}

const ROTATE_MS = 6500;

export function ShopHeroSlider({ slides }: { slides: ShopHeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = slides.length;

  /**
   * Which slides may fetch their background.
   *
   * Every slide used to carry its `background-image` from the first paint, so
   * a three-slide hero downloaded three full-bleed photographs before the
   * visitor had seen one. Only the current slide and the one on either side
   * load; a slide stays loaded once shown, so going back is instant and
   * nothing re-flashes.
   *
   * The server HTML carries the first slide's photo only; the neighbours
   * join once hydration is done, so they never compete with the first
   * paint. Kept up to date during render (react.dev "adjusting state when
   * a prop changes"), not in an effect.
   */
  const [loaded, setLoaded] = useState<boolean[]>(() =>
    slides.map((_, i) => i === 0),
  );
  const hydrated = useClientValue(isBrowser, false);
  const wanted =
    total === 0
      ? []
      : hydrated
        ? [index, (index + 1) % total, (index - 1 + total) % total]
        : [index];
  if (wanted.some((i) => !loaded[i])) {
    const next = [...loaded];
    for (const i of wanted) next[i] = true;
    setLoaded(next);
  }

  useEffect(() => {
    if (total <= 1 || paused) return;
    // Rotation stops for anyone who asks the platform not to animate - it is
    // decoration, and WCAG 2.2.2 gives a moving thing a way to be stopped.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [total, paused]);

  if (total === 0) return null;

  return (
    <section
      className="shop-hero-slider"
      aria-roledescription="carousel"
      aria-label="Mağaza vitrini"
      // Hovering or tabbing in stops the rotation, so a slide cannot slide out
      // from under someone reading or operating it.
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setPaused(false);
        }
      }}
    >
      <div className="shop-hero-track">
        {slides.map((s, i) => (
          <Slide key={s.id} slide={s} active={i === index} loaded={loaded[i]} />
        ))}
      </div>

      {total > 1 && (
        <>
          <button
            type="button"
            className="shop-hero-arrow shop-hero-arrow-prev"
            aria-label="Önceki slayt"
            onClick={() => setIndex((i) => (i - 1 + total) % total)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M10 2 L4 8 L10 14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="shop-hero-arrow shop-hero-arrow-next"
            aria-label="Sonraki slayt"
            onClick={() => setIndex((i) => (i + 1) % total)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 2 L12 8 L6 14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="shop-hero-playpause"
            aria-label={
              paused ? "Slaytları otomatik oynat" : "Otomatik geçişi durdur"
            }
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "▶" : "❚❚"}
          </button>
          <div
            className="shop-hero-dots"
            role="group"
            aria-label="Slayt seçici"
          >
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-current={i === index ? "true" : undefined}
                aria-label={`Slayt ${i + 1}: ${s.title}`}
                className="shop-hero-dot"
                data-active={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          {/* Live only while paused. Announcing "02 / 03" every 6.5 seconds
              interrupted whatever a screen-reader user was actually reading. */}
          <div
            className="shop-hero-counter tabular"
            aria-live={paused ? "polite" : "off"}
          >
            {String(index + 1).padStart(2, "0")} /{" "}
            {String(total).padStart(2, "0")}
          </div>
        </>
      )}
    </section>
  );
}

function Slide({
  slide,
  active,
  loaded,
}: {
  slide: ShopHeroSlide;
  active: boolean;
  loaded: boolean;
}) {
  const isLight = slide.textTheme === "light";
  const overlay = slide.imageUrl
    ? isLight
      ? "linear-gradient(to right, rgba(20,61,43,0.45), rgba(20,61,43,0.25) 60%, rgba(20,61,43,0.55))"
      : "linear-gradient(to right, rgba(255,255,255,0.35), rgba(255,255,255,0.1) 60%, rgba(255,255,255,0.35))"
    : isLight
      ? "linear-gradient(135deg, var(--brand) 0%, var(--bg-espresso-deep) 100%)"
      : "linear-gradient(135deg, #f3f5f2 0%, #e7eae7 100%)";

  const words = slide.title.trim().split(/\s+/);
  const lead = words.slice(0, -1).join(" ");
  const accent = words.length > 1 ? words[words.length - 1] : null;
  const accentColor = isLight ? "var(--gold-soft)" : "var(--gold-deep)";

  return (
    <article
      className="shop-hero-slide"
      data-active={active ? "true" : undefined}
      data-theme={slide.textTheme}
      aria-hidden={!active}
      style={{
        // The gradient alone until this slide is near: it is the fallback the
        // design already uses for a slide with no photo, so an unloaded slide
        // looks deliberate rather than broken.
        backgroundImage:
          slide.imageUrl && loaded
            ? `${overlay}, url(${slide.imageUrl})`
            : overlay,
      }}
    >
      <div className="shop-hero-content">
        <span className="eyebrow shop-hero-eyebrow">III · La bottega</span>
        <h2 className="shop-hero-title">
          {lead || slide.title || <span style={{ opacity: 0.5 }}>Başlık</span>}
          {accent && (
            <>
              {" "}
              <span
                className="shop-hero-title-accent"
                style={{ color: accentColor }}
              >
                {accent}
              </span>
            </>
          )}
        </h2>
        {slide.subtitle && (
          <p className="shop-hero-subtitle">{slide.subtitle}</p>
        )}
        {slide.ctaLabel && slide.ctaHref && (
          <a
            href={slide.ctaHref}
            className={`btn ${isLight ? "btn-light" : "btn-primary"} btn-lg shop-hero-cta`}
            tabIndex={active ? undefined : -1}
          >
            {slide.ctaLabel}
            <span className="arrow">→</span>
          </a>
        )}
      </div>
    </article>
  );
}
