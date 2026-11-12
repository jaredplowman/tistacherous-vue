// ==========================================
// 0. HOUSEHOLD & MEMBERS
// ==========================================

export type MemberRole = 'owner' | 'parent'

export interface Member {
  email: string // lowercase; also the Firestore document id
  displayName: string
  role: MemberRole
}

export interface Household {
  name: string
  timezone: string // IANA zone, e.g. 'America/Vancouver'
}

// ==========================================
// 1. KIDS, CHORES & DISCIPLINE
// ==========================================

export interface KidProfile {
  id: string
  name: string
  avatarUrl?: string
  sortOrder: number
  screenTimeCutoff: string // 'HH:mm', 24h
  troubleMeter: {
    currentStrikes: number
    maxStrikes: number
    penaltyAmount: number
  }
  goal: {
    title: string
    targetAmount: number
    currentSaved: number // doubles as the kid's ledger balance
    imageUrl: string
  }
}

export interface ChoreDefinition {
  id: string
  title: string
  description: string
  value: number
  assignedKidIds: string[]
  scheduleDays: number[] // 0 = Sun ... 6 = Sat
  isGatekeeper: boolean
  penaltyMultiplier: number // default 2 (1x clawback + 1x fine)
  active: boolean
  sortOrder?: number // position in the lists; chores without one go last
}

export type ChoreStatus = 'pending' | 'completed' | 'verified' | 'busted'

export interface DailyChoreInstance {
  id: string
  choreDefinitionId: string
  kidId: string
  date: string // 'YYYY-MM-DD'
  // Copied from the definition when the day's instance is generated, so later edits
  // or deletes of the chore never change what was earned or owed for that day.
  title: string
  value: number
  isGatekeeper: boolean
  penaltyMultiplier: number
  status: ChoreStatus
  completedAt?: string
  auditedAt?: string
  auditNotes?: string
  // What the bust actually took, which is less than value x multiplier when the balance ran short.
  bustedAmount?: number
}

// ==========================================
// 2. BILLS
// ==========================================

export type BillStatus = 'unpaid' | 'pending' | 'settled'
export type PaymentMethod = 'eft' | 'etransfer' | 'credit' | 'autopay' | 'other'
export type BillCategory = 'utility' | 'housing' | 'subscription' | 'telecom' | 'other'

export interface PaymentDetails {
  initiatedDate?: string
  clearedDate?: string
  method?: PaymentMethod
  confirmationRef?: string
}

// One bill for one due date. Recurring bills get a new one each month.
export interface BillItem {
  id: string
  title: string
  amount: number // 0 means "not known yet"
  dueDate: string // 'YYYY-MM-DD'
  isAutopay: boolean
  status: BillStatus
  paymentDetails?: PaymentDetails
  category?: BillCategory
  recurringId?: string // the RecurringBill this was generated from
  skipped?: boolean // a generated bill the household chose to skip this month
  variableAmount?: boolean // the amount changes every month and has to be entered each time
}

// The template a monthly bill is generated from.
export interface RecurringBill {
  id: string
  title: string
  amount: number
  dueDay: number // day of the month, 1-31 (short months use their last day)
  isAutopay: boolean
  category: BillCategory
  active: boolean
  variableAmount?: boolean // e.g. a credit card: due every month, amount unknown until the statement
}

// ==========================================
// 3. ADULT TASKS & PROJECTS
// ==========================================

export type Priority = 'P1' | 'P2' | 'P3'
export type AdultTaskTier = 'weekly' | 'short_term' | 'long_term'

export interface AdultTask {
  id: string
  title: string
  notes?: string
  tier: AdultTaskTier
  priority: Priority
  assignedTo: string[] // member emails; everyone when requiresBoth
  requiresBoth: boolean
  // weekly: the weekday it falls on (0 = Sun ... 6 = Sat) and an optional time of day ("Night")
  targetDay?: number
  targetTime?: string
  // short-term: the due date. long-term: an optional date used for sorting and overdue.
  targetDate?: string
  // long-term: the window as written, e.g. "Spring 2027"
  targetDisplay?: string
  active: boolean // a paused weekly routine stops showing up
  // One-off tasks finish once. Weekly routines never set this; see TaskCompletion.
  isCompleted: boolean
  completedAt?: string
  completedBy?: string
}

// One weekly routine done in one week. Its absence means "not done yet this week", so a new
// week starts clean while the old weeks stay as history.
export interface TaskCompletion {
  id: string // `${weekStart}_${taskId}`
  taskId: string
  weekStart: string // the Monday, 'YYYY-MM-DD'
  completedAt: string
  completedBy: string
}

// ==========================================
// 4. LEDGER
// ==========================================

export interface LedgerTransaction {
  id: string
  kidId: string
  timestamp: string
  amount: number // positive credit, negative deduction/payout
  reason:
    | 'chore_completed'
    | 'chore_undone'
    | 'busted_penalty'
    | 'bust_reverted'
    | 'strike_penalty'
    | 'payout'
    | 'manual_adjustment'
  referenceId?: string
  notes?: string
  by?: string // display name of the parent who made the entry, when a person did
}
