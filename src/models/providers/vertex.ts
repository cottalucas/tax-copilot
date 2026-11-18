import { requireEnv } from "../config.js";
import { DataResidencyError } from "../errors.js";
import type { CompletionRequest, CompletionResult, ModelProvider } from "../types.js";

export interface VertexOptions {
  projectId: string;
  region: string;
}

/**
 * Vertex AI in an EU region. The only provider allowed to see real client data.
 * Stub: the real call lands with the first task that sends client data (SR-18).
 * TODO(SR-18): call Claude on Vertex AI in the confirmed EU region.
 */
export class VertexProvider implements ModelProvider {
  readonly name = "vertex" as const;

  constructor(private readonly options: VertexOptions) {
    if (!options.region.startsWith("europe-")) {
      throw new DataResidencyError(
        `VERTEX_REGION must be an EU region (europe-*). Got "${options.region}".`,
      );
    }
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): VertexProvider {
    return new VertexProvider({
      projectId: requireEnv(env, "VERTEX_PROJECT_ID"),
      region: requireEnv(env, "VERTEX_REGION"),
    });
  }

  get region(): string {
    return this.options.region;
  }

  async complete(_request: CompletionRequest & { model: string }): Promise<CompletionResult> {
    throw new Error("Vertex provider is a stub. Implement it in SR-18 before sending client data.");
  }
}
