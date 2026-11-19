import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { complete, type AdapterDeps, type DataClass } from "../models/index.js";
import { z } from "zod";
import { ExtractedReturn as ExtractedReturnSchema, parseExtractedReturn, type ExtractedReturn } from "../schema/extraction.js";

export interface DocumentText {
  file: string;
  /** Plain text per page, page 1 first. */
  pages: string[];
}

export interface ExtractOptions extends AdapterDeps {
  dataClass: DataClass;
  model?: string;
  clientId: string;
  taxYear: number;
}

const PROMPT_PATH = fileURLToPath(new URL("../../prompts/extraction.md", import.meta.url));

export function loadExtractionPrompt(): string {
  return readFileSync(PROMPT_PATH, "utf8").replace(/<!--[\s\S]*?-->/g, "").trim();
}

/** Stops document text from closing or opening page tags (prompt injection, AGENTS.md). */
export function neutralize(text: string): string {
  return text.replace(/<(\/?)(page)/gi, "&lt;$1$2");
}

export function renderDocuments(docs: DocumentText[]): string {
  return docs
    .map((d) =>
      d.pages
        .map((text, i) => `<page file="${neutralize(d.file).replace(/"/g, "'")}" page="${i + 1}">\n${neutralize(text)}\n</page>`)
        .join("\n"),
    )
    .join("\n");
}

/** JSON Schema the model must follow, generated from the Zod schema (one source). */
export function extractionJsonSchema(): string {
  return JSON.stringify(z.toJSONSchema(ExtractedReturnSchema, { io: "input" }));
}

/**
 * Extracts one return from document text. Output is schema validated before it is returned.
 * TODO(SR-18): read PDFs from her Drive folder and turn them into DocumentText.
 */
export async function extractReturn(docs: DocumentText[], options: ExtractOptions): Promise<ExtractedReturn> {
  const result = await complete(
    {
      dataClass: options.dataClass,
      model: options.model,
      json: true,
      messages: [
        { role: "system", content: loadExtractionPrompt() },
        {
          role: "user",
          content: `clientId: ${options.clientId}\ntaxYear: ${options.taxYear}\nschemaVersion: 1\n\nJSON Schema:\n${extractionJsonSchema()}\n\nDocuments:\n${renderDocuments(docs)}`,
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
