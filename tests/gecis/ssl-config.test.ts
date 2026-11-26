import { rootCertificates } from "node:tls";

import { describe, expect, it } from "vitest";

import { poolConfig } from "@/lib/db";
import { sslConfigFor } from "@/lib/db/ssl-config.mjs";

const CA = "-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----\n";
const quiet = () => {};

describe("sslConfigFor", () => {
  it("applies DATABASE_SSL_CA on any host, next to the system roots", () => {
    const out = sslConfigFor(
      "postgres://u:p@199.247.6.54:5433/laffogato?sslmode=verify-full",
      { DATABASE_SSL_CA: CA },
      quiet,
    );
    expect(out.ssl?.rejectUnauthorized).toBe(true);
    expect(out.ssl?.ca).toContain(CA);
    // Added, not replacing: a rollback to a publicly signed host still works.
    expect(out.ssl?.ca?.length).toBe(rootCertificates.length + 1);
    expect(out.connectionString).not.toContain("sslmode");
  });

  it("keeps the system roots alone when no CA is set (Neon)", () => {
    const out = sslConfigFor(
      "postgres://u:p@ep-x.us-east-2.aws.neon.tech/db?sslmode=require&channel_binding=require",
      {},
      quiet,
    );
    expect(out.ssl).toEqual({ rejectUnauthorized: true });
    expect(out.connectionString).not.toMatch(/sslmode|channel_binding/);
  });

  it("ignores a CA that is not PEM, and says so", () => {
    const said: string[] = [];
    const out = sslConfigFor(
      "postgres://u:p@db.example.com/db?sslmode=verify-full",
      { DATABASE_SSL_CA: "not a cert" },
      (m) => said.push(m),
    );
    expect(out.ssl).toEqual({ rejectUnauthorized: true });
    expect(said.join(" ")).toContain("PEM");
    expect(said.join(" ")).not.toContain("not a cert");
  });

  it("never offers rejectUnauthorized: false", () => {
    for (const mode of ["require", "verify-ca", "verify-full", "prefer"]) {
      const out = sslConfigFor(
        `postgres://u:p@h/db?sslmode=${mode}`,
        { DATABASE_SSL_CA: CA },
        quiet,
      );
      expect(out.ssl?.rejectUnauthorized).toBe(true);
    }
  });

  it("forces TLS on a Supabase host without sslmode, case-insensitively", () => {
    const out = sslConfigFor(
      "postgres://u:p@AWS-0-EU.POOLER.SUPABASE.COM:6543/postgres",
      {},
      quiet,
    );
    expect(out.ssl?.rejectUnauthorized).toBe(true);
  });

  it("no TLS when the URL does not ask for it (local)", () => {
    expect(
      sslConfigFor(
        "postgres://postgres@127.0.0.1:5432/laf",
        { DATABASE_SSL_CA: CA },
        quiet,
      ).ssl,
    ).toBeUndefined();
    expect(
      sslConfigFor("postgres://u@h/db?sslmode=disable", {}, quiet).ssl,
    ).toBeUndefined();
  });

  it("checks the certificate against DATABASE_SSL_SERVERNAME when set", () => {
    const out = sslConfigFor(
      "postgres://u:p@199.247.6.54:5433/laffogato?sslmode=verify-full",
      {
        DATABASE_SSL_CA: CA,
        DATABASE_SSL_SERVERNAME: "yyabtxbgmir17mxdsqwzwtfe",
      },
      quiet,
    );
    expect(out.ssl?.servername).toBe("yyabtxbgmir17mxdsqwzwtfe");
    const bad = sslConfigFor(
      "postgres://u:p@h/db?sslmode=verify-full",
      { DATABASE_SSL_SERVERNAME: "bad name/../" },
      quiet,
    );
    expect(bad.ssl?.servername).toBeUndefined();
  });
});

describe("poolConfig", () => {
  it("keeps one connection per instance (the server has a connection cap)", () => {
    const cfg = poolConfig("postgres://u:p@h/db?sslmode=require");
    expect(cfg.max).toBe(1);
    expect(cfg.ssl).toMatchObject({ rejectUnauthorized: true });
  });
});
