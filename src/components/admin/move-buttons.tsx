import { ActionButton } from "./action-form";
import type { ModalAction } from "./ui";
import { AdminIcon } from "./ui/icons";
import { ROW_CONTROL } from "./ui/styles";

type Direction = "up" | "down";

const ICON = { up: "chevronUp", down: "chevron" } as const;

/**
 * A row's ↑ / ↓ in an ordered list: one small stepper, two chevrons in a
 * hairline frame (ROW_CONTROL: 28 px where the pointer can aim, 44 px on a
 * touch screen). One click moves the row a place and the answer is a
 * toast. The first row's ↑ and the last row's ↓ are drawn faint and do
 * nothing, so every row's stepper has the same shape and the column stays
 * straight; a list of one draws none. `label` names the row for a screen
 * reader ("Öne al: Sonbahar"). The action reads `id` and `direction`
 * (lib/admin/list-order.ts). Server-safe: the buttons are ActionButtons.
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
  if (count < 2) return null;
  const half = (direction: Direction, open: boolean) =>
    open ? (
      <ActionButton
        action={action}
        hidden={{ id, direction }}
        variant="bare"
        className={ROW_CONTROL.step}
        ariaLabel={`${direction === "up" ? "Öne al" : "Geriye al"}: ${label}`}
        title={direction === "up" ? "Bir öne al" : "Bir geriye al"}
      >
        <AdminIcon name={ICON[direction]} size={16} />
      </ActionButton>
    ) : (
      <span aria-hidden="true" className={ROW_CONTROL.stepIdle}>
        <AdminIcon name={ICON[direction]} size={16} />
      </span>
    );
  return (
    <span className={ROW_CONTROL.stepper}>
      {half("up", index > 0)}
      {half("down", index < count - 1)}
      <span className="sr-only">
        {index + 1}. sırada, toplam {count}
      </span>
    </span>
  );
}
