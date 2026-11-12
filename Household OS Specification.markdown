# Household OS: Technical Specification & UI Architecture

This document compiles the complete feature set, ASCII layouts, state machines, business logic, and TypeScript interfaces brainstormed for the Household Operational System. It is formatted for direct ingestion by coding agents and build harnesses.

---

## 1. System Overview & Architecture

### 1.1 Purpose
A dual-purpose household management portal tailored for shared wall-mounted touchscreen displays (e.g., tablet kiosks) and authenticated parent admin panels.

### 1.2 Access Tiers
1. **Public / Kiosk Mode (`/dashboard`):**
   - No login required.
   - High-contrast, touch-friendly UI for children and rapid adult reference.
   - Features: Kids' Chores, Goals, Trouble Meters, Screen Time Gate status, Adult Weekly Chores.
2. **Admin Console (`/admin`):**
   - Protected by role-based authentication (PIN, password, or biometric).
   - Features: Chore creation & scheduling, Parent Audits ("Busted" clawbacks), Ledger payouts, Bill Tracker, Adult Project management.

---

## 2. Module 1: Kids Chores, Goals & Discipline System

### 2.1 Wireframe: Kids Dashboard View
```text
+-------------------------------------------------------------------------------+
|  HOUSEHOLD DASHBOARD  >  CHORES & GOALS                     Wednesday, Nov 11 |
+-------------------------------------------------------------------------------+
|                                                                               |
|  [ KID A ]                                 [ KID B ]                          |
|  Today:   $1.00 / $4.50                    Today:   $2.75 / $4.25             |
|  Streak:  5 Days 🔥                        Streak:  0 Days ❄️ (Busted Today)   |
|                                                                               |
|  TROUBLE METER:                            TROUBLE METER:                     |
|  [ ⚠️ ⚠️ ⚠️ ⚪ ⚪ ] (3/5 Strikes)           [ ⚠️ ⚠️ ⚠️ ⚠️ ⚠️ ] (5/5 FULL - PENALTY!)|
|  Rule: 5 strikes = -$10 from Goal          Rule: 5 strikes = -$10 from Goal   |
|                                            (Deducted: -$10.00 from LEGO Set)  |
|                                                                               |
|  SAVINGS GOAL: Mountain Bike Helmet        SAVINGS GOAL: LEGO Star Wars Set   |
|  Current: $42.50 / $60.00 Target           Current: $35.00 / $80.00 Target    |
|  [==========--------] 70%  [ 🖼️ IMG ]      [====--------------] 43% [ 🖼️ IMG ]|
|  ($17.50 to go!)                           ($45.00 to go!)                    |
|                                                                               |
|  +-------------------------------------+   +--------------------------------+ |
|  | SCREEN TIME: 🟢 UNLOCKED            |   | SCREEN TIME: 🔴 LOCKED (1 Left)| |
|  | Cutoff: 7:30 PM                     |   | Finish: 20m Reading to unlock  | |
|  +-------------------------------------+   +--------------------------------+ |
|                                                                               |
|  TODAY'S CHORES:                           TODAY'S CHORES:                    |
|  +-------------------------------------+   +--------------------------------+ |
|  | [X] Make Bed                 $0.50  |   | [X] Make Bed             $0.50 | |
|  | [X] Pack Backpack (M-F)      $0.50  |   | [X] Pack Backpack (M-F)  $0.50 | |
|  | [ ] Feed Pets                $1.00  |   | [X] Pack Swim Bag (M/W/F)$0.75 | |
|  | [ ] 20m Reading              $1.00  |   | [ ] 20m Reading          $1.00 | |
|  | [ ] Tidy Bedroom             $1.50  |   |                                | |
|  |                                     |   | [ ⚠️ BUSTED: Dishwasher -$3.00]| |
|  +-------------------------------------+   +--------------------------------+ |
|  Ledger Balance: $42.50                    Ledger Balance: $35.00             |
+-------------------------------------------------------------------------------+
```

