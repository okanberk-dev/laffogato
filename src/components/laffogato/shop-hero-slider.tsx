"use client";

import { useEffect, useState } from "react";

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
  const total = slides.length;

  useEffect(() => {
    if (total <= 1) return;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, ROTATE_MS);
    return () => window.clearInterval(t);
  }, [total]);

  if (total === 0) return null;

  return (
    <section className="shop-hero-slider" aria-roledescription="carousel">
      <div className="shop-hero-track">
        {slides.map((s, i) => (
          <Slide key={s.id} slide={s} active={i === index} />
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
          <div
            className="shop-hero-dots"
            role="tablist"
            aria-label="Slayt seçici"
          >
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Slayt ${i + 1}: ${s.title}`}
                className="shop-hero-dot"
                data-active={i === index ? "true" : undefined}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <div className="shop-hero-counter tabular" aria-live="polite">
            {String(index + 1).padStart(2, "0")} /{" "}
            {String(total).padStart(2, "0")}
          </div>
        </>
      )}
    </section>
  );
}

function Slide({ slide, active }: { slide: ShopHeroSlide; active: boolean }) {
  const isLight = slide.textTheme === "light";
  const overlay = slide.imageUrl
    ? isLight
      ? "linear-gradient(to right, rgba(20,16,11,0.45), rgba(20,16,11,0.25) 60%, rgba(20,16,11,0.55))"
      : "linear-gradient(to right, rgba(255,255,255,0.35), rgba(255,255,255,0.1) 60%, rgba(255,255,255,0.35))"
    : isLight
      ? "linear-gradient(135deg, #6E4220 0%, #2F1F10 100%)"
      : "linear-gradient(135deg, #F5E6D3 0%, #E6D4B0 100%)";

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
        backgroundImage: slide.imageUrl
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
