"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";

import { GhostButton, PrimaryButton } from "../forms";
import { AdminIcon } from "./icons";
import { BUTTON } from "./styles";

/**
 * The panel's step-by-step form (22 Oct 2026, operator: "fatura oluşturma
 * yeri gibi olan yerlere wizard yap"): a create form split into steps, a
 * summary at the end, one post. The fields stay the form's own controls
 * (their names are the action's FormData keys, unchanged) and every step
 * is in the DOM, the later ones `hidden`, so nothing is lost between steps
 * and nothing is fetched for them. The server checks everything again;
 * the steps only spare the operator a refusal.
 *
 * - "Sonraki adım" (and Enter in a one-line field) checks the open step:
 *   the browser's own rules on its controls, then the step's `validate`.
 * - A chip opens an earlier step at once, a later one only through the
 *   steps between (each checked).
 * - Before the post every step is checked; the first problem's step opens
 *   with the browser's message on its field (the form is `noValidate`: the
 *   browser cannot show a message on a hidden field and silently dropped
 *   the post).
 * - A refusal from the server opens the step of its first field
 *   (`openErrors`, called in the action's own callback so the step is open
 *   when the form's focus effect runs) and flags every step holding one.
 * - The summary step reads the form as it is (`values`).
 *
 * Edit pages show the same sections as one page (`mode: "page"`): no
 * steps, no summary, the browser's own validation.
 */

export interface WizardStep {
  id: number;
  title: string;
  /** The FormData names this step holds, for a refusal from the server. */
  fields?: readonly string[];
  /** The summary: drawn from the form's values when it is opened. */
  summary?: boolean;
  body: ReactNode | ((values: FormData | null) => ReactNode);
}

type Validatable = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** The controls under `root` the browser would refuse, in document order. */
export function invalidControls(root: ParentNode): Validatable[] {
  return Array.from(
    root.querySelectorAll<Validatable>("input, select, textarea"),
  ).filter((el) => el.willValidate && !el.validity.valid);
}

/** Shows the browser's message on the first invalid control drawn. */
export function reportFirstInvalid(root: ParentNode): boolean {
  const bad = invalidControls(root);
  const target = bad.find((el) => el.getClientRects().length > 0) ?? bad[0];
  target?.reportValidity();
  return Boolean(target);
}

/** One filled-in field as the summary shows it. */
export interface SummaryEntry {
  step: number;
  label: string;
  value: string;
}

