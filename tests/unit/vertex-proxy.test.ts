import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error plain JS script without types
import { allowedPath, costOf, createProxy } from "../../scripts/vertex-proxy.mjs";

const cfg = { project: "p", region: "eu", model: "m" };
const path = "/v1/projects/p/locations/eu/publishers/google/models/m:generateContent";
let close: (() => void) | undefined;
afterEach(() => close?.());

async function start(maxCalls = 2, upstreamBody: unknown = { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }) {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify(upstreamBody), { status: 200 }));
  const { server, state } = createProxy({ ...cfg, upstream: "https://up", getToken: async () => "secret-token", fetchImpl, maxCalls, maxUsd: 1 });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  close = () => server.close();
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (p: string, body: unknown) => fetch(url + p, { method: "POST", body: JSON.stringify(body) });
  return { post, fetchImpl, state };
}

describe("vertex proxy", () => {
  it("allows only the configured model and location", () => {
    expect(allowedPath(path, cfg)).toBe(true);
    expect(allowedPath(path.replace(":generateContent", ":streamGenerateContent"), cfg)).toBe(false);
    expect(allowedPath("/v1/projects/p/locations/global/publishers/google/models/m:generateContent", cfg)).toBe(false);
  });

  it("adds the token upstream, never to the caller, and caps calls", async () => {
    const { post, fetchImpl } = await start(1);
    const ok = await post(path, { generationConfig: { maxOutputTokens: 100 } });
    expect(ok.status).toBe(200);
    expect(JSON.stringify(await ok.json())).not.toContain("secret-token");
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe(`https://up${path}`);
    expect((call[1].headers as Record<string, string>).authorization).toBe("Bearer secret-token");
    expect((await post(path, { generationConfig: { maxOutputTokens: 100 } })).status).toBe(429);
  });

  it("rejects other paths and missing or large output caps", async () => {
    const { post, fetchImpl } = await start();
    expect((await post("/v1/other", {})).status).toBe(403);
    expect((await post(path, {})).status).toBe(400);
    expect((await post(path, { generationConfig: { maxOutputTokens: 9000 } })).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("prices calls, and treats an unknown price as spent", () => {
    expect(costOf({ promptTokenCount: 1e6, candidatesTokenCount: 0 }, { input: 0.275, output: 1.65 })).toBeCloseTo(0.275);
    expect(costOf({ promptTokenCount: 1 }, undefined)).toBeUndefined();
  });
});
