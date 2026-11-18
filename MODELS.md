# MODELS.md

## Purpose
How the product and the pipeline call models. One adapter, providers and models from variables,
data residency respected.

## Required sections
- **Adapter**: path of the one module every model call goes through, and its interface.
- **Providers**: each provider, what it is for, which data it may see.
- **Variables**: each repository variable and environment variable, with a suggested value.
- **Data residency**: which provider handles real user data, and in which region.
- **Orchestration**: whether a framework is used, and why.
- **Cost**: how cost per call is recorded and capped.

## Rules
- Every model call goes through one adapter. No direct SDK calls elsewhere.
- Provider and model come from variables: `MODEL_PROVIDER`, `APP_MODEL`. Pipeline models:
  `BUILDER_MODEL`, `REVIEWER_MODEL`. Never a model name in code or workflows.
- Keys come from secrets. The adapter fails with a clear error when a key is missing.
- OpenRouter for development and evals, to compare models, cost and routing through one
  OpenAI compatible endpoint.
- Real client data only through a region locked provider (for example Vertex AI in an EU region).
  Never through OpenRouter or any dev tool.
- Structured output is validated with a schema library before it is stored or shown.
- Do not hardcode sampling parameters per model. Some models reject them. Pass only what the
  adapter config sets.
- LangChain, or any orchestration framework, only when a feature needs multi step orchestration.
  Plain calls first.
- Unit tests mock the network. Live calls only in evals.

## Best known references
- OpenRouter quickstart (OpenAI compatible): https://openrouter.ai/docs/quickstart
- Claude on Vertex AI: https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/use-claude
- Vertex AI locations: https://cloud.google.com/vertex-ai/generative-ai/docs/learn/locations
- Anthropic, building effective agents (start simple):
  https://www.anthropic.com/engineering/building-effective-agents
- Anthropic, writing tools for agents: https://www.anthropic.com/engineering/writing-tools-for-agents
- LangChain JS: https://js.langchain.com/docs/introduction/
- OWASP Top 10 for LLM applications: https://genai.owasp.org/llm-top-10/

## What worked in past projects
- Super Ramble: model ids verified live against the provider's docs before pinning them.
- Super Ramble: daily request and cost ceilings per user in one shared limit function kept
  spend bounded across endpoints.
- Super Ramble lesson: setting `temperature: 0` on a model that rejects it broke every live
  request. Parameters belong in config, tested by evals.
- Super Ramble lesson: a raw fetch was simpler than an SDK for a provider that needed multipart.
  The adapter hides that choice from callers.
