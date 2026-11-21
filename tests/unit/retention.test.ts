import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { expiryFor, FILES_DELETE_AFTER_DAYS, RETENTION_DAYS, VALUES_EXPIRE_AFTER_DAYS } from "../../src/functions/extract.js";

// SR-28: documents and extracted values are deleted after 30 days at the latest. The bucket rule
// lives in storage-lifecycle.json; infra.yml checks the live bucket matches it before deploying.
describe("retention", () => {
  it("both background deletions are scheduled with a day of margin, values before documents", () => {
    const lifecycle = JSON.parse(readFileSync("storage-lifecycle.json", "utf8")) as { rule: { action: { type: string }; condition: Record<string, unknown> }[] };
    expect(lifecycle.rule).toEqual([{ action: { type: "Delete" }, condition: { age: FILES_DELETE_AFTER_DAYS } }]);
    // Each acts within about a day of its deadline: documents by day 29, values by day 28.
    expect(FILES_DELETE_AFTER_DAYS + 1).toBeLessThan(RETENTION_DAYS);
    expect(VALUES_EXPIRE_AFTER_DAYS).toBeLessThan(FILES_DELETE_AFTER_DAYS);
    const upload = new Date("2026-03-01T00:00:00Z");
    expect(expiryFor([{ created: upload }], new Date("2026-03-02T00:00:00Z"))).toEqual(new Date("2026-03-28T00:00:00Z"));
  });

  it("rules cut access on schedule, whatever the background jobs do", () => {
    expect(readFileSync("storage.rules", "utf8")).toContain(`request.time < resource.timeCreated + duration.value(${FILES_DELETE_AFTER_DAYS}, 'd')`);
    expect(readFileSync("firestore.rules", "utf8")).toContain("resource.data.expireAt > request.time");
  });

  it("infra.yml checks the bucket and turns on the Firestore expiry for extracted values", () => {
    const infra = readFileSync(".github/workflows/infra.yml", "utf8");
    expect(infra).toContain("storage-lifecycle.json");
    expect(infra).toContain("--collection-group=extraction");
    expect(infra).toContain("expireAt");
  });
});
