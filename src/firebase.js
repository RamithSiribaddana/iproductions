import { initializeApp } from '@firebase/app';
import { getAuth, GoogleAuthProvider } from '@firebase/auth';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const allowedAdminEmails = new Set([
  'ramithk69@gmail.com',
  'isuru.withanage123@gmail.com',
]);
export const firebaseConfigured = Object.values(config).every(Boolean);
export const auth = firebaseConfigured ? getAuth(initializeApp(config)) : null;
export const googleProvider = new GoogleAuthProvider();
