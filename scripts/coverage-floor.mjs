#!/usr/bin/env node
// Coverage gate (AGENTS.md > Pipeline). Line coverage on src/ must stay at or above the floor in
// coverage-floor.json. The floor is never below 80 and can only go up.
// Usage: node scripts/coverage-floor.mjs [--update]   (--update raises the floor to today's level)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export const MINIMUM = 80;

export function evaluate({ actual, floor, baseFloor }) {
  const errors = [];
  if (floor < MINIMUM) errors.push(`coverage-floor.json is ${floor}%. It may not go below ${MINIMUM}%.`);
  if (baseFloor !== undefined && floor < baseFloor) errors.push(`coverage-floor.json was lowered from ${baseFloor}% to ${floor}%. It can only go up.`);
  if (actual < floor) errors.push(`Line coverage on src/ is ${actual}%, below the floor of ${floor}%.`);
  const raiseTo = Math.floor(actual);
  return { ok: errors.length === 0, errors, raiseTo: raiseTo > floor ? raiseTo : undefined };
}

function baseFloorFromGit() {
  const base = process.env.GITHUB_BASE_REF;
  if (!base) return undefined;
  try {
    return JSON.parse(execFileSync("git", ["show", `origin/${base}:coverage-floor.json`], { encoding: "utf8" })).lines;
  } catch {
    return undefined; // base branch has no floor yet
  }
}

function main() {
  if (!existsSync("coverage/coverage-summary.json")) {
    console.error("coverage/coverage-summary.json missing. Run vitest with --coverage first.");
    process.exit(1);
  }
  const actual = JSON.parse(readFileSync("coverage/coverage-summary.json", "utf8")).total.lines.pct;
  const floorFile = JSON.parse(readFileSync("coverage-floor.json", "utf8"));
  const result = evaluate({ actual, floor: floorFile.lines, baseFloor: baseFloorFromGit() });
  if (process.argv.includes("--update") && result.raiseTo) {
    writeFileSync("coverage-floor.json", JSON.stringify({ ...floorFile, lines: result.raiseTo }, null, 2) + "\n");
    console.log(`Raised the coverage floor to ${result.raiseTo}%. Commit coverage-floor.json.`);
    return;
  }
  if (!result.ok) {
    for (const e of result.errors) console.error(`::error title=coverage::${e}`);
    process.exit(1);
  }
  console.log(`Coverage ${actual}% on src/, floor ${floorFile.lines}%.`);
  if (result.raiseTo) console.log(`::notice title=coverage::Coverage is above the floor. Raise it with: node scripts/coverage-floor.mjs --update`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
