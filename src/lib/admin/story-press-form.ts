// Client-safe: the Hikaye and Basın forms' limits and their parsing, shared
// by the pages (maxLength) and the actions (the refusal). The actions used to
// cut an over-long value with .slice and answer "kaydedildi", so the end of
// a pasted period or quote was lost without a word (admin audit CON-15).

import type { PressInput, StoryEventInput } from "./store";

export const STORY_LIMITS = { year: 12, title: 120, body: 500 } as const;
export const PRESS_LIMITS = { name: 80, quote: 300 } as const;

export interface ParsedForm<T> {
  input: T;
  /** Refusals by field name; nothing is written while there is one. */
  fieldErrors: Record<string, string>;
}

/** A text field: trimmed, line breaks as the browser counted them. */
function text(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function tooLong(
  errors: Record<string, string>,
  name: string,
  value: string,
  limit: number,
  what: string,
) {
  if (value.length > limit && !errors[name]) {
    errors[name] =
      `${what} en fazla ${limit} karakter olabilir; şu an ${value.length}.`;
  }
}

export function parseStoryForm(fd: FormData): ParsedForm<StoryEventInput> {
  const input: StoryEventInput = {
    year: text(fd, "year"),
    title: text(fd, "title"),
    body: text(fd, "body"),
    sortOrder: parseInt(String(fd.get("sortOrder") ?? "0"), 10) || 0,
    isActive: fd.get("isActive") === "on",
  };
  const fieldErrors: Record<string, string> = {};
  if (!input.title) fieldErrors.title = "Başlığı yaz.";
  tooLong(fieldErrors, "year", input.year, STORY_LIMITS.year, "Yıl");
  tooLong(fieldErrors, "title", input.title, STORY_LIMITS.title, "Başlık");
  tooLong(fieldErrors, "body", input.body, STORY_LIMITS.body, "Açıklama");
  return { input, fieldErrors };
}

export function parsePressForm(fd: FormData): ParsedForm<PressInput> {
  const input: PressInput = {
    name: text(fd, "name"),
    quote: text(fd, "quote"),
    sortOrder: parseInt(String(fd.get("sortOrder") ?? "0"), 10) || 0,
    isActive: fd.get("isActive") === "on",
  };
  const fieldErrors: Record<string, string> = {};
  if (!input.name) fieldErrors.name = "Yayının adını yaz.";
  // The story page draws the quote in quotation marks: an empty one showed
  // as a bare pair of them.
  if (!input.quote) fieldErrors.quote = "Yayının yazdığı cümleyi yaz.";
  tooLong(fieldErrors, "name", input.name, PRESS_LIMITS.name, "Yayın adı");
  tooLong(fieldErrors, "quote", input.quote, PRESS_LIMITS.quote, "Alıntı");
  return { input, fieldErrors };
}
