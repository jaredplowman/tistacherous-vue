import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// Firebase web config is public by design; it identifies the project, it is
// not a secret. Access control happens in firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyBQisHMN8kKW6mWnoM8h1aClaFC83cYvRo',
  authDomain: 'home-d37bc.firebaseapp.com',
  projectId: 'home-d37bc',
  storageBucket: 'home-d37bc.firebasestorage.app',
  messagingSenderId: '551793130532',
  appId: '1:551793130532:web:2c80024179fd7625c36cb1',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// The local cache keeps the wall tablet usable through wifi drops.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
})
