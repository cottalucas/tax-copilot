# SECURITY.md

Wins over every other file on anything about data. From golden-template/SECURITY.md, filled
from the Product Doc Never list and the setup brief.

## Data inventory
| Data | Lives in | Retention | Who reads it |
| --- | --- | --- | --- |
| Client PDFs | Her Google Drive only | Hers to manage | Her, the engine through the Drive API |
| Client data file (extracted values) | TODO: her Drive next to the PDFs (default) | Hers | Her, fill step |
| Client status, flags, corrections | Firestore, europe location TBC | Until she deletes | Her only |
| Government credentials | Nowhere. She types them per session | Never stored | Nobody |
| Golden cases | `evals/golden/`, anonymized | In repo | Pipeline, dev models |

## Never
| Rule | Enforced by |
| --- | --- |
| Store client documents outside her Drive | Firestore default deny, no Storage bucket, review job, rules tests |
| Store client government credentials | Firestore default deny, rules test on `credentials/*`, review job |
| Submit without her final review | No submit code. Fill stops at draft (SR-21). Human presses submit |
| Real client data outside the EU or to a dev tool | `src/models` dataClass guard, Vertex EU region check, functions in europe-west6 |
| LLM judge for numbers | Eval runner uses exact match only |

## Residency
Functions: europe-west6. Firestore: an EU or Swiss location, confirmed by Lucas (permanent).
Models with client data: Vertex AI, `europe-*` region. Dev models: OpenRouter, anonymized only.

## Access rules
Firebase Auth, one user. `firestore.rules` denies everything. Each allow rule added later comes
with a test in `tests/integration/firestore.rules.test.ts`, including "another user cannot read".

## Secrets
Names only. A human sets values with `gh secret set`. Agents never see values.
| Secret | Used by | Rotate |
| --- | --- | --- |
| ANTHROPIC_API_KEY | claude.yml | Lucas, yearly or on leak |
| OPENAI_API_KEY | pr.yml review | Lucas |
| OPENROUTER_API_KEY | evals | Lucas |
| FIREBASE_SERVICE_ACCOUNT | preview, infra | Lucas. Replace with Workload Identity Federation later |

`npm run check` runs a secret guard on every push (API keys, private keys, AHV numbers, CH IBANs,
emails).

## Threats
- Prompt injection inside client PDFs. The prompt treats document text as data. Output is schema
  validated. Rules are code.
- Data leak to a dev tool or non EU model. Blocked in `src/models`.
- Account takeover of her login. TODO: enforce MFA on her Google account.

## Incident steps
TODO (gap): first hour steps, who to tell, nFADP notification duties.

## Dev and test data
Golden cases anonymized by hand before commit. No real PDFs in the repo or in any dev tool.
