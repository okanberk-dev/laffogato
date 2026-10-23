import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildEnvProblem } from "../scripts/check-build-env.mjs";

/**
 * A Vercel production build without DATABASE_URL goes red (15-17 Oct 2026:
 * a build without it served degraded pages, `[db-degraded]`, with nothing
 * but log lines to show). Previews, local builds and CI build without a
 * database as before. The script uses the app's own rule
 * (src/lib/db/database-url.mjs) and never prints a value.
 */

const SECRET = "postgres://u:s3cret-pw@db.example.test:5432/laf";
const SCRIPT = join(process.cwd(), "scripts", "check-build-env.mjs");

describe("buildEnvProblem", () => {
  it("stops a production build with no DATABASE_URL", () => {
    for (const DATABASE_URL of [undefined, "", "   "]) {
      const problem = buildEnvProblem({
        VERCEL_ENV: "production",
        DATABASE_URL,
      });
      expect(problem).toContain("DATABASE_URL tanımlı değil");
      expect(problem).toContain("Üretim derlemesi durduruldu");
      expect(problem).toContain("Production build stopped");
    }
  });

  it("does not take POSTGRES_URL for it, and names it without its value", () => {
    const problem = buildEnvProblem({
      VERCEL_ENV: "production",
      POSTGRES_URL: SECRET,
    });
    expect(problem).toContain("POSTGRES_URL");
    expect(problem).not.toContain("s3cret-pw");
  });

  it("lets a production build with DATABASE_URL through", () => {
    expect(
      buildEnvProblem({ VERCEL_ENV: "production", DATABASE_URL: SECRET }),
    ).toBeNull();
  });

  it("leaves previews, development, CI and local builds alone", () => {
    for (const VERCEL_ENV of ["preview", "development", "", undefined]) {
      expect(buildEnvProblem({ VERCEL_ENV })).toBeNull();
    }
  });
});

describe("the script, run as the build runs it", () => {
  function run(env: Record<string, string | undefined>) {
    // A clean environment: nothing from the test runner's own leaks in.
    return spawnSync(process.execPath, [SCRIPT], {
      env: {
        PATH: process.env.PATH ?? "",
        ...env,
      } as unknown as NodeJS.ProcessEnv,
      encoding: "utf8",
    });
  }

  it("exits 1 with the reason for a production build without the variable", () => {
    const res = run({ VERCEL_ENV: "production", POSTGRES_URL: SECRET });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("[build-env] DATABASE_URL tanımlı değil");
    expect(res.stderr).not.toContain("s3cret-pw");
  });

  it("exits 0 otherwise, saying nothing", () => {
    for (const env of [
      { VERCEL_ENV: "production", DATABASE_URL: SECRET },
      { VERCEL_ENV: "preview" },
      {},
    ]) {
      const res = run(env);
      expect(res.status).toBe(0);
      expect(res.stderr).toBe("");
    }
  });
});

describe("wiring", () => {
  it("runs before next build on Vercel, which ignores npm's prebuild", () => {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
    expect(vercel.buildCommand).toBe(
      "node scripts/check-build-env.mjs && next build",
    );
  });

  it("runs first under npm run build too", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    expect(pkg.scripts.prebuild).toMatch(
      /^node scripts\/check-build-env\.mjs && /,
    );
  });
});
