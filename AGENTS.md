# AGENTS.md

"The Plowman House": Vue 3 + TypeScript + Pinia + Firebase (Auth, Firestore, Hosting) household app, plus a weather dashboard. Spec: `Household OS Specification.markdown` (the spec's public/no-login kiosk tier is intentionally ignored; sign-in is required everywhere). Current state and live-check checklist: `docs/tracking/PROJECT-STATE.md`. Update it and `README.md` when behaviour changes.

## Commands

- `npm run build` runs `vue-tsc --noEmit && vite build`; a type error fails the build. `npm run typecheck` alone is faster.
- `npm test` = Vitest over `src/**/*.test.ts` (pure logic only, no Firebase). One file: `npx vitest run src/domain/ledger.test.ts`.
- `npm run test:rules` runs `firestore.rules` against the emulator and needs Java 21+ on PATH. Delete the generated `firestore-debug.log`/`ui-debug.log` afterwards.
- No linter or formatter is configured. There is no CI.
- Deploy: `npm run build`, then `firebase deploy` (project `home-d37bc`). `--only hosting` is only safe when `firestore.rules` is unchanged. **Deploy only when the user explicitly asks.**
- You can't sign in as the user, so signed-in flows can't be verified from a headless browser. Say so instead of claiming they work.

## Toolchain gotchas

- Windows + PowerShell 5.1. The real folder is `D:\Code\tistacherous-vue`; run commands with that casing. `vite.config.ts` pins `root` and the `@` alias to `realpathSync.native(process.cwd())` because wrong casing bundled Pinia twice and crashed production. Don't simplify it.
- TypeScript is held at 6.x: `vue-tsc` 3.3.x crashes with TS 7. Don't bump it.
- `npm audit` flags `@grpc/grpc-js` via Firestore; the suggested fix is a firebase 9 downgrade. Don't apply it.
- Write source files as UTF-8 without BOM (`Set-Content -Encoding UTF8` adds one). Sources contain emoji; PowerShell console output shows mojibake but the files are fine.
- In PowerShell, `\n` inside quotes is literal. Prefer the edit/write tools over shell here-strings for file changes.
- Vite 8 uses Rolldown: chunk config is `build.rolldownOptions.output.codeSplitting` (Firebase is split into its own chunks).

## Architecture

- `src/domain/`: types and pure, unit-tested business logic. Put new rules and calculations here, with tests.
- `src/stores/`: Pinia stores with realtime Firestore listeners (`household`, `chores`, `ledger`, `bills`, `tasks`). `App.vue` starts/stops them on `isAllowed`.
- `src/lib/firestore.ts` holds the collection paths. Data lives under `households/main/{members,kids,chores,instances,ledger,bills,recurringBills,tasks,taskCompletions}`.
- `src/features/weather/` is the original weather app; its styles are scoped under `.weather`. Keep it working.
- Styles: Catppuccin Mocha tokens in `src/styles/_variables.scss` (`c()` helper). New partials must be registered in `src/styles/main.scss`; order matters (`_settings.scss` loads after `_today.scss`).
- Routes: `/`, `/kids` (`?tab=board|audits|ledger|chores`), `/bills`, `/tasks`, `/weather`, `/settings`, `/kiosk`. Kiosk is chromeless with no nav and no management controls (strike, undo, "Set a goal"); `KidSummaryCard` gates those behind its `manage` prop, which only `KidsView` sets.
- Use `confirmDialog()` from `src/lib/confirm.ts` for confirmations. Never use native `confirm()`.

## Domain rules that are easy to get wrong

- No Cloud Functions. Daily chore instances and monthly bills are generated lazily by the first signed-in device with deterministic IDs, gated on `!metadata.fromCache`.
- A "day" is `YYYY-MM-DD` in the household timezone (default `America/Vancouver`), not the browser's. Use `useChoresStore().today` as the clock.
- Money-moving actions (bust, unbust, strike, payout, adjust) are `runTransaction`s that re-read the balance. Balances and penalties clamp at $0. Check-off is a batch so it works offline.
- Chores credit immediately; Busted claws back the credit plus a fine (value x `penaltyMultiplier`, clamped to the balance). The amount actually taken is stored as `bustedAmount` and Undo refunds exactly that. Nothing auto-verifies.
- The ledger is append-only. Instance statuses may only move pending <-> completed -> verified/busted, and verified/busted -> completed (re-audit). All of this is enforced in `firestore.rules`.
- Any new field written to a validated collection (instances, ledger, bills, tasks, taskCompletions) or new ledger `reason` needs a `firestore.rules` change, a case in `rules/firestore.rules.test.ts`, and a full `firebase deploy`; otherwise the write is rejected live.
- `tasks` and `taskCompletions` are excluded from the wildcard rule and have their own validators. Weekly routines are completed through `taskCompletions` docs named `{Monday}_{taskId}`, never on the task.
- Access = a member doc at `households/main/members/{lowercase email}` with `role` owner|parent.
- Pictures are data URLs on the kid doc (`avatarUrl`, `goal.imageUrl`). A doc caps at 1 MB and holds two, so each is limited to `MAX_PICTURE_CHARS` (420,000); files over 300 kB are re-saved as WebP by `src/lib/imageUpload.ts`. Shapes come from CSS. Circles were rejected by the user, and no image generator.
- `public/sw.js` (cache `plowman-shell-v1`) only registers in production builds. Bump the cache name if the shell caching strategy changes.

## Verification for UI work

- Headless Edge can load a production preview to catch console errors on the signed-out view. For component checks, use a temporary page under `tmp-imgtest/` served by `node node_modules/vite/bin/vite.js --port 5199`, and delete it afterwards.
