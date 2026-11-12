import { collection, doc } from 'firebase/firestore'
import { db } from './firebase'

export const HOUSEHOLD_ID = 'main'

export const householdRef = () => doc(db, 'households', HOUSEHOLD_ID)
export const householdCollection = (name: string) => collection(db, 'households', HOUSEHOLD_ID, name)
export const householdDoc = (name: string, id: string) => doc(householdCollection(name), id)
export const memberRef = (email: string) => householdDoc('members', email.toLowerCase())
