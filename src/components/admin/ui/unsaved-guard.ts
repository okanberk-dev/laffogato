"use client";

import { useEffect, useRef, type RefObject } from "react";

import { hasUnsavedForm, trackUnsavedGuard } from "../unsaved-guard";

/*
 * "Leave the page with unsaved changes?" for the panel's long forms (admin
 * UI v2, UI-17, design §5 item 13). The browser asks only on a reload, a
 * closed tab or a typed address; a link in the panel and the palette are
 * client navigations it never sees. Four pieces, the rules pure and tested
 * in node (tests/admin-unsaved-guard.test.ts), the DOM glue thin:
 *
 * - useUnsavedGuard(formRef): a form's fields are read when it mounts and
 *   compared with what they are now. useUnsavedFlag(dirty): for a form that
 *   already knows (the Ayarlar tabs).
 * - One shared controller while any guarded form is mounted: a click
 *   listener on `document` in the capture phase (it runs before Next's
 *   <Link>), `beforeunload`, and the palette's "may this page be left?"
 *   event (palette-shell.ts: the palette's chunk has no room to import this
 *   file, so it asks by event; no listener, no question).
 * - isPanelDirty() and confirmLeave(): what the controller asks with.
 * - The registry is the one the product wizard's own guard (../unsaved-guard,
 *   CAT-30: touch-based, with its own `beforeunload`) writes to, so a single
 *   answer holds for both and the single keys (shortcuts.tsx) already see
 *   every form here. The wizard itself is not changed.
 *
 * Not covered, because the browser gives no hook: Back and Forward (the App
 * Router moves without a page unload), and the Çıkış button (a form post,
 * not a link).
 */

/**
 * The palette's question (PANEL_LEAVE_EVENT in lib/admin/palette-shell.ts,
 * which is not imported here: that file carries the recents' rules into
 * every page this one is on; a test holds the two names equal).
 */
export const LEAVE_EVENT = "admin:leave";

/** The one question every way out of a dirty form asks. */
export const UNSAVED_CONFIRM =
  "Kaydedilmemiş değişiklikler var. Sayfadan çıkılsın mı?";

/**
 * A form's fields as one comparable string.
 *
 * - Names are sorted: the order controls come in is not content. The values
 *   of one name keep their order: a reordered list is a change.
 * - A checkbox that is not ticked sends nothing, so ticked and unticked
 *   differ by the name being absent, not by an empty value.
 * - A file input is left out (a File is not a string, and what it says
 *   about the file is not something the form saved).
 * - Name and values are kept apart by JSON, so no two forms read alike.
 */
