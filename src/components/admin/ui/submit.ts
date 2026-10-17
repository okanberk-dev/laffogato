import { unstable_rethrow } from "next/navigation";
import { startTransition, useEffect, useRef, type FormEvent } from "react";

/**
 * How the panel's forms post without losing what was typed.
 *
 * React 19 resets a `<form action={fn}>`'s uncontrolled fields before the
 * action runs (react-dom startHostTransition -> requestFormReset), whatever
 * the action answers. A refused save therefore came back with the text
 * fields empty and every select and checkbox on its default: a promo
 * re-ticked as active, a product moved back to the first category, a
 * manual order back to "Ödendi". Dispatching from onSubmit (preventDefault,
 * FormData, startTransition) is not a form action, so nothing is reset.
 *
 * ActionForm and ActionModal post this way; a form that keeps its own
 * useActionState state shape uses useNoResetSubmit directly, and
 * withPanelCatch for its action.
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
 * The form's onSubmit for a `useActionState` dispatcher: posts by hand, so
 * a refusal leaves every field as the operator left it, and drops a second
 * submit until the first answer is in (`pending` from the same
 * useActionState).
 *
 * @example
 * const [state, formAction, pending] = useActionState(withPanelCatch(saveAction, failed), initial);
 * const onSubmit = useNoResetSubmit(formAction, pending);
 * return <form onSubmit={onSubmit}>…</form>;
 */
export function useNoResetSubmit(
  dispatch: (formData: FormData) => void,
  pending: boolean,
  { beforeSubmit }: { beforeSubmit?: BeforeSubmit } = {},
): (e: FormEvent<HTMLFormElement>) => void {
  const busy = useRef(false);
  // The answer is in (pending went back to false): the next submit may go.
  useEffect(() => {
    if (!pending) busy.current = false;
  }, [pending]);
  return (e) => {
    submitByHand(e, { busy, dispatch, beforeSubmit });
  };
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
