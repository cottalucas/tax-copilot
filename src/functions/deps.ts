import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { ExtractDeps } from "./extract.js";

/**
 * The live wiring for the extract and submitReturn functions: Firestore and the project's default
 * bucket (europe-west6) through the Admin SDK. Tested against the emulators
 * (tests/integration/functions-deps.test.ts).
 */
export function firebaseDeps(log?: ExtractDeps["log"]): ExtractDeps {
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();
  const clients = db.collection("clients");
  const bucket = getStorage().bucket();
  return {
    env: process.env,
    bucket: bucket.name,
    getClient: async (id) => (await clients.doc(id).get()).data(),
    listFiles: async (prefix) => {
      const [files] = await bucket.getFiles({ prefix });
      return files.map((f) => ({ name: f.name, contentType: String(f.metadata.contentType ?? ""), size: Number(f.metadata.size ?? 0) }));
    },
    saveExtraction: async (id, record) => {
      const batch = db.batch();
      batch.set(clients.doc(id).collection("extraction").doc("current"), record);
      batch.update(clients.doc(id), { extractedAt: record.extractedAt });
      await batch.commit();
    },
    // Submitting deletes the documents and the extracted values, then marks the return submitted.
    submit: async (id, prefix) => {
      await bucket.deleteFiles({ prefix });
      await db.recursiveDelete(clients.doc(id).collection("extraction"));
      await clients.doc(id).update({ status: "submitted", submittedAt: FieldValue.serverTimestamp(), extractedAt: FieldValue.delete() });
    },
    log,
  };
}
