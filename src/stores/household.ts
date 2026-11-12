import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { addDoc, deleteDoc, onSnapshot, setDoc, updateDoc, writeBatch, type Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { householdCollection, householdDoc, householdRef, memberRef } from '@/lib/firestore'
import { moveKid as reorderKids, newKid, nextKidOrder } from '@/domain/kids'
import type { Household, KidProfile, Member, MemberRole } from '@/domain/types'
import { BRAND_NAME } from '@/app/brand'

const DEFAULT_TIMEZONE = 'America/Vancouver'

export const useHouseholdStore = defineStore('household', () => {
  const household = ref<Household>({ name: BRAND_NAME, timezone: DEFAULT_TIMEZONE })
  const members = ref<Member[]>([])
  const kids = ref<KidProfile[]>([])
  const error = ref('')
  let unsubscribers: Unsubscribe[] = []

  const sortedKids = computed(() => [...kids.value].sort((a, b) => a.sortOrder - b.sortOrder))

  function start() {
    if (unsubscribers.length) return
    const onError = (e: Error) => (error.value = e.message)

    unsubscribers = [
      onSnapshot(
        householdRef(),
        (snap) => {
          const data = snap.data()
          household.value = {
            name: data?.name || BRAND_NAME,
            timezone: data?.timezone || DEFAULT_TIMEZONE,
          }
        },
        onError,
      ),
      onSnapshot(
        householdCollection('members'),
        (snap) => {
          members.value = snap.docs.map((d) => ({
            email: d.id,
            displayName: d.data().displayName || d.id,
            role: d.data().role === 'owner' ? 'owner' : 'parent',
          }))
        },
        onError,
      ),
      onSnapshot(
        householdCollection('kids'),
        (snap) => {
          kids.value = snap.docs.map((d) => ({ ...newKid('', 0), ...d.data(), id: d.id }) as KidProfile)
        },
        onError,
      ),
    ]
  }

  function stop() {
    unsubscribers.forEach((unsubscribe) => unsubscribe())
    unsubscribers = []
    members.value = []
    kids.value = []
  }

  const renameHousehold = (name: string) => setDoc(householdRef(), { name }, { merge: true })

  const addMember = (email: string, displayName: string, role: MemberRole) =>
    setDoc(memberRef(email), { displayName, role })

  const updateMember = (email: string, patch: Partial<Pick<Member, 'displayName' | 'role'>>) =>
    updateDoc(memberRef(email), patch)

  const removeMember = (email: string) => deleteDoc(memberRef(email))

  const addKid = (name: string) => addDoc(householdCollection('kids'), newKid(name, nextKidOrder(kids.value)))

  const updateKid = (id: string, patch: Record<string, unknown>) =>
    updateDoc(householdDoc('kids', id), patch)

  const removeKid = (id: string) => deleteDoc(householdDoc('kids', id))

  async function moveKid(id: string, direction: -1 | 1) {
    const changes = reorderKids(kids.value, id, direction)
    if (!changes.length) return
    const batch = writeBatch(db)
    for (const { id: kidId, sortOrder } of changes) batch.update(householdDoc('kids', kidId), { sortOrder })
    await batch.commit()
  }

  return {
    household,
    members,
    kids: sortedKids,
    error,
    start,
    stop,
    renameHousehold,
    addMember,
    updateMember,
    removeMember,
    addKid,
    updateKid,
    removeKid,
    moveKid,
  }
})
