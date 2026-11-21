import { createServer, type Server } from "node:http";

/**
 * A fake Vertex endpoint for end to end tests (synthetic answers, no model, no network). The
 * functions emulator reaches it through VERTEX_PROXY_URL (.env.demo-tax-copilot), so the real
 * extract function, Storage listing, schema checks, rules and Firestore writes all run.
 */
export const FAKE_VERTEX_PORT = 8799;

export function startFakeVertex(): Promise<Server> {
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { contents?: { parts?: { text?: string; fileData?: { fileUri: string } }[] }[] };
    const parts = (body.contents ?? []).flatMap((c) => c.parts ?? []);
    const text = parts.map((p) => p.text ?? "").join("\n");
    const clientId = /clientId: (\S+)/.exec(text)?.[1] ?? "unknown";
    const taxYear = Number(/taxYear: (\d+)/.exec(text)?.[1] ?? 0);
    const file = /Document file="([^"]+)"/.exec(text)?.[1] ?? "missing.pdf";
    const sent = parts.filter((p) => p.fileData?.fileUri.startsWith("gs://")).length;
    const output = {
      schemaVersion: 1,
      taxpayer: { clientId, taxYear },
      employment: [{ employer: { value: "Synthetic AG", source: { file, page: 1 } }, grossSalary: { value: 76400, source: { file, page: 1 } } }],
      deductions: {},
      bankAccounts: [],
      cantonSpecific: {},
    };
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }],
        usageMetadata: { promptTokenCount: 1000 + sent, candidatesTokenCount: 200 },
      }),
    );
  });
  return new Promise((resolve) => server.listen(FAKE_VERTEX_PORT, "127.0.0.1", () => resolve(server)));
}
