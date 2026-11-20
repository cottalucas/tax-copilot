import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Files whose change can change model output. A recording is valid only for this exact set. */
export const MODEL_INPUTS = ["prompts", "src/extraction", "src/models", "src/schema"];

function files(path: string): string[] {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path)
    .flatMap((f) => files(join(path, f)))
    .filter((f) => !f.endsWith(".test.ts"));
}

/** sha256 over the model input files, path and content, in a stable order. */
export function modelInputsHash(root = "."): string {
  const hash = createHash("sha256");
  for (const f of MODEL_INPUTS.flatMap((p) => files(join(root, p))).sort()) {
    hash.update(relative(root, f)).update("\0").update(readFileSync(f)).update("\0");
  }
  return hash.digest("hex");
}
