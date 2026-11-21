import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

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
// Functions run in europe-west6 (ARCHITECTURE.md). Called directly, never behind a Hosting rewrite.
export const functions = getFunctions(app, "europe-west6");

if (useEmulators) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
