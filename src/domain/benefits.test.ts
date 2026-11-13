import { describe, expect, it } from 'vitest'
import {
  calculateMemberBudgets,
  claimCoverage,
  detectCaregiverInText,
  matchCareTypeByName,
  pickResponseLineItem,
  responseMismatchWarnings,
  sortClaims,
  suggestCaregiverName,
} from './benefits'
import type { BenefitClaim, BenefitType, Caregiver, Member } from './types'

describe('benefits', () => {
  it('computes coverage and out-of-pocket', () => {
    expect(claimCoverage({ billedAmount: 300, primaryPaid: 200, secondaryPaid: 100 })).toEqual({
      totalCovered: 300,
      outOfPocket: 0,
      isFullyCovered: true,
    })
    expect(claimCoverage({ billedAmount: 300, primaryPaid: 200, secondaryPaid: 0 })).toEqual({
      totalCovered: 200,
      outOfPocket: 100,
      isFullyCovered: false,
    })
    expect(claimCoverage({ billedAmount: 0, primaryPaid: 0, secondaryPaid: 0 }).isFullyCovered).toBe(false)
  })

  it('detects existing caregivers and suggests a new name from PDF text', () => {
    const caregivers: Caregiver[] = [
      { id: '1', name: 'Smile', typeId: 'dental' },
      { id: '2', name: 'Smile Dental Clinic', typeId: 'dental' },
    ]
    const text = 'RECEIPT\nSmile Dental Clinic\n123 Main St\nTotal $250.00'
    expect(detectCaregiverInText(text, caregivers)?.id).toBe('2')
    expect(detectCaregiverInText('Unrelated Clinic', caregivers)).toBeNull()
    expect(suggestCaregiverName('Receipt\n2026-11-01\nWestcoast Physio\nPatient: Enzo')).toBe('Westcoast Physio')
    expect(
      matchCareTypeByName('Physiotherapy', [
        { id: 'dental', name: 'Dental', defaultBudget: 500 },
        { id: 'physio', name: 'Physio', defaultBudget: 500 },
      ])?.id,
    ).toBe('physio')
  })

  it('calculates per-member yearly budgets across primary and secondary claims', () => {
    const members: Member[] = [
      { email: 'a@example.com', displayName: 'Alice', role: 'owner' },
      { email: 'b@example.com', displayName: 'Bob', role: 'parent' },
    ]
    const types: BenefitType[] = [
      { id: 'physio', name: 'Physio', defaultBudget: 500 },
      { id: 'dental', name: 'Dental', defaultBudget: 500 },
    ]
    const claims: BenefitClaim[] = [
      {
        id: 'c1',
        title: 'Visit 1',
        serviceDate: '2026-03-10',
        patient: 'Enzo',
        caregiverId: 'g1',
        caregiverName: 'Westcoast Physio',
        typeId: 'physio',
        billedAmount: 300,
        primaryMemberEmail: 'a@example.com',
        primaryPaid: 300,
        secondaryMemberEmail: 'b@example.com',
        secondaryPaid: 0,
        status: 'paid',
        notes: '',
      },
      {
        id: 'c2',
        title: 'Visit 2',
        serviceDate: '2026-06-15',
        patient: 'Sofia',
        caregiverId: 'g1',
        caregiverName: 'Westcoast Physio',
        typeId: 'physio',
        billedAmount: 300,
        primaryMemberEmail: 'a@example.com',
        primaryPaid: 200,
        secondaryMemberEmail: 'b@example.com',
        secondaryPaid: 100,
        status: 'paid',
        notes: '',
      },
      {
        id: 'c3',
        title: 'Last year',
        serviceDate: '2025-12-01',
        patient: 'Alice',
        caregiverId: 'g1',
        caregiverName: 'Westcoast Physio',
        typeId: 'physio',
        billedAmount: 100,
        primaryMemberEmail: 'a@example.com',
        primaryPaid: 100,
        secondaryMemberEmail: '',
        secondaryPaid: 0,
        status: 'paid',
        notes: '',
      },
    ]

    const summaries = calculateMemberBudgets({
      members,
      types,
      claims,
      year: '2026',
      overrides: [{ id: 'b@example.com_dental', memberEmail: 'b@example.com', typeId: 'dental', limit: 750 }],
    })

    const alicePhysio = summaries[0]!.types.find((t) => t.type.id === 'physio')!
    expect(alicePhysio.used).toBe(500)
    expect(alicePhysio.remaining).toBe(0)
    expect(alicePhysio.percent).toBe(100)

    const bobPhysio = summaries[1]!.types.find((t) => t.type.id === 'physio')!
    expect(bobPhysio.used).toBe(100)
    expect(bobPhysio.remaining).toBe(400)

    const bobDental = summaries[1]!.types.find((t) => t.type.id === 'dental')!
    expect(bobDental.limit).toBe(750)
  })

  it('sorts claims newest first', () => {
    const claims = [
      { serviceDate: '2026-01-01', title: 'Old' },
      { serviceDate: '2026-05-01', title: 'New' },
    ] as BenefitClaim[]
    expect(sortClaims(claims).map((c) => c.title)).toEqual(['New', 'Old'])
  })

  it('flags mismatched dates, billed amounts, patients, and plan holders on response PDFs', () => {
    const warnings = responseMismatchWarnings({
      claim: {
        serviceDate: '2026-10-12',
        billedAmount: 115,
        patient: 'Jared Plowman',
        selectedPlanName: 'Jared',
        otherPlanName: 'Jess',
      },
      scanned: {
        serviceDate: '2026-10-19',
        billedAmount: 150,
        patient: 'Sofia Plowman',
        planHolder: 'Jess Plowman',
      },
    })
    expect(warnings).toHaveLength(4)

    expect(
      responseMismatchWarnings({
        claim: {
          serviceDate: '2026-10-12',
          billedAmount: 115,
          patient: 'Jared Plowman',
          selectedPlanName: 'Jared',
          otherPlanName: 'Jess',
        },
        scanned: {
          serviceDate: '2026-10-12',
          billedAmount: 115,
          patient: 'Jared',
          planHolder: 'Jared Plowman',
        },
      }),
    ).toEqual([])
  })

  it('picks the matching line item from a multi-claim EOB PDF', () => {
    const items = [
      { serviceDate: '2026-10-12', description: 'Physiotherapist', patient: 'Jared', billedAmount: 115, paidAmount: 115 },
      { serviceDate: '2026-10-21', description: 'Physiotherapist', patient: 'Jared', billedAmount: 95, paidAmount: 95 },
    ]
    expect(pickResponseLineItem(items, { serviceDate: '2026-10-12', billedAmount: 115 })?.paidAmount).toBe(115)
    expect(pickResponseLineItem(items, { serviceDate: '2026-10-21', billedAmount: 95 })?.paidAmount).toBe(95)
    expect(pickResponseLineItem(items, { serviceDate: '2026-11-01', billedAmount: 50 })).toBeNull()
  })
})
