# The Plowman House

A household app for chores, bills and adult tasks, built with Vue 3, TypeScript, Vite, Pinia and
Firebase (Auth, Firestore, Hosting). The original **Historical Weather** dashboard lives on as one
of its sections.

## Routes

| Path           | Page                                                       |
| -------------- | ---------------------------------------------------------- |
| `/`            | Today: daily briefing                                      |
| `/kids`        | Kids: board, audits, balances and payouts, ledger, chores  |
| `/bills`       | Bills: monthly tracker and recurring bills                 |
| `/tasks`       | Adult tasks: weekly routines, short-term, projects         |
| `/schedule`    | Rolling 7/14-day family schedule from Google Calendar      |
| `/benefits`    | Benefit claims, PDF receipts/EOBs, caregiver budgets       |
| `/weather`     | Historical weather (`/historical-weather` redirects here)  |
| `/settings`    | Household name, members, kids                              |
| `/kiosk`       | Wall-tablet kids board: no navigation, leave by changing the URL |

## How chores work

- Chores are definitions in `households/main/chores`: value, assigned kids, weekdays, gatekeeper flag.
- There are no Cloud Functions. The first signed-in device open each day creates that day's
  instances in `households/main/instances` with deterministic ids (`date_choreId_kidId`), copying
  the chore's title and value so later edits don't rewrite history.
- Days follow the household timezone (`households/main.timezone`, default `America/Vancouver`).
- Checking a chore credits the kid's balance (`goal.currentSaved`) immediately and appends a
  `ledger` entry. Unchecking reverses it with a second entry.
- Checked-off chores wait in the **Audits** tab (`/kids?tab=audits`). **Pass** marks one verified, with no
  money change. **Busted** takes back value x the chore's penalty multiplier (1x clawback plus the fine) and
  resets the streak. Nothing auto-verifies.
- **Strikes** are added there too. Filling the trouble meter takes the kid's penalty amount and resets the meter.
- **Payouts** are cash handed over in person; recording one takes it off the balance. **Adjust** is a signed
  correction with a required reason.
- Balances never drop below $0: a bust or strike penalty collects only what is there, and the ledger entry
  says how much was covered. Payouts can't exceed the balance.
- Audit, strike, payout and adjust actions are Firestore transactions, so two parents can't double-apply one.
  They need a connection; checking chores off still works offline.
- The ledger is append-only (enforced in `firestore.rules`), and chore instances can only move through
  pending, completed, then verified or busted. A parent can send a verified or busted chore back to
  completed (**Kids → Audits → Recently audited**, or *Undo* on a busted line of the board) to re-audit it.
- **Undo bust** gives back exactly what the bust took (stored as `bustedAmount` on the chore; older busts are
  looked up in the ledger), adds a `bust_reverted` ledger entry and returns the chore to the audit queue.
  *Reopen* on a passed chore moves no money.
- Streak is derived from the last 60 days of instances, not stored: consecutive days with every
  chore done and none busted. Days with no chores scheduled are skipped.
- **Order:** chores have a `sortOrder` (arrows in Kids → Chores) used by the manage list, the board and the
  kiosk. Kids are ordered the same way in Settings → Kids.
- **Strikes:** *Add strike* is on each board card and in Kids → Balances. The strikes needed and the
  penalty are set per kid in Settings → Kids.

## Kid pictures and goals

- **Kiosk emoji burst:** tapping a pending chore on the kiosk bursts into random emojis. Un-checking is still a tap.
- Settings → Kids also sets each kid's card background and name colour. Other text on the card switches between
  dark and light automatically for contrast, and a name colour that would be hard to read is ignored.
- Settings → Kids sets each kid's picture, savings goal name, target amount and goal picture. Pictures are
  uploaded from a file (or the camera on a phone).
- Pictures are stored as text on the kid's document, which can't pass 1 MB and holds two pictures. So a file up
  to 300 kB is saved exactly as uploaded, and a bigger one is re-saved as WebP with the longest side at most
  1600 px (no crop, transparency kept), stepping the quality down until it fits (src/lib/imageUpload.ts).
- They show as rounded squares; the shape comes from CSS, not the saved image.

## Confirmations

Destructive and money-moving actions use an in-app dialog (`src/lib/confirm.ts`, `ConfirmDialog.vue`) instead of
the browser's native `confirm()` box.

## How bills work

- A bill is one document per due date in `households/main/bills`. Recurring bills are templates in
  `households/main/recurringBills` (title, amount, due day of the month, autopay, active).
- No Cloud Functions here either: the first device open creates this month's and next month's bills
  from the templates, with deterministic ids (`YYYY-MM_planId`). A day-31 bill falls on the last day of
  a shorter month.
- Lifecycle: **unpaid**, then **Pay now** (settled) or **Mark pending** (payment in transit), then
  **Confirm cleared** (settled). **Revert** sends a pending bill back to unpaid, and **Reopen** does the
  same for a settled one. Each step is a transaction that checks the bill hasn't moved on another device.
