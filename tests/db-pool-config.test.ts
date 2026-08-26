import { describe, expect, it } from "vitest";

import { poolConfig } from "@/lib/db/index";

describe("pool configuration", () => {
  const neon =
    "postgresql://user:pw@ep-x-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

  it("keeps TLS on for a provider URL that asks for it", () => {
    expect(poolConfig(neon).ssl).toEqual({ rejectUnauthorized: true });
  });

  it("strips the SSL params pg would warn about", () => {
    // pg-connection-string treats sslmode=require as a deprecated alias and
    // logs a warning on every cold start, which lands in the platform logs at
    // error level. TLS is configured explicitly instead.
    const cs = poolConfig(neon).connectionString as string;
    expect(cs).not.toContain("sslmode");
    expect(cs).not.toContain("channel_binding");
    expect(cs).toContain("ep-x-pooler.c-5.us-east-2.aws.neon.tech");
    expect(cs).toContain("/neondb");
  });

  it("leaves TLS off for a local database that does not ask for it", () => {
    expect(poolConfig("postgresql://laffo@127.0.0.1:5432/laffogato").ssl).toBe(
      undefined,
    );
  });

  it("honours an explicit sslmode=disable", () => {
    expect(
      poolConfig("postgresql://laffo@127.0.0.1:5432/db?sslmode=disable").ssl,
    ).toBe(undefined);
  });

  it("gives a cold start room to reach a waking pooler", () => {
    // Too short a timeout degrades the first request after an idle period,
    // which shows the visitor a fallback page for no reason.
    expect(poolConfig(neon).connectionTimeoutMillis).toBeGreaterThanOrEqual(
      10_000,
    );
  });

  it("keeps one connection per instance", () => {
    expect(poolConfig(neon).max).toBe(1);
  });
});
