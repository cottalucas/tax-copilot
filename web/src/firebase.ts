import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

// Public web config, injected at build time (infra.yml writes it from the Firebase project).
// Tests build with VITE_USE_EMULATORS=true and the demo project, so no real service is touched.
const useEmulators = import.meta.env.VITE_USE_EMULATORS === "true";

export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "demo-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "localhost",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "demo-tax-copilot",
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const auth = getAuth(app);
export const db = getFirestore(app);

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
