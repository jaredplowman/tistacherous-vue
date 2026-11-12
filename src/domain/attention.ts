export type AttentionTone = 'bad' | 'warn' | 'info'

export interface AttentionItem {
  key: string
  text: string
  to: string
  tone: AttentionTone
}

export interface AttentionInput {
  audits: number // chores waiting for a parent to review
  billsOverdue: number
  billsSoon: number // due within the week, not yet overdue
  billsInTransit: number
  tasksLate: number
  tasksToday: number // due today, not yet late
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// Everything that wants a person's attention, most urgent first.
export function attentionItems(input: AttentionInput): AttentionItem[] {
  const { audits, billsOverdue, billsSoon, billsInTransit, tasksLate, tasksToday } = input
  const items: (AttentionItem & { show: boolean })[] = [
    {
      key: 'bills-overdue',
      show: billsOverdue > 0,
      tone: 'bad',
      to: '/bills',
      text: `${plural(billsOverdue, 'bill is', 'bills are')} overdue`,
    },
    {
      key: 'tasks-late',
      show: tasksLate > 0,
      tone: 'bad',
      to: '/tasks',
      text: `${plural(tasksLate, 'task of yours is', 'tasks of yours are')} late`,
    },
    {
      key: 'audits',
      show: audits > 0,
      tone: 'warn',
      to: '/kids?tab=audits',
      text: `${plural(audits, 'chore', 'chores')} waiting for audit`,
    },
    {
      key: 'bills-soon',
      show: billsSoon > 0,
      tone: 'warn',
      to: '/bills',
      text: `${plural(billsSoon, 'bill', 'bills')} due this week`,
    },
    {
      key: 'tasks-today',
      show: tasksToday > 0,
      tone: 'warn',
      to: '/tasks',
      text: `${plural(tasksToday, 'task', 'tasks')} due today`,
    },
    {
      key: 'bills-transit',
      show: billsInTransit > 0,
      tone: 'info',
      to: '/bills',
      text: `${plural(billsInTransit, 'payment', 'payments')} waiting to clear`,
    },
  ]
  return items.filter((i) => i.show).map(({ show, ...item }) => item)
}
