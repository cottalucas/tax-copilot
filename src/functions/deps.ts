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
      return files.map((f) => ({
        name: f.name,
        contentType: String(f.metadata.contentType ?? ""),
        size: Number(f.metadata.size ?? 0),
        created: new Date(String(f.metadata.timeCreated ?? 0)),
      }));
    },
    // One transaction: values are saved only while the return is open, so an extraction that
    // finishes after submit cannot bring them back.
    saveExtraction: (id, record) =>
      db.runTransaction(async (tx) => {
        const client = await tx.get(clients.doc(id));
        if (!client.exists || client.get("status") !== "documents_in") return false;
        tx.set(clients.doc(id).collection("extraction").doc("current"), record);
        tx.update(clients.doc(id), { extractedAt: record.extractedAt });
        return true;
      }),
    // Submit closes the return first, so a running extraction cannot save after this point. Then
    // the extracted values and the documents are deleted.
    submit: async (id, prefix) => {
      await clients.doc(id).update({ status: "submitted", submittedAt: FieldValue.serverTimestamp(), extractedAt: FieldValue.delete() });
      await db.recursiveDelete(clients.doc(id).collection("extraction"));
      await bucket.deleteFiles({ prefix });
    },
    log,
  };
}
