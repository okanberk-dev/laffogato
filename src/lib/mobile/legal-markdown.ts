import type { LegalSection } from "@/lib/legal/documents";

/**
 * Admin-authored legal Markdown → the app's `LegalSection[]` (docs/API-MOBILE.md §13).
 *
 * The site renders an override with `LegalMarkdown` (src/lib/legal/markdown.tsx)
 * straight from the text. The app has no Markdown renderer: it draws the
 * structured sections the coded documents already come in - heading, plain
 * paragraphs, ordered and unordered lists. This is the bridge, and it speaks
 * the same tiny dialect the editor accepts, so what the admin sees on
 * /hukuk/<slug> is what the phone shows at the moment of consent:
 *
 *   `## ` / `### `   → a new section; the text is its heading
 *   `- ` / `* `      → a bullet of the current section
 *   `1. ` / `1) `    → an ordered item of the current section
 *   anything else    → a paragraph (consecutive lines join; a blank line ends it)
 *   `**bold**`       → the marks are dropped; the app renders plain text
 *
 * Text before the first heading becomes a section headed `fallbackHeading`
 * (the document's short title), so a body that opens with a preamble - or
 * has no headings at all - still has a heading to show.
 *
 * Pure and dependency-free: no `server-only`, no database, so the tests and
 * an export script can import it.
 */

// The text group is optional so a bare `##` is recognised (and skipped)
// rather than read as a paragraph that says "##".
const HEADING = /^#{2,3}(?:\s+(.*))?$/;
const BULLET = /^[-*]\s+(.*)$/;
const ORDERED = /^\d+[.)]\s+(.*)$/;

/** `**x**` → `x`. A lone `**` is left alone rather than eaten. */
function stripBold(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1");
}

interface OpenSection {
  heading: string;
  paragraphs: string[];
  ordered: string[];
  bullets: string[];
  /** Lines of the paragraph being read, not yet joined. */
  para: string[];
}

function open(heading: string): OpenSection {
  return { heading, paragraphs: [], ordered: [], bullets: [], para: [] };
}

function flushParagraph(s: OpenSection): void {
  if (s.para.length === 0) return;
  s.paragraphs.push(s.para.join(" "));
  s.para = [];
}

function close(s: OpenSection): LegalSection {
  flushParagraph(s);
  const out: LegalSection = { heading: s.heading };
  // Omit empty arrays rather than sending `[]` - same shape the hydrated
  // coded documents have, so the app treats both alike.
  if (s.paragraphs.length) out.paragraphs = s.paragraphs;
  if (s.ordered.length) out.ordered = s.ordered;
  if (s.bullets.length) out.bullets = s.bullets;
  return out;
}

export function markdownToSections(
  bodyMarkdown: string,
  fallbackHeading: string,
): LegalSection[] {
  const sections: LegalSection[] = [];
  let current: OpenSection | null = null;

  const lines = bodyMarkdown.replace(/\r\n?/g, "\n").split("\n");
  for (const raw of lines) {
    const line = raw.trim();

    const heading = HEADING.exec(line);
    if (heading) {
      const text = stripBold(heading[1] ?? "").trim();
      // `## ` with nothing after it is noise, not a section.
      if (!text) continue;
      if (current) sections.push(close(current));
      current = open(text);
      continue;
    }

    if (line === "") {
      if (current) flushParagraph(current);
      continue;
    }

    // Content before any heading: give it the document's own short title.
    current ??= open(fallbackHeading);

    const bullet = BULLET.exec(line);
    if (bullet) {
      flushParagraph(current);
      const text = stripBold(bullet[1]).trim();
      if (text) current.bullets.push(text);
      continue;
    }

    const ordered = ORDERED.exec(line);
    if (ordered) {
      flushParagraph(current);
      const text = stripBold(ordered[1]).trim();
      if (text) current.ordered.push(text);
      continue;
    }

    current.para.push(stripBold(line));
  }

  if (current) sections.push(close(current));
  return sections;
}
