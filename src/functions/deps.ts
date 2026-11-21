import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import type { CleanupDeps } from "./cleanup.js";
import type { ExtractDeps, StoredFile } from "./extract.js";

/**
 * The one documents bucket. Live, DOCUMENTS_BUCKET comes from infra.yml, the same name it checks
 * (europe-west6, lifecycle, no soft delete, no versioning). Without it the functions refuse to
 * run, so they never use an unchecked bucket. On the emulators the default bucket is used.
 */
export function documentsBucket() {
  const name = (process.env.DOCUMENTS_BUCKET ?? "").trim();
  if (!name && !process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error("DOCUMENTS_BUCKET is not set.");
  return name ? getStorage().bucket(name) : getStorage().bucket();
}

/**
 * The live wiring for the extract and submitReturn functions: Firestore and the project's default
 * bucket (europe-west6) through the Admin SDK. Tested against the emulators
 * (tests/integration/functions-deps.test.ts).
 */
export function firebaseDeps(log?: ExtractDeps["log"]): ExtractDeps {
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();
  const clients = db.collection("clients");
  const bucket = documentsBucket();
  return {
    env: process.env,
    bucket: bucket.name,
    getClient: async (id) => (await clients.doc(id).get()).data(),
    listFiles: async (prefix) => {
      const [files] = await bucket.getFiles({ prefix });
      return files.map(stored);
    },
    // One transaction: values, flags and the new status are saved only while the return is not
    // submitted, so an extraction that finishes after submit cannot bring them back.
    saveExtraction: (id, record) =>
      db.runTransaction(async (tx) => {
        const client = await tx.get(clients.doc(id));
        if (!client.exists || client.get("status") === "submitted") return false;
        tx.set(clients.doc(id).collection("extraction").doc("current"), record);
        tx.update(clients.doc(id), { extractedAt: record.extractedAt, status: record.status, flagCount: record.flags.length });
        return true;
      }),
    approve: (id) =>
      db.runTransaction(async (tx) => {
        const client = await tx.get(clients.doc(id));
        const values = await tx.get(clients.doc(id).collection("extraction").doc("current"));
        if (!values.exists || !["needs_review", "ready_to_fill"].includes(String(client.get("status")))) return false;
        tx.update(clients.doc(id), { status: "ready_to_fill", approvedAt: FieldValue.serverTimestamp() });
        return true;
      }),
    // Submit closes the return first, so a running extraction cannot save after this point. Then
    // the extracted values and the documents are deleted. Repeating it on a submitted return only
    // deletes what is left, so a failed cleanup is retried by calling it again.
    submit: async (id, prefix) => {
      const client = await clients.doc(id).get();
      if (client.get("status") !== "submitted") {
        await clients.doc(id).update({ status: "submitted", submittedAt: FieldValue.serverTimestamp(), extractedAt: FieldValue.delete(), flagCount: 0 });
      }
      // Values and files are deleted independently: a failure in one never skips the other.
      const results = await Promise.allSettled([db.recursiveDelete(clients.doc(id).collection("extraction")), bucket.deleteFiles({ prefix })]);
      if (results.some((r) => r.status === "rejected")) throw new Error("Deleting the return's values or documents failed.");
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
  const bucket = documentsBucket();
  return {
    now: () => new Date(),
    listClients: async () =>
      (await clients.select("ownerUid", "status").get()).docs.map((d) => ({ id: d.id, ownerUid: String(d.get("ownerUid") ?? ""), status: String(d.get("status") ?? "") })),
    deleteExpiredValues: (id, now) =>
      db.runTransaction(async (tx) => {
        const ref = clients.doc(id).collection("extraction").doc("current");
        const snap = await tx.get(ref);
        const at = snap.get("expireAt") as { toDate(): Date } | undefined;
        if (!snap.exists || (at && at.toDate().getTime() > now.getTime())) return false;
        tx.delete(ref);
        tx.update(clients.doc(id), { extractedAt: FieldValue.delete(), flagCount: 0 });
        return true;
      }),
    deleteValues: async (id) => {
      const had = (await clients.doc(id).collection("extraction").limit(1).get()).size > 0;
      await db.recursiveDelete(clients.doc(id).collection("extraction"));
      await clients.doc(id).update({ extractedAt: FieldValue.delete(), flagCount: 0 });
      return had;
    },
    listFiles: async (prefix) => (await bucket.getFiles({ prefix }))[0].map(stored),
    deleteFile: async (name) => {
      await bucket.file(name).delete({ ignoreNotFound: true });
    },
    log,
  };
}