function textOf(el: Element | null | undefined): string {
  return el?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

/** A control's caption: its label's (the Field's first span), else its name. */
function labelOf(el: Element): string {
  const control = el as HTMLInputElement;
  const own = el.getAttribute("aria-label");
  const label = control.labels?.[0] ?? el.closest("label");
  if (control.type === "checkbox" || control.type === "radio") {
    return own || textOf(label) || control.name;
  }
  if (label) {
    // A Field wraps the control: its caption is the first span (the hint
    // is in the same label). A <label for> holds the caption alone.
    const caption = label.contains(el)
      ? textOf(label.querySelector("span")) || textOf(label)
      : textOf(label);
    if (caption) return caption;
  }
  const by = el.getAttribute("aria-labelledby");
  return (
    (by && textOf(document.getElementById(by))) ||
    own ||
    textOf(el.closest("fieldset")?.querySelector("legend")) ||
    control.name
  );
}

/**
 * What the operator filled in, step by step, read off the form's own
 * controls when the summary opens (hidden payloads, buttons and files
 * left out; a box says "Evet" / "Hayır", a select its option's text).
 */
export function readSummary(form: HTMLFormElement): SummaryEntry[] {
  const out: SummaryEntry[] = [];
  const seen = new Set<string>();
  for (const el of Array.from(form.elements)) {
    if (
      !(el instanceof HTMLInputElement) &&
      !(el instanceof HTMLSelectElement) &&
      !(el instanceof HTMLTextAreaElement)
    )
      continue;
    if (!el.name || el.disabled) continue;
    const step = Number(
      el.closest("[data-step]")?.getAttribute("data-step") ?? 0,
    );
    if (!step || el.closest("[data-summary]")) continue;
    let value = "";
    if (el instanceof HTMLSelectElement) {
      value = Array.from(el.selectedOptions)
        .map((o) => o.textContent?.trim() ?? "")
        .join(", ");
    } else if (el instanceof HTMLTextAreaElement) {
      value = el.value.trim();
    } else if (
      ["hidden", "submit", "button", "file", "password"].includes(el.type)
    ) {
      continue;
    } else if (el.type === "checkbox") {
      const group = form.querySelectorAll<HTMLInputElement>(
        `input[type="checkbox"][name="${CSS.escape(el.name)}"]`,
      );
      if (group.length === 1) {
        value = el.checked ? "Evet" : "Hayır";
      } else {
        // A list of boxes (tags, allergens): one row, the ticked ones.
        if (seen.has(el.name)) continue;
        seen.add(el.name);
        const ticked = Array.from(group)
          .filter((b) => b.checked)
          .map((b) => labelOf(b));
        out.push({
          step,
          label:
            textOf(el.closest("fieldset")?.querySelector("legend")) || el.name,
          value: ticked.join(", "),
        });
        continue;
      }
    } else if (el.type === "radio") {
      if (seen.has(el.name)) continue;
      const checked = form.querySelector<HTMLInputElement>(
        `input[type="radio"][name="${CSS.escape(el.name)}"]:checked`,
      );
      seen.add(el.name);
      if (!checked) continue;
      out.push({
        step,
        label:
          el
            .closest("fieldset")
            ?.querySelector("legend")
            ?.textContent?.trim() || el.name,
        value: labelOf(checked),
      });
      continue;
    } else {
      value = el.value.trim();
    }
    out.push({ step, label: labelOf(el), value });
  }
  return out;
}

export interface UseWizardOptions {
  steps: readonly Pick<WizardStep, "id" | "fields">[];
  formRef: RefObject<HTMLFormElement | null>;
  /** False on an edit page: one page, the browser validates. */
  enabled?: boolean;
  /**
   * Checks the browser cannot make (a VKN's check digit, a list that must
   * not be empty): field name → message for step `id`; empty when fine.
   */
  validate?: (id: number, form: HTMLFormElement) => Record<string, string>;
}

export interface Wizard {
  enabled: boolean;
  step: number;
  total: number;
  /** Messages from `validate`, by field name, until the field is fixed. */
  clientErrors: Record<string, string>;
  /** Steps with a problem found here (the server's are added by the frame). */
  flagged: number[];
  values: FormData | null;
  /** The form read off its controls when a step opened (readSummary). */
  entries: SummaryEntry[];
  goTo: (target: number) => void;
  next: () => void;
  back: () => void;
  /** For useHandPost's beforeSubmit: false keeps the post back. */
  beforeSubmit: () => boolean;
  /** Opens the step of the first refused field; call it in the action. */
  openErrors: (fieldErrors: Record<string, string> | undefined) => void;
  /** Enter in a one-line field: the next step, not a post. */
  onKeyDown: (e: KeyboardEvent<HTMLFormElement>) => void;
  /** Clears a `validate` message once its field changes. */
  clearError: (name: string) => void;
}

export function useWizard({
  steps,
  formRef,
  enabled = true,
  validate,
}: UseWizardOptions): Wizard {
  const total = steps.length;
  const [step, setStep] = useState(steps[0]?.id ?? 1);
  const [flagged, setFlagged] = useState<number[]>([]);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState<FormData | null>(null);
  const [entries, setEntries] = useState<SummaryEntry[]>([]);

  const ids = steps.map((s) => s.id);
  const indexOf = (id: number) => ids.indexOf(id);

  /** The problems of one step: the browser's, then `validate`'s. */
  const problems = useCallback(
    (id: number): { native: boolean; custom: Record<string, string> } => {
      const form = formRef.current;
      if (!form) return { native: false, custom: {} };
      const root = form.querySelector(`[data-step="${id}"]`);
      const native = root ? invalidControls(root).length > 0 : false;
      return { native, custom: validate?.(id, form) ?? {} };
    },
    [formRef, validate],
  );

  /** Opens `id` with its first problem shown; true when there was one. */
  const stopAt = (id: number): boolean => {
    const { native, custom } = problems(id);
    const names = Object.keys(custom);
    if (!native && names.length === 0) return false;
    setStep(id);
    setFlagged((prev) => [...new Set([...prev, id])]);
    setClientErrors((prev) => ({ ...prev, ...custom }));
    // After the step is drawn: the browser's bubble, or the field focused.
    requestAnimationFrame(() => {
      const form = formRef.current;
      const root = form?.querySelector(`[data-step="${id}"]`);
      if (native && root) {
        reportFirstInvalid(root);
        return;
      }
      const el = form?.elements.namedItem(names[0]);
      if (el instanceof HTMLElement) el.focus();
    });
    return true;
  };

  /** Opens `id`; the summary reads the form as it is now. */
  const open = (id: number) => {
    setStep(id);
    const form = formRef.current;
    setValues(form ? new FormData(form) : null);
    setEntries(form ? readSummary(form) : []);
  };

  const goTo = (target: number) => {
    if (!enabled || target === step) return;
    if (indexOf(target) > indexOf(step)) {
      for (const id of ids.slice(indexOf(step), indexOf(target))) {
        if (stopAt(id)) return;
        setFlagged((prev) => prev.filter((s) => s !== id));
      }
    }
    open(target);
  };

  const next = () => {
    const i = indexOf(step);
    if (i < total - 1) goTo(ids[i + 1]);
  };
  const back = () => {
    const i = indexOf(step);
    if (i > 0) open(ids[i - 1]);
  };

  const beforeSubmit = () => {
    if (!enabled) return true;
    for (const id of ids) if (stopAt(id)) return false;
    return true;
  };

  const openErrors = (fieldErrors: Record<string, string> | undefined) => {
    if (!enabled || !fieldErrors) return;
    const bad = steps
      .filter((s) => s.fields?.some((f) => f in fieldErrors))
      .map((s) => s.id);
    if (bad.length === 0) return;
    setFlagged((prev) => [...new Set([...prev, ...bad])]);
    setStep(bad[0]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (!enabled || e.key !== "Enter" || e.nativeEvent.isComposing) return;
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLInputElement)) return;
    if (["checkbox", "radio", "submit", "button", "file"].includes(t.type))
      return;
    // A combobox's Enter picks an option.
    if (t.getAttribute("role") === "combobox") return;
    if (indexOf(step) < total - 1) {
      e.preventDefault();
      next();
    }
  };

  const clearError = (name: string) =>
    setClientErrors((prev) => {
      if (!(name in prev)) return prev;
      const rest = { ...prev };
      delete rest[name];
      return rest;
    });

  return {
    enabled,
    step,
    total,
    clientErrors,
    flagged,
    values,
    entries,
    goTo,
    next,
    back,
    beforeSubmit,
    openErrors,
    onKeyDown,
    clearError,
  };
}

