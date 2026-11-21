import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { complete, type AdapterDeps, type ContentPart, type DataClass } from "../models/index.js";
import { z } from "zod";
import { ExtractedReturn as ExtractedReturnSchema, parseExtractedReturn, type ExtractedReturn } from "../schema/extraction.js";

/** File types the model reads itself: text PDFs, scanned PDFs, and photos. */
export const DOCUMENT_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * One document for extraction. `file` is the name the model cites as source.file, unique per
 * extraction. The bytes come inline (base64, small synthetic files) or as a gs:// link to the EU
 * bucket. The model reads the document itself, so scans and photos work (SR-28).
 */
export type DocumentFile = { file: string; mimeType: DocumentType } & ({ data: string; uri?: never } | { uri: string; data?: never });

export interface ExtractOptions extends AdapterDeps {
  dataClass: DataClass;
  model?: string;
  clientId: string;
  taxYear: number;
}

export const EXTRACTION_MAX_TOKENS = 2000;

const PROMPT_PATH = fileURLToPath(new URL("../../prompts/extraction.md", import.meta.url));

export function loadExtractionPrompt(): string {
  return readFileSync(PROMPT_PATH, "utf8").replace(/<!--[\s\S]*?-->/g, "").trim();
}

/** A file name the model can cite safely: no quotes, angle brackets or line breaks. */
export function safeName(name: string): string {
  return name.replace(/["<>\r\n]/g, "_").slice(0, 200);
}

/** The user message: request details, then each document introduced by its file name. */
export function documentParts(docs: DocumentFile[], header: string): ContentPart[] {
  const parts: ContentPart[] = [{ type: "text", text: header }];
  for (const d of docs) {
    parts.push({ type: "text", text: `Document file="${safeName(d.file)}" (${d.mimeType === "application/pdf" ? "PDF, pages numbered from 1" : "image, page 1"}):` });
    parts.push(d.uri ? { type: "file", mimeType: d.mimeType, uri: d.uri } : { type: "file", mimeType: d.mimeType, data: d.data! });
  }
  return parts;
}

/** JSON Schema the model must follow, generated from the Zod schema (one source). */
export function extractionJsonSchema(): string {
  return JSON.stringify(z.toJSONSchema(ExtractedReturnSchema, { io: "input" }));
}

/** Extracts one return from the documents themselves. Output is schema validated before it is returned. */
export async function extractReturn(docs: DocumentFile[], options: ExtractOptions): Promise<ExtractedReturn> {
  const result = await complete(
    {
      dataClass: options.dataClass,
      model: options.model,
      json: true,
      // One return is a small JSON object. A cap keeps cost bounded (budgets.json).
      maxTokens: EXTRACTION_MAX_TOKENS,
      messages: [
        { role: "system", content: loadExtractionPrompt() },
        {
          role: "user",
          content: documentParts(
            docs,
            `clientId: ${options.clientId}\ntaxYear: ${options.taxYear}\nschemaVersion: 1\n\nJSON Schema:\n${extractionJsonSchema()}\n\nDocuments follow, each after its file name.`,
          ),
        },
      ],
    },
    options,
  );

  let json: unknown;
  try {
    json = JSON.parse(result.text);
  } catch {
    throw new Error(`Model returned invalid JSON (${result.provider}/${result.model}).`);
  }
  const parsed = parseExtractedReturn(json);
  if (!parsed.success) {
    throw new Error(`Model output failed schema validation: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  return parsed.data;
}
