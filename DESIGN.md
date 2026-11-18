# DESIGN.md

## Purpose
How the product looks and behaves, screen by screen. Read before any UI work.
Anti-patterns are rules, not suggestions.

## Required sections
- **Vibe**: three to five words.
- **Screens**: one block per screen, mapped to a task. For each: job, main action, data shown.
- **States**: for every screen: empty, loading, error, partial, success. No blank screens.
- **Flows**: the core flow from the PRD as screen to screen steps.
- **Tokens**: colors (role, value), type scale, spacing scale, radius. Use the design system
  if one exists, else a short list.
- **Components**: the few reused pieces (table row, badge, button, flag card).
- **Copy rules**: link to STYLE.md, plus product words (status names, labels) fixed here.
- **Accessibility**: target WCAG level and the checks we run.
- **Anti-patterns**: what we will not do.
- **Pre-delivery checklist**.

## Rules
- Every screen lists all five states before it is built.
- Status names and labels are defined once here and used word for word in code.
- Expert tools optimise for speed: keyboard first, dense tables, exceptions first.
- Contrast at least 4.5:1 for text. Visible focus. Works at 375, 768, 1024, 1440 px.
- No emoji as icons. No purple gradients. No generic stock look.
- Every value that came from a document can show its source.

## Best known references
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Nielsen Norman, 10 usability heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- Laws of UX: https://lawsofux.com
- Refactoring UI: https://www.refactoringui.com
- Material Design 3: https://m3.material.io
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines

## What worked in past projects
- ai-builder-series: design.md with an anti-pattern list and a pre-delivery checklist kept agent
  UI output out of the generic AI look.
- Super Ramble: comparing our screenshots against a real reference product (docs/reference/)
  found gaps that text descriptions missed. Keep reference screenshots in the repo.
- Super Ramble: each modal state (loading, error, preview, recording) as a full view made
  states explicit and testable.
- Super Ramble lesson: design-system.md reached about 800 lines. Keep tokens and rules here,
  move history to the log.
