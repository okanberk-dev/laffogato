"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

import { cx } from "@/components/laffogato/cx";

import { BUTTON } from "./styles";

export interface ActionMenuProps {
  /** Accessible name of the "⋯" button; default "İşlemler". */
  label?: string;
  /** Show `label` next to the dots instead of only to screen readers. */
  showLabel?: boolean;
  /** Which edge of the button the panel lines up with; default `end`. */
  align?: "start" | "end";
  /** ActionMenuLink, ActionMenuButton, ActionModal (`triggerVariant="menu"`), ConfirmButton. */
  children: ReactNode;
  className?: string;
}

const ITEMS = "a[href], button";

/**
 * The row and page "⋯" menu, on `<details>`/`<summary>`: it opens with a
 * click, Enter or Space and works before hydration. On top of that it closes
 * on an outside click, Esc, scroll and after an item is chosen; ↑/↓ move
 * between items. The panel is positioned `fixed` when it opens, so a table's
 * horizontal scroll box does not clip it.
 *
 * @example
 * <ActionMenu label={`Sipariş ${o.orderNo} işlemleri`}>
 *   <ActionMenuLink href={`/admin/siparisler/${o.id}`}>Detay</ActionMenuLink>
 *   <ActionMenuButton disabledReason="İade yetkisi gerekiyor">İade başlat</ActionMenuButton>
 *   <ConfirmButton variant="menuDanger" label="İptal et" action={cancel} hidden={{ id: o.id }} reason={{ required: true }} />
 * </ActionMenu>
 */
export function ActionMenu({
  label = "İşlemler",
  showLabel = false,
  align = "end",
  children,
  className,
}: ActionMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const close = (focusSummary = false) => {
    const details = detailsRef.current;
    if (!details?.open) return;
    details.open = false;
    if (focusSummary) details.querySelector("summary")?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const details = detailsRef.current;
    const onPointerDown = (e: PointerEvent) => {
      if (details && !details.contains(e.target as Node)) details.open = false;
    };
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      if (details) details.open = false;
    };
    const onResize = () => {
      if (details) details.open = false;
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const place = () => {
    const details = detailsRef.current;
    const panel = panelRef.current;
    const summary = details?.querySelector("summary");
    if (!details || !panel || !summary) return;
    const r = summary.getBoundingClientRect();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const gap = 4;
    const edge = 8;
    let top = r.bottom + gap;
    if (top + h > window.innerHeight - edge && r.top - gap - h >= edge) {
      top = r.top - gap - h;
    }
    let left = align === "end" ? r.right - w : r.left;
    left = Math.min(Math.max(edge, left), window.innerWidth - w - edge);
    Object.assign(panel.style, {
      position: "fixed",
      top: `${Math.max(edge, top)}px`,
      left: `${left}px`,
      right: "auto",
    });
  };

  const onToggle = () => {
    const isOpen = detailsRef.current?.open ?? false;
    setOpen(isOpen);
    if (isOpen) place();
    else panelRef.current?.removeAttribute("style");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDetailsElement>) => {
    if (!detailsRef.current?.open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [],
    );
    if (items.length === 0) return;
    e.preventDefault();
    const at = items.indexOf(document.activeElement as HTMLElement);
    const step = e.key === "ArrowDown" ? 1 : -1;
    const next =
      at === -1
        ? step === 1
          ? 0
          : items.length - 1
        : (at + step + items.length) % items.length;
    items[next]?.focus();
  };

  // Choosing an item closes the menu; a disabled one (aria-disabled) does not.
  const onPanelClick = (e: MouseEvent<HTMLDivElement>) => {
    const item = (e.target as Element).closest(ITEMS);
    if (item && item.getAttribute("aria-disabled") !== "true") close();
  };

  return (
    <details
      ref={detailsRef}
      onToggle={onToggle}
      onKeyDown={onKeyDown}
      className={cx("relative inline-block text-left", className)}
    >
      <summary
        aria-label={showLabel ? undefined : label}
        aria-controls={panelId}
        className={cx(
          "inline-flex min-h-[44px] min-w-[44px] cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-text-soft)] select-none hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-accent)]/45 focus-visible:outline-none [&::-webkit-details-marker]:hidden",
          open && "border-[var(--admin-primary)] text-[var(--admin-primary)]",
        )}
      >
        {showLabel ? <span>{label}</span> : null}
        <span aria-hidden="true" className="text-lg leading-none">
          ⋯
        </span>
      </summary>
      <div
        ref={panelRef}
        id={panelId}
        onClick={onPanelClick}
        className={cx(
          "absolute top-full z-40 mt-1 flex w-60 max-w-[calc(100vw-1rem)] flex-col gap-0.5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1.5 shadow-[0_12px_32px_rgba(44,29,17,0.16)]",
          align === "end" ? "right-0" : "left-0",
        )}
      >
        {children}
      </div>
    </details>
  );
}

/** A link row in an ActionMenu. */
export function ActionMenuLink({
  href,
  children,
  tone = "default",
  prefetch,
}: {
  href: string;
  children: ReactNode;
  tone?: "default" | "danger";
  prefetch?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={tone === "danger" ? BUTTON.menuDanger : BUTTON.menu}
    >
      {children}
    </Link>
  );
}

/**
 * A button row in an ActionMenu.
 *
 * `disabledReason` keeps it visible and focusable (`aria-disabled`) with the
 * reason underneath, instead of hiding it or letting it fail on click.
 * `type="submit"` with `form` / `name` / `value` submits a form elsewhere on
 * the page.
 */
export function ActionMenuButton({
  children,
  onClick,
  tone = "default",
  disabledReason,
  type = "button",
  form,
  name,
  value,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "danger";
  disabledReason?: string;
  type?: "button" | "submit";
  form?: string;
  name?: string;
  value?: string;
}) {
  const reasonId = useId();
  const cls = tone === "danger" ? BUTTON.menuDanger : BUTTON.menu;
  if (disabledReason) {
    return (
      <span className="flex flex-col">
        <button
          type="button"
          aria-disabled="true"
          aria-describedby={reasonId}
          onClick={(e) => e.preventDefault()}
          className={cls}
        >
          {children}
        </button>
        <span
          id={reasonId}
          className="-mt-2 px-3 pb-2 text-xs text-[var(--admin-text-soft)]"
        >
          {disabledReason}
        </span>
      </span>
    );
  }
  return (
    <button
      type={type}
      form={form}
      name={name}
      value={value}
      onClick={onClick}
      className={cls}
    >
      {children}
    </button>
  );
}

/** A thin rule between groups of items. */
export function ActionMenuSeparator() {
  return (
    <hr aria-hidden="true" className="my-1 border-[var(--admin-border)]" />
  );
}
