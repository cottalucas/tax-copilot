# MODELS.md

From golden-template/MODELS.md, filled for Tax Copilot.

## Adapter
`src/models/index.ts`, function `complete(request, deps?)`. Every model call goes through it.
ESLint blocks importing `openai`, `@anthropic-ai/sdk` or `@google-cloud/vertexai` anywhere else.

Request: `messages`, `dataClass` ("anonymized" or "client"), optional `json`, `maxTokens`,
`model` (override, used by evals). Result: `text`, `provider`, `model`, `latencyMs`, `usage`.

## Providers
| Provider | File | Use | May see |
| --- | --- | --- | --- |
| openrouter | `src/models/providers/openrouter.ts` | Dev and evals, model comparison | Anonymized data only |
| vertex | `src/models/providers/vertex.ts` (stub) | Production extraction | Real client data, EU region only |

The adapter refuses `dataClass: "client"` for any provider except vertex. Vertex refuses any
region that does not start with `europe-`.

## Variables
| Name | Kind | Where | Suggested value |
| --- | --- | --- | --- |
| MODEL_PROVIDER | Repo variable, env | App and evals | `openrouter` (set 2026-11-19) |
| APP_MODEL | Repo variable, env | App and evals | `anthropic/claude-sonnet-5.5` (set 2026-11-19) |
| EVAL_MODELS | Repo variable, optional | Evals | `anthropic/claude-sonnet-5.5,google/gemini-3.8-flash` (set 2026-11-19) |
| BUILDER_MODEL | Repo variable | claude.yml | `claude-opus-5-5` (set 2026-11-19) |
| REVIEWER_MODEL | Repo variable | pr.yml review | `gpt-6.2-sol` (set 2026-11-19) |
| OPENROUTER_API_KEY | Secret | Evals | Set by a human |
| ANTHROPIC_API_KEY | Secret | claude.yml | Set by a human |
| OPENAI_API_KEY | Secret | review | Set by a human |
| VERTEX_PROJECT_ID, VERTEX_REGION | Env (later) | Production | Region to confirm, `europe-*` |

## Data residency
Real client data only through Vertex AI in an EU region (Claude on Vertex). Check Claude
availability per EU region before choosing VERTEX_REGION. OpenRouter never sees client data.

## Orchestration
None. Plain calls. LangChain only when a feature needs multi step orchestration.

## Cost
The adapter returns token usage and latency per call. TODO (SR-18): write per call cost to the
eval report and set a daily cap in the engine.
