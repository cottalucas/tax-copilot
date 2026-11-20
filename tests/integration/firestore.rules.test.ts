import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

// Runs against the Firestore emulator: npm run test:integration
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-tax-copilot", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "clients/c1"), { ownerUid: "preparer", displayName: "Client A", status: "documents_in", flagCount: 0 });
    await setDoc(doc(ctx.firestore(), "clients/c2"), { ownerUid: "someone-else", displayName: "Client B", status: "needs_review", flagCount: 1 });
  });
});

afterAll(async () => {
  await env?.cleanup();
});

describe("firestore.rules: clients (SR-16)", () => {
  it("lets her read and list her own clients", async () => {
    const db = env.authenticatedContext("preparer").firestore();
    await assertSucceeds(getDoc(doc(db, "clients/c1")));
    await assertSucceeds(getDocs(query(collection(db, "clients"), where("ownerUid", "==", "preparer"))));
  });

  it("does not let another user read her clients, or list without the owner filter", async () => {
    const db = env.authenticatedContext("preparer").firestore();
    await assertFails(getDoc(doc(db, "clients/c2")));
    await assertFails(getDocs(collection(db, "clients")));
    const other = env.authenticatedContext("someone-else").firestore();
    await assertFails(getDoc(doc(other, "clients/c1")));
  });

  it("denies signed out users and every write", async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "clients/c1")));
    const db = env.authenticatedContext("preparer").firestore();
    await assertFails(setDoc(doc(db, "clients/c1"), { ownerUid: "preparer", displayName: "X", status: "submitted" }));
    await assertFails(setDoc(doc(db, "clients/c3"), { ownerUid: "preparer", displayName: "Y", status: "documents_in" }));
  });
});

describe("firestore.rules: default deny", () => {
  it("denies storing documents or credentials anywhere", async () => {
    const db = env.authenticatedContext("preparer").firestore();
    await assertFails(setDoc(doc(db, "documents/d1"), { content: "pdf bytes" }));
    await assertFails(setDoc(doc(db, "credentials/c1"), { username: "x" }));
    await assertFails(getDoc(doc(db, "clients/c1/flags/f1")));
  });
});