- **Autopay** bills settle themselves once their due date arrives. Reopening one turns it into a manual
  bill, because the payment evidently didn't go through.
- The tracker shows the chosen month plus anything from earlier months that is still unpaid or pending.
  Totals follow the Autopay/Manual filter.
- Removing a generated bill skips it for that month (so it isn't generated again); a one-off bill is deleted.
- Editing a recurring bill also updates this and next month's bills, unless they have been edited by
  hand or are no longer unpaid.
- An amount of $0 means "not known yet" and shows as TBD.

## Today, badges and the kiosk

- **Today** pulls the other sections together. *Needs attention* lists, most urgent first: overdue bills,
  your late tasks, chores waiting for audit, bills due this week, your tasks due today and payments
  waiting to clear. *My tasks today* shows your open tasks that are due or late, with a Mark done button.
  *Bills due soon* shows unpaid bills that are overdue or due within 7 days, plus payments in transit.
- **Nav badges** count what is waiting on you: chores to audit (Kids), manual bills overdue or due within
  7 days (Bills) and your tasks due or late (Tasks). Autopay bills are left out because they settle
  themselves. A task with nobody assigned counts for everyone.
- The **kiosk** shows the kids board and, underneath, the adults' weekly routines for the current week
  (read-only, with late ones highlighted).

## How tasks work

- Three kinds, all in `households/main/tasks`: **weekly** routines, **short-term** one-offs with a due
  date, and **long-term** projects with an optional date and a free-text window ("Spring 2027").
- Each has a priority (P1 high, P2 med, P3 low), one or more assignees (member emails) and a "needs both"
  flag. A both-people task is assigned to everyone, so it shows under each person's filter.
- A weekly routine is never finished on the task itself. Marking it done writes one document to
  `households/main/taskCompletions`, named `{Monday}_{taskId}`, and un-marking deletes it. A new week
  (Mondays, in the household timezone) therefore starts clean, and past weeks stay as history.
- Short-term tasks and projects finish once (`isCompleted`) and move to a Completed list.
- A task is late once its day has passed and it isn't done. For a weekly routine that is its target day
  this week. Any member can mark any task done.
- Pausing a weekly routine (Edit, untick Active) hides it from the board until resumed.

Everything requires a Google sign-in. Access is decided by member documents in Firestore
(`households/main/members/{lowercase email}`), enforced by `firestore.rules`.

## Install, offline and backup

- The app is installable (manifest and icons in `public/`). `public/sw.js` caches the app shell and its
  built files so it opens offline; data comes from Firestore's own offline cache. The service worker only
  registers in production builds and ignores everything cross-origin and `/__/` (sign-in).
- The icon is `public/icon.svg`. The PNGs and `favicon.ico` are renders of it (maskable and Apple icons
  are full-bleed on the base colour).
- The kiosk asks the browser to keep the screen on and asks again whenever the tab returns to the
  foreground. Browsers that don't support the Wake Lock API just dim as normal.
- **Settings → Backup** downloads every collection plus the household document as one JSON file.
  There is no restore button; the file is for safekeeping and manual recovery.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm test               # unit tests for the pure logic
npm run test:rules     # security rules against the Firestore emulator
```

`test:rules` needs Java 21+ on your PATH (the emulator is a Java program; it downloads itself on the
first run). It covers sign-in and membership checks, the owner-only areas, the append-only ledger, the
chore audit flow and the bill and task validators.

## Deploy

```bash
npm run build
firebase deploy                  # hosting + firestore rules
firebase deploy --only firestore # rules only
```

## First-time Firestore setup

1. Create a Firestore database (Standard edition, Native mode).
2. Add `households/main` with a `name` field.
3. Add `households/main/members/<your lowercase email>` with `role: "owner"` and `displayName`.
4. Deploy the rules. More members can then be added from Settings.

## Project layout

```
src/
  App.vue                  Auth gate and layout switch (app shell vs kiosk)
  app/                     Brand, nav definition, layouts, shared shell components
  domain/                  Types and pure, unit-tested business logic
  lib/                     Firebase, auth, Firestore paths, error helpers
  stores/                  Pinia stores (realtime Firestore listeners)
  router/                  Route table and the kiosk guard
  views/                   Top-level pages
  features/
    kids/                  Kid cards, audits, ledger
    bills/                 Bill tracker and recurring bills
    tasks/                 Adult task board
    household/             Settings panels
    weather/               Historical weather dashboard (styles scoped under .weather)
  styles/                  Shared Catppuccin Mocha design system
public/                    Icons, web manifest and service worker
rules/                     Security rules tests (emulator)
firestore.rules            Security rules (members only)
```

Weather data comes from [Open-Meteo](https://open-meteo.com/): ERA5 archive history and
model forecasts.
