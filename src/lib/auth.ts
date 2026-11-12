import { computed, ref } from 'vue'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { getDoc } from 'firebase/firestore'
import { auth, googleProvider } from './firebase'
import { memberRef } from './firestore'
import type { Member } from '@/domain/types'

export const user = ref<User | null>(null)
export const authReady = ref(false)
export const member = ref<Member | null>(null)
export const authError = ref('')

export const isAllowed = computed(() => !!member.value)
export const isOwner = computed(() => member.value?.role === 'owner')

// Membership lives in Firestore (households/main/members/{email}) and is enforced
// by firestore.rules; this lookup only decides what the UI shows.
async function loadMember(email: string): Promise<Member | null> {
  const snap = await getDoc(memberRef(email))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    email: email.toLowerCase(),
    displayName: data.displayName || email,
    role: data.role === 'owner' ? 'owner' : 'parent',
  }
}

onAuthStateChanged(auth, async (nextUser) => {
  authReady.value = false
  authError.value = ''
  user.value = nextUser
  member.value = null

  if (nextUser?.email) {
    try {
      member.value = await loadMember(nextUser.email)
    } catch (error) {
      const code = (error as { code?: string }).code
      // permission-denied means the rules turned this account away
      if (code !== 'permission-denied') authError.value = "Couldn't check your access. Check your connection and try again."
    }
  }
  authReady.value = true
})

export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export function signOutUser() {
  return signOut(auth)
}
