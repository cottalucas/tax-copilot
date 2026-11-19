#!/usr/bin/env node
// Secret guard (AGENTS.md > Never do). Scans git tracked files for secret shaped and PII shaped content.
// Lesson from Super Ramble: secrets in a log file forced a git history rewrite.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS = [
  ["Google API key", /AIza[0-9A-Za-z_-]{35}/g],
  ["OpenAI style key", /\bsk-(?:proj-|or-v1-|ant-)?[A-Za-z0-9_-]{20,}/g],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{36,}/g],
  ["Private key block", /-----BEGIN (?:RSA |EC |)PRIVATE KEY-----/g],
  ["Service account private_key", /"private_key"\s*:\s*"-----BEGIN/g],
  ["Swiss AHV number", /\b756\.\d{4}\.\d{4}\.\d{2}\b/g],
  ["IBAN (CH/LI)", /\b(?:CH|LI)\d{2}(?: ?[0-9A-Z]{4}){4}(?: ?[0-9A-Z]{1})\b/g],
];
const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const EMAIL_ALLOW = [/@example\.(com|org)$/i, /@anthropic\.com$/i, /@users\.noreply\.github\.com$/i, /gserviceaccount\.com$/i];
const SKIP = new Set(["package-lock.json"]);

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && !SKIP.has(f.split("/").pop()));

const failures = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const [name, re] of PATTERNS) {
    for (const m of text.matchAll(re)) failures.push(`${file}: ${name} (${m[0].slice(0, 8)}...)`);
  }
  for (const m of text.matchAll(EMAIL)) {
    if (!EMAIL_ALLOW.some((re) => re.test(m[0]))) failures.push(`${file}: email address (use name@example.com)`);
  }
}

if (failures.length) {
  console.error("Secret guard failed:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log(`Secret guard: ${files.length} files clean.`);