export function snapshotOf(entries: Iterable<[string, unknown]>): string {
  const byName = new Map<string, string[]>();
  for (const [name, value] of entries) {
    if (typeof value !== "string") continue;
    const values = byName.get(name);
    if (values) values.push(value);
    else byName.set(name, [value]);
  }
  return JSON.stringify(
    [...byName].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

/** One guarded form's memory, apart from the DOM. */
export interface FormGuard {
  /** The operator typed or picked something (an `input` or `change`). */
  edit(): void;
  /** The form is being posted: remembers what goes. */
  submit(): void;
  /** The server saved it: what went is the saved state now. */
  saved(): void;
  /** The form went back to its defaults. */
  reset(): void;
  dirty(): boolean;
}

/**
 * Dirty means: the operator edited the form AND its fields differ from the
 * saved state. The edit gate keeps what the page does by itself (a field a
 * revalidation moved, a value the browser restored) from asking about a
 * form nobody touched; a change typed back is no change.
 *
 * `read` is the form's snapshotOf(), taken when it mounts: the fields as
 * React rendered them, a controlled input's value and a select's default
 * included. A refused save leaves the form dirty (`saved()` is the server's
 * "yes", nothing else moves the baseline). A save takes what was POSTED
 * as the new baseline, not what the fields hold when the answer arrives:
 * typing during the round trip is still unsaved.
 */
export function createFormGuard(read: () => string): FormGuard {
  let baseline = read();
  let touched = false;
  let posted: string | null = null;
  let typedSince = false;
  return {
    edit() {
      touched = true;
      typedSince = true;
    },
    submit() {
      posted = read();
      typedSince = false;
    },
    saved() {
      baseline = posted ?? read();
      posted = null;
      touched = typedSince;
    },
    reset() {
      baseline = read();
      touched = false;
      posted = null;
      typedSince = false;
    },
    dirty() {
      return touched && read() !== baseline;
    },
  };
}

/**
 * The answer of a save that wrote something: a message, no error, nothing
 * left to confirm. The shape the Ayarlar, Uygulama ayarları and campaign
 * forms answer with; null for a refusal, a confirm question or nothing yet.
 */
export function savedAnswer<
  T extends { message?: string; error?: string; confirm?: unknown },
>(state: T | null | undefined): T | null {
  return state && state.message && !state.error && !state.confirm
    ? state
    : null;
}

/** What a click on a link tells the guard (read off the anchor and the event). */
export interface LinkClick {
  /** The anchor's resolved address (`a.href`). */
  href: string;
  target?: string | null;
  download?: boolean;
  button?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  defaultPrevented?: boolean;
  /** The link only opens something on this page (the palette's trigger). */
  skip?: boolean;
}

/** Anchors that look like links and are not: skipped by the click guard. */
export const LINK_SKIP_SELECTOR =
  "[data-admin-palette-trigger], [data-unsaved-skip]";

/**
 * Whether `href` is another page of this site. Same page with another
 * query or hash is not: the page stays mounted and keeps its forms (a link
 * to `?sekme=email` on Ayarlar, the skip link's `#admin-main`). Another
 * origin, a mail or phone link and anything unreadable is not either: the
 * browser's own `beforeunload` asks about leaving the site.
 */
export function leavesPage(href: string, here: string): boolean {
  try {
    const to = new URL(href, here);
    const from = new URL(here);
    return (
      (to.protocol === "http:" || to.protocol === "https:") &&
      to.origin === from.origin &&
      to.pathname !== from.pathname
    );
  } catch {
    return false;
  }
}

/**
 * Whether this click leaves the page by a plain link: the primary button,
 * no ⌘, Ctrl, Shift or Alt (a new tab, window or download), no `target`
 * other than `_self`, no `download`, not already handled by a listener
 * before this one, and a different page of this site.
 */
export function linkAsksToLeave(click: LinkClick, here: string): boolean {
  if (click.skip || click.defaultPrevented || click.download) return false;
  if (click.button !== undefined && click.button !== 0) return false;
  if (click.ctrlKey || click.metaKey || click.shiftKey || click.altKey) {
    return false;
  }
  const target = (click.target ?? "").trim().toLowerCase();
  if (target !== "" && target !== "_self") return false;
  return leavesPage(click.href, here);
}

/** Whether a guarded form on the page has unsaved changes. */
export function isPanelDirty(): boolean {
  return hasUnsavedForm();
}

/**
 * Said yes to leaving: the browser's own `beforeunload` question stays
 * quiet for a moment, or a link that really unloads the page (a plain
 * anchor) would ask a second time, right after ours.
 */
const LEAVING_MS = 1000;
let leaving = false;

function markLeaving(): void {
  leaving = true;
  setTimeout(() => {
    leaving = false;
  }, LEAVING_MS);
}

/**
 * The question before a client navigation (the palette's entries; the click
 * guard asks it too): true when the page may be left. Quiet while nothing is
 * unsaved, and for a page that is the same one (`href` given). Cancelled,
 * the caller stays where it is.
 */
export function confirmLeave(
  href?: string,
  env: { here?: string; ask?: (message: string) => boolean } = {},
): boolean {
  if (!isPanelDirty()) return true;
  if (
    href !== undefined &&
    !leavesPage(href, env.here ?? window.location.href)
  ) {
    return true;
  }
  const ask = env.ask ?? ((message: string) => window.confirm(message));
  if (!ask(UNSAVED_CONFIRM)) return false;
  markLeaving();
  return true;
}

function onBeforeUnload(event: BeforeUnloadEvent): void {
  if (leaving || !isPanelDirty()) return;
  event.preventDefault();
  // Older Chrome and Safari still want a returnValue set.
  event.returnValue = "";
}

/**
 * A click on a link, before anything else sees it. Cancelled, the click is
 * swallowed whole: Next's <Link> never starts its navigation. Only a
 * click on a real link gets as far as asking, so the form is read for
 * nothing else.
 */
function onLinkClick(event: MouseEvent): void {
  const target = event.target as Element | null;
  const found =
    target && typeof target.closest === "function"
      ? target.closest("a[href]")
      : null;
  // An SVG anchor's `href` is an object, not an address: left alone.
  if (!found || typeof (found as HTMLAnchorElement).href !== "string") return;
  const link = found as HTMLAnchorElement;
  const asks = linkAsksToLeave(
    {
      href: link.href,
      target: link.getAttribute("target"),
      download: link.hasAttribute("download"),
      button: event.button,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      defaultPrevented: event.defaultPrevented,
      skip: link.closest(LINK_SKIP_SELECTOR) !== null,
    },
    window.location.href,
  );
  if (!asks || confirmLeave()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

/** The palette's "may this page be left?": cancelled on a no. */
function onLeaveRequest(event: Event): void {
  const href = (event as CustomEvent<unknown>).detail;
  if (typeof href === "string" && !confirmLeave(href)) event.preventDefault();
}

let holders = 0;

/**
 * One click listener, one `beforeunload` and one leave listener for every
 * guarded form on the page, not one each: eight tab forms asked eight times
 * for a single click. Counted, and gone with the last form, so a page that
 * has none (the next one) is never held back. The release is safe to call
 * twice.
 */
export function acquireLeaveGuard(): () => void {
  if (holders++ === 0) {
    document.addEventListener("click", onLinkClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener(LEAVE_EVENT, onLeaveRequest);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--holders === 0) {
      document.removeEventListener("click", onLinkClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener(LEAVE_EVENT, onLeaveRequest);
    }
  };
}

/** What the guard needs of a form: its events. */
export interface GuardedForm {
  addEventListener(
    type: string,
    listener: (event: Event) => void,
    capture?: boolean,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: Event) => void,
    capture?: boolean,
  ): void;
}

/**
 * Puts a form under guard: its edits, its posts and its reset are followed,
 * it counts as unsaved changes for the page while it differs, and the
 * shared controller is held for it. `detach` undoes all of it (safe twice);
 * `saved` tells the guard the server saved what was posted last. The
 * hooks below are this, in an effect.
 */
export function attachFormGuard(
  form: GuardedForm,
  read: () => string,
): { saved(): void; detach(): void } {
  const guard = createFormGuard(read);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onEdit = () => guard.edit();
  const onSubmit = () => guard.submit();
  // `reset` fires before the fields change: look once they have.
  const onReset = () => {
    clearTimeout(timer);
    timer = setTimeout(() => guard.reset(), 0);
  };
  form.addEventListener("input", onEdit);
  form.addEventListener("change", onEdit);
  form.addEventListener("submit", onSubmit, true);
  form.addEventListener("reset", onReset);
  const untrack = trackUnsavedGuard({ dirty: () => guard.dirty() });
  const release = acquireLeaveGuard();
  let attached = true;
  return {
    saved: () => guard.saved(),
    detach() {
      if (!attached) return;
      attached = false;
      clearTimeout(timer);
      form.removeEventListener("input", onEdit);
      form.removeEventListener("change", onEdit);
      form.removeEventListener("submit", onSubmit, true);
      form.removeEventListener("reset", onReset);
      release();
      untrack();
    },
  };
}

/**
 * Guards `formRef`'s form while it is mounted. Its fields are read once the
 * form is on screen and compared with the fields now; `saved` is the answer
 * of a save that wrote (savedAnswer(state)): each new one makes what was
 * posted the saved state, so leaving after a save that stays on the page
 * asks nothing. A refusal (`saved` stays null) keeps the form guarded. A
 * save that redirects needs no `saved`: the page is gone. Fields that
 * change a value without an `input` or `change` event must dispatch one,
 * and the `<form>` must stay the same element for as long as the component
 * lives (a ref that moves to another element is not followed).
 */
export function useUnsavedGuard(
  formRef: RefObject<HTMLFormElement | null>,
  {
    saved = null,
    enabled = true,
  }: { saved?: object | null; enabled?: boolean } = {},
): void {
  const attachedRef = useRef<ReturnType<typeof attachFormGuard> | null>(null);

  useEffect(() => {
    const form = formRef.current;
    if (!enabled || !form) return;
    const attached = attachFormGuard(form, () =>
      snapshotOf(new FormData(form).entries()),
    );
    attachedRef.current = attached;
    return () => {
      attached.detach();
      if (attachedRef.current === attached) attachedRef.current = null;
    };
  }, [formRef, enabled]);

  useEffect(() => {
    if (saved) attachedRef.current?.saved();
  }, [saved]);
}

/**
 * The same guard for a page that already knows whether it has unsaved
 * changes (the Ayarlar tabs, each with its own baseline and its own test
 * mail form that is not a setting): guarded while `dirty` is true.
 */
export function useUnsavedFlag(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const untrack = trackUnsavedGuard({ dirty: () => true });
    const release = acquireLeaveGuard();
    return () => {
      release();
      untrack();
    };
  }, [dirty]);
}