### 2.2 Wireframe: Admin Audit & Ledger View
```text
+-------------------------------------------------------------------------------+
|  ADMIN CONSOLE  |  [ Audits (2) ]  [ Ledger ]  [ Manage Chores ]   (Logged: Jared) |
+-------------------------------------------------------------------------------+
|                                                                               |
|  RECENT CHECKOFFS PENDING AUDIT                                               |
|  TIMESTAMP   KID    CHORE                 VALUE   ACTION                      |
|  ---------------------------------------------------------------------------  |
|  12:45 PM    Kid A  Clean Bedroom         $1.50   [ PASS ✓ ]  [ BUSTED! ⚠️ ]  |
|  11:10 AM    Kid B  Empty Dishwasher      $1.50   [ PASS ✓ ]  [ BUSTED! ⚠️ ]  |
|  08:15 AM    Kid A  Make Bed              $0.50   [ PASS ✓ ]  [ BUSTED! ⚠️ ]  |
|                                                                               |
+-------------------------------------------------------------------------------+
|  KID ACCOUNT BALANCES & PAYOUTS                                               |
|  KID        SAVINGS GOAL BAL    PENDING AUDIT    STREAK    ACTIONS            |
|  ---------------------------------------------------------------------------  |
|  Kid A      $42.50 / $60.00     $3.50            5 Days    [ ADD STRIKE ] [PAY]|
|  Kid B      $35.00 / $80.00     $2.00            0 Days    [ ADD STRIKE ] [PAY]|
+-------------------------------------------------------------------------------+
```

### 2.3 Business Logic & Rules
1. **Chore Value Accumulation:**
   - Checking a chore adds value to `todayEarnings` and flags completion as `pending_audit`.
2. **The "Busted" Clawback Formula:**
   - Net deduction: $\text{Deduction} = \text{Chore Value} \times \text{penaltyMultiplier}$ (default multiplier is 2, representing 1x clawback + 1x penalty).
   - Resets streak counter to 0 days.
   - Places a `[ ⚠️ BUSTED ]` tag on the kid's daily view.
3. **Screen Time Gatekeeper Rule:**
   - Any chore flagged with `isGatekeeper: true` must be in state `completed` or `verified`.
   - Screen time indicator evaluates:
     $$\text{Screen Status} = \begin{cases} \text{UNLOCKED (Green)}, & \text{if all gatekeepers complete} \\ \text{LOCKED (Red)}, & \text{otherwise} \end{cases}$$
4. **Trouble Meter Penalty:**
   - When `currentStrikes >= maxStrikes`, automatically deduct `strikePenaltyAmount` directly from the active goal balance, create an audit ledger entry, and reset `currentStrikes` to 0.
5. **Goal Progress Bar:**
   - Percentage: $\min(100, (\text{currentSaved} / \text{targetAmount}) \times 100)\%$.
   - The visual bar renders across the container leading directly to an image preview.

---

## 3. Module 2: Household Bills & Expenses

### 3.1 Wireframe: Bill Tracker View
```text
+-------------------------------------------------------------------------------+
|  HOUSEHOLD DASHBOARD  >  BILLS & EXPENSES                  November 2026      |
+-------------------------------------------------------------------------------+
|  TOTAL DUE: $1,420.00  |  PAID: $775.00  |  PENDING: $165.00  |  DUE: $480.00 |
+-------------------------------------------------------------------------------+
|                                                                               |
|  ACTION REQUIRED / DUE SOON                                                   |
|  +-------------------+----------+---------+----------+----------------------+ |
|  | BILL / SERVICE    | DUE DATE | AMOUNT  | AUTOPAY? | ACTIONS              | |
|  +-------------------+----------+---------+----------+----------------------+ |
|  | FortisBC / Gas    | Nov 22   | $120.00 | No       | [PAY NOW] [MARK PEND]| |
|  | Internet          | Nov 24   | $ 95.00 | Scheduled| [MARK PENDING]       | |
|  | City Utilities    | Nov 30   | $100.00 | No       | [PAY NOW] [MARK PEND]| |
|  +-------------------+----------+---------+----------+----------------------+ |
|                                                                               |
|  IN TRANSIT / PENDING CLEARANCE (1)                                          |
|  +-------------------+----------+---------+----------+----------------------+ |
|  | BC Hydro          | Nov 18   | $165.00 | EFT Sent | [ CONFIRM CLEARED ]  | |
|  |                   |          |         | (Nov 10) | [ Cancel / Revert ]  | |
|  +-------------------+----------+---------+----------+----------------------+ |
|                                                                               |
|  SETTLED THIS MONTH (3) [ Collapse ]                                          |
|  +-------------------+----------+---------+----------+----------------------+ |
|  | Mortgage          | Nov 01   | $----.--| Auto     | Cleared Nov 01 ✓     | |
|  | Telus Cell Phones | Nov 05   | $140.00 | Credit   | Cleared Nov 05 ✓     | |
|  +-------------------+----------+---------+----------+----------------------+ |
|                                                                               |
|  [ + New Bill / Recurring ]                   [ Filter: All / Autopay / Manual]|
+-------------------------------------------------------------------------------+
```

