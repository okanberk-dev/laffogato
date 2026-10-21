"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Autocomplete } from "react-aria-components/Autocomplete";
import { Header } from "react-aria-components/Header";
import { I18nProvider } from "react-aria-components/I18nProvider";
import { Input } from "react-aria-components/Input";
import {
  ListBox,
  ListBoxItem,
  ListBoxSection,
} from "react-aria-components/ListBox";
import { TextField } from "react-aria-components/TextField";

import {
  readSoundPref,
  useSoundPref,
  writeSoundPref,
} from "@/components/admin/sound-pref";
import { useToast } from "@/components/admin/ui/toast";
import {
  commandEntries,
  createEntries,
  goEntries,
  listRow,
  PALETTE_SEARCH_DEBOUNCE_MS,
  PALETTE_SEARCH_MIN,
  PALETTE_SEARCH_ROUTE,
  parseSearchAnswer,
  rankEntries,
  resultCountText,
  runPaletteCommand,
  searchOutcome,
  signInHref,
  visibleRecents,
  type PaletteCommand,
  type PaletteEntry,
  type PaletteHitGroup,
  type PaletteNavGroup,
  type PaletteView,
} from "@/lib/admin/palette-core";
import type { AdminRole } from "@/lib/admin/roles";

import { readRecents } from "./recents";
import { SearchIcon } from "./trigger";

/*
 * The palette's list (admin UI v2, UI-6, design §4): React Aria's
 * Autocomplete, TextField and ListBox, inside the trigger's native
 * <dialog> (one modal system: no React Aria Modal, Dialog, Popover or
 * Menu). React Aria does not filter: palette-core ranks the panel's own
 * entries as the text changes, and the server's record hits are drawn as
 * they came. Read-only: an entry opens a page (`navigate`, the trigger's:
 * it asks a form with unsaved changes first, then opens the page; never
 * prefetched while the arrow keys pass over it: every panel page is
 * dynamic, so each would be a server render and its database reads),
 * flips this browser's own order sound, or asks the shell for one of its own
 * commands (the shortcut sheet, a view preference) with an event. No
 * Server Action is imported here. Opened by `n` on a page with no "Yeni"
 * link, it lists Oluştur alone (view "create").
 */

type SearchState =
  | { status: "idle" }
  | { status: "loading"; text: string }
  | { status: "ok"; text: string; groups: PaletteHitGroup[] }
  | { status: "expired" }
  | { status: "unavailable" };

type Target = { href: string } | { command: PaletteCommand };

export interface PaletteProps {
  groups: PaletteNavGroup[];
  role: AdminRole;
  accountKey: string;
  pathname: string;
  /** "create": Oluştur alone (the `n` key); the whole palette otherwise. */
  view?: PaletteView;
  /** Closes the dialog; the trigger takes focus back. */
  close: () => void;
  /** Opens a page and closes the dialog, unless unsaved changes say no. */
  navigate: (href: string) => void;
}

/**
 * The record search for `text`, from two characters, 200 ms after the last
 * key; the answer to an older text is aborted, never drawn.
 */
function useRecordSearch(text: string): SearchState {
  const query = text.trim();
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const active = query.length >= PALETTE_SEARCH_MIN;

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState({ status: "loading", text: query });
      try {
        const res = await fetch(PALETTE_SEARCH_ROUTE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: query }),
          credentials: "same-origin",
          redirect: "manual",
          signal: controller.signal,
        });
        const outcome = searchOutcome(res);
        if (outcome !== "ok") {
          setState({ status: outcome });
          return;
        }
        const groups = parseSearchAnswer(await res.json());
        setState(
          groups
            ? { status: "ok", text: query, groups }
            : { status: "unavailable" },
        );
      } catch {
        if (!controller.signal.aborted) setState({ status: "unavailable" });
      }
    }, PALETTE_SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, active]);

  if (!active) return { status: "idle" };
  // Typed on since the answer came: the old hits are not this text's.
  if (
    (state.status === "ok" || state.status === "loading") &&
    state.text !== query
  )
    return { status: "loading", text: query };
  return state;
}

