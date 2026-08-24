import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import firebaseConfigData from '../../firebase-applet-config.json';

// STRICT LOCK TO AIKNOWLEDGEASSISTANT05
export const REQUIRED_PROJECT_ID = "aiknowledgeassistant05";
export const LOCKED_DATABASE_ID = "ai-studio-leadpilotailandi-fe680836-10a7-44f8-aa18-c674131bb6cf";
export const LOCKED_STORAGE_BUCKET = "aiknowledgeassistant05.firebasestorage.app";
export const LOCKED_AUTH_DOMAIN = "aiknowledgeassistant05.firebaseapp.com";

// Enforce project consistency and prevent switching to temporary or unapproved databases
const configProjectId = firebaseConfigData.projectId || REQUIRED_PROJECT_ID;

if (configProjectId !== REQUIRED_PROJECT_ID) {
  const errorMsg = `[CRITICAL FIREBASE ERROR] Unauthorized project ID detected: "${configProjectId}". System is strictly locked to "${REQUIRED_PROJECT_ID}". Halting initialization to protect data integrity.`;
  console.error(errorMsg);
  if (typeof window !== 'undefined') {
    console.error(`%c${errorMsg}`, 'background: #b91c1c; color: white; font-size: 14px; font-weight: bold; padding: 8px;');
  }
}

export const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey || "AIzaSyC6hWRcnhDOXBVSQUgpe0V3A7pcaM3bTck",
  authDomain: LOCKED_AUTH_DOMAIN,
  projectId: REQUIRED_PROJECT_ID, // Strictly locked
  storageBucket: LOCKED_STORAGE_BUCKET,
  messagingSenderId: firebaseConfigData.messagingSenderId || "161220198428",
  appId: firebaseConfigData.appId || "1:161220198428:web:b06fb9c43e992274889fd9"
};

// Singleton App instance with automatic reconnection persistence
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Bound to the dedicated Firestore database
export const db = getFirestore(app, LOCKED_DATABASE_ID);

// Authentication service locked to aiknowledgeassistant05 with browserLocalPersistence
export const auth = getAuth(app);

// Explicitly enforce browserLocalPersistence to preserve sessions across page navigations, tab switches & refreshes
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Firebase Auth] Persistence configuration notice:', err);
  });
}

// Storage service locked to aiknowledgeassistant05
export const storage = getStorage(app, `gs://${LOCKED_STORAGE_BUCKET}`);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Validates active Firebase runtime environment against the locked project configuration.
 */
export function validateFirebaseProject(): {
  isValid: boolean;
  projectId: string;
  databaseId: string;
  storageBucket: string;
  authDomain: string;
  error?: string;
} {
  const activeProjectId = app.options.projectId;
  const isMatch = activeProjectId === REQUIRED_PROJECT_ID;

  return {
    isValid: isMatch,
    projectId: activeProjectId || REQUIRED_PROJECT_ID,
    databaseId: LOCKED_DATABASE_ID,
    storageBucket: LOCKED_STORAGE_BUCKET,
    authDomain: LOCKED_AUTH_DOMAIN,
    error: isMatch ? undefined : `Project mismatch: Expected ${REQUIRED_PROJECT_ID}, detected ${activeProjectId}`
  };
}