### 3.2 Bill Lifecycle State Machine
```text
               +---------------------------+
               |        UNPAID / DUE       |
               +---------------------------+
                 |                       |
       [ Mark Pending ]            [ Mark Paid ]
                 |                       |
                 v                       |
   +---------------------------+         |
   |     PENDING CLEARANCE     |         |
   | (e-Transfer / In-Transit) |         |
   +---------------------------+         |
         |               |               |
     [ Revert ]  [ Confirm Cleared ]     |
         |               |               |
         v               v               v
   [ UNPAID / DUE ]    +-------------------+
                       |   SETTLED / PAID  |
                       +-------------------+
```

---

## 4. Module 3: Adult Tasks & Projects (3-Tier Model)

### 4.1 Wireframe: Adult Tasks Board
```text
+-------------------------------------------------------------------------------+
|  HOUSEHOLD DASHBOARD  >  ADULT TASKS & PROJECTS             Wednesday, Nov 11 |
+-------------------------------------------------------------------------------+
|  View: [*] All Tasks    [ ] Jared's    [ ] Partner's    [ ] 👥 2-Person Only   |
|  Actions: [ + Add Task / Project ]                      [ Manage Routines ]   |
+-------------------------------------------------------------------------------+
|                                                                               |
|  1. WEEKLY RECURRING (Routine Maintenance & Reset)                            |
|  PRIORITY  CHORE                  ASSIGNEE     TARGET DAY    TEAM    STATUS   |
|  ---------------------------------------------------------------------------  |
|  [P1-HIGH] Wheel bins to curb     [ Jared    ] [ Thu Night ] [  Solo ] [✓ Done] |
|  [P2-MED]  Costco / Grocery run   [ Partner  ] [ Fri Morning][👥 BOTH] [✓ Done] |
|  [P2-MED]  Strip & wash bedding   [ Partner  ] [ Sat Morning][  Solo ] [✓ Done] |
|  [P3-LOW]  Mow / Edge lawn        [ Jared    ] [ Sunday    ] [  Solo ] [✓ Done] |
|                                                                               |
+-------------------------------------------------------------------------------+
|                                                                               |
|  2. SHORT-TERM TASKS (Next 1–3 Weeks / One-Off To-Dos)                        |
|  PRIORITY  TASK                   ASSIGNEE     TARGET DATE   TEAM    STATUS   |
|  ---------------------------------------------------------------------------  |
|  [P1-HIGH] Deep clean heat pumps  [ Jared    ] [ Sat, Nov 14 ] [👥 BOTH] [✓ Done] |
|  [P2-MED]  Winter tire swap       [ Jared    ] [ Sun, Nov 15 ] [  Solo ] [✓ Done] |
|  [P3-LOW]  Declutter coat closet  [ Partner  ] [ Sun, Nov 22 ] [  Solo ] [✓ Done] |
|                                                                               |
+-------------------------------------------------------------------------------+
|                                                                               |
|  3. LONG-TERM PROJECTS (Seasonal, Multi-Stage & Big Impact)                   |
|  PRIORITY  PROJECT / MILESTONE    ASSIGNEE     TARGET WINDOW TEAM    STATUS   |
|  ---------------------------------------------------------------------------  |
|  [P1-HIGH] Paint living room trim [ Jared    ] [ Nov 28-29   ] [👥 BOTH] [✓ Done] |
|  [P2-MED]  Service snowblower     [ Jared    ] [ By Dec 01   ] [  Solo ] [✓ Done] |
|  [P2-MED]  Organize crawlspace    [ Both     ] [ Dec 2026    ] [👥 BOTH] [✓ Done] |
|  [P3-LOW]  Reseal deck boards     [ Jared    ] [ Spring 2027 ] [  Solo ] [✓ Done] |
|                                                                               |
+-------------------------------------------------------------------------------+
|  Active Summary: 4 Weekly | 3 Short-Term | 4 Long-Term (3 Require 👥 Both)     |
+-------------------------------------------------------------------------------+
```

