# EVALS.md

## Purpose
The contract for AI output. Acceptance criteria test the software, evals test the model.
Without them every prompt change is a guess.

## Required sections
Names match the Notion Product Doc EVALS section.
- **Golden set**: where cases live (evals/golden/), how many, who wrote the truth, how anonymized.
- **Deterministic checks**: schema valid, required fields present, numbers match the source.
- **Metrics**: each metric with its formula. Typical: field accuracy, flag recall, cost per case.
- **Launch threshold**: the numbers that must pass, written before the first run.
- **Judge**: where an LLM judge is allowed (free text only) and the rubric it uses.
- **Model comparison**: how to run the same set across models and compare.
- **Regression rule**: what happens to every expert correction.
- **When it runs**: link to QA.md.

## Rules
- Deterministic checks first. Code checks beat judges.
- Never use an LLM judge for numbers. Exact match, or a tolerance written in the case.
- Golden cases are anonymized before they enter the repo or any dev tool.
- Every expert correction becomes a new golden case or a new rule with a test.
- The threshold is written before testing and only changes by a dated decision.
- Zero cases is a pass with a loud warning, so the pipeline runs before data exists.
- Evals run only when prompts, schema, rules, the model adapter or the cases change. They cost
  tokens. Nightly runs the full set.
- Record model, provider, cost and latency with every run.

## Best known references
- Hamel Husain, Your AI product needs evals: https://hamel.dev/blog/posts/evals/
- Hamel Husain, Creating an LLM judge that drives results: https://hamel.dev/blog/posts/llm-judge/
- Eugene Yan, task specific evals: https://eugeneyan.com/writing/evals/
- Anthropic, define success criteria and build evaluations:
  https://docs.anthropic.com/en/docs/test-and-evaluate/develop-tests
- OpenAI evals guide: https://platform.openai.com/docs/guides/evals

## What worked in past projects
- Super Ramble: offline evals with no model credits ran on every push and caught regressions
  for free. Split offline checks from live model runs.
- Super Ramble: real traces graded automatically, and a user correction plus a grader flag that
  agreed promoted the case on its own. Corrections are the cheapest source of golden cases.
- Super Ramble: a prompt duplicated in two files needed its own sync check. Keep one prompt
  source.
- Super Ramble lesson: a "fix" for one model parameter broke every live call because the model
  rejected it. Run a small live eval before deploy whenever model settings change.
- Chapter 2: launch threshold of 98% field accuracy and zero missed critical flags gave a clear
  go or no go.
