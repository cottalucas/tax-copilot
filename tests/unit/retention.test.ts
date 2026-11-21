import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RETENTION_DAYS } from "../../src/functions/extract.js";

// SR-28: documents and extracted values are deleted after 30 days at the latest. The bucket rule
// lives in storage-lifecycle.json; infra.yml checks the live bucket matches it before deploying.
describe("retention", () => {
  it("the bucket lifecycle deletes every document after the retention period, and nothing else", () => {
    const lifecycle = JSON.parse(readFileSync("storage-lifecycle.json", "utf8")) as { rule: { action: { type: string }; condition: Record<string, unknown> }[] };
    expect(RETENTION_DAYS).toBe(30);
    expect(lifecycle.rule).toEqual([{ action: { type: "Delete" }, condition: { age: RETENTION_DAYS } }]);
  });

  it("infra.yml checks the bucket and turns on the Firestore expiry for extracted values", () => {
    const infra = readFileSync(".github/workflows/infra.yml", "utf8");
    expect(infra).toContain("storage-lifecycle.json");
    expect(infra).toContain("--collection-group=extraction");
    expect(infra).toContain("expireAt");
  });
});
