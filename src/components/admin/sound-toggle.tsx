"use client";

import { useCallback } from "react";

import { cx } from "@/components/laffogato/cx";

import { beep } from "./beep";
import { readSoundPref, useSoundPref, writeSoundPref } from "./sound-pref";
import { COMPACT } from "./ui/styles";

/**
 * The sound toggle's name. It stays the same whatever the state: the state
 * is `aria-pressed` (and the dot), so a screen reader hears "Yeni sipariş
 * sesi, basılı" rather than "Ses kapalı, basılı değil" (admin audit ORD-27).
 */
export const SOUND_TOGGLE_LABEL = "Yeni sipariş sesi";

/**
 * The order list's switch for the panel's one sound (sound-pref.ts, shared
 * with the top bar's bell). The orders page hands it to the FilterBar's
 * toolbar, beside "Görünümler", only while the list polls: it had a row of
 * its own above the table (21 Oct 2026), a fourth row of controls before
 * the first order on a phone.
 */
export function SoundToggle() {
  const sound = useSoundPref();
  const toggle = useCallback(() => {
    const next = !readSoundPref();
    writeSoundPref(next);
    // Proof it works, on the click that turned it on - and the gesture a
    // browser wants before it will let a page make a sound at all.
    if (next) beep(true);
  }, []);
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={sound}
      title="Yeni sipariş geldiğinde kısa bir ses çalar."
      className={cx(
        "inline-flex min-h-11 items-center gap-2 rounded-lg border px-3.5 text-sm transition-colors pointer-fine:min-h-9",
        COMPACT.minH8,
        sound
          ? "border-[var(--admin-primary)] bg-[var(--admin-primary-soft)] text-[var(--admin-primary)]"
          : "border-[var(--admin-border-strong)] bg-[var(--admin-surface)] text-[var(--admin-text-soft)] hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)]",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "h-2.5 w-2.5 rounded-full border",
          sound
            ? "border-[var(--admin-primary)] bg-[var(--admin-primary)]"
            : "border-[var(--admin-text-mute)] bg-transparent",
        )}
      />
      {SOUND_TOGGLE_LABEL}
    </button>
  );
}
