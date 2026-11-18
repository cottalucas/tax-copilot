# SETUP.md

## Purpose
How a new project goes from Notion docs to a repo ready for coding agents, in two prompts.
Copied from the Notion page "Golden Project Setup". Notion wins if they disagree.

## Required sections (project copy)
- **Project links**: Notion product doc, Linear project, repo, cloud project.
- **Manual steps done**: the checklist below with ticks and dates.
- **Variables and secrets**: names set, never values.

## The two prompt flow
**Prompt 1, setup (agent, unattended):** read Notion project docs and Linear issues. Create the
repo from this template. Fill every .md. Add code scaffolding, stage scripts and workflows.
Push. Open a demo pull request. Write GAPS.md. Hand over the manual steps.

**You:** do the manual steps below. Reply "keys are in".

**Prompt 2, final test (agent):** run infra setup. Open one good and one broken pull request.
Set the branch rule. Confirm the broken one is blocked. Close both. Move the setup issue to Done.

## Who does what
Living list. Goal: move items from You to the agent over time.

**Only you** (identity, billing, browser approval, judgment):
- Create accounts and billing: GitHub, Google Cloud with Firebase on Blaze, Anthropic, OpenAI,
  OpenRouter.
- Log in once to gh, firebase, gcloud.
- Get model API keys. Set secrets per repo with `gh secret set`. Secrets do not copy from the
  template.
- Approve the Claude GitHub app install (`/install-github-app`).
- Linear: connect the GitHub integration and the coding agent.
- Google consent screen, when the product reads Drive or other Google data.
- Enable the model in Vertex Model Garden and accept terms, when the product uses Vertex.
- Decisions: database location (permanent), approve each plan, approve Linear slices, build the
  golden set with the expert.

**Agent:**
- Create the repo from the template, set the template flag and Actions permissions.
- Repository variables (models).
- Context files, folders, stage commands, workflows.
- Branch rules on main.
- Cloud resources: database, auth, functions, hosting, deploys, preview channels.
- Smoke test: one passing and one blocked pull request.
- PROGRESS.md log and Template gaps.

## Rules
- Keys never pass through the agent. You set secrets yourself.
- Every manual step you had to do goes into Template gaps, then FEEDBACK.md.

## Ideas to do less
- Move repos to a free GitHub organization. Set secrets once at org level.
- Workload Identity Federation instead of a service account key.
- One script that pulls keys from a password manager and sets all secrets.

## Best known references
- GitHub template repositories:
  https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-repository-from-a-template
- Claude Code GitHub Actions: https://github.com/anthropics/claude-code-action

## What worked in past projects
- Tax Copilot (first pilot) is the worked example of this flow.
