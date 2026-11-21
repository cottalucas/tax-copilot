import { deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { firebaseDeps } from "../../src/functions/deps.js";
import { clientPrefix } from "../../src/functions/extract.js";

// SR-28: the functions' real Firestore and Storage wiring, against the emulators
// (firebase emulators:exec sets FIRESTORE_EMULATOR_HOST and FIREBASE_STORAGE_EMULATOR_HOST).
const prefix = clientPrefix("preparer", "c1");

beforeAll(() => {
  initializeApp({ projectId: "demo-tax-copilot", storageBucket: "demo-tax-copilot.appspot.com" });
});

afterAll(async () => {
  await Promise.all(getApps().map((a) => deleteApp(a)));
});

beforeEach(async () => {
  const bucket = getStorage().bucket();
  await bucket.deleteFiles({ prefix: "users/" }).catch(() => undefined);
  await getFirestore().recursiveDelete(getFirestore().collection("clients"));
  await getFirestore().doc("clients/c1").set({ ownerUid: "preparer", displayName: "Client A", status: "documents_in", flagCount: 0, fileCount: 2, taxYear: 2025 });
  await bucket.file(`${prefix}salary.pdf`).save(Buffer.from("%PDF-1.4\n%%EOF\n"), { contentType: "application/pdf" });
  await bucket.file(`${prefix}photo.jpg`).save(Buffer.from([0xff, 0xd8, 0xff]), { contentType: "image/jpeg" });
  await bucket.file(`${clientPrefix("preparer", "c2")}other.pdf`).save(Buffer.from("%PDF-1.4\n%%EOF\n"), { contentType: "application/pdf" });
});

describe("functions wiring on the emulators", () => {
  it("lists only that client's files, with type and size", async () => {
    const files = await firebaseDeps().listFiles(prefix);
    expect(files.map((f) => [f.name, f.contentType]).sort()).toEqual([
      [`${prefix}photo.jpg`, "image/jpeg"],
      [`${prefix}salary.pdf`, "application/pdf"],
    ]);
    expect(files.every((f) => f.size > 0)).toBe(true);
    // Upload time, which the values' expiry follows.
    expect(files.every((f) => Math.abs(f.created.getTime() - Date.now()) < 60_000)).toBe(true);
  });

  it("saves the extracted values with their expiry, and marks the client extracted", async () => {
    const extractedAt = new Date("2026-03-01T00:00:00Z");
    const expireAt = new Date("2026-03-31T00:00:00Z");
    const data = { schemaVersion: 1 as const, taxpayer: { clientId: "c1", taxYear: 2025 }, employment: [], deductions: {}, bankAccounts: [], cantonSpecific: {} };
    expect(await firebaseDeps().saveExtraction("c1", { data, model: "m", taxYear: 2025, sources: ["salary.pdf"], extractedAt, expireAt })).toBe(true);
    const saved = (await getFirestore().doc("clients/c1/extraction/current").get()).data()!;
    expect(saved.expireAt.toDate()).toEqual(expireAt);
    expect(saved.data.taxpayer).toEqual({ clientId: "c1", taxYear: 2025 });
    expect((await getFirestore().doc("clients/c1").get()).get("extractedAt").toDate()).toEqual(extractedAt);
  });

  it("submitting deletes the client's documents and extracted values, and nobody else's", async () => {
    const deps = firebaseDeps();
    await deps.saveExtraction("c1", {
      data: { schemaVersion: 1, taxpayer: { clientId: "c1", taxYear: 2025 }, employment: [], deductions: {}, bankAccounts: [], cantonSpecific: {} },
      model: "m",
      taxYear: 2025,
      sources: [],
      extractedAt: new Date(),
      expireAt: new Date(),
    });
    await deps.submit("c1", prefix);
    const [left] = await getStorage().bucket().getFiles({ prefix: "users/" });
    expect(left.map((f) => f.name)).toEqual([`${clientPrefix("preparer", "c2")}other.pdf`]);
    expect((await getFirestore().doc("clients/c1/extraction/current").get()).exists).toBe(false);
    const client = (await getFirestore().doc("clients/c1").get()).data()!;
    expect(client.status).toBe("submitted");
    expect(client.submittedAt).toBeDefined();
    expect(client.extractedAt).toBeUndefined();
    // An extraction that finishes after submit cannot bring the values back.
    const late = await deps.saveExtraction("c1", {
      data: { schemaVersion: 1, taxpayer: { clientId: "c1", taxYear: 2025 }, employment: [], deductions: {}, bankAccounts: [], cantonSpecific: {} },
      model: "m",
      taxYear: 2025,
      sources: [],
      extractedAt: new Date(),
      expireAt: new Date(),
    });
    expect(late).toBe(false);
    expect((await getFirestore().doc("clients/c1/extraction/current").get()).exists).toBe(false);
    expect((await getFirestore().doc("clients/c1").get()).get("extractedAt")).toBeUndefined();
  });
});
