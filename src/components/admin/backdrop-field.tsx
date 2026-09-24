"use client";

import { useId, useState } from "react";

import type { BackdropColumns } from "@/lib/admin/store";
import {
  BACKDROP_FAMILIES,
  BACKDROP_KEYS,
  familyForHue,
  isBackdropKey,
  isVesselKey,
  NO_AUTO_PICK_CATEGORIES,
  VESSEL_KEYS,
  VESSEL_NAMES,
} from "@/lib/backdrop/families";
import {
  BACKDROP_AUTO,
  BACKDROP_FIELD,
  VESSEL_FIELD,
  VESSEL_FROM_CATEGORY,
  type PhotoKind,
} from "@/lib/backdrop/scene-core";

import { Select } from "./forms";

/**
 * The panel's "Sahne" and "Kap biçimi" fields (glass round G5; lafmobil
 * docs/DESIGN-GLASS.md §6.5 "Panel"), in the menu item form and in step 4 of
 * the product wizard.
 *
 * "Sahne" is the scene family the app draws behind the product. Left on
 * "Otomatik (fotoğraftan)", the save reads the photo and picks it; a family
 * chosen here is kept even when a new photo is uploaded. "Kap biçimi" is the
 * shape the app draws for an item with no photo; "Kategoriden" leaves it to
 * the category.
 *
 * The line under "Sahne" says what is stored now, in the operator's words:
 * "Otomatik: Karamel", "Sahne seçilemedi, elle seç", and why when there is
 * no pick. The pick itself happens on the server when the form is saved.
 */

export type StoredScene = Pick<
  BackdropColumns,
  "backdrop" | "backdropSource" | "backdropHex" | "vessel"
>;

export interface BackdropFieldProps {
  /** The stored row's scene columns; undefined for a new item. */
  stored?: StoredScene;
  /**
   * The stored photo the columns describe (menu `image`, shop `images[0]`),
   * as `photoKind()` names it.
   */
  photo: PhotoKind;
  /** The item's hue (menu `hue`, shop `img`): the app's scene when there is no pick. */
  hue: string;
  /** The menu `categoryKey` or the shop `cat`. */
  category: string;
}

type Tone = "ok" | "warn" | "info";

export interface SceneStatus {
  tone: Tone;
  text: string;
  /** The chosen family's colour, when there is one. */
  swatch: string | null;
  /** The body colour the photo was read as, when it was read. */
  measured: string | null;
}

/** The "Şu an" line: what the stored columns mean for the app. */
export function storedSceneStatus({
  stored,
  photo,
  hue,
  category,
}: BackdropFieldProps): SceneStatus {
  const measured = stored?.backdropHex ?? null;
  if (!stored) {
    return {
      tone: "info",
      text: "Fotoğraf yükleyip kaydedince sahne otomatik seçilir.",
      swatch: null,
      measured: null,
    };
  }
  if (isBackdropKey(stored.backdrop)) {
    const family = BACKDROP_FAMILIES[stored.backdrop];
    return {
      tone: "ok",
      text:
        stored.backdropSource === "manual"
          ? `Elle seçildi: ${family.name}`
          : `Otomatik: ${family.name}`,
      swatch: family.ref,
      measured,
    };
  }
  if (photo === "none") {
    const fallback = familyForHue(hue);
    return {
      tone: "info",
      text: fallback
        ? `Fotoğraf yok. Uygulama tondan ${BACKDROP_FAMILIES[fallback].name} sahnesini çizer.`
        : "Fotoğraf yok. Uygulama sahneyi kategoriden seçer.",
      swatch: fallback ? BACKDROP_FAMILIES[fallback].ref : null,
      measured: null,
    };
  }
  if (NO_AUTO_PICK_CATEGORIES.includes(category)) {
    return {
      tone: "info",
      text: "Bu kategoride otomatik seçim yapılmaz (içecek değil). İstersen elle seç.",
      swatch: null,
      measured: null,
    };
  }
  if (photo === "link") {
    return {
      tone: "warn",
      text: "Adresle eklenen fotoğrafın rengi panelde okunmaz, elle seç.",
      swatch: null,
      measured: null,
    };
  }
  return {
    tone: "warn",
    text: "Sahne seçilemedi, elle seç.",
    swatch: null,
    measured,
  };
}

