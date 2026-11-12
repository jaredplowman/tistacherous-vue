import { describe, expect, it } from 'vitest'
import {
  addMonths,
  autopayDue,
  billTotals,
  billsInTransit,
  billsSoon,
  billsForMonth,
  confirmCleared,
  dueDateFor,
  dueLabel,
  filterBills,
  formatMonth,
  groupBills,
  markPaid,
  markPending,
  missingBills,
  monthEnd,
  needsAmount,
  ordinal,
  paymentLabel,
  planUpdates,
  reopen,
} from './bills'
import type { BillItem, RecurringBill } from './types'

const bill = (patch: Partial<BillItem> = {}): BillItem => ({
  id: 'b',
  title: 'Internet',
  amount: 100,
  dueDate: '2026-11-24',
  isAutopay: false,
  status: 'unpaid',
  ...patch,
})

const plan = (patch: Partial<RecurringBill> = {}): RecurringBill => ({
  id: 'p1',
  title: 'Mortgage',
  amount: 2000,
  dueDay: 1,
  isAutopay: true,
  category: 'housing',
  active: true,
  ...patch,
})

describe('months', () => {
  it('moves across year boundaries', () => {
    expect(addMonths('2026-11', 1)).toBe('2026-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })

  it('knows the last day of a month, including leap years', () => {
    expect(monthEnd('2026-11')).toBe('2026-11-30')
    expect(monthEnd('2026-02')).toBe('2026-02-28')
    expect(monthEnd('2028-02')).toBe('2028-02-29')
  })

  it('moves a day-31 bill to the end of a short month', () => {
    expect(dueDateFor('2026-11', 31)).toBe('2026-11-30')
    expect(dueDateFor('2026-12', 31)).toBe('2026-12-31')
    expect(dueDateFor('2026-11', 5)).toBe('2026-11-05')
  })

  it('formats a month name', () => {
    expect(formatMonth('2026-11')).toBe('November 2026')
  })

  it('writes ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '31st',
    ])
  })
})

describe('missingBills', () => {
  it('creates one bill per active plan per month with a stable id', () => {
    const result = missingBills([plan(), plan({ id: 'p2', active: false })], new Set(), ['2026-11', '2026-12'])
    expect(result.map((b) => [b.id, b.dueDate])).toEqual([
      ['2026-11_p1', '2026-11-01'],
      ['2026-12_p1', '2026-12-01'],
    ])
    expect(result[0]).toMatchObject({ title: 'Mortgage', amount: 2000, status: 'unpaid', recurringId: 'p1' })
  })

  it('leaves existing bills alone', () => {
    expect(missingBills([plan()], new Set(['2026-11_p1']), ['2026-11'])).toEqual([])
  })
})

describe('autopayDue', () => {
  it('picks unpaid autopay bills whose date has arrived', () => {
    const bills = [
      bill({ id: 'a', isAutopay: true, dueDate: '2026-11-10' }),
      bill({ id: 'b', isAutopay: true, dueDate: '2026-11-11' }),
      bill({ id: 'c', isAutopay: true, dueDate: '2026-11-12' }),
      bill({ id: 'd', isAutopay: false, dueDate: '2026-11-01' }),
      bill({ id: 'e', isAutopay: true, dueDate: '2026-11-01', status: 'settled' }),
      bill({ id: 'f', isAutopay: true, dueDate: '2026-11-01', skipped: true }),
    ]
    expect(autopayDue(bills, '2026-11-11').map((b) => b.id)).toEqual(['a', 'b'])
  })
})

describe('lifecycle', () => {
  it('pays in one step', () => {
    expect(markPaid({ method: 'etransfer', date: '2026-11-11', confirmationRef: ' ' })).toEqual({
      status: 'settled',
      paymentDetails: { method: 'etransfer', initiatedDate: '2026-11-11', clearedDate: '2026-11-11' },
    })
  })

  it('goes pending, then cleared, keeping the original details', () => {
    const pending = markPending({ method: 'eft', date: '2026-11-10', confirmationRef: 'A1' })
    expect(pending.status).toBe('pending')
    const cleared = confirmCleared(bill({ status: 'pending', paymentDetails: pending.paymentDetails }), '2026-11-13')
    expect(cleared).toEqual({
      status: 'settled',
      paymentDetails: { method: 'eft', initiatedDate: '2026-11-10', clearedDate: '2026-11-13', confirmationRef: 'A1' },
    })
  })

  it('reopens with no payment details', () => {
    expect(reopen(bill({ status: 'pending', paymentDetails: { method: 'eft' } }))).toEqual({ status: 'unpaid' })
  })

  it('turns a reopened autopay bill into a manual one', () => {
    const settled = bill({ isAutopay: true, status: 'settled', paymentDetails: { method: 'autopay' } })
    expect(reopen(settled)).toEqual({ status: 'unpaid', isAutopay: false })
  })
})

