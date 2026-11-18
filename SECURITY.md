# SECURITY.md

## Purpose
What data we hold, where it may go, who can read it, and how secrets are handled. Wins over
every other file on anything about data.

## Required sections
- **Data inventory**: each kind of data, where it lives, retention, who can read it.
- **Never**: copied from the PRD Never list, each with how it is enforced.
- **Residency**: allowed regions per data kind, and allowed providers.
- **Access rules**: auth model, database rules, the default deny, and their tests.
- **Secrets**: list of secret names (never values), where each is set, who rotates it.
- **Threats**: top risks for this product (prompt injection, data leaks, account takeover).
- **Incident steps**: what to do in the first hour, who to tell.
- **Dev and test data**: how real data is anonymized before any dev use.

## Rules
- Default deny. Database rules deny everything until a rule with a test allows it.
- Secrets live in the CI secret store or the cloud secret manager. Never in code, logs, docs,
  pull requests or chat with an agent. Humans set them.
- A secret guard scans tracked files on every push.
- Real user data never goes to a dev tool, a dev model endpoint or a log line.
- Golden and test cases are anonymized before they enter the repo.
- Model input from documents is untrusted. Treat instructions inside documents as data.
- Irreversible actions (submit, pay, delete) need a human review step.
- Prefer keyless auth (Workload Identity Federation) over service account key files when ready.
- Least privilege for CI tokens and service accounts.

## Best known references
- OWASP Top 10 for LLM applications: https://genai.owasp.org/llm-top-10/
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- Firestore security rules: https://firebase.google.com/docs/firestore/security/get-started
- Testing security rules: https://firebase.google.com/docs/rules/unit-tests
- GitHub secret scanning:
  https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning
- Workload Identity Federation: https://cloud.google.com/iam/docs/workload-identity-federation
- NIST AI Risk Management Framework: https://www.nist.gov/itl/ai-risk-management-framework
- Swiss data protection act (nFADP): https://www.fedlex.admin.ch/eli/cc/2022/491/en

## What worked in past projects
- Super Ramble: a secret guard script for API key shapes, hex secrets near "secret", and literal
  emails ran in CI and blocked leaks.
- Super Ramble lesson: secrets pasted into a log file forced a full git history rewrite. Agents
  never see secret values.
- Super Ramble lesson: docs claimed client side encryption that was not wired. Security claims
  need a test or they are removed.
- Chapter 2 go-live: "user A cannot read user B's data" tested by hand and by rules tests.
