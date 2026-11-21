import { STATUS_LABELS, STATUSES, type Status } from "../../rules/types.js";

export interface QueueClient {
  id: string;
  displayName: string;
  status: Status;
  flagCount: number;
  /** Her Drive folder for this client (SR-17). */
  driveFolderId?: string;
  /** True once the data file is saved in her Drive (SR-18). */
  extracted: boolean;
}

export interface QueueGroup {
  status: Status;
  label: string;
  clients: QueueClient[];
}

/** Order of groups on the home queue (DESIGN.md): what needs her first. */
export const GROUP_ORDER: readonly Status[] = ["needs_review", "documents_in", "ready_to_fill", "submitted"];

/** Keeps only well formed client documents; anything else is dropped, never shown half read. */
export function toQueueClient(id: string, data: Record<string, unknown>): QueueClient | undefined {
  const status = data.status as Status;
  if (typeof data.displayName !== "string" || !STATUSES.includes(status)) return undefined;
  const flags = typeof data.flagCount === "number" && data.flagCount > 0 ? Math.floor(data.flagCount) : 0;
  const folder = typeof data.driveFolderId === "string" && data.driveFolderId ? data.driveFolderId : undefined;
  const extracted = typeof data.dataFileId === "string" && data.dataFileId.length > 0;
  return { id, displayName: data.displayName, status, flagCount: flags, ...(folder ? { driveFolderId: folder } : {}), extracted };
}

/** Groups clients by status, flagged clients first in each group, then by name. Empty groups are left out. */
export function groupQueue(clients: QueueClient[]): QueueGroup[] {
  return GROUP_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    clients: clients
      .filter((c) => c.status === status)
      .sort((a, b) => b.flagCount - a.flagCount || a.displayName.localeCompare(b.displayName)),
  })).filter((g) => g.clients.length > 0);
}
