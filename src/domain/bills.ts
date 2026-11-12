import { addDays, daysBetween } from './dates'
import { roundMoney } from './chores'
import { formatMoney } from './kids'
import type {
  BillCategory,
  BillItem,
  BillStatus,
  PaymentDetails,
  PaymentMethod,
  RecurringBill,
} from './types'

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  eft: 'EFT',
  etransfer: 'e-Transfer',
  credit: 'Credit card',
  autopay: 'Autopay',
  other: 'Other',
}

// Autopay isn't offered for a manual payment; it is recorded by the app when an autopay bill comes due.
export const MANUAL_METHODS: PaymentMethod[] = ['eft', 'etransfer', 'credit', 'other']

export const CATEGORY_LABELS: Record<BillCategory, string> = {
  utility: 'Utility',
  housing: 'Housing',
  subscription: 'Subscription',
  telecom: 'Phone & internet',
  other: 'Other',
}

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as BillCategory[]

// What the bill form edits, and what it hands back when saved.
export type BillFields = Pick<BillItem, 'title' | 'amount' | 'dueDate' | 'isAutopay' | 'category'>
export type BillSave = { repeat: false; data: BillFields } | { repeat: true; data: Omit<RecurringBill, 'id'> }

// How many months ahead of the current one get generated, so upcoming bills are visible.
export const MONTHS_AHEAD = 1

// ---- months ('YYYY-MM') and due dates ('YYYY-MM-DD') ----

const pad = (n: number) => String(n).padStart(2, '0')

export const monthOf = (date: string) => date.slice(0, 7)

