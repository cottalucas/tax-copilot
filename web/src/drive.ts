/**
 * Google Drive, called from her browser with her own OAuth token (scope drive.file: only files
 * this app creates). Files go straight into her Drive and are stored nowhere else (SR-17).
 */
const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

async function ok<T = { id: string }>(res: Response, what: string): Promise<T> {
  if (!res.ok) throw new Error(`${what} failed (${res.status}).`);
  return res.json() as Promise<T>;
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

export async function uploadFile(token: string, folderId: string, file: Blob, name: string, fileType: string): Promise<string> {
  const boundary = `tc${crypto.randomUUID().replace(/-/g, "")}`;
  const res = await fetch(`${UPLOAD}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": `multipart/related; boundary=${boundary}` },
    body: multipartRelated({ name, parents: [folderId] }, file, fileType, boundary),
  });
  return (await ok(res, `Uploading ${name}`)).id;
}

/** Escapes a value for a Drive search query. Ids come from Drive, quotes escaped anyway. */
function q(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

/** Drive search query for the PDFs in one folder. */
export function pdfQuery(folderId: string): string {
  return `${q(folderId)} in parents and mimeType='application/pdf' and trashed=false`;
}

/** Drive search query for one file by name in one folder. */
export function nameQuery(folderId: string, name: string): string {
  return `${q(folderId)} in parents and name=${q(name)} and trashed=false`;
}

/**
 * Saves a JSON file in the folder. If a file with that name is already there (a retry after a
 * failed save), it is overwritten, so a retry never leaves a second copy.
 */
export async function saveJsonFile(token: string, folderId: string, name: string, json: string): Promise<string> {
  const params = new URLSearchParams({ q: nameQuery(folderId, name), fields: "files(id)", pageSize: "1" });
  const found = await fetch(`${API}?${params}`, { headers: { authorization: `Bearer ${token}` } });
  const existing = (await ok<{ files?: { id: string }[] }>(found, `Looking for ${name}`)).files?.[0]?.id;
  const body = new Blob([json], { type: "application/json" });
  if (!existing) return uploadFile(token, folderId, body, name, "application/json");
  const boundary = `tc${crypto.randomUUID().replace(/-/g, "")}`;
  const res = await fetch(`${UPLOAD}/${encodeURIComponent(existing)}?uploadType=multipart&fields=id`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": `multipart/related; boundary=${boundary}` },
    body: multipartRelated({}, body, "application/json", boundary),
  });
  return (await ok(res, `Saving ${name}`)).id;
}

export async function listPdfs(token: string, folderId: string): Promise<{ id: string; name: string }[]> {
  const params = new URLSearchParams({ q: pdfQuery(folderId), fields: "files(id,name)", pageSize: "100", orderBy: "name" });
  const res = await fetch(`${API}?${params}`, { headers: { authorization: `Bearer ${token}` } });
  return (await ok<{ files?: { id: string; name: string }[] }>(res, "Listing the client's files")).files ?? [];
}

export async function downloadFile(token: string, fileId: string): Promise<ArrayBuffer> {
  const res = await fetch(`${API}/${encodeURIComponent(fileId)}?alt=media`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Download failed (${res.status}).`);
  return res.arrayBuffer();
}
