# EV Charging Tool

Full-stack pnpm monorepo: `client/` (React 18 + Vite + TanStack Query + Tailwind + Leaflet) and `server/` (Express + better-sqlite3 + Zod). App = Open Charge Map station finder + EV trip/charge planner. No test framework and no CI — verification is scripts + manual/smoke runs (see below).

## Mandatory Planning Rule

**You MUST create a plan before writing any code.** This is non-negotiable.

1. Create a plan file in the `.plans/` folder before starting any coding task
2. Name the file with an incrementing number and short slug: `000-short-slug.md`, `001-another-task.md`, etc.
3. The plan must contain bullet points with checkboxes using the following states:
   - `[ ]` — pending (not yet started)
   - `[o]` — in progress (currently working on)
   - `[x]` — completed
4. **Present the plan to the user and WAIT for explicit approval before writing any code**
5. When you start working on a task, immediately mark it as `[o]`
6. When a task is done, mark it as `[x]`
7. Only then proceed to the next task
8. **When all tasks are completed, update README.md if the changes require it** (read the active plans in `.plans/` for what changed; older instructions referenced DATAMODEL.md/TECH.md but those files do not currently exist — do not create them unless the user asks)
9. **After all tasks are completed, append a "Summary & Learnings" section to the bottom of the plan file.** This retrospective should capture, in a few concise bullet points:
   - **Ups** — what went well, what worked smoothly
   - **Downs** — what was harder than expected, what went wrong, dead ends
   - **Challenges** — the tricky parts, gotchas, and how they were solved
   - **Learnings** — reusable insights, patterns, or warnings that will help with future similar tasks

**Example** (`.plans/003-add-export-button.md`):
```markdown
# Add CSV Export Button to Sales Module

- [x] Identify where export logic should live
- [o] Create export utility function in shared
- [ ] Add button to SalesOverviewTab
- [ ] Wire up click handler to trigger download
- [ ] Test with sample data

## Summary & Learnings

- **Ups:** Reused the existing `useFormatter` hook; export logic dropped into shared cleanly.
- **Downs:** TanStack Table column state made it tricky to grab the filtered rows.
- **Challenges:** Had to read filtered rows from the table instance, not the raw data — solved via `table.getFilteredRowModel()`.
- **Learnings:** For any future export button, pull rows from the table instance so filters/sorting are respected.
```

Note: `.plans/` is gitignored — plan files are local working notes, never committed.

## Commands

- `pnpm dev` — client (Vite, :5173, proxies `/api` → :3001) + server (`tsx watch src/index.ts`, :3001). Individually: `pnpm client:dev`, `pnpm server:dev`. Stop with `lsof -ti:3001,5173 | xargs kill -9`.
- `pnpm type-check`, `pnpm lint`, `pnpm build` — run both packages in parallel; these are the **only** checks that exist (no test suite).
- `pnpm format` / `format:check` — Prettier (single quotes, trailing commas, 100 cols, at root `.prettierrc`).
- Production: `pnpm build`, then `pnpm server:start` (= `node dist/index.js`). The server serves `client/dist` statically when present (`CLIENT_DIST` env override; default `<server>/../client/dist`), with an SPA fallback for non-`/api` GETs and JSON 404s elsewhere. Without a built client it runs API-only (`GET /` → 404 JSON; use the Vite dev server).

## Layout & wiring (know before you edit)

- `@/*` imports map to `client/src/*` (client tsconfig `paths` + `vite.config.ts` alias). The server uses plain relative `../` imports — no alias.
- OCM station types are duplicated: `server/src/types/index.ts` is the source, `client/src/types/index.ts` mirrors it — keep them in sync.
- SQLite schema lives in code: `server/src/db/index.ts` runs `CREATE TABLE IF NOT EXISTS` + guarded `ALTER TABLE … ADD COLUMN` migrations inside `initDb()` on every server boot. Never hand-edit `server/data/ev-cache.db`; delete the file to reset.
- Client API layer is `client/src/lib/api.ts` (fetch wrapper matching the `server/src/routes/*` REST routes). External services: Nominatim (geocoding), OSRM public router (`router.project-osrm.org`), OCM (stations — needs `OCM_API_KEY` set in `server/.env`, copy `server/.env.example`), EVDB catalogue (`gaia-charge.github.io/evdb/v1`).
- Charge-planning entry points: `client/src/utils/chargePlan.ts` (pure logic) + `client/src/components/ChargePlanView.tsx` (UI). Route math: `client/src/utils/routingUtils.ts`.
- `.env` is gitignored; the OCM key is required for live station data (cached DB responses work without it).

## Verification & smoke tests (no test runner)

- Verify changes with `pnpm type-check && pnpm lint && pnpm build`.
- For pure client logic (e.g. `chargePlan.ts`), the established smoke pattern: copy the file(s) into a temp dir, `sed`-replace `@/…` imports to local stubs, compile with a minimal tsconfig, run with `node`. Exact recipe worked out previously:
  1. `cp client/src/utils/chargePlan.ts /tmp/<dir>/chargePlan.ts`
  2. `sed -i '' "s|from '@/utils/routingUtils'|from './stubs'|; s|from '@/types'|from './stubs'|; s|from '@/lib/utils'|from './stubs'|"` and write a `stubs.ts` with the imported helpers/types (`haversineDistance`, `getStationStatus`, `getMaxPower`, station types)
  3. compile with `client/node_modules/.bin/tsc -p /tmp/<dir>/tsconfig.json --outDir /tmp/<dir>/build` (minimal tsconfig: commonjs, es2020, strict, `ignoreDeprecations: "6.0"`; pass absolute `-p` and `--outDir` so the working directory is never ambiguous), then `node build/smoke.js`
- **Never run bare `npx tsc`** — it installs the deprecated npm `tsc` package, not TypeScript. Always use `client/node_modules/.bin/tsc` or the pnpm scripts.
- Live smoke: `cd server && PORT=3999 node dist/index.js`, then curl `/health` and `/api/cars` (200 expected).

## Domain gotchas

- Charge plan: `computeChargePlan` produces range-based ideal stops; `anchorPlanToStations` snaps them to real stations — prefers `preferredOperator`, **falls back to any operator** so the destination stays reachable, and flags plans `infeasible` with per-stop `reasons` when a leg has no reachable charger. Hard arrival floor: `PLAN_FLOOR_SOC_PCT = 5`. WLTP range is optimistic — the floor is the guard.
- Charge-time defaults `DEFAULT_CHARGE_10_80_MIN = 45` / `DEFAULT_CHARGE_10_100_MIN = 55` are applied when a car has no stored values; such plans are flagged `usesEstimates` in the UI.
- `charge_time_10_100_min` (DB + `Car`) stores the EVDB **0→100** field (`dc_charge_time_0_100_min`) as a documented estimate — EVDB has no true 10→100 time.
- Operator preference = case-insensitive substring of `operator.title`, identical semantics in client (`matchesOperator` / `rankStations`) and the server's `?operator=` station filter.
- OCM reports `statusTitle: "Operational"` (not live occupancy). "n free" is only shown when a connection's `statusTitle` contains "Available" (`availableConnectors`); otherwise the connector totals are shown.