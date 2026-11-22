"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import Link from "@/components/link";

/**
 * The home page's first screen: a full-bleed film under the top bar, three
 * clips in turn, a title at the bottom left and a link at the bottom right
 * (operator, 21 Kas 2026: the hero of goodboybob.com). The films are
 * licensed stock (docs/MEDIA-LICENSES.md), not the reference's; a phone
 * gets its own upright cut.
 *
 * The server renders the first poster, so the screen is never empty and
 * the poster is the page's largest paint. The film starts after hydration,
 * and only where it should: not under reduced motion, not with Save-Data,
 * not while the hero is off screen or the tab is hidden. A clip is fetched
 * only when it is about to play. The pause button stops the film and the
 * turn of the slides (WCAG 2.2.2).
 */

export interface HeroSlide {
  /** public/video/<name>-wide.mp4, -tall.mp4 and the two posters. */
  media: string;
  title: string;
  link: { href: string; label: string };
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    media: "hero-1",
    title: "Tuzla’da İtalyan kahvesi",
    link: { href: "/menu", label: "Menüyü gör" },
  },
  {
    media: "hero-2",
    title: "Espresso barı",
    link: { href: "/menu/espresso", label: "Sıcak kahveler" },
  },
  {
    media: "hero-3",
    title: "Kahve evde de bizden",
    link: { href: "/magaza", label: "Mağazaya git" },
  },
];

const PHONE_QUERY = "(max-width: 767px)";

function src(slide: HeroSlide, tall: boolean, kind: "mp4" | "webp") {
  return `/video/${slide.media}-${tall ? "tall" : "wide"}.${kind}`;
}

/** A media query's answer; null on the server and during hydration. */
function useMedia(query: string): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => null,
  );
}

const noSubscribe = () => () => {};
function useSaveData(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () =>
      Boolean(
        (navigator as Navigator & { connection?: { saveData?: boolean } })
          .connection?.saveData,
      ),
    () => false,
  );
}

export function HomeHero({ slides = HERO_SLIDES }: { slides?: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const tall = useMedia(PHONE_QUERY);
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const saveData = useSaveData();
  const allowed = reduced === false && !saveData;
  const [userPaused, setUserPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const rootRef = useRef<HTMLElement>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  /** Which clips have been given a source (loaded lazily, then kept). */
  const [armed, setArmed] = useState<boolean[]>(() =>
    slides.map((_, i) => i === 0),
  );

  // Off screen or in a hidden tab, the film stops drawing.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    io.observe(el);
    const onVis = () =>
      setVisible(document.visibilityState === "visible" && isOnScreen(el));
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const shouldPlay = allowed && !userPaused && visible && tall !== null;

  // Play the current clip, pause every other one. `playing` follows the
  // element's own play and pause events.
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === index && shouldPlay) {
        v.play()?.catch(() => {
          // Autoplay refused (low-power mode): the poster stays.
        });
      } else {
        v.pause();
      }
    });
  }, [index, shouldPlay, armed, tall]);

  const go = useCallback(
    (next: number) => {
      const n = (next + slides.length) % slides.length;
      setArmed((a) => (a[n] ? a : a.map((x, i) => (i === n ? true : x))));
      const v = videoRefs.current[n];
      if (v) {
        try {
          v.currentTime = 0;
        } catch {
          // Not loaded yet: it starts at 0 anyway.
        }
      }
      setIndex(n);
    },
    [slides.length],
  );

  // Fetch the next clip while this one plays, so the turn has no gap.
  const onTime = (i: number) => (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (i !== index || !v.duration) return;
    if (v.currentTime / v.duration > 0.5) {
      const n = (i + 1) % slides.length;
      setArmed((a) => (a[n] ? a : a.map((x, k) => (k === n ? true : x))));
    }
  };

  // The button answers what the visitor sees, not the last thing they
  // pressed: when the browser refused to autoplay (low-power mode), the
  // film is stopped though nobody paused it, and the first tap must play
  // it. play() runs inside the tap, so it carries the user's activation.
  const toggle = () => {
    if (playing) {
      setUserPaused(true);
      return;
    }
    setUserPaused(false);
    videoRefs.current[index]?.play()?.catch(() => {
      // Still refused: the poster stays and the button keeps saying "oynat".
    });
  };
  const current = slides[index];

  return (
    <section
      ref={rootRef}
      className="hero-film"
      aria-roledescription="carousel"
      aria-label="L'Affogato"
    >
      <div className="hero-film-stage">
        {slides.map((s, i) => (
          <div
            key={s.media}
            className="hero-film-slide"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} / ${slides.length}: ${s.title}`}
            data-active={i === index ? "true" : undefined}
            aria-hidden={i === index ? undefined : true}
          >
            {/* The poster: the server's paint, and what reduced motion
                keeps. A phone gets the upright cut. */}
            <picture>
              <source media={PHONE_QUERY} srcSet={src(s, true, "webp")} />
              <img
                className="hero-film-poster"
                src={src(s, false, "webp")}
                alt=""
                fetchPriority={i === 0 ? "high" : "low"}
                loading={i === 0 ? "eager" : "lazy"}
                decoding={i === 0 ? "sync" : "async"}
              />
            </picture>
            {tall !== null && allowed && armed[i] ? (
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                className="hero-film-video"
                src={src(s, tall, "mp4")}
                poster={src(s, tall, "webp")}
                muted
                playsInline
                preload="auto"
                onTimeUpdate={onTime(i)}
                onPlay={() => {
                  if (i === index) setPlaying(true);
                }}
                onPause={() => {
                  if (i === index) setPlaying(false);
                }}
                onEnded={() => {
                  if (i === index) go(i + 1);
                }}
              />
            ) : null}
          </div>
        ))}
        <div className="hero-film-shade" aria-hidden="true" />
      </div>

      <div className="hero-film-caption">
        {/* Announced only when the visitor turns the slide; while the film
            turns them itself, a new title every few seconds would talk
            over whatever they are reading (WAI-ARIA carousel pattern). */}
        <p className="hero-film-title" aria-live={playing ? "off" : "polite"}>
          {current.title}
        </p>
        <div className="hero-film-controls">
          <Link className="hero-film-link" href={current.link.href}>
            {current.link.label}
          </Link>
          <div className="hero-film-pager" role="group" aria-label="Slaytlar">
            {slides.map((s, i) => (
              <button
                key={s.media}
                type="button"
                className="hero-film-dot"
                aria-label={`${i + 1}. slayt: ${s.title}`}
                aria-current={i === index ? "true" : undefined}
                onClick={() => go(i)}
              >
                {String(i + 1).padStart(2, "0")}
              </button>
            ))}
          </div>
          {allowed ? (
            <button
              type="button"
              className="hero-film-pause"
              onClick={toggle}
              aria-label={playing ? "Videoyu durdur" : "Videoyu oynat"}
            >
              {playing ? (
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5 3v10M11 3v10" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5 3.5v9l7.5-4.5z" />
                </svg>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function isOnScreen(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < window.innerHeight;
}
