---
version: alpha
name: Tax Copilot
description: "A calm, dense, light work surface for one professional tax preparer. Based on the Linear analysis in VoltAgent/awesome-design-md (single lavender accent, hairline borders, dense type), moved to a light canvas for long reading sessions next to PDFs. Red appears only on flags."
colors:
  primary: "#5e6ad2"
  on-primary: "#ffffff"
  primary-hover: "#4f5bc4"
  focus: "#5e6ad2"
  canvas: "#f7f8f8"
  surface: "#ffffff"
  surface-sunken: "#f1f2f4"
  ink: "#1b1c1f"
  ink-muted: "#3c4149"
  ink-subtle: "#5f636b"
  hairline: "#e3e4e8"
  hairline-strong: "#cfd1d6"
  flag-critical: "#b4232a"
  flag-warning: "#9a5b00"
  success: "#1f7a36"
typography:
  title:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: -0.2px
  section:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: -0.1px
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
  body-strong:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: 0px
  table:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0px
    fontFeature: "'tnum' 1"
  label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: 0.2px
  button:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0px
  mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0px
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
components:
  page:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  divider:
    backgroundColor: "{colors.hairline}"
    height: 1px
  input-outline:
    backgroundColor: "{colors.hairline-strong}"
    height: 1px
  focus-ring:
    backgroundColor: "{colors.focus}"
    width: 2px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 6px 12px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.sm}"
    padding: 6px 12px
  queue-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.table}"
    padding: 8px 12px
  status-badge:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 2px 8px
  flag-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 12px 16px
  flag-badge-critical:
    backgroundColor: "{colors.flag-critical}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  flag-badge-warning:
    backgroundColor: "{colors.flag-warning}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  status-badge-submitted:
    backgroundColor: "{colors.success}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
  source-link:
    textColor: "{colors.primary}"
    typography: "{typography.table}"
  drop-zone:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: 24px
---

# DESIGN.md

Format: [Google Labs DESIGN.md spec](https://github.com/google-labs-code/design.md) (alpha). Tokens
in the front matter are normative. Base: Linear analysis from
[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) (MIT), adapted.
Screens come from Linear issues SR-16 to SR-22. Lint with `npm run check:design`.

## Overview
An expert tool for one tax preparer who checks about 11 returns a day. It should feel calm,
dense and exact: more spreadsheet than marketing page. Exceptions first, everything else quiet.
Every number can show where it came from. Desktop first: she works on a laptop at 1024 to 1440 px.

## Colors
- **Ink (#1b1c1f)** for text and numbers. **Ink muted** and **ink subtle** for labels and metadata.
- **Canvas (#f7f8f8)** behind everything, **surface (#ffffff)** for tables and cards, **hairline
  (#e3e4e8)** borders instead of shadows.
- **Primary lavender (#5e6ad2)** is the one accent: primary buttons, focus rings, source links.
- **Flag critical (#b4232a)** and **flag warning (#9a5b00)** appear only on flags. **Success
  (#1f7a36)** only on Submitted.

## Typography
Inter for everything, JetBrains Mono for ids and file names. Body 14 px, tables 13 px with tabular
figures so amounts line up. Titles stay small (18 px). Weight, not size, carries hierarchy.

## Layout
4 px base grid, spacing scale 4 to 32. Content max width 1200 px. Tables are full width with 8 px
vertical row padding. The review screen uses two columns: values on the left, source page on the
right.

## Elevation & Depth
Flat. Hairline borders separate surfaces. One shadow only, for menus and the source page panel.

## Shapes
Small radii: 6 px buttons and inputs, 8 px cards, full radius for badges.

## Motion & Micro-interaction
120 ms ease-out for hover and focus, 200 ms ease-in-out for panels. Motion is prose only: the
spec has no motion token key in this linter version. No motion on numbers. Respect reduced motion.

## Voice & Content Strategy
Plain, short, exact. Load the `stop-slop` skill before writing copy. Status names are fixed and
used word for word in code (`rules/types.ts`): Documents in, Needs review, Ready to fill,
Submitted. Flag reasons are one plain sentence that says what to check. Errors say what happened
and what to do next.

## Components
Queue row, status badge, flag card, critical flag badge, source link, drop zone, primary and
secondary buttons. Tokens in the front matter. Every clickable element has a visible focus ring.

## Do's and Don'ts
Do:
- Show all five states for every screen: empty, loading, error, partial, success.
- Put flags first, then key totals, then changes from last year.
- Link every extracted value to its source page.
- Keep every action reachable by keyboard. WCAG 2.2 AA, text contrast at least 4.5:1.

Don't:
- No emoji as icons, no gradients, no illustrations.
- No spinner without text, no blank screens, no modal for the main flow.
- No red outside flags. No second accent color.

## Screens and states
| Screen (issue) | Job and main action | Empty | Loading | Error | Partial | Success |
| --- | --- | --- | --- | --- | --- | --- |
| Login (SR-16) | Get her in. Sign in with Google | Name and one button | Button disabled, "Signing in" | "Sign in failed. Try again." | n/a | Home queue |
| Home queue (SR-16) | What needs her next. Open a client | "No clients yet", New client | Skeleton rows | "Could not load clients." Retry | Row shows "Extraction failed" | Groups by status, flagged first |
| New client and intake (SR-28) | Files in place. Drop PDFs, scans or photos | Name field, tax year (no default), drop zone | Per file progress, then "Reading the documents" | Per file reason | Failed upload: Try again (no file twice). Failed reading: client kept, Extract all retries | Status Documents in, Data Extracted |
| Extraction progress (SR-18) | Show the batch works | Queued | Running | Failed with reason | Some documents done | Done |
| Review (SR-19, SR-20) | Check only exceptions. Approve | "No flags. Check totals and approve." | Skeleton sections | "Could not load this return." Retry | "Not extracted" fields listed | Flags, totals, changes, Approve |
| Fill handoff (SR-21) | Start the fill. Fill now | Ready | Tab open, filling | Field that failed | Some fields filled | Filled, time vs 19 min |
| Done and next client (SR-22) | Close the loop. Mark as submitted, Next client | n/a | Submitting | Reason and Retry | n/a | Submitted, corrections count |
