import { describe, expect, it } from "vitest";

import { schemaPolicies, schemaTableSecurity } from "./_support/schema-tables";

/**
 * Row level security is on, with no policy, for every table the schema
 * creates.
 *
 * On Neon it changes nothing: the app connects as the tables' owner, and RLS
 * does not apply to an owner. On a Supabase database every table in `public`
 * is served through PostgREST to the anon and authenticated roles; RLS with
 * no policy is what keeps them out (docs/SUPABASE-GECIS.md §1).
 * customer_milestone_rewards was created without it (20260923200000) and
 * stayed the one open table until 20261020175000. A new table that forgets
 * it fails here; tests/db-integration-schema-objects.test.ts asks a real
 * Postgres the same question through pg_class.relrowsecurity.
 */

describe("row level security on every table", () => {
  it("is on for every table db/schema.sql leaves behind", () => {
    const tables = schemaTableSecurity();
    // The parse still finds the schema (an empty map would pass vacuously).
    expect(tables.size).toBeGreaterThanOrEqual(46);
    expect([...tables.keys()]).toEqual(
      expect.arrayContaining([
        "_migrations",
        "orders",
        "customers",
        "customer_milestone_rewards",
      ]),
    );
    const open = [...tables].filter(([, t]) => !t.rls).map(([name]) => name);
    expect(open).toEqual([]);
  });

  it("has no policy: RLS without one is what closes a table to client roles", () => {
    expect(schemaPolicies()).toEqual([]);
  });
});

describe("the schema reader", () => {
  it("follows the statements in order and ignores comments", () => {
    const tables = schemaTableSecurity(`
      create table if not exists public.a (id text);
      alter table public.a enable row level security;
      -- alter table public.a disable row level security;
      create table if not exists public.b (id text);
      create table if not exists public.c (id text);
      alter table public.c enable row level security;
      drop table if exists public.c cascade;
      create table if not exists public.c (id text);
      create table if not exists public.d (id text);
      alter table public.d   enable row level security;
      alter table public.d disable row level security;
      create table if not exists public.gone (id text);
      drop table if exists public.gone;
    `);
    expect(Object.fromEntries(tables)).toEqual({
      a: { rls: true },
      b: { rls: false },
      c: { rls: false },
      d: { rls: false },
    });
    expect(schemaPolicies("create policy p on public.a for select using (true);")).toHaveLength(1);
    expect(schemaPolicies("-- create policy p on public.a for select using (true);")).toEqual([]);
  });
});
