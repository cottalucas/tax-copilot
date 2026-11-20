#!/usr/bin/env node
// Coverage gate (AGENTS.md > Pipeline). Line coverage on src/ must be at least 80%, a fixed floor
// (coverage-floor.json, approved by Lucas on 2026-11-20).
import { existsSync, readFileSync } from "node:fs";

export const FLOOR = 80;

export function evaluate({ actual, floor }) {
  const errors = [];
  if (floor !== FLOOR) errors.push(`coverage-floor.json is ${floor}%. The approved floor is fixed at ${FLOOR}%.`);
  if (actual < FLOOR) errors.push(`Line coverage on src/ is ${actual}%, below the floor of ${FLOOR}%.`);
  return { ok: errors.length === 0, errors };
}

function main() {
  if (!existsSync("coverage/coverage-summary.json")) {
    console.error("coverage/coverage-summary.json missing. Run vitest with --coverage first.");
    process.exit(1);
  }
  const actual = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8")).total.lines.pct;
  const result = evaluate({ actual, floor: JSON.parse(readFileSync("coverage-floor.json", "utf8")).lines });
  if (!result.ok) {
    for (const e of result.errors) console.error(`::error title=coverage::${e}`);
    process.exit(1);
  }
  console.log(`Coverage ${actual}% on src/, floor ${FLOOR}%.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
