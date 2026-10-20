import { cx } from "@/components/laffogato/cx";

/**
 * The track and knob of an on/off switch, drawn inside a
 * `<button role="switch" aria-checked>` that carries the name and the
 * state; this part is decoration (`aria-hidden`). The state reads from the
 * knob's side as well as the colour. Off, the track's edge is the field
 * border (3.31:1 on white) and the knob the muted ink (5.71:1).
 */
export function SwitchMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-on={on ? "" : undefined}
      className={cx(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors motion-reduce:transition-none",
        on
          ? "border-[var(--admin-primary)] bg-[var(--admin-primary)]"
          : "border-[var(--admin-border-field)] bg-[var(--admin-surface)]",
      )}
    >
      <span
        className={cx(
          "absolute top-[3px] left-[3px] h-3 w-3 rounded-full transition-transform motion-reduce:transition-none",
          on ? "translate-x-4 bg-white" : "bg-[var(--admin-text-mute)]",
        )}
      />
    </span>
  );
}
