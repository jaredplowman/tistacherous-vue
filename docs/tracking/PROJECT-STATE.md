# The Plowman House: project state

Last updated: 2026-11-12. Written so a new session (or person) can pick up without the chat history.

## Objective

Overhaul the Vue/Firebase app into "The Plowman House", a household app built from
`Household OS Specification.markdown`, on the existing Firebase Hosting, keeping the weather app.
Phases 0-6 and the follow-up round (confirm dialog, undo bust, goals, ordering, strike button, picture upload)
are built and deployed.

- Live: https://home-d37bc.web.app and home.jaredplowman.dev (Firebase project `home-d37bc`).

## Requirements and preferences

- Sign-in required everywhere (the spec's public/no-login kiosk tier is ignored).
- Kiosk (`/kiosk`) is chromeless: no nav, only exit is typing another URL. No management controls on it
  (add strike, undo, "Set a goal").
- TypeScript throughout. Kids and members are configurable in Settings.
- Payouts are cash and reduce the goal/ledger balance.
- Chores credit immediately, with a clawback if busted. No auto-verify; chores wait for a parent audit.
- Streak = consecutive days with all scheduled chores done and none busted.
- Busts and the strike penalty clamp at $0.
- Weekly adult tasks use per-week completion records (`taskCompletions`).
- **Deploy only when the user explicitly asks.** The user checks things live.
- Keep packages current.
- Pictures: simple upload only. No circles. Shrink only when the file is huge. No generator (rejected: "it's awful").

## Decisions

- Firestore: Standard edition, Native mode, Toronto (`northamerica-northeast2`), `(default)` database.
- Stack: Vue 3, TypeScript (`vue-tsc`), Pinia 4, Vitest 5, Vite 8 (Rolldown), vue-router 5, firebase 13.3.
  - TypeScript is held at 6.0.3 because `vue-tsc` 3.3.14 crashes with TS 7.
  - `npm audit` flags `@grpc/grpc-js` via Firestore. Its suggested fix is a downgrade to firebase 9; not applied.
- No Cloud Functions. Generation (daily chore instances, monthly bills) is lazy on the first signed-in device,
  with deterministic IDs, gated on `!metadata.fromCache`.
- Days are `YYYY-MM-DD` in the household timezone (default `America/Vancouver`). Shared clock: `useChoresStore().today`.
- Access is decided by member docs at `households/main/members/{lowercase email}` (`role`: owner|parent),
  enforced by `firestore.rules`.
- Navigation: desktop sidebar, tablet icon rail, phone bottom tabs.
  Routes: `/`, `/kids` (tabs via `?tab=`: board, audits, balances, ledger, chores), `/bills`, `/tasks`, `/benefits`,
  `/weather`, `/settings`, `/kiosk`.
- Chores:
  - Pass sets `verified`. Busted deducts value x `penaltyMultiplier`, clamped at the balance.
  - Strike, payout and adjust use `runTransaction`. Check-off is a batch and works offline.
  - The ledger is append-only. Instance status transitions are enforced in the rules.
- Benefits (`/benefits`, `src/stores/benefits.ts`, `src/domain/benefits.ts`): tracks claims, status (`draft`, `submitted_primary`, `denied_primary`, `submitted_secondary`, `denied_secondary`, `paid`, `closed`), primary/secondary plan amounts, notes, and PDFs (receipt, primary response, secondary response) stored in Firebase Storage (`src/lib/storage.ts`, `storage.rules`). Firebase AI Logic (`src/lib/benefitAi.ts`, `GoogleAIBackend`, `gemini-3.8-flash`) scans uploaded PDFs (including scanned images) to auto-fill claim details and detect/prompt for caregivers and care types ($500 default yearly budget per adult member), with `pdfjs-dist` (`src/lib/pdfText.ts`) as a local fallback. Requires `firebase deploy --only storage` (or full `firebase deploy`) for `storage.rules`.
- Phase 6: icons and manifest in `public/`, `public/sw.js` (cache `plowman-shell-v1`, production only), kiosk wake lock
  in `src/lib/wakeLock.ts`, export-only backup in Settings, rules tests in `rules/`, Firebase chunk split in
  `vite.config.ts`.
- **Build bug fix (keep):** `vite.config.ts` uses `realpathSync.native(process.cwd())` as `root` and for the `@`
  alias, because the `d:\code` vs `D:\Code` casing bundled Pinia twice.
- Confirm dialog: all 10 native `confirm()` calls replaced by promise-based, queued `confirmDialog()`
  (`src/lib/confirm.ts`, `src/app/components/ConfirmDialog.vue` mounted in `App.vue`). Supports `details` and
  `danger`, focuses Cancel, closes on Esc or backdrop click.
- Undo bust:
  - Busting stores `bustedAmount` on the instance.
  - `unbust` is a transaction: busted -> `completed`, refunds the amount, adds ledger reason `bust_reverted`.
    Older busts look up the ledger entry (`referenceId` + `busted_penalty`).
  - `reopenAudit` moves verified -> `completed` with no money moving.
  - UI: Kids -> Audits -> "Recently audited" (`RecentAudits.vue`, last 7 days) and an Undo link on the board's
    BUSTED line. Helpers: `src/features/kids/audit.ts`, `src/features/kids/strike.ts`.
- Strike: "Add strike" on board cards (`KidSummaryCard` `manage` prop, KidsView only) and in Kids -> Balances. Penalty and strikes-to-fill are per kid in Settings -> Kids.
- Strike meter: empty slots are faded grey ⚠️ (not ⚪), filled ones full colour.
- Kid colours: Settings -> Kids sets `cardColor` (card background) and `nameColor` on the kid doc (no rules change; kids are open to members). `src/domain/color.ts` (tested) picks dark/light text by WCAG contrast; a name colour under 3:1 on the card is ignored. Unchecked live: set colours, view Board and kiosk.
- Kiosk emoji burst: tapping a pending chore on the kiosk (`large` card only) triggers `makeBurst` emoji explosion (`src/domain/burst.ts`, 1.8 s). Progress bar gain popup (`spark-gain`) runs 1.9 s.
- Goals: Settings -> Kids (`KidEditRow.vue`) edits goal title, target and picture. The board shows a "Set a goal"
  link when none. The saved balance is not editable there. The form only reloads when an edited field changes.
- Ordering: `ChoreDefinition.sortOrder?` with `sortChores`, `moveChore`, `nextSortOrder`, `sortInstances`.
  Board, manage list and kiosk follow it; new chores go last. Up/down buttons in Kids -> Chores. Kids use
  `moveKid` / `nextKidOrder` in Settings -> Kids.
- Pictures:
  - **Upload picture** button (`PictureField.vue`, `src/lib/imageUpload.ts`).
  - Files up to 300 kB are saved as uploaded. Bigger files are re-saved as WebP, longest side at most 1600 px,
    quality stepping down until it fits. No crop. Transparency kept.
  - Stored as data URLs on the kid doc (`avatarUrl`, `goal.imageUrl`). Limit `MAX_PICTURE_CHARS` = 420,000 each
    (a doc is capped at 1 MB and holds two pictures).
  - Shown as rounded squares via CSS (`.avatar` 28%, goal image 14px radius). No picture -> lilac initial.
  - Firebase Storage was offered (needs the Blaze plan) and not chosen.

## Status

### Done and deployed
- Phases 0-6 plus the follow-up round above.
- The rules were last deployed with the follow-up round (instance transitions, `bustedAmount`, `bust_reverted`).
- The upload-only picture change was deployed hosting-only.
- Verification at last deploy: `vue-tsc` clean, `npm run build` no warnings, `npm test` 127 passing (12 files),
  `npm run test:rules` 46 passing, headless Edge showed no console errors on the signed-out view.
- Upload pipeline checked in headless Edge: 7 MB noisy JPEG -> 307 kB, 18 MB PNG -> 264 kB, small PNG kept
  transparency, PDF rejected.

### Waiting on
- The user's live check. No signed-in flow has been tried by the user or by the assistant (the assistant can't sign in).

