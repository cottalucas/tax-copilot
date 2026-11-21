import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

// Runs against the Storage emulator: npm run test:integration (SR-28).
let env: RulesTestEnvironment;
const pdf = new TextEncoder().encode("%PDF-1.4\n% synthetic\n%%EOF\n");
const mine = "users/preparer/clients/c1/salary.pdf";

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-tax-copilot", storage: { rules: readFileSync("storage.rules", "utf8") } });
});

beforeEach(async () => {
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), mine), pdf, { contentType: "application/pdf" });
  });
});

afterAll(async () => {
  await env?.cleanup();
});

describe("storage.rules: client documents", () => {
  it("lets her upload PDFs, JPGs and PNGs into her own folder and read them", async () => {
    const s = env.authenticatedContext("preparer").storage();
    await assertSucceeds(uploadBytes(ref(s, "users/preparer/clients/c1/statement.pdf"), pdf, { contentType: "application/pdf" }));
    await assertSucceeds(uploadBytes(ref(s, "users/preparer/clients/c1/photo.jpg"), pdf, { contentType: "image/jpeg" }));
    await assertSucceeds(uploadBytes(ref(s, "users/preparer/clients/c1/scan.png"), pdf, { contentType: "image/png" }));
    await assertSucceeds(getBytes(ref(s, mine)));
  });

  it("does not let another user or a signed out user read or write her documents", async () => {
    const other = env.authenticatedContext("someone-else").storage();
    await assertFails(getBytes(ref(other, mine)));
    await assertFails(uploadBytes(ref(other, "users/preparer/clients/c1/forged.pdf"), pdf, { contentType: "application/pdf" }));
    const anon = env.unauthenticatedContext().storage();
    await assertFails(getBytes(ref(anon, mine)));
    await assertFails(uploadBytes(ref(anon, "users/preparer/clients/c1/x.pdf"), pdf, { contentType: "application/pdf" }));
  });

  it("refuses other file types, files over 25 MB, overwrites, deletes and other paths", async () => {
    const s = env.authenticatedContext("preparer").storage();
    await assertFails(uploadBytes(ref(s, "users/preparer/clients/c1/run.html"), pdf, { contentType: "text/html" }));
    await assertFails(uploadBytes(ref(s, "users/preparer/clients/c1/big.pdf"), new Uint8Array(25 * 1024 * 1024 + 1), { contentType: "application/pdf" }));
    await assertFails(uploadBytes(ref(s, mine), pdf, { contentType: "application/pdf" }));
    await assertFails(deleteObject(ref(s, mine)));
    await assertFails(uploadBytes(ref(s, "public/x.pdf"), pdf, { contentType: "application/pdf" }));
    await assertFails(uploadBytes(ref(s, "users/preparer/x.pdf"), pdf, { contentType: "application/pdf" }));
  });
});
