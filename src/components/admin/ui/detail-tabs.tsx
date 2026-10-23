"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cx } from "@/components/laffogato/cx";
import { withParams, type SearchParamsInput } from "@/lib/admin/list-params";

/** One tab of a record's page: its words, an optional count, its sections. */
export interface DetailTab {
  /** The `?sekme=` value and the panel's anchor; short lower-case ASCII. */
  id: string;
  label: string;
  /** Drawn beside the label when set ("Geçmiş 6"). */
  count?: number;
  content: ReactNode;
}

/**
 * A record's tabs (Innex's three-zone detail, 22 Eki 2026): the figures
 * that decide what to do stay outside them, in the page's left column; the
 * details sit here, one tab at a time. The tabs are links to `?sekme=…`,
 * so the server draws the asked-for tab and a tab can be linked to (or
 * opened without JavaScript); in the browser a click swaps the panel at
 * once and writes the address in place. Every panel is in the page,
 * hidden but the current one, so the page's forms and their state stay
 * as they were when a tab is left. The keys are the ARIA tab pattern's:
 * ←/→ (and Home/End) move between tabs. An anchor in the address
 * (`#odeme`) opens the tab that holds it.
 */
export function DetailTabs({
  tabs,
  label,
  initial,
  param = "sekme",
  query,
}: {
  tabs: readonly DetailTab[];
  /** The tab row's accessible name ("Sipariş ayrıntıları"). */
  label: string;
  /** The tab the server drew (pickDetailTab); the first without. */
  initial?: string;
  param?: string;
  /**
   * The page's address, so a tab's link keeps its other params (a
   * booking's way back, `geri`) when opened without JavaScript, in a new
   * tab or before hydration.
   */
  query?: SearchParamsInput;
}) {
  const baseId = useId();
  const [active, setActive] = useState(initial ?? tabs[0]?.id ?? "");
  const tabRefs = useRef(new Map<string, HTMLAnchorElement>());
  const tabId = (id: string) => `${baseId}-tab-${id}`;
  const panelId = (id: string) => `${baseId}-panel-${id}`;

  const select = (id: string, focus = false) => {
    setActive(id);
    if (focus) tabRefs.current.get(id)?.focus();
    const url = new URL(window.location.href);
    url.searchParams.set(param, id);
    url.hash = "";
    // `null`, as Next's docs write it: Next's own history state marks the
    // call as the router's, which then keeps the old address and puts it
    // back on the next server action (review of #231).
    window.history.replaceState(null, "", url);
  };

  // An anchor in the address opens the tab that holds it, on load and when
  // a link on the page changes it.
  useEffect(() => {
    const openFromHash = () => {
      const raw = window.location.hash.slice(1);
      if (!raw) return;
      // A malformed escape (`#%E0`) is read as written, never thrown.
      let hash = raw;
      try {
        hash = decodeURIComponent(raw);
      } catch {
        // keep the raw anchor
      }
      const target = document.getElementById(hash);
      const panel = target?.closest<HTMLElement>("[data-detail-panel]");
      const id = panel?.dataset.detailPanel;
      if (!id) return;
      setActive(id);
      requestAnimationFrame(() => target?.scrollIntoView({ block: "start" }));
    };
    const frame = requestAnimationFrame(openFromHash);
    window.addEventListener("hashchange", openFromHash);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLAnchorElement>, at: number) => {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight"
        ? at === last
          ? 0
          : at + 1
        : e.key === "ArrowLeft"
          ? at === 0
            ? last
            : at - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    select(tabs[next].id, true);
  };

  return (
    <div className="min-w-0">
      <div
        role="tablist"
        aria-label={label}
        className="mb-4 flex [scrollbar-width:none] gap-5 overflow-x-auto border-b border-[var(--admin-border)] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab, i) => {
          const current = tab.id === active;
          return (
            <a
              key={tab.id}
              ref={(el) => {
                if (el) tabRefs.current.set(tab.id, el);
                else tabRefs.current.delete(tab.id);
              }}
              role="tab"
              id={tabId(tab.id)}
              href={withParams(query, { [param]: tab.id })}
              aria-selected={current}
              aria-controls={panelId(tab.id)}
              tabIndex={current ? 0 : -1}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
                  return;
                }
                e.preventDefault();
                select(tab.id);
              }}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cx(
                "-mb-px inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-0.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 focus-visible:outline-none focus-visible:ring-inset pointer-fine:min-h-10",
                current
                  ? "border-[var(--admin-text)] text-[var(--admin-text)]"
                  : "border-transparent text-[var(--admin-text-mute)] hover:text-[var(--admin-text)]",
              )}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <span
                  className={cx(
                    "min-w-5 rounded-md px-1.5 py-px text-center text-xs leading-4 font-medium",
                    current
                      ? "bg-[var(--admin-text)] text-white"
                      : "bg-[var(--admin-panel)] text-[var(--admin-text-soft)]",
                  )}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {tab.count}
                </span>
              ) : null}
            </a>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={panelId(tab.id)}
          aria-labelledby={tabId(tab.id)}
          data-detail-panel={tab.id}
          hidden={tab.id !== active}
          // A panel whose first content is not focusable is reached with
          // Tab from its tab (the ARIA tab pattern).
          tabIndex={0}
          className="flex min-w-0 flex-col gap-4 focus-visible:outline-none"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
