import { describe, expect, it } from "vitest";
import { checkFiles, folderName, hasPdfHeader, MAX_FILES, validateName } from "../../web/src/intake.js";
import { multipartRelated } from "../../web/src/drive.js";

describe("intake", () => {
  it("cleans the client name and rejects empty or long names", () => {
    expect(validateName("  Ana   Example ")).toEqual({ name: "Ana Example" });
    expect(validateName("   ").error).toBe("Enter a client name.");
    expect(validateName("x".repeat(81)).error).toMatch(/at most 80/);
  });

  it("accepts PDFs only, within 25 MB and the count limit", () => {
    const pdf = (name: string, size = 1000) => ({ name, type: "application/pdf", size });
    const { accepted, rejected } = checkFiles([pdf("a.pdf"), { name: "b.png", type: "image/png", size: 10 }, pdf("c.pdf", 26 * 1024 * 1024), { name: "D.PDF", type: "", size: 5 }]);
    expect(accepted.map((f) => f.name)).toEqual(["a.pdf", "D.PDF"]);
    expect(rejected).toEqual(["b.png: only PDF files.", "c.pdf: larger than 25 MB."]);
    expect(checkFiles(Array.from({ length: MAX_FILES + 1 }, (_, i) => pdf(`${i}.pdf`))).rejected).toHaveLength(1);
    expect(checkFiles([{ name: "fake.pdf", type: "image/png", size: 10 }]).rejected).toEqual(["fake.pdf: only PDF files."]);
  });

  it("checks the PDF signature before upload", async () => {
    expect(await hasPdfHeader(new Blob(["%PDF-1.7 rest"]))).toBe(true);
    expect(await hasPdfHeader(new Blob(["\x89PNG data"]))).toBe(false);
  });

  it("builds Drive's multipart/related body: metadata part, then the file part", async () => {
    const body = await multipartRelated({ name: "a.pdf", parents: ["f1"] }, new Blob(["%PDF-x"]), "application/pdf", "B").text();
    expect(body).toBe('--B\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{"name":"a.pdf","parents":["f1"]}\r\n--B\r\nContent-Type: application/pdf\r\n\r\n%PDF-x\r\n--B--');
  });

  it("names the Drive folder after the client and year, without slashes", () => {
    expect(folderName("Ana/B", 2025)).toBe("Tax Copilot - Ana-B - 2025");
  });
});