## Live-check checklist

Pictures and follow-up round:
- [ ] Upload a kid picture and a goal picture, Save. Rounded squares on Board, kiosk, Accounts rows. Replace and Remove work.
- [ ] Busted opens the themed dialog (not the browser popup).
- [ ] Undo bust and Reopen: balance returns, chore reappears in Pending audit.
- [ ] Goals editor in Settings -> Kids.
- [ ] Up/down ordering for chores and kids; board and kiosk follow.
- [ ] Board "Add strike" (asks first only when it fills the meter).
- [ ] Kiosk shows no manage controls.

Phase 5/6:
- [ ] Nav badges match Today's "Needs attention".
- [ ] Install and favicon, offline shell, kiosk wake lock, Settings -> Download backup.
- [ ] Kiosk weekly routines panel.

Tasks and Bills:
- [ ] Tasks: weekly, short-term, long-term, undo, filters, "needs both", pausing a routine.
- [ ] Bills: autopay settles; Mark pending then Confirm cleared; an edited recurring amount carries to next month;
      a skipped bill stays skipped.

## Optional next offers
- Make the kiosk adult routines tickable.
- Add a backup restore.
- Move pictures to Firebase Storage (needs Blaze) for bigger photos.

## Known gaps
- A stale-device re-generation `batch.set` could overwrite a completed or settled doc (the sync gate mitigates it).
- Removing a kid leaves their instances orphaned.
- The last-owner demotion guard is UI-only.
- Deleting a weekly task leaves past-week completions orphaned.
- Completed short-term and long-term tasks accumulate.
- Backup is export-only.
- The kid doc re-sends its pictures on every balance change (kept small by the 300 kB / 420,000-char budget).
- Old circular generator pictures remain until replaced.

