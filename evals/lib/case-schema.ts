import { z } from "zod";

/** Shape of every eval case file. Offline evals reject a malformed case. */
export const CaseFile = z.object({
  id: z.string().min(1),
  taxYear: z.number().int(),
  documents: z.array(z.object({ file: z.string().min(1), pages: z.array(z.string()).min(1) })).min(1),
  previous: z.unknown().optional(),
  expected: z.object({
    fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
    flags: z.array(z.object({ ruleId: z.string(), field: z.string().optional(), critical: z.boolean().optional() })),
  }),
  predicted: z.unknown().optional(),
});

export const Recording = z.object({
  model: z.string().min(1),
  recordedAt: z.string().min(1),
  /** modelInputsHash() of the code and prompt that produced the output. */
  inputsHash: z.string().length(64),
  output: z.unknown(),
});
