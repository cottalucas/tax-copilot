/**
 * Google Drive, called from her browser with her own OAuth token (scope drive.file: only files
 * this app creates). Files go straight into her Drive and are stored nowhere else (SR-17).
 */
const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

async function ok(res: Response, what: string) {
  if (!res.ok) throw new Error(`${what} failed (${res.status}).`);
  return res.json() as Promise<{ id: string }>;
}

export async function createFolder(token: string, name: string): Promise<string> {
  const res = await fetch(`${API}?fields=id`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }),
  });
  return (await ok(res, "Creating the Drive folder")).id;
}

/** Drive's multipart upload needs multipart/related: a JSON metadata part, then the file part. */
export function multipartRelated(metadata: object, file: Blob, fileType: string, boundary: string): Blob {
  return new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${fileType}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ]);
}

export async function uploadFile(token: string, folderId: string, file: File): Promise<string> {
  const boundary = `tc${crypto.randomUUID().replace(/-/g, "")}`;
  const res = await fetch(`${UPLOAD}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": `multipart/related; boundary=${boundary}` },
    body: multipartRelated({ name: file.name, parents: [folderId] }, file, "application/pdf", boundary),
  });
  return (await ok(res, `Uploading ${file.name}`)).id;
}