---

## 5. Unified TypeScript Data Schemas

```typescript
// ==========================================
// 1. KIDS, CHORES & DISCIPLINE SCHEMAS
// ==========================================

export interface KidProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  streakDays: number;
  troubleMeter: {
    currentStrikes: number;
    maxStrikes: number; // e.g., 3 or 5
    penaltyAmount: number; // e.g., 10.00
  };
  goal: {
    title: string;
    targetAmount: number;
    currentSaved: number;
    imageUrl: string;
  };
}

export interface ChoreDefinition {
  id: string;
  title: string;
  description?: string;
  value: number; // Monetary credit, e.g., 0.50
  assignedKidIds: string[]; // ['kid_a', 'kid_b']
  scheduleDays: number[]; // 0 = Sun, 1 = Mon ... 6 = Sat
  isGatekeeper: boolean; // Must be done to unlock Screen Time
  penaltyMultiplier: number; // Default 2.0 (1x clawback + 1x fine)
  active: boolean;
}

export interface DailyChoreInstance {
  id: string;
  choreDefinitionId: string;
  kidId: string;
  date: string; // ISO 'YYYY-MM-DD'
  status: 'pending' | 'completed' | 'verified' | 'busted';
  completedAt?: string;
  auditedAt?: string;
  auditNotes?: string;
}

// ==========================================
// 2. BILL TRACKING SCHEMAS
// ==========================================

export type BillStatus = 'unpaid' | 'pending' | 'settled';

export interface BillItem {
  id: string;
  title: string;
  amount: number;
  dueDate: string; // ISO 'YYYY-MM-DD'
  isAutopay: boolean;
  status: BillStatus;
  paymentDetails?: {
    initiatedDate?: string;
    clearedDate?: string;
    method?: 'eft' | 'etransfer' | 'credit' | 'autopay';
    confirmationRef?: string;
  };
  category?: 'utility' | 'housing' | 'subscription' | 'telecom';
}

// ==========================================
// 3. ADULT TASKS & PROJECTS SCHEMAS
// ==========================================

export type Priority = 'P1' | 'P2' | 'P3';
export type AdultTaskTier = 'weekly' | 'short_term' | 'long_term';

export interface AdultTask {
  id: string;
  title: string;
  notes?: string;
  tier: AdultTaskTier;
  priority: Priority;
  assignedTo: string[]; // ['jared'], ['partner'], or ['jared', 'partner']
  requiresBoth: boolean; // Flagged true if both parents needed
  targetDisplay: string; // e.g. "Thu Night", "Sat, Nov 14", or "Spring 2027"
  targetDate?: string; // Optional strict ISO date for calendar sorting
  isCompleted: boolean;
  completedAt?: string;
}

// ==========================================
// 4. FINANCIAL LEDGER AUDIT TRAIL
// ==========================================

export interface LedgerTransaction {
  id: string;
  kidId: string;
  timestamp: string;
  amount: number; // Positive (credit) or negative (deduction/busted/payout)
  reason: 'chore_completed' | 'busted_penalty' | 'strike_penalty' | 'payout' | 'manual_adjustment';
  referenceId?: string; // Links to choreId or audit log
  notes?: string;
}
```