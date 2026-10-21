/**
 * CSV reading and writing for the panel's imports (RFC 4180).
 *
 * Client-safe and dependency-free: the product import parses with it on
 * the server, and its template is written with it. What it accepts is what
 * a spreadsheet actually saves:
 *
 * - a UTF-8 byte order mark at the start (Excel's "CSV UTF-8") is dropped;
 * - `;` (Excel with a Turkish locale) or `,` between cells, picked from the
 *   first record, whichever appears more often outside quotes;
 * - CRLF, LF or a lone CR between records;
 * - quoted cells holding the delimiter, line breaks and `""` for a quote;
 * - empty lines, and lines of empty cells only (";;;;"), are skipped.
 *
 * Cells come back as written, untrimmed; a line break inside a quoted cell
 * comes back as "\n" whatever the file used. A quote that is never closed
 * is an error with the line it opened on, not a silently merged file.
 */

export type CsvDelimiter = "," | ";";

export interface CsvRecord {
  /** The file line the record starts on, from 1 (a quoted cell may span lines). */
  line: number;
  cells: string[];
}

export type CsvParseResult =
  | { ok: true; delimiter: CsvDelimiter; records: CsvRecord[] }
  | { ok: false; error: string; line: number };

const BOM = "﻿";

export function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text;
}

/**
 * The delimiter of the first non-empty record: `;` when it appears more
 * often than `,` outside quotes, otherwise `,`.
 */
export function detectDelimiter(input: string): CsvDelimiter {
  const text = stripBom(input).replace(/^[\r\n]+/, "");
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        i += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }
    if (quoted) continue;
    if (c === "\n" || c === "\r") break;
    if (c === ",") commas += 1;
    else if (c === ";") semicolons += 1;
  }
  return semicolons > commas ? ";" : ",";
}

export function parseCsv(
  input: string,
  delimiter?: CsvDelimiter,
): CsvParseResult {
  const text = stripBom(input);
  const sep = delimiter ?? detectDelimiter(text);
  const records: CsvRecord[] = [];

  let cells: string[] = [];
  let cell = "";
  let line = 1;
  let recordLine = 1;
  let quoted = false;
  let quoteLine = 0;
  // A quoted cell just closed: only the delimiter, a line break or spaces
  // may follow it.
  let closed = false;

  const endRecord = () => {
    cells.push(cell);
    if (cells.some((c) => c.trim() !== "")) {
      records.push({ line: recordLine, cells });
    }
    cells = [];
    cell = "";
    closed = false;
  };

  let i = 0;
  while (i < text.length) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          quoted = false;
          closed = true;
          i += 1;
        }
      } else if (c === "\r" || c === "\n") {
        cell += "\n";
        line += 1;
        i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
      } else {
        cell += c;
        i += 1;
      }
      continue;
    }

    if (c === sep) {
      cells.push(cell);
      cell = "";
      closed = false;
      i += 1;
      continue;
    }

    if (c === "\r" || c === "\n") {
      endRecord();
      i += c === "\r" && text[i + 1] === "\n" ? 2 : 1;
      line += 1;
      recordLine = line;
      continue;
    }

    if (closed) {
      if (c === " " || c === "\t") {
        i += 1;
        continue;
      }
      return {
        ok: false,
        line,
        error: `${line}. satırda tırnak kapandıktan sonra beklenmeyen bir karakter var. Hücredeki tırnağı ikiye katla ("").`,
      };
    }

    if (c === '"' && cell === "") {
      quoted = true;
      quoteLine = line;
      i += 1;
      continue;
    }

    cell += c;
    i += 1;
  }

  if (quoted) {
    return {
      ok: false,
      line: quoteLine,
      error: `${quoteLine}. satırda açılan tırnak kapanmamış.`,
    };
  }
  if (cell !== "" || cells.length > 0 || closed) endRecord();

  return { ok: true, delimiter: sep, records };
}

/**
 * One cell, quoted when it holds the delimiter, a quote or a line break. A
 * cell that starts with = + - @ (or a tab / CR) gets a ' first, so a
 * spreadsheet shows it as text instead of running it as a formula (CSV
 * injection, as order-csv.ts's csvCell): the import template carries the
 * first category's label, which a manager can set to `=HYPERLINK(…)` for the
 * owner to open in Excel.
 */
export function csvField(value: string, delimiter: CsvDelimiter): string {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return text.includes(delimiter) || /["\r\n]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

/** Records as CSV text: CRLF line ends, a byte order mark when asked. */
export function toCsv(
  rows: ReadonlyArray<ReadonlyArray<string>>,
  delimiter: CsvDelimiter,
  { bom = false }: { bom?: boolean } = {},
): string {
  const body = rows
    .map((row) => row.map((v) => csvField(v, delimiter)).join(delimiter))
    .join("\r\n");
  return `${bom ? BOM : ""}${body}\r\n`;
}
