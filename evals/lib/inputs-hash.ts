import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

/** Files whose change can change model output. A recording is valid only for this exact set. */
export const MODEL_INPUTS = ["prompts", "src/extraction", "src/models", "src/schema"];

/**
 * Lists regular files under path. Rejects symlinks and anything outside root: the trusted live
 * eval job hashes pull request files on a host that holds a Google token.
 */
export function safeFiles(root: string, path: string): string[] {
  const top = realpathSync(resolve(root));
  const abs = resolve(top, relative(resolve(root), resolve(path)));
  if (abs !== top && !abs.startsWith(top + sep)) throw new Error(`Path outside the checkout: ${path}`);
  const st = lstatSync(abs);
  if (st.isSymbolicLink()) throw new Error(`Symlink not allowed: ${relative(top, abs)}`);
  // A symlink in any parent folder (for example src) changes the real path: reject it too.
  if (realpathSync(abs) !== abs) throw new Error(`Symlink not allowed in the path: ${relative(top, abs)}`);
  if (st.isFile()) return [abs];
  if (!st.isDirectory()) return [];
  return readdirSync(abs).flatMap((f) => safeFiles(root, join(abs, f)));
}

/** sha256 over the model input files, path and content, in a stable order. */
export function modelInputsHash(root = "."): string {
  const hash = createHash("sha256");
  const top = realpathSync(resolve(root));
  const list = MODEL_INPUTS.flatMap((p) => safeFiles(top, join(top, p))).filter((f) => !f.endsWith(".test.ts"));
  for (const f of list.sort()) {
    hash.update(relative(top, f)).update("\0").update(readFileSync(f)).update("\0");
  }
  return hash.digest("hex");
}
