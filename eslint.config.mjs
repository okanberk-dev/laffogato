import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // Honor the `_`-prefix convention the codebase already uses for
      // intentionally-unused args/vars (e.g. useActionState's `_prev`).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Stylistic only — literal quotes/apostrophes (incl. Turkish
      // possessives like "Tuzla'da") render fine; keep as a warning.
      "react/no-unescaped-entities": "warn",
      // The new React-Compiler-strict hooks rules flag patterns that are
      // intentional in this codebase (mount/hydration sync — see the
      // LaffogatoApp hydration note in CLAUDE.md, render-time date checks,
      // and handler-time navigation). Surface them as warnings rather than
      // refactoring hydration-critical code.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  {
    // The admin panel's UI libraries stay in the panel: the customer site,
    // src/lib (server and pure modules), the mobile API and the scripts never
    // load them. Inside the panel, tests/admin-ui-deps.test.ts holds the
    // finer rules (lucide only through ui/icons.tsx, React Aria and
    // @internationalized/date only in "use client" files, React Aria by
    // sub-path) and catches the dynamic import() this rule cannot see.
    ignores: ["src/components/admin/**", "src/app/admin/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "lucide-react",
                "lucide-react/*",
                "react-aria-components",
                "react-aria-components/*",
                "@internationalized/date",
                "@internationalized/date/*",
              ],
              message:
                "Admin UI libraries are for src/components/admin and src/app/admin only.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored, minified widget bundle built from its own project. Linting a
    // build artifact only produced noise — 10 `no-this-alias` errors in a
    // minifier's output — which drowned out real findings in `src`.
    "public/laffogato-pour.js",
  ]),
]);

export default eslintConfig;
