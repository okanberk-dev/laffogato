"use client";

import { unstable_rethrow } from "next/navigation";
import { startTransition, useEffect, useRef, type FormEvent } from "react";

/**
 * How the panel's forms post without losing what was typed.
 *
 * React 19 resets a `<form action={fn}>`'s uncontrolled fields once the
 * action finishes, whatever it answers (react-dom startHostTransition
 * requests the reset, the action's transition applies it). A refused save
 * therefore came back with the text fields empty and every select and
 * checkbox on its default: a promo re-ticked as active, a product moved
 * back to the first category, a manual order back to "Ödendi". Dispatching
 * from onSubmit (preventDefault, FormData, startTransition) is not a form
 * action, so nothing is reset.
 *
 * ActionForm and ActionModal post this way; a form that keeps its own
 * useActionState state shape uses useHandPost directly, and withPanelCatch
 * for its action.
 *
 * Such a form still needs an `action`. Before the page's JavaScript has run
 * there is no onSubmit, and a form with neither action nor method posts the
 * browser's own way: a GET to the page with every field in the address (the
 * history, the request log). With a function action React draws its guard
 * (`action="javascript:..."`), so an early Enter sends nothing; after
 * hydration onSubmit prevents the post and React skips the action of a
 * prevented submit, so nothing is reset either. useHandPost hands out both.
 * tests/form-native-submit.test.ts holds every `<form>` under src to this.
 */

/** Called before the post; `false` cancels it and the form stays as typed. */
export type BeforeSubmit = (
  form: HTMLFormElement,
  submitter: HTMLElement | null,
) => boolean | void;

/** The parts of a submit event a hand dispatch reads. */
export interface SubmitLike {
  preventDefault(): void;
  currentTarget: HTMLFormElement;
  nativeEvent: Event;
}

export interface HandSubmitOptions {
  /** True while an answer is outstanding; a second submit is dropped. */
  busy: { current: boolean };
  dispatch: (formData: FormData) => void;
  beforeSubmit?: BeforeSubmit;
  /** Reads the form; `new FormData(form, submitter)` (a seam for tests). */
  readForm?: (form: HTMLFormElement, submitter: HTMLElement | null) => FormData;
  /** Runs the dispatch; React's startTransition (a seam for tests). */
  run?: (fn: () => void) => void;
}

const readFormData = (form: HTMLFormElement, submitter: HTMLElement | null) =>
  new FormData(form, submitter);

/**
 * One submit, dispatched by hand. Returns whether it was posted. The
 * submitter's name and value ride along, as with a native post (a form
 * with two submit buttons tells them apart). Exported for tests.
 */
export function submitByHand(e: SubmitLike, opts: HandSubmitOptions): boolean {
  e.preventDefault();
  // A double click, or Enter pressed twice, before the first answer: the
  // first post stands and the second is dropped, not queued behind it.
  if (opts.busy.current) return false;
  const form = e.currentTarget;
  const submitter =
    ((e.nativeEvent as SubmitEvent).submitter as HTMLElement | null) ?? null;
  if (opts.beforeSubmit?.(form, submitter) === false) return false;
  const formData = (opts.readForm ?? readFormData)(form, submitter);
  opts.busy.current = true;
  (opts.run ?? startTransition)(() => opts.dispatch(formData));
  return true;
}

/**
 * A submit React replays. An Enter pressed before hydration meets React's
 * guard: React's own script keeps it and, once the page is live, hands its
 * FormData to the form's `action`, not to onSubmit. Each kept press is one
 * call: with the bare dispatcher as the action, three impatient Enters are
 * three posts (three coupons, three stamps). This goes through the same
 * gate as a hand submit instead: dropped while an answer is outstanding,
 * and dropped when the form has a beforeSubmit check, which needs the form
 * and the button a replay no longer has (the operator presses again).
 * React still empties the form after a replay (its own reset), so a refusal
 * there comes back to an empty form; rare, and nothing reaches the address.
 * Returns whether it was posted. Exported for tests.
 */
export function replayByHand(
  formData: FormData,
  opts: Pick<HandSubmitOptions, "busy" | "dispatch" | "beforeSubmit" | "run">,
): boolean {
  if (opts.busy.current || opts.beforeSubmit) return false;
  opts.busy.current = true;
  (opts.run ?? startTransition)(() => opts.dispatch(formData));
  return true;
}

/**
 * What a hand-posted `<form>` takes:
 * `action={post.action} onSubmit={post.onSubmit}`.
 */
export interface HandPost {
  /** React's guard before hydration; afterwards only a replayed submit. */
  action: (formData: FormData) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

/**
 * The form's props for a `useActionState` dispatcher: onSubmit posts by
 * hand, so a refusal leaves every field as the operator left it, and drops
 * a second submit until the first answer is in (`pending` from the same
 * useActionState); `action` keeps the browser's own GET away before
 * hydration and gates the submit React replays after it (replayByHand).
 *
 * @example
 * const [state, formAction, pending] = useActionState(withPanelCatch(saveAction, failed), initial);
 * const post = useHandPost(formAction, pending);
 * return <form action={post.action} onSubmit={post.onSubmit}>…</form>;
 */
export function useHandPost(
  dispatch: (formData: FormData) => void,
  pending: boolean,
  { beforeSubmit }: { beforeSubmit?: BeforeSubmit } = {},
): HandPost {
  const busy = useRef(false);
  // The answer is in (pending went back to false): the next submit may go.
  useEffect(() => {
    if (!pending) busy.current = false;
  }, [pending]);
  return {
    action: (formData) => {
      replayByHand(formData, { busy, dispatch, beforeSubmit });
    },
    onSubmit: (e) => {
      submitByHand(e, { busy, dispatch, beforeSubmit });
    },
  };
}

/**
 * useHandPost's onSubmit alone, for a form whose action is something else:
 * the search box's post without JavaScript (admin-search.tsx), the settings
 * tabs' method="post". A form that has neither still needs useHandPost.
 */
export function useNoResetSubmit(
  dispatch: (formData: FormData) => void,
  pending: boolean,
  options: { beforeSubmit?: BeforeSubmit } = {},
): (e: FormEvent<HTMLFormElement>) => void {
  return useHandPost(dispatch, pending, options).onSubmit;
}

/**
 * A form action with a throw turned into an answer, for forms whose state
 * is not an ActionResult (`{ error, message }` and the like): redirect()
 * and notFound() still run (unstable_rethrow); anything else becomes
 * `onThrow(prev, err)` instead of the full-page error screen, which threw
 * away the form and everything typed in it.
 *
 * @example
 * withPanelCatch(savePromoAction, (prev) => ({ ...prev, error: PANEL_ACTION_FAILED }))
 */
export function withPanelCatch<S, P = FormData>(
  action: (prev: S, payload: P) => Promise<S>,
  onThrow: (prev: S, err: unknown) => S,
): (prev: S, payload: P) => Promise<S> {
  return async (prev, payload) => {
    try {
      return await action(prev, payload);
    } catch (err) {
      unstable_rethrow(err);
      return onThrow(prev, err);
    }
  };
}
