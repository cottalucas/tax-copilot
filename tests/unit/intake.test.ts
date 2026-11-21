import { describe, expect, it } from "vitest";
import { checkFiles, documentType, hasValidHeader, MAX_FILES, storageNames, taxYearChoices, validateName } from "../../web/src/intake.js";

describe("intake", () => {
  it("cleans the client name and rejects empty or long names", () => {
    expect(validateName("  Ana   Example ")).toEqual({ name: "Ana Example" });
    expect(validateName("   ").error).toBe("Enter a client name.");
    expect(validateName("x".repeat(81)).error).toMatch(/at most 80/);
  });

  it("offers the last three tax years, nothing preselected", () => {
    expect(taxYearChoices(new Date("2026-03-01"))).toEqual([2025, 2024, 2023]);
  });

  it("accepts PDFs, JPGs and PNGs, within 25 MB and the count limit", () => {
    const f = (name: string, type: string, size = 1000) => ({ name, type, size });
    const { accepted, rejected } = checkFiles([
      f("a.pdf", "application/pdf"),
      f("photo.jpg", "image/jpeg"),
      f("scan.png", "image/png"),
      f("b.gif", "image/gif"),
      f("c.pdf", "application/pdf", 26 * 1024 * 1024),
      f("D.PDF", ""),
      f("E.JPEG", ""),
    ]);
    expect(accepted.map((a) => [a.file.name, a.type])).toEqual([
      ["a.pdf", "application/pdf"],
      ["photo.jpg", "image/jpeg"],
      ["scan.png", "image/png"],
      ["D.PDF", "application/pdf"],
      ["E.JPEG", "image/jpeg"],
    ]);
    expect(rejected).toEqual(["b.gif: only PDF, JPG and PNG files.", "c.pdf: larger than 25 MB."]);
    expect(checkFiles(Array.from({ length: MAX_FILES + 1 }, (_, i) => f(`${i}.pdf`, "application/pdf"))).rejected).toHaveLength(1);
    // A declared type wins over the name.
    expect(documentType(f("fake.pdf", "text/html"))).toBeUndefined();
  });

  it("checks the file is what it claims before upload", async () => {
    expect(await hasValidHeader(new Blob(["%PDF-1.7\n1 0 obj\nendobj\n%%EOF\n"]), "application/pdf")).toBe(true);
    expect(await hasValidHeader(new Blob(["%PDF-"]), "application/pdf")).toBe(false);
    expect(await hasValidHeader(new Blob(["%PDF-1.7 truncated without end marker"]), "application/pdf")).toBe(false);
    expect(await hasValidHeader(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])]), "image/jpeg")).toBe(true);
    expect(await hasValidHeader(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]), "image/png")).toBe(true);
    expect(await hasValidHeader(new Blob(["%PDF-1.7 %%EOF"]), "image/png")).toBe(false);
    expect(await hasValidHeader(new Blob([new Uint8Array([0x89, 0x50])]), "image/jpeg")).toBe(false);
  });

  it("gives each file one safe, unique storage name, which citations use", () => {
    expect(storageNames(["a.pdf", "b.pdf", "a.pdf", "A.pdf", "x/y\\z.jpg", "", "noext", "noext"])).toEqual([
      "a.pdf",
      "b.pdf",
      "a (2).pdf",
      "A (3).pdf",
      "x_y_z.jpg",
      "document",
      "noext",
      "noext (2)",
    ]);
    expect(storageNames(["x".repeat(200) + ".pdf"])[0]).toHaveLength(120);
  });
});
