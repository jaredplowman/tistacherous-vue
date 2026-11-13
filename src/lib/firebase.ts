import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAI, GoogleAIBackend } from 'firebase/ai'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

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

// Public reCAPTCHA v3 site key (not a secret; the private secret key lives in Firebase Console).
if (import.meta.env.DEV) {
  ;(self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true
}
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6Lcm0B4uAAAAAKFIhh1Q2JRXfcy9qQ4T8mlDuF1_'),
  isTokenAutoRefreshEnabled: true,
})

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()

// The local cache keeps the wall tablet usable through wifi drops.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
})
export const storage = getStorage(app)
export const ai = getAI(app, { backend: new GoogleAIBackend() })