/**
 * The steps, the chips over them and the buttons under them; on an edit
 * page the same sections as cards, one after another.
 */
export function WizardFrame({
  wizard,
  steps,
  serverErrors,
  formError,
  cancelHref,
  submitLabel,
  pendingLabel,
  pending,
  label,
  extraActions,
}: {
  wizard: Wizard;
  steps: readonly WizardStep[];
  /** The last refusal's field errors (they flag their steps). */
  serverErrors?: Record<string, string>;
  /** The last refusal's form-level message, above the buttons. */
  formError?: string | null;
  cancelHref: string;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  /** What the steps make, for the chips' list name ("Promosyon adımları"). */
  label: string;
  /** More buttons beside the submit (a second submit: "Kaydet ve yenisini ekle"). */
  extraActions?: ReactNode;
}) {
  const shown = wizard.enabled ? steps : steps.filter((s) => !s.summary);
  const serverFlagged = new Set(
    steps
      .filter((s) => s.fields?.some((f) => serverErrors && f in serverErrors))
      .map((s) => s.id),
  );
  const flagged = new Set([...wizard.flagged, ...serverFlagged]);
  const index = shown.findIndex((s) => s.id === wizard.step);
  const last = index === shown.length - 1;
  const panel = "rounded-3xl bg-[var(--admin-panel)] p-4 sm:p-6";
  return (
    <WizardContext.Provider value={{ wizard, steps: shown }}>
      {wizard.enabled ? (
        <div className={panel}>
          <p className="sr-only" aria-live="polite">
            {`Adım ${index + 1} / ${shown.length}: ${shown[index]?.title ?? ""}`}
          </p>
          <ol
            aria-label={label}
            className="-mx-1 flex [scrollbar-width:none] items-center gap-2 overflow-x-auto px-1 [&::-webkit-scrollbar]:hidden"
          >
            {shown.map((s, i) => {
              const current = s.id === wizard.step;
              const done = i < index && !flagged.has(s.id);
              const bad = flagged.has(s.id);
              return (
                <li key={s.id} className="flex shrink-0 items-center gap-2">
                  {i > 0 ? (
                    <span
                      aria-hidden="true"
                      className={`h-px w-4 ${i <= index ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-border-strong)]"}`}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => wizard.goTo(s.id)}
                    aria-current={current ? "step" : undefined}
                    aria-label={`${i + 1}. ${s.title}${bad ? ": düzeltilecek alan var" : done ? ": tamam" : ""}`}
                    className={`flex min-h-[44px] items-center gap-2 rounded-full px-3 py-2 text-xs transition-colors ${
                      current
                        ? "bg-[var(--admin-primary)] text-white"
                        : bad
                          ? "border border-[var(--admin-danger)] text-[var(--admin-danger-ink)]"
                          : done
                            ? "bg-[var(--admin-surface-2)] text-[var(--admin-text)]"
                            : "border border-[var(--admin-border)] text-[var(--admin-text-soft)]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-grid h-5 w-5 place-items-center rounded-full text-[10px] ${
                        current
                          ? "bg-white/15"
                          : done
                            ? "bg-[var(--admin-primary)] text-white"
                            : "border border-current"
                      }`}
                    >
                      {bad ? (
                        "!"
                      ) : done ? (
                        <AdminIcon
                          name="stepDone"
                          size={12}
                          strokeWidth={2.5}
                        />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="whitespace-nowrap">{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {shown.map((s) => {
        const body =
          typeof s.body === "function" ? s.body(wizard.values) : s.body;
        return (
          <div
            key={s.id}
            data-step={s.id}
            data-summary={s.summary ? "" : undefined}
            hidden={wizard.enabled && s.id !== wizard.step}
          >
            <div className={panel}>
              {wizard.enabled ? null : (
                <h2 className="mb-5 text-lg font-semibold tracking-tight text-[var(--admin-text)]">
                  {s.title}
                  {flagged.has(s.id) ? (
                    <span className="ml-3 align-middle text-sm font-normal text-[var(--admin-danger-ink)]">
                      Düzeltilecek alan var
                    </span>
                  ) : null}
                </h2>
              )}
              {body}
            </div>
          </div>
        );
      })}

      {formError ? (
        <div
          role="alert"
          className="rounded-xl bg-[var(--admin-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--admin-danger-ink)]"
        >
          {formError}
        </div>
      ) : null}

      <div
        className={`${panel} flex flex-wrap items-center justify-between gap-3`}
      >
        {wizard.enabled ? (
          <div className="flex gap-2">
            <GhostButton
              type="button"
              onClick={wizard.back}
              disabled={index <= 0}
            >
              Geri
            </GhostButton>
            {last ? null : (
              <PrimaryButton type="button" onClick={wizard.next}>
                Sonraki adım
              </PrimaryButton>
            )}
          </div>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Link href={cancelHref} className={BUTTON.ghost}>
            Vazgeç
          </Link>
          {!wizard.enabled || last ? extraActions : null}
          {!wizard.enabled || last ? (
            <PrimaryButton
              type="submit"
              disabled={pending}
              aria-busy={pending || undefined}
            >
              {pending ? pendingLabel : submitLabel}
            </PrimaryButton>
          ) : null}
        </div>
      </div>
    </WizardContext.Provider>
  );
}

const WizardContext = createContext<{
  wizard: Wizard;
  steps: readonly WizardStep[];
} | null>(null);

/**
 * A summary step for a form whose steps are drawn on the server (no
 * function body can cross to the browser): every field filled in, under
 * its step's title, with "Düzenle" back to that step.
 */
export function WizardAutoSummary({ note }: { note?: ReactNode }) {
  const ctx = useContext(WizardContext);
  if (!ctx) return null;
  const { wizard, steps } = ctx;
  return (
    <div className="grid gap-5">
      {steps
        .filter((s) => !s.summary)
        .map((s) => {
          const rows = wizard.entries.filter(
            (e) => e.step === s.id && e.value !== "",
          );
          return (
            <section key={s.id} className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[var(--admin-text)]">
                  {s.title}
                </h3>
                <button
                  type="button"
                  onClick={() => wizard.goTo(s.id)}
                  className="text-xs text-[var(--admin-text-soft)] underline underline-offset-4 hover:text-[var(--admin-text)]"
                  aria-label={`${s.title}: düzenle`}
                >
                  Düzenle
                </button>
              </div>
              {rows.length ? (
                <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,11rem)_1fr]">
                  {rows.map((r, i) => (
                    <div key={`${r.label}-${i}`} className="contents">
                      <dt className="text-[var(--admin-text-soft)]">
                        {r.label}
                      </dt>
                      <dd className="line-clamp-3 break-words text-[var(--admin-text)]">
                        {r.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-[var(--admin-text-soft)]">
                  Bu adımda doldurulan alan yok.
                </p>
              )}
            </section>
          );
        })}
      {note ? (
        <p className="rounded-xl bg-[var(--admin-surface-2)] px-3.5 py-3 text-sm text-[var(--admin-text-soft)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** One row of a summary step, with a way back to the step it came from. */
export function SummaryRows({
  rows,
  wizard,
}: {
  rows: ReadonlyArray<{ label: string; value: ReactNode; step?: number }>;
  wizard: Wizard;
}) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[minmax(0,11rem)_1fr_auto]">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-[var(--admin-text-soft)]">{r.label}</dt>
          <dd className="break-words text-[var(--admin-text)]">
            {r.value === "" || r.value === null || r.value === undefined
              ? "-"
              : r.value}
          </dd>
          <dd className="sm:text-right">
            {r.step ? (
              <button
                type="button"
                onClick={() => wizard.goTo(r.step!)}
                className="text-xs text-[var(--admin-text-soft)] underline underline-offset-4 hover:text-[var(--admin-text)]"
                aria-label={`${r.label}: düzenle`}
              >
                Düzenle
              </button>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A FormData value as text ("" when missing or a file). */
export function formText(values: FormData | null, name: string): string {
  const v = values?.get(name);
  return typeof v === "string" ? v.trim() : "";
}
