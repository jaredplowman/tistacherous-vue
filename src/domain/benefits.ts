import type {
  BenefitBudgetOverride,
  BenefitClaim,
  BenefitStatus,
  BenefitType,
  Caregiver,
  Member,
} from './types'

export const DEFAULT_TYPE_BUDGET = 500

export interface StatusMeta {
  value: BenefitStatus
  label: string
  tone: 'neutral' | 'warn' | 'bad' | 'good'
}

export const BENEFIT_STATUSES: StatusMeta[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'submitted_primary', label: 'Pending primary', tone: 'warn' },
  { value: 'denied_primary', label: 'Denied by primary', tone: 'bad' },
  { value: 'submitted_secondary', label: 'Pending secondary', tone: 'warn' },
  { value: 'denied_secondary', label: 'Denied by secondary', tone: 'bad' },
  { value: 'paid', label: 'Paid', tone: 'good' },
  { value: 'closed', label: 'Closed', tone: 'neutral' },
]

export function statusMeta(status: BenefitStatus): StatusMeta {
  return BENEFIT_STATUSES.find((s) => s.value === status) ?? BENEFIT_STATUSES[0]!
}

export const isPendingStatus = (status: BenefitStatus) =>
  status === 'submitted_primary' || status === 'submitted_secondary'

export const isDeniedStatus = (status: BenefitStatus) =>
  status === 'denied_primary' || status === 'denied_secondary'

export interface CoverageSummary {
  totalCovered: number
  outOfPocket: number
  isFullyCovered: boolean
}

export function claimCoverage(claim: Pick<BenefitClaim, 'billedAmount' | 'primaryPaid' | 'secondaryPaid'>): CoverageSummary {
  const totalCovered = Math.round((claim.primaryPaid + claim.secondaryPaid) * 100) / 100
  const outOfPocket = Math.max(0, Math.round((claim.billedAmount - totalCovered) * 100) / 100)
  const isFullyCovered = claim.billedAmount > 0 && outOfPocket === 0
  return { totalCovered, outOfPocket, isFullyCovered }
}

// Matches existing caregivers against extracted PDF text, preferring the longest name match.
export function detectCaregiverInText(text: string, caregivers: Caregiver[]): Caregiver | null {
  if (!text.trim() || !caregivers.length) return null
  const haystack = text.toLowerCase()
  const sorted = [...caregivers].sort((a, b) => b.name.length - a.name.length)
  return sorted.find((c) => c.name.trim().length >= 3 && haystack.includes(c.name.trim().toLowerCase())) ?? null
}

export function matchCareTypeByName(name: string, types: BenefitType[]): BenefitType | null {
  const q = name.trim().toLowerCase()
  if (!q) return null
  return (
    types.find((t) => t.name.trim().toLowerCase() === q) ??
    types.find((t) => t.name.trim().toLowerCase().includes(q) || q.includes(t.name.trim().toLowerCase())) ??
    null
  )
}

// Picks a likely clinic or provider name from the top lines of a receipt/EOB PDF.
export function suggestCaregiverName(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && l.length <= 60)
  const ignore = /^(receipt|invoice|statement|explanation of benefits|page \d|date|patient|claim|total|amount|\$?\d)/i
  const candidate = lines.slice(0, 12).find((l) => !ignore.test(l) && /[a-z]{3,}/i.test(l))
  return candidate ?? ''
}

export interface TypeBudgetStatus {
  type: BenefitType
  limit: number
  used: number
  remaining: number
  percent: number
}

export interface MemberBudgetSummary {
  member: Member
  types: TypeBudgetStatus[]
}

export function calculateMemberBudgets(params: {
  members: Member[]
  types: BenefitType[]
  claims: BenefitClaim[]
  year: string // 'YYYY'
  overrides: BenefitBudgetOverride[]
}): MemberBudgetSummary[] {
  const { members, types, claims, year, overrides } = params
  const overrideMap = new Map(overrides.map((o) => [`${o.memberEmail}_${o.typeId}`, o.limit]))
  const yearClaims = claims.filter((c) => c.serviceDate.startsWith(year))

  return members.map((member) => ({
    member,
    types: types.map((type) => {
      const limit = overrideMap.get(`${member.email}_${type.id}`) ?? type.defaultBudget
      let used = 0
      for (const claim of yearClaims) {
        if (claim.typeId !== type.id) continue
        if (claim.primaryMemberEmail === member.email) used += claim.primaryPaid
        if (claim.secondaryMemberEmail === member.email) used += claim.secondaryPaid
      }
      used = Math.round(used * 100) / 100
      const remaining = Math.max(0, Math.round((limit - used) * 100) / 100)
      const percent = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
      return { type, limit, used, remaining, percent }
    }),
  }))
}

export function sortClaims(claims: BenefitClaim[]): BenefitClaim[] {
  return [...claims].sort((a, b) => b.serviceDate.localeCompare(a.serviceDate) || a.title.localeCompare(b.title))
}
