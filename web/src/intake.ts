/** Intake rules (SR-17, SR-28): pure functions, unit tested. */

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 30;
export const NAME_MAX = 80;

export type IntakeError = string;
export type DocumentType = "application/pdf" | "image/jpeg" | "image/png";

/** Her label for the client. Not a legal name requirement, just something she recognizes. */
export function validateName(raw: string): { name?: string; error?: IntakeError } {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { error: "Enter a client name." };
  if (name.length > NAME_MAX) return { error: `Use at most ${NAME_MAX} characters.` };
  return { name };
}

/** Tax years she can choose from: the last three. She always picks one, nothing is preselected. */
export function taxYearChoices(now: Date): number[] {
  const y = now.getFullYear();
  return [y - 1, y - 2, y - 3];
}

export interface FileLike {
  name: string;
  type: string;
  size: number;
}

const BY_EXTENSION: Record<string, DocumentType> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

/** PDF, JPG or PNG. A declared type must be one of them; only a file with no type falls back to its extension. */
export function documentType(f: FileLike): DocumentType | undefined {
  if (f.type === "application/pdf" || f.type === "image/jpeg" || f.type === "image/png") return f.type;
  if (f.type !== "") return undefined;
  return BY_EXTENSION[f.name.toLowerCase().split(".").pop() ?? ""];
}

/** Accepts PDFs, JPGs and PNGs within size and count limits. Returns the accepted files and one line per rejection. */
export function checkFiles<T extends FileLike>(files: T[]): { accepted: { file: T; type: DocumentType }[]; rejected: string[] } {
  const accepted: { file: T; type: DocumentType }[] = [];
  const rejected: string[] = [];
  for (const f of files) {
    const type = documentType(f);
    if (!type) rejected.push(`${f.name}: only PDF, JPG and PNG files.`);
    else if (f.size > MAX_FILE_BYTES) rejected.push(`${f.name}: larger than 25 MB.`);
    else if (accepted.length >= MAX_FILES) rejected.push(`${f.name}: at most ${MAX_FILES} files at once.`);
    else accepted.push({ file: f, type });
  }
  return { accepted, rejected };
}

/**
 * Checks the file is what it claims before upload: a PDF starts with "%PDF-" and has "%%EOF" in
 * its last 1024 bytes, a JPG starts with FF D8 FF, a PNG with its 8 byte signature. Not a full
 * parser; the model reads the content.
 */
export async function hasValidHeader(file: Blob, type: DocumentType): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const starts = (bytes: number[]) => bytes.every((b, i) => head[i] === b);
  if (type === "image/jpeg") return starts([0xff, 0xd8, 0xff]);
  if (type === "image/png") return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (file.size < 13 || !starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return false;
  const tail = new TextDecoder("latin1").decode(await file.slice(Math.max(0, file.size - 1024)).arrayBuffer());
  return tail.includes("%%EOF");
}

/**
 * One storage name per file, which is also the name every citation uses. No slashes or control
 * characters, at most 120 characters, and unique: a repeat becomes "name (2).pdf".
 */
export function storageNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((raw) => {
    // eslint-disable-next-line no-control-regex
    const name = raw.replace(/[\u0000-\u001f\u007f/\\]/g, "_").slice(-120) || "document";
    const dot = name.lastIndexOf(".") > 0 ? name.lastIndexOf(".") : name.length;
    let label = name;
    for (let n = 2; used.has(label.toLowerCase()); n++) label = `${name.slice(0, dot)} (${n})${name.slice(dot)}`;
    used.add(label.toLowerCase());
    return label;
  });
}