export function addMonths(month: string, count: number): string {
  const [y, m] = month.split('-').map(Number)
  const index = y * 12 + (m - 1) + count
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export const monthStart = (month: string) => `${month}-01`
export const monthEnd = (month: string) => `${month}-${pad(daysInMonth(month))}`

// A bill due on the 31st falls on the last day of a shorter month.
export const dueDateFor = (month: string, day: number) => `${month}-${pad(Math.min(Math.max(1, day), daysInMonth(month)))}`

// 1 -> '1st', 22 -> '22nd', 13 -> '13th'
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${suffix}`
}

export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)))
}

// 'Nov 22'
export function formatDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}

// ---- generating monthly bills ----

export const billId = (month: string, recurringId: string) => `${month}_${recurringId}`

export function newRecurring(): Omit<RecurringBill, 'id'> {
  return { title: '', amount: 0, dueDay: 1, isAutopay: false, category: 'utility', active: true }
}

export function newBill(dueDate: string): Omit<BillItem, 'id'> {
  return { title: '', amount: 0, dueDate, isAutopay: false, status: 'unpaid', category: 'utility' }
}

// A bill whose amount changes every month starts at $0 and is waiting for someone to enter the real figure.
export const needsAmount = (bill: BillItem) => !!bill.variableAmount && bill.amount === 0 && bill.status === 'unpaid'

function fromPlan(plan: RecurringBill, month: string): BillItem {
  return {
    id: billId(month, plan.id),
    title: plan.title,
    amount: plan.variableAmount ? 0 : plan.amount,
    dueDate: dueDateFor(month, plan.dueDay),
    isAutopay: plan.isAutopay,
    status: 'unpaid',
    category: plan.category,
    recurringId: plan.id,
    ...(plan.variableAmount && { variableAmount: true }),
  }
}

// Bills for `months` that don't exist yet. Ids are deterministic, so two devices generating at
// once write the same documents rather than duplicates.
export function missingBills(plans: RecurringBill[], existingIds: Set<string>, months: string[]): BillItem[] {
  const result: BillItem[] = []
  for (const month of months) {
    for (const plan of plans) {
      if (plan.active && !existingIds.has(billId(month, plan.id))) result.push(fromPlan(plan, month))
    }
  }
  return result
}

const FROM_PLAN_FIELDS = ['title', 'amount', 'dueDate', 'isAutopay', 'category', 'variableAmount'] as const

// A missing flag and false mean the same thing.
const planValue = (bill: BillItem, field: (typeof FROM_PLAN_FIELDS)[number]) => bill[field] ?? false

// When a recurring bill is edited, bills already generated from it follow along, unless someone has
// changed them by hand (a real amount, a moved date) or they are no longer unpaid.
export function planUpdates(before: RecurringBill, after: RecurringBill, bills: BillItem[]) {
  const updates: { id: string; patch: Required<Pick<BillItem, (typeof FROM_PLAN_FIELDS)[number]>> }[] = []
  for (const bill of bills) {
    if (bill.recurringId !== before.id || bill.status !== 'unpaid' || bill.skipped) continue
    const month = monthOf(bill.dueDate)
    const original = fromPlan(before, month)
    if (!FROM_PLAN_FIELDS.every((field) => planValue(bill, field) === planValue(original, field))) continue
    const next = fromPlan(after, month)
    updates.push({
      id: bill.id,
      patch: {
        title: next.title,
        amount: next.amount,
        dueDate: next.dueDate,
        isAutopay: next.isAutopay,
        category: next.category ?? after.category,
        variableAmount: !!next.variableAmount,
      },
    })
  }
  return updates
}
export const settlementForAutopay = (bill: BillItem): PaymentDetails => ({
  method: 'autopay',
  initiatedDate: bill.dueDate,
  clearedDate: bill.dueDate,
})

// Autopay bills settle themselves once their due date arrives; a person can reopen one if the payment failed.
// One still waiting for its amount isn't settled, since there is nothing real to record yet.
export const autopayDue = (bills: BillItem[], today: string) =>
  bills.filter((b) => !b.skipped && b.isAutopay && b.status === 'unpaid' && !needsAmount(b) && b.dueDate <= today)

// ---- the lifecycle: unpaid -> pending -> settled, or unpaid -> settled ----

export interface BillChange {
  status: BillStatus
  paymentDetails?: PaymentDetails // left out when the details should be cleared
  isAutopay?: boolean // only set when the change should alter it
}

export interface PaymentInput {
  method: PaymentMethod
  date: string
  confirmationRef?: string
}

const clean = (details: PaymentDetails): PaymentDetails =>
  Object.fromEntries(Object.entries(details).filter(([, v]) => v !== undefined && v !== '')) as PaymentDetails

export const markPaid = ({ method, date, confirmationRef }: PaymentInput): BillChange => ({
  status: 'settled',
  paymentDetails: clean({ method, initiatedDate: date, clearedDate: date, confirmationRef: confirmationRef?.trim() }),
})

export const markPending = ({ method, date, confirmationRef }: PaymentInput): BillChange => ({
  status: 'pending',
  paymentDetails: clean({ method, initiatedDate: date, confirmationRef: confirmationRef?.trim() }),
})

export const confirmCleared = (bill: BillItem, date: string): BillChange => ({
  status: 'settled',
  paymentDetails: clean({ ...bill.paymentDetails, clearedDate: date }),
})

// Reverting a pending payment and reopening a settled one both go back to unpaid with a clean slate.
// An autopay bill that is reopened didn't actually go through, so it becomes a manual bill;
// otherwise it would just settle itself again.
export const reopen = (bill: BillItem): BillChange => ({
  status: 'unpaid',
  ...(bill.paymentDetails?.method === 'autopay' && { isAutopay: false }),
})

// ---- what the page shows ----

export type BillFilter = 'all' | 'autopay' | 'manual'

export const filterBills = (bills: BillItem[], filter: BillFilter) =>
  filter === 'all' ? bills : bills.filter((b) => (filter === 'autopay') === b.isAutopay)

// A month shows its own bills, plus anything from earlier months that still hasn't been settled.
export const billsForMonth = (bills: BillItem[], month: string) =>
  bills.filter((b) => !b.skipped && (monthOf(b.dueDate) === month || (b.status !== 'settled' && b.dueDate < monthStart(month))))

const byDue = (a: BillItem, b: BillItem) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title)

export function groupBills(bills: BillItem[]) {
  const pick = (status: BillStatus) => bills.filter((b) => b.status === status).sort(byDue)
  return { due: pick('unpaid'), pending: pick('pending'), settled: pick('settled') }
}

export function billTotals(bills: BillItem[]) {
  const sum = (status?: BillStatus) =>
    roundMoney(bills.filter((b) => !status || b.status === status).reduce((total, b) => total + b.amount, 0))
  return {
    total: sum(),
    paid: sum('settled'),
    pending: sum('pending'),
    due: sum('unpaid'),
    awaitingAmount: bills.filter((b) => !b.skipped && needsAmount(b)).length,
  }
}

// A bill with no amount yet reads "TBD", or "Needed" when it is a monthly figure still to be entered.
export const amountLabel = (bill: BillItem) =>
  bill.amount > 0 ? formatMoney(bill.amount) : needsAmount(bill) ? 'Needed' : 'TBD'

// How far ahead "due soon" looks.
export const SOON_DAYS = 7

// Unpaid bills that are overdue or fall due within the next week, soonest first.
export const billsSoon = (bills: BillItem[], today: string, days = SOON_DAYS) =>
  bills.filter((b) => !b.skipped && b.status === 'unpaid' && b.dueDate <= addDays(today, days)).sort(byDue)

// Payments that have been sent but haven't cleared yet.
export const billsInTransit = (bills: BillItem[]) =>
  bills.filter((b) => !b.skipped && b.status === 'pending').sort(byDue)

export const isOverdue = (bill: BillItem, today: string) => bill.status === 'unpaid' && bill.dueDate < today

export function dueLabel(bill: BillItem, today: string): string {
  const days = daysBetween(today, bill.dueDate)
  if (days < 0) return `${-days} ${days === -1 ? 'day' : 'days'} overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `In ${days} days`
}

// The "Autopay?" column of the tracker.
export function paymentLabel(bill: BillItem): string {
  const details = bill.paymentDetails
  const method = details?.method ? METHOD_LABELS[details.method] : ''
  if (needsAmount(bill)) return bill.isAutopay ? 'Autopay · needs amount' : 'Needs amount'
  if (bill.status === 'unpaid') return bill.isAutopay ? 'Scheduled' : 'No'
  if (bill.status === 'pending') {
    const sent = details?.initiatedDate ? ` (${formatDay(details.initiatedDate)})` : ''
    return `${method || 'Payment'} sent${sent}`
  }
  const cleared = details?.clearedDate ? `Cleared ${formatDay(details.clearedDate)}` : 'Cleared'
  return method ? `${method} · ${cleared}` : cleared
}
