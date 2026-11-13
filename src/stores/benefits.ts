import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  addDoc,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { householdCollection, householdDoc } from '@/lib/firestore'
import { errorMessage } from '@/lib/errors'
import { deleteBenefitFile } from '@/lib/storage'
import { calculateMemberBudgets, DEFAULT_TYPE_BUDGET, sortClaims } from '@/domain/benefits'
import type {
  BenefitBudgetOverride,
  BenefitClaim,
  BenefitType,
  Caregiver,
} from '@/domain/types'
import { useChoresStore } from './chores'
import { useHouseholdStore } from './household'

const OPTIONAL_CLAIM_FIELDS = ['submittedDate', 'receipt', 'primaryResponse', 'secondaryResponse'] as const

export const useBenefitsStore = defineStore('benefits', () => {
  const chores = useChoresStore()
  const household = useHouseholdStore()

  const claims = ref<BenefitClaim[]>([])
  const types = ref<BenefitType[]>([])
  const caregivers = ref<Caregiver[]>([])
  const budgetOverrides = ref<BenefitBudgetOverride[]>([])
  const error = ref('')

  let unsubscribers: Unsubscribe[] = []

  const onError = (e: Error) => (error.value = errorMessage(e))

  const sortedClaims = computed(() => sortClaims(claims.value))
  const sortedTypes = computed(() => [...types.value].sort((a, b) => a.name.localeCompare(b.name)))
  const sortedCaregivers = computed(() => [...caregivers.value].sort((a, b) => a.name.localeCompare(b.name)))

  const currentYear = computed(() => chores.today.slice(0, 4))

  const memberBudgets = computed(() =>
    calculateMemberBudgets({
      members: household.members,
      types: sortedTypes.value,
      claims: claims.value,
      year: currentYear.value,
      overrides: budgetOverrides.value,
    }),
  )

  function start() {
    if (unsubscribers.length) return
    unsubscribers = [
      onSnapshot(
        householdCollection('benefits'),
        (snap) => {
          claims.value = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as BenefitClaim)
        },
        onError,
      ),
      onSnapshot(
        householdCollection('benefitTypes'),
        (snap) => {
          types.value = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as BenefitType)
        },
        onError,
      ),
      onSnapshot(
        householdCollection('caregivers'),
        (snap) => {
          caregivers.value = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Caregiver)
        },
        onError,
      ),
      onSnapshot(
        householdCollection('benefitBudgets'),
        (snap) => {
          budgetOverrides.value = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as BenefitBudgetOverride)
        },
        onError,
      ),
    ]
  }

  function stop() {
    unsubscribers.forEach((u) => u())
    unsubscribers = []
    claims.value = []
    types.value = []
    caregivers.value = []
    budgetOverrides.value = []
  }

  const newClaimId = () => doc(householdCollection('benefits')).id

  async function saveClaim(id: string, fields: Omit<BenefitClaim, 'id'>, isNew: boolean) {
    if (isNew) {
      await setDoc(householdDoc('benefits', id), fields)
      return
    }
    const patch: Record<string, unknown> = { ...fields }
    for (const key of OPTIONAL_CLAIM_FIELDS) {
      if (fields[key] === undefined) patch[key] = deleteField()
    }
    await updateDoc(householdDoc('benefits', id), patch)
  }

  async function removeClaim(claim: BenefitClaim) {
    await deleteDoc(householdDoc('benefits', claim.id))
    await Promise.all([
      deleteBenefitFile(claim.receipt?.path),
      deleteBenefitFile(claim.primaryResponse?.path),
      deleteBenefitFile(claim.secondaryResponse?.path),
    ])
  }

  async function addType(name: string, defaultBudget = DEFAULT_TYPE_BUDGET): Promise<string> {
    const docRef = await addDoc(householdCollection('benefitTypes'), {
      name: name.trim(),
      defaultBudget: Math.max(0, Math.round(defaultBudget * 100) / 100),
    })
    return docRef.id
  }

  const updateType = (id: string, patch: Partial<Omit<BenefitType, 'id'>>) =>
    updateDoc(householdDoc('benefitTypes', id), patch)

  const removeType = (id: string) => deleteDoc(householdDoc('benefitTypes', id))

  async function addCaregiver(name: string, typeId: string): Promise<string> {
    const docRef = await addDoc(householdCollection('caregivers'), {
      name: name.trim(),
      typeId,
    })
    return docRef.id
  }

  const updateCaregiver = (id: string, patch: Partial<Omit<Caregiver, 'id'>>) =>
    updateDoc(householdDoc('caregivers', id), patch)

  const removeCaregiver = (id: string) => deleteDoc(householdDoc('caregivers', id))

  function setMemberBudget(memberEmail: string, typeId: string, limit: number) {
    const id = `${memberEmail}_${typeId}`
    return setDoc(householdDoc('benefitBudgets', id), {
      memberEmail,
      typeId,
      limit: Math.max(0, Math.round(limit * 100) / 100),
    })
  }

  return {
    claims: sortedClaims,
    types: sortedTypes,
    caregivers: sortedCaregivers,
    budgetOverrides,
    memberBudgets,
    currentYear,
    error,
    start,
    stop,
    newClaimId,
    saveClaim,
    removeClaim,
    addType,
    updateType,
    removeType,
    addCaregiver,
    updateCaregiver,
    removeCaregiver,
    setMemberBudget,
  }
})
