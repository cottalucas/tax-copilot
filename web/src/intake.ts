/** Intake rules (SR-17): pure functions, unit tested. */

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 30;
export const NAME_MAX = 80;

export type IntakeError = string;

/** Her label for the client. Not a legal name requirement, just something she recognizes. */
export function validateName(raw: string): { name?: string; error?: IntakeError } {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { error: "Enter a client name." };
  if (name.length > NAME_MAX) return { error: `Use at most ${NAME_MAX} characters.` };
  return { name };
}

export interface FileLike {
  name: string;
  type: string;
  size: number;
}

/** Accepts PDFs only, within size and count limits. Returns the accepted files and one line per rejection. */
export function checkFiles<T extends FileLike>(files: T[]): { accepted: T[]; rejected: string[] } {
  const accepted: T[] = [];
  const rejected: string[] = [];
  for (const f of files) {
    // A declared type must be PDF; only a file with no type falls back to the .pdf name.
    const pdf = f.type === "application/pdf" || (f.type === "" && f.name.toLowerCase().endsWith(".pdf"));
    if (!pdf) rejected.push(`${f.name}: only PDF files.`);
    else if (f.size > MAX_FILE_BYTES) rejected.push(`${f.name}: larger than 25 MB.`);
    else if (accepted.length >= MAX_FILES) rejected.push(`${f.name}: at most ${MAX_FILES} files at once.`);
    else accepted.push(f);
  }
  return { accepted, rejected };
}

/** Folder name in her Drive: "Tax Copilot - <client> - <year>". Drive allows most characters; strip slashes. */
export function folderName(client: string, year: number): string {
  return `Tax Copilot - ${client.replace(/[\\/]/g, "-")} - ${year}`;
}

/** True when the file starts with the PDF signature "%PDF-". Checked before any upload. */
export async function hasPdfHeader(file: Blob): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...head) === "%PDF-";
}