describe('planUpdates', () => {
  const before = plan({ isAutopay: false, amount: 100, dueDay: 10 })
  const after = { ...before, amount: 120, dueDay: 12 }
  const generated = (month: string, patch: Partial<BillItem> = {}) => ({
    ...missingBills([before], new Set(), [month])[0],
    ...patch,
  })

  it('updates untouched unpaid bills from the plan', () => {
    const updates = planUpdates(before, after, [generated('2026-11'), generated('2026-12')])
    expect(updates.map((u) => [u.id, u.patch.amount, u.patch.dueDate])).toEqual([
      ['2026-11_p1', 120, '2026-11-12'],
      ['2026-12_p1', 120, '2026-12-12'],
    ])
  })

  it('leaves bills that were edited by hand, settled or skipped', () => {
    const updates = planUpdates(before, after, [
      generated('2026-11', { amount: 123.45 }),
      generated('2026-12', { status: 'settled' }),
      generated('2027-01', { skipped: true }),
      bill({ recurringId: 'other' }),
    ])
    expect(updates).toEqual([])
  })

  it('carries a change to or from a variable amount', () => {
    const variable = { ...before, variableAmount: true }
    const toVariable = planUpdates(before, variable, [generated('2026-11')])
    expect(toVariable[0].patch).toMatchObject({ amount: 0, variableAmount: true })

    const generatedVariable = { ...missingBills([variable], new Set(), ['2026-11'])[0] }
    const fromVariable = planUpdates(variable, before, [generatedVariable])
    expect(fromVariable[0].patch).toMatchObject({ amount: 100, variableAmount: false })
  })

  it('leaves a variable bill once its amount has been entered', () => {
    const variable = { ...before, variableAmount: true }
    const entered = { ...missingBills([variable], new Set(), ['2026-11'])[0], amount: 456.78 }
    expect(planUpdates(variable, { ...variable, dueDay: 12 }, [entered])).toEqual([])
  })
})

describe('variable amounts', () => {
  const card = plan({ id: 'card', title: 'Visa', amount: 999, isAutopay: true, variableAmount: true })

  it('generates bills with no amount, flagged as variable', () => {
    const [generated] = missingBills([card], new Set(), ['2026-11'])
    expect(generated).toMatchObject({ amount: 0, variableAmount: true, status: 'unpaid' })
    expect(needsAmount(generated)).toBe(true)
  })

  it('leaves the flag off for ordinary plans', () => {
    expect(missingBills([plan()], new Set(), ['2026-11'])[0]).not.toHaveProperty('variableAmount')
  })

  it('stops needing an amount once one is entered or the bill is no longer unpaid', () => {
    const [generated] = missingBills([card], new Set(), ['2026-11'])
    expect(needsAmount({ ...generated, amount: 250 })).toBe(false)
    expect(needsAmount({ ...generated, status: 'pending' })).toBe(false)
    expect(needsAmount(bill({ amount: 0 }))).toBe(false)
  })

  it('does not autopay a bill that is still waiting for its amount', () => {
    const [generated] = missingBills([card], new Set(), ['2026-11'])
    expect(autopayDue([generated], '2026-12-01')).toEqual([])
    expect(autopayDue([{ ...generated, amount: 250 }], '2026-12-01')).toHaveLength(1)
  })

  it('counts bills awaiting an amount in the totals', () => {
    const [generated] = missingBills([card], new Set(), ['2026-11'])
    expect(billTotals([generated, bill()])).toMatchObject({ due: 100, awaitingAmount: 1 })
  })
})

