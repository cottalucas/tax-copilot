# Golden set

Anonymized past returns with her final submitted values as truth. Target: 10 to 20 cases.

Rules (EVALS.md, SECURITY.md):
- Anonymize before a file enters this folder. No names, addresses, AHV numbers, IBANs or employer
  names that identify a person. Use ids like `case-001`.
- Real client documents never go here. Only anonymized page text.
- Every correction she makes becomes a new case or a new rule.

One JSON file per case. Shape (see `evals/lib/types.ts`):

```json
{
  "id": "case-001",
  "taxYear": 2025,
  "documents": [{ "file": "salary-statement.pdf", "pages": ["anonymized page 1 text"] }],
  "expected": {
    "fields": { "employment.0.grossSalary": 98000 },
    "flags": [{ "ruleId": "large-salary-change", "critical": false }]
  }
}
```

Before committing a case, run `npm run check`. The secret guard blocks AHV numbers, CH IBANs and
email addresses.

Add `"predicted": { ... }` with a saved extraction to score a case offline, with no model call.
