import { foldLoose } from "./palette-core";

/*
 * What the panel's searchable pickers (ui/combobox-field.tsx, admin UI v2,
 * UI-16) do with a list of options and what is typed: pure, so the rules
 * are tested without a browser (tests/admin-option-filter.test.ts).
 */

/** One choice of a picker: what it posts, what it says, and where it sits. */
export interface ComboboxOption {
  /** What the form posts when the choice is picked. Never "" (see `placeholder`). */
  value: string;
  /** The text the list and the closed picker show. */
  label: string;
  /** Shown but not pickable (out of stock). */
  disabled?: boolean;
  /** The group heading it sits under (a product's variants), if any. */
  group?: string;
}

/**
 * Whether `label` answers `query`: both folded the way the palette folds
 * (Turkish lower case, I family and marks off), so "sire" finds "Şire",
 * "findik" finds "Fındık" and "icecek" finds "İçecek". Every word of the
 * query must be in the label, in any order: "sire 250" finds "Şire · 250 g".
 * An empty query matches everything.
 */
export function matchesOption(label: string, query: string): boolean {
  const words = foldLoose(query).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const folded = foldLoose(label);
  return words.every((word) => folded.includes(word));
}

/** The options that answer `query`, in their own order. */
export function filterOptions<T extends { label: string }>(
  options: readonly T[],
  query: string,
): T[] {
  return options.filter((o) => matchesOption(o.label, query));
}

/** A run of options under one heading (`group` null: no heading). */
export interface OptionRun {
  group: string | null;
  options: ComboboxOption[];
}

/**
 * The options as runs of neighbours that share a group, which is how a
 * `<select>` draws them (`<optgroup>`) and how the list does. A group is
 * only joined to its neighbours: the same heading twice stays two runs, as
 * two `<optgroup>`s with one label would.
 */
export function optionRuns(options: readonly ComboboxOption[]): OptionRun[] {
  const runs: OptionRun[] = [];
  for (const option of options) {
    const group = option.group ?? null;
    const last = runs[runs.length - 1];
    if (last && last.group === group) last.options.push(option);
    else runs.push({ group, options: [option] });
  }
  return runs;
}