describe('what the page shows', () => {
  const bills = [
    bill({ id: 'old', dueDate: '2026-10-28' }),
    bill({ id: 'oldPaid', dueDate: '2026-10-05', status: 'settled' }),
    bill({ id: 'a', dueDate: '2026-11-24' }),
    bill({ id: 'b', dueDate: '2026-11-02', status: 'settled', amount: 50 }),
    bill({ id: 'c', dueDate: '2026-11-18', status: 'pending', amount: 25.5 }),
    bill({ id: 'next', dueDate: '2026-12-01' }),
    bill({ id: 'gone', dueDate: '2026-11-20', skipped: true }),
  ]

  it('shows a month plus earlier bills still unsettled, never skipped ones', () => {
    expect(billsForMonth(bills, '2026-11').map((b) => b.id).sort()).toEqual(['a', 'b', 'c', 'old'])
    expect(billsForMonth(bills, '2026-10').map((b) => b.id).sort()).toEqual(['old', 'oldPaid'])
  })

  it('groups by status in due order', () => {
    const groups = groupBills(billsForMonth(bills, '2026-11'))
    expect(groups.due.map((b) => b.id)).toEqual(['old', 'a'])
    expect(groups.pending.map((b) => b.id)).toEqual(['c'])
    expect(groups.settled.map((b) => b.id)).toEqual(['b'])
  })

  it('totals add up', () => {
    expect(billTotals(billsForMonth(bills, '2026-11'))).toMatchObject({ total: 275.5, paid: 50, pending: 25.5, due: 200 })
  })

  it('filters by autopay', () => {
    const mixed = [bill({ id: 'x', isAutopay: true }), bill({ id: 'y' })]
    expect(filterBills(mixed, 'autopay').map((b) => b.id)).toEqual(['x'])
    expect(filterBills(mixed, 'manual').map((b) => b.id)).toEqual(['y'])
    expect(filterBills(mixed, 'all')).toHaveLength(2)
  })
})

describe('billsSoon and billsInTransit', () => {
  const list = [
    bill({ id: 'late', dueDate: '2026-11-05' }),
    bill({ id: 'soon', dueDate: '2026-11-18' }),
    bill({ id: 'edge', dueDate: '2026-11-19' }),
    bill({ id: 'far', dueDate: '2026-11-20' }),
    bill({ id: 'skipped', dueDate: '2026-11-12', skipped: true }),
    bill({ id: 'paid', dueDate: '2026-11-12', status: 'settled' }),
    bill({ id: 'sent', dueDate: '2026-11-03', status: 'pending' }),
  ]

  it('lists unpaid bills that are overdue or due within a week, soonest first', () => {
    expect(billsSoon(list, '2026-11-12').map((b) => b.id)).toEqual(['late', 'soon', 'edge'])
  })

  it('takes a custom window', () => {
    expect(billsSoon(list, '2026-11-12', 1).map((b) => b.id)).toEqual(['late'])
  })

  it('lists payments that have not cleared', () => {
    expect(billsInTransit(list).map((b) => b.id)).toEqual(['sent'])
  })
})

describe('labels', () => {
  it('describes how soon a bill is due', () => {
    expect(dueLabel(bill({ dueDate: '2026-11-09' }), '2026-11-11')).toBe('2 days overdue')
    expect(dueLabel(bill({ dueDate: '2026-11-10' }), '2026-11-11')).toBe('1 day overdue')
    expect(dueLabel(bill({ dueDate: '2026-11-11' }), '2026-11-11')).toBe('Due today')
    expect(dueLabel(bill({ dueDate: '2026-11-12' }), '2026-11-11')).toBe('Due tomorrow')
    expect(dueLabel(bill({ dueDate: '2026-11-22' }), '2026-11-11')).toBe('In 11 days')
  })

  it('describes the payment column', () => {
    expect(paymentLabel(bill())).toBe('No')
    expect(paymentLabel(bill({ isAutopay: true }))).toBe('Scheduled')
    expect(
      paymentLabel(bill({ status: 'pending', paymentDetails: { method: 'eft', initiatedDate: '2026-11-10' } })),
    ).toBe('EFT sent (Nov 10)')
    expect(
      paymentLabel(bill({ status: 'settled', paymentDetails: { method: 'credit', clearedDate: '2026-11-05' } })),
    ).toBe('Credit card · Cleared Nov 5')
  })
})
