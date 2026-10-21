import { readFileSync } from "node:fs";

/**
 * What db/schema.sql leaves each table with, read statement by statement in
 * file order: a table exists once created and until dropped, and has row
 * level security once enabled after its (last) creation.
 *
 * `--` comments are stripped first: migration headers quote rollbacks such as
 * "disable row level security", which are prose, not statements.
 */
export function schemaTableSecurity(
  sql = readFileSync("db/schema.sql", "utf8"),
): Map<string, { rls: boolean }> {
  const code = sql.replace(/--[^\n]*/g, "");
  type Event = {
    at: number;
    table: string;
    kind: "create" | "drop" | "enable" | "disable";
  };
  const events: Event[] = [];
  const push = (re: RegExp, kind: (m: RegExpMatchArray) => Event["kind"]) => {
    for (const m of code.matchAll(re)) {
      events.push({ at: m.index ?? 0, table: m[1].toLowerCase(), kind: kind(m) });
    }
  };
  push(
    /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?/gi,
    () => "create",
  );
  push(
    /\bdrop\s+table\s+(?:if\s+exists\s+)?(?:public\.)?"?([a-z_0-9]+)"?/gi,
    () => "drop",
  );
  push(
    /\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?(?:public\.)?"?([a-z_0-9]+)"?\s+(enable|disable)\s+row\s+level\s+security/gi,
    (m) => (m[2].toLowerCase() === "enable" ? "enable" : "disable"),
  );
  events.sort((a, b) => a.at - b.at);

  const tables = new Map<string, { rls: boolean }>();
  for (const e of events) {
    if (e.kind === "create") {
      // `create table if not exists` on a live table changes nothing.
      if (!tables.has(e.table)) tables.set(e.table, { rls: false });
    } else if (e.kind === "drop") {
      tables.delete(e.table);
    } else {
      const t = tables.get(e.table);
      if (t) t.rls = e.kind === "enable";
    }
  }
  return tables;
}

/** Every policy statement in db/schema.sql, comments stripped. */
export function schemaPolicies(
  sql = readFileSync("db/schema.sql", "utf8"),
): string[] {
  const code = sql.replace(/--[^\n]*/g, "");
  return [...code.matchAll(/\bcreate\s+policy\s+[^;]*/gi)].map((m) => m[0]);
}
