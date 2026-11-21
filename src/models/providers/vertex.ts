import { GoogleAuth } from "google-auth-library";
import { requireEnv } from "../config.js";
import { DataResidencyError } from "../errors.js";
import { priceUsd } from "../prices.js";
import type { ChatMessage, CompletionRequest, CompletionResult, ModelProvider } from "../types.js";

/** EU multi-region ("eu") or a single EU region ("europe-*"). Never global or outside the EU. */
export function isEuLocation(region: string): boolean {
  return region === "eu" || region.startsWith("europe-");
}

export interface VertexOptions {
  projectId: string;
  region: string;
  /** Returns an OAuth access token. Default: keyless Google login (ADC, Workload Identity in CI). */
  getAccessToken?: () => Promise<string>;
  /** Injected in tests to mock the network. */
  fetch?: typeof globalThis.fetch;
  /** Base URL override, used only for the trusted live eval proxy. */
  endpoint?: string;
  /** Waits between retries. Injected in tests. */
  sleep?: (ms: number) => Promise<void>;
}

/** Busy answers worth a retry: rate limit (429) and unavailable (503). At most 2 retries, 2 s then 6 s. */
export const RETRY_STATUSES = [429, 503];
export const RETRY_DELAYS_MS = [2000, 6000];

/**
 * Gemini on Vertex AI, EU multi-region or an EU regional endpoint only. The only provider allowed to see
 * real client data, as decided on 2026-11-21 (ARCHITECTURE.md > Data inventory and residency).
 * Gemini caches repeated prompt prefixes on its own and reports cached tokens.
 */
export class VertexProvider implements ModelProvider {
  readonly name = "vertex" as const;
  private readonly getToken: () => Promise<string>;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(private readonly options: VertexOptions) {
    if (!isEuLocation(options.region)) {
      throw new DataResidencyError(`VERTEX_REGION must be "eu" or an EU region (europe-*). Got "${options.region}".`);
    }
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.getToken =
      options.getAccessToken ??
      (async () => {
        const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
        const token = await (await auth.getClient()).getAccessToken();
        if (!token.token) throw new Error("No Google access token. Log in with gcloud or Workload Identity.");
        return token.token;
      });
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): VertexProvider {
    // VERTEX_PROXY_URL: live evals on pull requests run in a container without credentials and
    // reach Vertex only through the trusted proxy (scripts/vertex-proxy.mjs), which adds the token.
    const proxy = (env.VERTEX_PROXY_URL ?? "").trim();
    return new VertexProvider({
      projectId: requireEnv(env, "VERTEX_PROJECT_ID"),
      region: requireEnv(env, "VERTEX_REGION"),
      ...(proxy ? { endpoint: proxy, getAccessToken: async () => "via-proxy" } : {}),
    });
  }

  get region(): string {
    return this.options.region;
  }

  url(model: string): string {
    const { projectId, region } = this.options;
    // "eu" is the EU multi-region endpoint: data stays in the EU, newer Gemini models serve there.
    const host = region === "eu" ? "aiplatform.eu.rep.googleapis.com" : `${region}-aiplatform.googleapis.com`;
    const base = this.options.endpoint ?? `https://${host}`;
    return `${base}/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;
  }

  async complete(request: CompletionRequest & { model: string }): Promise<CompletionResult> {
    const started = Date.now();
    const system = request.messages.filter((m) => m.role === "system").map((m) => textOf(m.content)).join("\n\n");
    const body = {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: request.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: toParts(m.content) })),
      generationConfig: {
        ...(request.maxTokens ? { maxOutputTokens: request.maxTokens } : {}),
        ...(request.json ? { responseMimeType: "application/json" } : {}),
      },
    };
    const sleep = this.options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    let res: Response;
    for (let attempt = 0; ; attempt++) {
      res = await this.fetchImpl(this.url(request.model), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${await this.getToken()}` },
        body: JSON.stringify(body),
      });
      const delay = RETRY_DELAYS_MS[attempt];
      if (!RETRY_STATUSES.includes(res.status) || delay === undefined) break;
      await sleep(delay);
    }
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number; thoughtsTokenCount?: number };
      modelVersion?: string;
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(`Vertex AI error ${res.status}: ${json.error?.message ?? "unknown"}`);
    const m = json.usageMetadata;
    const usage = m
      ? {
          inputTokens: m.promptTokenCount ?? 0,
          outputTokens: (m.candidatesTokenCount ?? 0) + (m.thoughtsTokenCount ?? 0),
          cachedInputTokens: m.cachedContentTokenCount ?? 0,
        }
      : undefined;
    return {
      text: (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join(""),
      provider: this.name,
      model: request.model,
      latencyMs: Date.now() - started,
      usage,
      costUsd: priceUsd(this.name, request.model, usage),
    };
  }
}

function textOf(content: ChatMessage["content"]): string {
  return typeof content === "string" ? content : content.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n");
}

function toParts(content: ChatMessage["content"]) {
  if (typeof content === "string") return [{ text: content }];
  return content.map((p) => {
    if (p.type === "text") return { text: p.text };
    if (p.type === "file") return p.uri ? { fileData: { mimeType: p.mimeType, fileUri: p.uri } } : { inlineData: { mimeType: p.mimeType, data: p.data } };
    const [, mimeType = "image/png", data = ""] = /^data:([^;]+);base64,(.*)$/.exec(p.dataUrl) ?? [];
    return { inlineData: { mimeType, data } };
  });
}
