import { readFileSync } from "node:fs";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

// Runs against the Firestore emulator: npm run test:integration
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-tax-copilot",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env?.cleanup();
});

describe("firestore.rules: default deny", () => {
  it("denies reads and writes to signed out users", async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, "clients/c1")));
    await assertFails(setDoc(doc(db, "clients/c1"), { status: "documents_in" }));
  });

  it("denies reads and writes to signed in users until a rule allows it", async () => {
    const db = env.authenticatedContext("preparer").firestore();
    await assertFails(getDoc(doc(db, "clients/c1")));
    await assertFails(setDoc(doc(db, "clients/c1"), { status: "documents_in" }));
    await assertFails(setDoc(doc(db, "clients/c1/flags/f1"), { reason: "x" }));
  });

  it("denies storing documents or credentials anywhere", async () => {
    const db = env.authenticatedContext("preparer").firestore();
    await assertFails(setDoc(doc(db, "documents/d1"), { content: "pdf bytes" }));
    await assertFails(setDoc(doc(db, "credentials/c1"), { username: "x" }));
  });
});
