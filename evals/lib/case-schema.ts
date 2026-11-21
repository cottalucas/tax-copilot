import { z } from "zod";

/** Shape of every eval case file. Offline evals reject a malformed case. */
export const CaseFile = z.object({
  id: z.string().min(1),
  taxYear: z.number().int(),
  /** Text documents. The runner renders each as a text PDF and sends the PDF (SR-28). */
  documents: z.array(z.object({ file: z.string().min(1), pages: z.array(z.string()).min(1) })).min(1).optional(),
  /** Binary documents in evals/media/files (scans, photos). Synthetic only. */
  attachments: z
    .array(
      z.object({
        file: z.string().min(1),
        path: z.string().regex(/^[a-z0-9-]+\.(pdf|jpg|png)$/, "a plain file name in evals/media/files"),
        mimeType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
      }),
    )
    .min(1)
    .optional(),
  previous: z.unknown().optional(),
  expected: z.object({
    fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    flags: z.array(z.object({ ruleId: z.string(), field: z.string().optional(), critical: z.boolean().optional() })),
  }),
  predicted: z.unknown().optional(),
}).refine((c) => (c.documents?.length ?? 0) + (c.attachments?.length ?? 0) > 0, { message: "a case needs documents or attachments", path: ["documents"] });

export const Recording = z.object({
  model: z.string().min(1),
  recordedAt: z.string().min(1),
  /** modelInputsHash() of the code and prompt that produced the output. */
  inputsHash: z.string().length(64),
  output: z.unknown(),
});