## Key files
- `Household OS Specification.markdown`: full spec.
- `firestore.rules`, `rules/firestore.rules.test.ts` (46 emulator tests).
- `src/stores/`: `ledger.ts` (bust, unbust, reopenAudit, strike, payout, adjust), `chores.ts`, `household.ts`.
- `src/lib/`: `confirm.ts`, `imageUpload.ts`, `auth.ts`, `firestore.ts`, `wakeLock.ts`, `backup.ts`.
- `src/domain/`: `chores.ts`, `kids.ts`, `ledger.ts`, `image.ts`, `types.ts`.
- `src/features/kids/components/`: `KidSummaryCard.vue` (props `interactive`, `large`, `manage`), `RecentAudits.vue`.
- `src/features/household/components/`: `KidEditRow.vue`, `PictureField.vue`.
- `vite.config.ts`: casing-safe root and alias (keep), chunk groups.
- `README.md`: update it with each change.

## Environment notes (Windows, PowerShell 5.1)
- Real folder is `D:\Code\tistacherous-vue`; use it as the working directory.
- `Set-Content -Encoding UTF8` adds a BOM. For bulk replaces use `[IO.File]::WriteAllText` with
  `New-Object Text.UTF8Encoding $false`. In PowerShell, `\n` is literal inside quotes; use a backtick-n.
  Here-strings containing `'@` can break the shell tool; use the write/edit tools for files.
- Firebase CLI is installed and logged in; `.firebaserc` default is `home-d37bc`. `gcloud` is not installed.
- Deploy: `npm run build`, then `firebase deploy`. Use `--only hosting` only when the rules are unchanged.
- Rules tests need Java. A portable JRE 21 was at
  `C:\Users\jared\AppData\Local\Temp\opencode\jdk\jdk-21.0.13+9-jre\bin` (prepend to `$env:PATH`), then
  `npm run test:rules`. Delete the generated `firestore-debug.log` and `ui-debug.log` afterwards (gitignored).
- Live-app checks used headless Edge (`check.ps1`, `cdp2.mjs` in the opencode temp folder). It can't sign in.
  For component checks, create a temporary page under `tmp-imgtest\`, serve it with
  `node node_modules/vite/bin/vite.js --port 5199`, and delete it afterwards.
- Firestore collections: `households/main/{members,kids,chores,instances,ledger,bills,recurringBills,tasks,taskCompletions}`.
  `tasks` and `taskCompletions` are excluded from the wildcard rule and have their own validators.
- Design tokens are Catppuccin Mocha in `src/styles/_variables.scss` (`c()` helper, mixins `mobile`, `tablet`,
  `label`, `interactive`). Style partials are registered in `src/styles/main.scss`.
- Git: all work is uncommitted, along with many earlier uncommitted user changes (deleted `beautiful-dashboard/`,
  `babel.config.js`, etc.).
