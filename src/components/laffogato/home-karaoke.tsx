"use client";

import { priceLabel } from "@/lib/utils/format";

import { Illustration } from "./illustration";
import {
  hourToLabel,
  type KaraokeFacts,
  type KaraokeToday,
} from "./karaoke-today";
import { SCENES } from "./scenes";
import { useKaraokeToday } from "./use-karaoke-today";

/**
 * The karaoke band on the home page, right under the hero and the panel's
 * statement (operator, 17 Eki 2026: "sitede anasayfada da karaokeyi
 * vurgula").
 *
 * The room upstairs, drawn (`karaoke-room.webp`: our own flat vector, the
 * edible-cup microphone on a curtained stage), with what a visitor needs to
 * decide tonight: how many fit, until when, what an hour costs, what the top
 * tier saves - all from the panel's settings, never typed here - and today's
 * free hours, read live after hydration. Each hour opens the booking page
 * with that day and hour already picked (`?tarih=…&saat=…`).
 *
 * The room's berry light on porcelain, like the page heroes: never bordo, the
 * loyalty block further down is the page's one bordo surface. It arrives with
 * the site's `.reveal` and one sheen across the drawing; under
 * `prefers-reduced-motion` nothing moves (globals.css).
 */
export function HomeKaraoke({ facts }: { facts: KaraokeFacts }) {
  const today = useKaraokeToday();
  return <HomeKaraokeView facts={facts} today={today} />;
}

/** The band itself, for a given calendar answer (the tests render this). */
export function HomeKaraokeView({
  facts,
  today,
}: {
  facts: KaraokeFacts;
  today: KaraokeToday;
}) {
  const scene = SCENES.berry;
  const lines = [
    `${facts.capacity} kişiye kadar`,
    `Gece ${hourToLabel(facts.closeHour)} kadar`,
    `Saati ${priceLabel(facts.hourlyMinor)}`,
    facts.rubyDiscountPct > 0
      ? `${facts.rubyLabel} üyelere %${facts.rubyDiscountPct} indirim`
      : null,
  ].filter((l): l is string => l !== null);

  return (
    <section
      className="home-section home-karaoke-section"
      aria-labelledby="home-karaoke-title"
    >
      <div className="wrap">
        <div
          className="home-karaoke reveal"
          style={
            {
              "--scene-core": scene.core,
              "--scene-mid": scene.mid,
              "--scene-edge": scene.edge,
            } as React.CSSProperties
          }
        >
          <span className="home-karaoke-light" aria-hidden="true" />
          <div className="home-karaoke-copy">
            <p className="home-karaoke-kicker">Karaoke · köşkün üst katı</p>
            <h2 id="home-karaoke-title" className="home-karaoke-title">
              Sahne bu akşam senin
            </h2>
            <p className="home-karaoke-lede">
              200 yıllık köşkün üst katında sana ve arkadaşlarına ait bir oda.{" "}
              {facts.prepay
                ? "Saatini seç, kartınla öde, rezervasyonun hemen kesinleşsin."
                : "Saatini seç, isteğini gönder."}
            </p>
            <ul className="home-karaoke-facts">
              {lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <KaraokeLive today={today} />
            <div className="home-karaoke-actions">
              <a href="/karaoke" className="btn btn-primary btn-lg">
                Saatini seç
                <span className="arrow" aria-hidden="true">
                  →
                </span>
              </a>
              <p className="home-karaoke-note">
                Doğum günü mü var? Rezervasyonda notunu yaz
              </p>
            </div>
          </div>
          <div className="home-karaoke-stage" aria-hidden="true">
            <Illustration
              name="karaoke-room"
              width={440}
              sizes="(max-width: 760px) calc(100vw - 60px), 440px"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Today's line: up to three free hours as links, or where to look instead.
 * While the calendar is being asked it holds its height (empty, so nothing
 * jumps when the hours arrive); when it could not be read it is not there.
 */
function KaraokeLive({ today }: { today: KaraokeToday }) {
  switch (today.kind) {
    case "loading":
      return (
        <div className="home-karaoke-live is-pending" aria-hidden="true" />
      );
    case "error":
      return null;
    case "open":
      return (
        <div className="home-karaoke-live">
          <p className="home-karaoke-live-label" id="home-karaoke-hours">
            Bugün boş saatler
          </p>
          <ul
            className="home-karaoke-chips"
            aria-labelledby="home-karaoke-hours"
          >
            {today.chips.map((chip) => (
              <li key={chip.hour}>
                <a className="home-karaoke-chip" href={chip.href}>
                  {chip.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      );
    case "full":
    case "closed":
      return (
        <div className="home-karaoke-live">
          <a className="home-karaoke-tomorrow" href={today.tomorrowHref}>
            {today.kind === "full"
              ? "Bugün oda dolu, yarına bak"
              : "Yarın için saatini seç"}
          </a>
        </div>
      );
  }
}
