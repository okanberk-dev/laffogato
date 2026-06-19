import type { ReactNode } from "react";

import type { LegalDoc } from "./documents";

/**
 * Serialize a coded legal document's structured sections into editable
 * Markdown. Used to pre-fill the admin editor so editing starts from the
 * current published content rather than a blank box.
 */
export function sectionsToMarkdown(doc: LegalDoc): string {
  const blocks: string[] = [];
  for (const s of doc.sections) {
    blocks.push(`## ${s.heading}`);
    for (const p of s.paragraphs ?? []) blocks.push(p);
    if (s.bullets?.length) {
      blocks.push(s.bullets.map((b) => `- ${b}`).join("\n"));
    }
    if (s.ordered?.length) {
      blocks.push(s.ordered.map((o, i) => `${i + 1}. ${o}`).join("\n"));
    }
    if (s.table?.length) {
      blocks.push(s.table.map((r) => `- **${r.key}:** ${r.value}`).join("\n"));
    }
  }
  return blocks.join("\n\n");
}

// ── Minimal, safe Markdown renderer ─────────────────────────────────────────
// Supports: ## / ### headings, - bullet lists, 1. ordered lists, paragraphs,
// and **bold** inline. Content is admin-authored (RBAC-gated) and rendered as
// React text nodes only — no raw HTML is ever injected.

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== "");
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${keyPrefix}-b${i}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${keyPrefix}-t${i}`}>{part}</span>;
  });
}

export function LegalMarkdown({ body }: { body: string }) {
  const blocks = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <article className="legal-article">
      <section className="legal-section">
        {blocks.map((block, i) => {
          const lines = block.split("\n").map((l) => l.trim());

          if (block.startsWith("### ")) {
            return <h3 key={i}>{renderInline(block.slice(4), `h3-${i}`)}</h3>;
          }
          if (block.startsWith("## ")) {
            return <h2 key={i}>{renderInline(block.slice(3), `h2-${i}`)}</h2>;
          }
          if (lines.every((l) => l.startsWith("- "))) {
            return (
              <ul key={i} className="legal-bullets">
                {lines.map((l, j) => (
                  <li key={j}>{renderInline(l.slice(2), `ul-${i}-${j}`)}</li>
                ))}
              </ul>
            );
          }
          if (lines.every((l) => /^\d+\.\s/.test(l))) {
            return (
              <ol key={i} className="legal-ordered">
                {lines.map((l, j) => (
                  <li key={j}>
                    {renderInline(l.replace(/^\d+\.\s/, ""), `ol-${i}-${j}`)}
                  </li>
                ))}
              </ol>
            );
          }
          return (
            <p key={i}>
              {lines.map((l, j) => (
                <span key={j}>
                  {renderInline(l, `p-${i}-${j}`)}
                  {j < lines.length - 1 ? <br /> : null}
                </span>
              ))}
            </p>
          );
        })}
      </section>
    </article>
  );
}