const TONE_CLASS: Record<Tone, string> = {
  ok: "border-[var(--admin-border)] bg-[var(--admin-surface-2)] text-[var(--admin-text)]",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-[var(--admin-border)] bg-[var(--admin-surface-2)] text-[var(--admin-text-soft)]",
};

const LABEL_CLASS =
  "text-[10px] tracking-[0.22em] text-[var(--admin-text-mute)] uppercase";
const LABEL_STYLE = { fontFamily: "var(--mono), monospace" };

function Swatch({ color, title }: { color: string; title: string }) {
  return (
    <span
      aria-hidden="true"
      title={title}
      className="inline-block h-4 w-4 shrink-0 rounded-full border border-black/10"
      style={{ background: color }}
    />
  );
}

export function BackdropField(props: BackdropFieldProps) {
  const { stored } = props;
  const sceneId = useId();
  const statusId = useId();
  const hintId = useId();
  const vesselId = useId();
  const vesselHintId = useId();

  const storedChoice =
    stored?.backdropSource === "manual" && isBackdropKey(stored.backdrop)
      ? stored.backdrop
      : BACKDROP_AUTO;
  const [choice, setChoice] = useState<string>(storedChoice);
  const storedVessel = stored?.vessel;
  const status = storedSceneStatus(props);

  let pending: string;
  if (isBackdropKey(choice)) {
    pending =
      choice === storedChoice
        ? "Elle seçim yeni fotoğraf yüklense de korunur."
        : `Kaydedince elle seçim olur: ${BACKDROP_FAMILIES[choice].name}. Yeni fotoğraf yüklense de korunur.`;
  } else if (storedChoice !== BACKDROP_AUTO) {
    pending = "Kaydedince fotoğraftan yeniden seçilir.";
  } else {
    pending =
      "Yeni fotoğraf yüklersen sahne kaydedince ondan yeniden seçilir.";
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor={sceneId} className={LABEL_CLASS} style={LABEL_STYLE}>
          Sahne
        </label>
        <Select
          id={sceneId}
          name={BACKDROP_FIELD}
          aria-describedby={`${statusId} ${hintId}`}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value={BACKDROP_AUTO}>Otomatik (fotoğraftan)</option>
          {BACKDROP_KEYS.map((key) => {
            const family = BACKDROP_FAMILIES[key];
            return (
              <option key={key} value={key}>
                {family.examples
                  ? `${family.name} (${family.examples})`
                  : family.name}
              </option>
            );
          })}
        </Select>
        <div
          id={statusId}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${TONE_CLASS[status.tone]}`}
        >
          {status.swatch && (
            <Swatch color={status.swatch} title="Sahnenin rengi" />
          )}
          <span>
            <span className="text-[var(--admin-text-mute)]">Şu an: </span>
            {status.text}
          </span>
          {status.measured && (
            <span className="ml-auto flex items-center gap-1 text-[var(--admin-text-mute)]">
              <Swatch
                color={status.measured}
                title="Fotoğraftan okunan gövde rengi"
              />
              <span style={LABEL_STYLE}>{status.measured}</span>
            </span>
          )}
        </div>
        <span
          id={hintId}
          aria-live="polite"
          className="text-xs text-[var(--admin-text-mute)]"
        >
          Uygulamada ürünün arkasındaki ışıklı sahne. {pending}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={vesselId} className={LABEL_CLASS} style={LABEL_STYLE}>
          Kap biçimi
        </label>
        <Select
          id={vesselId}
          name={VESSEL_FIELD}
          aria-describedby={vesselHintId}
          defaultValue={
            isVesselKey(storedVessel) ? storedVessel : VESSEL_FROM_CATEGORY
          }
        >
          <option value={VESSEL_FROM_CATEGORY}>Kategoriden</option>
          {VESSEL_KEYS.map((key) => (
            <option key={key} value={key}>
              {VESSEL_NAMES[key]}
            </option>
          ))}
        </Select>
        <span id={vesselHintId} className="text-xs text-[var(--admin-text-mute)]">
          Fotoğrafsız kalemin uygulamada çizilen kabı. Kategorinin biçimi
          uymuyorsa seç (örneğin çay için ince belli bardak).
        </span>
      </div>
    </div>
  );
}