const SECTION_CLASS = "pb-1";
const HEADER_CLASS =
  "px-4 pt-3 pb-1 text-xs font-medium text-[var(--admin-text-mute)]";
const ITEM_CLASS =
  "mx-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--admin-text)] outline-none data-[focused]:bg-[var(--admin-primary-soft)] data-[focused]:text-[var(--admin-primary)] data-[hovered]:bg-[var(--admin-surface-2)]";

function Row({
  label,
  hint,
  extra,
}: {
  label: string;
  hint?: string;
  extra?: ReactNode;
}) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {extra}
      </span>
      {hint ? (
        <span className="shrink-0 truncate text-xs text-[var(--admin-text-mute)]">
          {hint}
        </span>
      ) : null}
    </>
  );
}

/**
 * An amount as the lists write it. A hit's time is left to its own page:
 * the row stays one line, and the palette's chunk stays inside its budget.
 */
const money = (minor: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
    minor / 100,
  );

export function Palette({
  groups,
  role,
  accountKey,
  pathname,
  view,
  close,
  navigate,
}: PaletteProps) {
  const toast = useToast();
  const soundOn = useSoundPref();
  const [text, setText] = useState("");
  const all = view !== "create";
  const search = useRecordSearch(all ? text : "");

  // Read once per opening: the list cannot change while the dialog is up.
  const [recents] = useState(() =>
    visibleRecents(readRecents(accountKey), role, pathname),
  );
  const go = useMemo(() => goEntries(groups, role), [groups, role]);
  const create = useMemo(() => createEntries(role), [role]);
  const commands = useMemo(
    () => commandEntries(role, { soundOn }),
    [role, soundOn],
  );

  const query = text.trim();
  const goShown = rankEntries(go, query);
  const createShown = rankEntries(create, query);
  const commandsShown = rankEntries(commands, query);
  const hitGroups =
    search.status === "ok" ? search.groups.filter((g) => g.hits.length) : [];

  const map = new Map<string, Target>();
  const entryTarget = (e: PaletteEntry): Target | null =>
    e.href ? { href: e.href } : e.command ? { command: e.command } : null;
  const item = (
    id: string,
    target: Target,
    children: ReactNode,
    textValue: string,
  ) => {
    map.set(id, target);
    return (
      <ListBoxItem
        key={id}
        id={id}
        textValue={textValue}
        className={ITEM_CLASS}
      >
        {children}
      </ListBoxItem>
    );
  };
  const entryItems = (entries: PaletteEntry[]) =>
    entries.flatMap((e) => {
      const target = entryTarget(e);
      if (!target) return [];
      return [
        item(
          e.id,
          target,
          <Row label={e.label} hint={e.hint} />,
          e.hint ? `${e.label}, ${e.hint}` : e.label,
        ),
      ];
    });

  const sections: ReactNode[] = [];
  let count = 0;
  const section = (id: string, title: string, items: ReactNode[]) => {
    if (items.length === 0) return;
    count += items.length;
    sections.push(
      <ListBoxSection key={id} id={id} className={SECTION_CLASS}>
        <Header className={HEADER_CLASS}>{title}</Header>
        {items}
      </ListBoxSection>,
    );
  };

  if (!query && all) {
    section(
      "recent",
      "Son açılanlar",
      recents.map((r) =>
        item(
          `recent:${r.href}`,
          { href: r.href },
          <Row label={r.label} />,
          r.label,
        ),
      ),
    );
  }
  if (all) section("go", "Git", entryItems(goShown));
  section("create", "Oluştur", entryItems(createShown));
  for (const g of hitGroups) {
    const rows = g.hits.map((hit) => {
      const facts = [
        ...hit.meta,
        ...(hit.amountMinor !== undefined ? [money(hit.amountMinor)] : []),
      ];
      return item(
        `hit:${g.section}:${hit.href}`,
        { href: hit.href },
        <Row
          label={hit.title}
          extra={
            facts.length ? (
              <span className="block truncate text-xs text-[var(--admin-text-soft)]">
                {facts.join(" · ")}
              </span>
            ) : null
          }
        />,
        hit.title,
      );
    });
    const list = listRow(g);
    if (list) {
      rows.push(
        item(
          `list:${g.section}`,
          { href: list.href },
          <Row label={list.label} hint={g.label} />,
          `${g.label}: ${list.label}`,
        ),
      );
    }
    section(`records:${g.section}`, `Kayıtlar · ${g.label}`, rows);
  }
  if (all) section("commands", "Komutlar", entryItems(commandsShown));

  // This render's entries: onAction below is this render's too.
  const run = (key: string) => {
    const target = map.get(key);
    if (!target) return;
    if ("href" in target) {
      navigate(target.href);
      return;
    }
    // The commands the shell answers (the shortcut sheet and the view
    // preferences) go out as an event, after the dialog closes (one dialog
    // at a time).
    if (target.command !== "toggleSound") {
      close();
      runPaletteCommand(target.command);
      return;
    }
    const next = !readSoundPref();
    writeSoundPref(next);
    toast.show({
      tone: "info",
      message: next ? "Sipariş sesi açık." : "Sipariş sesi kapalı.",
    });
    close();
  };

  const loading = search.status === "loading";
  const status = loading ? "Aranıyor…" : resultCountText(count);

  return (
    <I18nProvider locale="tr-TR">
      <Autocomplete inputValue={text} onInputChange={setText}>
        <div className="flex min-h-0 flex-1 flex-col">
          {/* TextField, not SearchField: the same box without the search
              type's clear button and its strings in 34 languages, which
              took the chunk over its 45 KB budget. Its one behaviour is
              here: the first Esc empties the box, Esc on an empty box
              closes the dialog (the native cancel). */}
          <TextField
            aria-label="Panelde ara"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape" && text !== "") {
                e.preventDefault();
                setText("");
                return;
              }
              e.continuePropagation();
            }}
            className="flex min-h-14 shrink-0 items-center gap-4 border-b border-[var(--admin-border)] px-4"
          >
            <span className="text-[var(--admin-text-soft)]">
              <SearchIcon />
            </span>
            {/* Autocomplete sets autocomplete, autocorrect and spellcheck
                off and the Enter key's hint itself. */}
            <Input
              placeholder={
                all ? "Sayfa, kayıt ya da komut ara" : "Ne oluşturulsun?"
              }
              maxLength={80}
              className="-mx-2 min-h-11 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-base text-[var(--admin-text)] outline-none placeholder:text-[var(--admin-text-mute)]"
            />
            {loading ? (
              <span
                aria-hidden="true"
                className="shrink-0 text-xs text-[var(--admin-text-mute)]"
              >
                Aranıyor…
              </span>
            ) : null}
            {/* A phone has no Esc key: the one way out besides the backdrop. */}
            <button
              type="button"
              onClick={close}
              aria-label="Kapat"
              className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[var(--admin-text-soft)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-primary)]"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </TextField>
          <p role="status" className="sr-only">
            {status}
          </p>
          {search.status === "expired" ? (
            <div
              role="alert"
              className="mx-4 mt-3 rounded-xl bg-[var(--admin-warning-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-warning)]"
            >
              Oturumun kapandı.{" "}
              <a
                href={signInHref(pathname)}
                className="font-medium underline underline-offset-4"
              >
                Yeniden giriş yap
              </a>
            </div>
          ) : search.status === "unavailable" ? (
            <div
              role="alert"
              className="mx-4 mt-3 rounded-xl bg-[var(--admin-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-danger-ink)]"
            >
              Arama şu an çalışmıyor.
            </div>
          ) : null}
          <ListBox
            aria-label="Sonuçlar"
            onAction={(key) => run(String(key))}
            renderEmptyState={() => (
              <p className="px-4 py-6 text-sm text-[var(--admin-text-soft)]">
                {loading ? "Aranıyor…" : "Sonuç yok."}
              </p>
            )}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 outline-none"
          >
            {sections}
          </ListBox>
        </div>
      </Autocomplete>
    </I18nProvider>
  );
}
