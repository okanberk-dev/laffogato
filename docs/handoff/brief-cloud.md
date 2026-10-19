# Working rules for the cloud sessions (handoff, 19 Oct 2026)

Repos: `RiosenBeq/laffogato` (site, Next.js 16, Vercel; production deploys ONLY from `main`) and `RiosenBeq/lafmobil` (Expo app). Read each repo's `CLAUDE.md` and `AGENTS.md` first and follow them fully (security rules 1-30, front/back split, migrations, docs, Turkish copy).

Everything a session needs lives in the repo: `docs/handoff/` (this folder) on `main` of laffogato.

## Per pull request
1. Build on a branch from the current `main` (or continue a pushed WIP branch named in `README.md`). Small logical commits, English conventional messages ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
2. Re-verify each finding or spec item on current `main` before changing code; if already done, say so with evidence and skip it.
3. Tests for every behaviour you change (a test must fail on the old code). Run `npm run typecheck`, `npx eslint --max-warnings=0 <changed files>` and the touched + related vitest files. CI runs the full suite and `next build`.
4. An INDEPENDENT review before merge, by a different agent/session than the builder:
   - money/refund/stock/coupon/consent/legal PRs (`review: adversarial`): first list concrete claims through three lenses (money, access, regression), then one verifier per lens tries to refute each claim with a test or script and fixes only what survives, each with a regression test;
   - other PRs: one careful review (security-minded where marked) that proves each claimed fix and hunts regressions.
5. Draft PR against `main`: Turkish title like the recent history, Turkish body with "Ne değişti", "Neden", "Test", "Notlar / riskler" (and "Hukuki dayanak" where law is involved, "Zaten düzelmiş / atlanan" for skipped items), last line `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
6. Merge only when CI ("typecheck + test + build") and the Vercel preview are green at the exact head: `gh pr ready N` then `gh pr merge N --squash --match-head-commit <sha>`. After each merge, bring the next open PR up to date (merge `main` into it; regenerate `db/schema.sql` + `src/lib/db/schema-sql.ts` with `npm run db:bundle` when migrations conflict, never hand-merge them; keep both sides' sections in `docs/AUDIT.md`), wait for green, merge.
7. After each merge check production: the newest production deployment must come from `main` (Vercel dashboard or API), and `/`, `/odeme`, `/menu`, `/karaoke`, `/magaza`, `/admin/giris`, `/api/mobile/v1/shop`, `/api/mobile/v1/menu` answer 200.

## Hard rules
- Never promote a preview or redeploy an old deployment to production (an old branch served production for 9.5 hours on 18-19 Oct). Production only from `main`.
- Neon free plan: max 10 branches. Every pushed branch gets a `preview/<branch>` Neon branch through the Vercel integration; when the limit is full the Vercel check stays pending. After each merge delete that PR's `preview/*` branch (never `production`, never `vercel-dev`). If you cannot reach Neon from the cloud session, tell the operator which `preview/*` branches to delete.
- Migrations: `db/migrations/YYYYMMDDHHMMSS_name.sql`, name sorts after the newest on `main` (rename on update if needed), then `npm run db:bundle` and commit the generated files.
- `/api/mobile/v1` is additive only. Any change to `docs/API-MOBILE.md` must be copied byte for byte to lafmobil with a new `RECONCILED` hash in `src/data/contract-sync.test.ts` (separate lafmobil PR, merged after the site PR).
- Legal: no lawyer or accountant round (operator decision 18 Oct 2026). Decide from current Turkish law (primary sources), write "Hukuki dayanak". D-SAME-DAY: at most one PR that moves `LEGAL_UPDATED` (or `KARAOKE_LEGAL_UPDATED`) in `src/lib/legal/meta.ts` merges per Istanbul calendar day, and it carries that day's date.
- Money: card data never stored or logged (rule 28); an unreachable POS is never "not paid" (rule 29); validate before moving money (rule 25); counters move in SQL (rule 20); never call the live PayNkolay POS, never use real cards.
- Copy: Turkish UI, informal "sen" for customers, no long dashes (U+2013/U+2014) anywhere.
- No new npm dependencies unless the spec names them with an exact pin (admin UI v2: `lucide-react@1.51.0`, `react-aria-components@1.21.1`, `@internationalized/date@3.12.4`; add them with `npm install --save-exact`).
