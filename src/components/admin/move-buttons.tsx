"use client";

import { useEffect, useRef } from "react";

import { useToastAction } from "./action-form";
import type { ModalAction } from "./ui";
import { AdminIcon } from "./ui/icons";
import { ROW_CONTROL } from "./ui/styles";

type Direction = "up" | "down";

const ICON = { up: "chevronUp", down: "chevron" } as const;

/**
 * A row's ↑ / ↓ in an ordered list: one small stepper, two chevrons in a
 * hairline frame (ROW_CONTROL: 28 px where the pointer can aim, 44 px on a
 * touch screen). One click moves the row a place and the answer is a
 * toast; both halves wait while a move runs. The first row's ↑ and the last
 * row's ↓ are drawn faint and do nothing, so every row's stepper has the
 * same shape and the column stays straight; a list of one draws none.
 * `label` names the row for a screen reader ("Öne al: Sonbahar"). The
 * action reads `id` and `direction` (lib/admin/list-order.ts).
 *
 * A keyboard keeps its place: the moved row comes back in its new place
 * (the button React moves loses the focus) and at an edge the pressed half
 * is gone, so after the move the focus returns to this stepper, the same
 * way while it is there, else the other.
 */
export function MoveButtons({
  action,
  id,
  index,
  count,
  label,
}: {
  action: ModalAction;
  id: string;
  /** The row's place in the list as drawn, from 0. */
  index: number;
  count: number;
  label: string;
}) {
  const [, formAction, pending] = useToastAction(action);
  const box = useRef<HTMLSpanElement>(null);
  /** The way pressed while it had the focus, until the move is over. */
  const pressed = useRef<Direction | null>(null);

  useEffect(() => {
    const way = pressed.current;
    if (pending || !way) return;
    const button = (w: Direction) =>
      box.current?.querySelector<HTMLButtonElement>(
        `button[data-direction="${w}"]`,
      ) ?? null;
    pressed.current = null;
    (button(way) ?? button(way === "up" ? "down" : "up"))?.focus();
  });

  if (count < 2) return null;

  const half = (direction: Direction, open: boolean) =>
    open ? (
      <form action={formAction} className="inline-flex">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="direction" value={direction} />
        <button
          type="submit"
          data-direction={direction}
          disabled={pending}
          aria-busy={pending || undefined}
          aria-label={`${direction === "up" ? "Öne al" : "Geriye al"}: ${label}`}
          title={direction === "up" ? "Bir öne al" : "Bir geriye al"}
          className={ROW_CONTROL.step}
          onClick={(e) => {
            // A mouse click in Safari does not focus the button: no focus
            // to give back then.
            if (document.activeElement === e.currentTarget) {
              pressed.current = direction;
            }
          }}
        >
          <AdminIcon name={ICON[direction]} size={16} />
        </button>
      </form>
    ) : (
      <span aria-hidden="true" className={ROW_CONTROL.stepIdle}>
        <AdminIcon name={ICON[direction]} size={16} />
      </span>
    );
  return (
    <span ref={box} className={ROW_CONTROL.stepper}>
      {half("up", index > 0)}
      {half("down", index < count - 1)}
      <span className="sr-only">
        {index + 1}. sırada, toplam {count}
      </span>
    </span>
  );
}
