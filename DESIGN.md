# DESIGN.md

Screens from Linear SR-16 to SR-22. Read before any UI work. Copy rules in STYLE.md.

## Vibe
Calm, dense, Swiss clean. An expert tool, not a consumer app.

## Status names
Fixed here, used word for word in code (`rules/types.ts`):
Documents in · Needs review · Ready to fill · Submitted

## Screens

### 1. Login (SR-16)
Job: get her in. Main action: Sign in with Google (Firebase Auth).
| State | What she sees |
| --- | --- |
| Empty | Product name, one Sign in button |
| Loading | Button disabled, "Signing in" |
| Error | "Sign in failed. Try again." plus the provider reason |
| Success | Redirect to Home queue |

### 2. Home queue (SR-16)
Job: show what needs her next. Main action: open a client. Data: name, status, flag count.
Grouped by status, flagged first.
| State | What she sees |
| --- | --- |
| Empty | "No clients yet" and a New client button |
| Loading | Skeleton rows, no layout shift |
| Error | "Could not load clients." and Retry |
| Partial | Rows loaded, a row with a failed extraction shows "Extraction failed" |
| Success | Groups: Needs review, Documents in, Ready to fill, Submitted |

### 3. New client and intake (SR-17)
Job: get files in place. Main actions: create client, drop PDFs or pick a Drive folder.
| State | What she sees |
| --- | --- |
| Empty | Name field, drop zone, Pick Drive folder |
| Loading | Per file progress, saved to her Drive |
| Error | Per file: "Upload failed" with reason. Drive denied: "Drive access needed" |
| Partial | Some files in, failed ones listed with Retry |
| Success | Status Documents in |

### 4. Extraction progress (SR-18)
Job: show the batch is working. Shown as a status on the queue row and client page.
States: queued, running, failed with reason, done. Never a blank row.

### 5. Review (SR-19, SR-20)
Job: she checks only the exceptions. Order: flags first, then key totals, then changes from last
year. Each value opens its source page. Main action: Approve sets Ready to fill.
| State | What she sees |
| --- | --- |
| Empty | No flags: "No flags. Check totals and approve." |
| Loading | Skeleton sections |
| Error | "Could not load this return." and Retry |
| Partial | Fields that failed schema validation listed as "Not extracted" |
| Success | Flag cards with plain language reason, totals, change list, Approve |

### 6. Fill handoff (SR-21)
Job: start the fill. Main action: Fill now opens one dedicated tab.
States: ready, tab open and filling, fill error with the field that failed, filled with time
taken compared to the 19 minute baseline.

### 7. Done and next client (SR-22)
Job: close the loop fast. Main actions: Mark as submitted, Next client (reuses the same tab).
States: submitting, submitted, error. Corrections saved as eval cases, shown as a count.

## Tokens
Text #1c1917 · Muted #57534e · Background #fafaf9 · Surface #ffffff · Border #e7e5e4 ·
Flag #b91c1c · Focus #1d4ed8. Type: Inter or system sans, 14 px body, 18 px titles.
Spacing scale 4, 8, 16, 24, 32. Radius 6. See `web/src/styles.css`.

## Components
Queue row · Status badge · Flag card · Value with source link · Primary button · Drop zone.

## Accessibility
WCAG 2.2 AA. Contrast 4.5:1. Visible focus. Every action reachable by keyboard.

## Anti-patterns
No emoji as icons. No gradients. No spinners without text. No modal for the main flow. No blank
screens.

## Pre-delivery checklist
- [ ] All five states built for the screen
- [ ] Status names match this file
- [ ] Every extracted value links to its source page
- [ ] Keyboard path works end to end
- [ ] Works at 1024 and 1440 px (desktop first, she works on a laptop)
