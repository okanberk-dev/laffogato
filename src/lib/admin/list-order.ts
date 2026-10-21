// Client-safe (no server-only): the fields and the answers of two one-click
// row controls the panel's ordered lists share, the ↑ / ↓ buttons (shop
// and app slides, app announcements and posts, menu items) and the list's
// "Yayına al" / "Yayından kaldır" (the slides, announcements and posts).

import { actionError, actionOk, type ActionResult } from "./action-result";

export type MoveDirection = "up" | "down";

/** What a move came to: moved, already first or last, or gone (store.ts). */
export type MoveOutcome = "moved" | "edge" | "not_found";

/** The ↑ / ↓ form: the row and the way, or why it cannot run. */
export function readMoveForm(
  formData: FormData,
):
  | { ok: true; id: string; direction: MoveDirection }
  | { ok: false; error: string } {
  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction");
  if (!id) return { ok: false, error: "Kayıt seçilmedi." };
  if (direction !== "up" && direction !== "down") {
    return { ok: false, error: "Yön seçilmedi." };
  }
  return { ok: true, id, direction };
}

/**
 * The toast for a move. `noun` is the record, capitalised ("Slayt",
 * "Duyuru"); `gone` is the answer when it was deleted in the meantime.
 */
export function moveAnswer(
  outcome: MoveOutcome,
  direction: MoveDirection,
  noun: string,
  gone: string,
): ActionResult {
  if (outcome === "not_found") return actionError(gone);
  if (outcome === "edge") {
    return actionError(
      direction === "up"
        ? `${noun} zaten en başta.`
        : `${noun} zaten en sonda.`,
    );
  }
  return actionOk(
    direction === "up"
      ? `${noun} bir öne alındı.`
      : `${noun} bir geriye alındı.`,
  );
}

/**
 * The "Yayına al" / "Yayından kaldır" form: the row and the state asked for
 * (`active` "1" or "0"), never a flip, so a double click cannot undo itself.
 */
export function readActiveForm(
  formData: FormData,
): { ok: true; id: string; isActive: boolean } | { ok: false; error: string } {
  const id = String(formData.get("id") ?? "");
  const raw = formData.get("active");
  if (!id) return { ok: false, error: "Kayıt seçilmedi." };
  if (raw !== "1" && raw !== "0") {
    return { ok: false, error: "Geçersiz istek." };
  }
  return { ok: true, id, isActive: raw === "1" };
}
