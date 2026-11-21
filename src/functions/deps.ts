import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { CleanupDeps } from "./cleanup.js";
import type { ExtractDeps, StoredFile } from "./extract.js";

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
      return files.map(stored);
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
    // the extracted values and the documents are deleted. Repeating it on a submitted return only
    // deletes what is left, so a failed cleanup is retried by calling it again.
    submit: async (id, prefix) => {
      const client = await clients.doc(id).get();
      if (client.get("status") !== "submitted") {
        await clients.doc(id).update({ status: "submitted", submittedAt: FieldValue.serverTimestamp(), extractedAt: FieldValue.delete() });
      }
      await db.recursiveDelete(clients.doc(id).collection("extraction"));
      await bucket.deleteFiles({ prefix });
    },
    log,
  };
}

function stored(f: { name: string; metadata: { contentType?: unknown; size?: unknown; timeCreated?: unknown } }): StoredFile {
  return {
    name: f.name,
    contentType: String(f.metadata.contentType ?? ""),
    size: Number(f.metadata.size ?? 0),
    created: new Date(String(f.metadata.timeCreated ?? 0)),
  };
}

/** The live wiring for the daily cleanup. Tested against the emulators. */
export function cleanupDeps(log?: CleanupDeps["log"]): CleanupDeps {
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();
  const clients = db.collection("clients");
  const bucket = getStorage().bucket();
  return {
    now: () => new Date(),
    listClients: async () =>
      (await clients.select("ownerUid", "status").get()).docs.map((d) => ({ id: d.id, ownerUid: String(d.get("ownerUid") ?? ""), status: String(d.get("status") ?? "") })),
    getValuesExpiry: async (id) => {
      const snap = await clients.doc(id).collection("extraction").doc("current").get();
      const at = snap.get("expireAt") as { toDate(): Date } | undefined;
      return snap.exists ? (at?.toDate() ?? new Date(0)) : undefined;
    },
    deleteValues: async (id) => {
      const had = (await clients.doc(id).collection("extraction").limit(1).get()).size > 0;
      await db.recursiveDelete(clients.doc(id).collection("extraction"));
      await clients.doc(id).update({ extractedAt: FieldValue.delete() });
      return had;
    },
    listFiles: async (prefix) => (await bucket.getFiles({ prefix }))[0].map(stored),
    deleteFile: async (name) => {
      await bucket.file(name).delete({ ignoreNotFound: true });
    },
    log,
  };
}
