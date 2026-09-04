#!/usr/bin/env node
// Enforces the COMPAT tagging rule that docs/protocol-compatibility.md already states:
// every shim tag carries a name plus a removal date or a removal condition.
//
// Reason: `rg "COMPAT\("` is meant to be the cleanup backlog. A tag with no removal
// date and no removal condition never leaves the backlog, because nothing says when it
// is done. The baseline below records the tags that predate this gate; the gate only
// stops new ones from being added.
//
// Review trigger: when the baseline reaches zero, delete it and the --update flag, and
// make the check unconditional. Rollback: delete this script and its CI line.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASELINE_URL = new URL("./compat-expiry-baseline.json", import.meta.url);
const SOURCE_EXTENSIONS = /\.(?:ts|tsx|mjs|cjs|js|jsx)$/u;
const TAG_PATTERN = /COMPAT\(([^)\s]+)\)/gu;
const COMMENT_CONTINUATION = /^(?:\/\/|\*|\/\*)/u;
const REMOVAL_DATE = /\d{4}-\d{2}-\d{2}/u;
const REMOVAL_CONDITION =
  /\b(?:remove|removed|removal|delete|drop|retire|unpin|collapse)\b[^.;]{0,120}?\b(?:after|when|once|until|as soon as)\b/iu;
// A line that points at a tag defined elsewhere is a cross-reference, not a tag site.
const CROSS_REFERENCE = /\b(?:see|per|matches|mirrors|paired with|companion to)\s+COMPAT\(/iu;
// This checker and its tests carry COMPAT-shaped literals and fixtures on purpose.
const SELF_EXCLUDED = new Set([
  "scripts/check-compat-expiry.mjs",
  "scripts/check-compat-expiry.test.mjs",
]);

export function hasRemovalPlan(block) {
  return REMOVAL_DATE.test(block) || REMOVAL_CONDITION.test(block);
}

export function isCrossReference(line) {
  return CROSS_REFERENCE.test(line);
}

/** Collect the tag line plus the comment lines that continue it. */
export function commentBlockAt(lines, index, maxLookahead = 6) {
  let block = lines[index] ?? "";
  const limit = Math.min(index + 1 + maxLookahead, lines.length);
  for (let cursor = index + 1; cursor < limit; cursor++) {
    const trimmed = (lines[cursor] ?? "").trim();
    if (!COMMENT_CONTINUATION.test(trimmed)) break;
    if (TAG_PATTERN.test(trimmed)) {
      TAG_PATTERN.lastIndex = 0;
      break;
    }
    TAG_PATTERN.lastIndex = 0;
    block += ` ${trimmed}`;
  }
  return block;
}

/** Every COMPAT tag site in one file that lacks a removal date or condition. */
export function findUndatedTags(filePath, contents) {
  const lines = contents.split("\n");
  const found = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.includes("COMPAT(")) continue;
    if (isCrossReference(line)) continue;
    TAG_PATTERN.lastIndex = 0;
    const names = [...line.matchAll(TAG_PATTERN)].map((match) => match[1]);
    if (names.length === 0) continue;
    const block = commentBlockAt(lines, index);
    if (hasRemovalPlan(block)) continue;
    for (const name of names) {
      found.push({ key: `${filePath}::${name}`, file: filePath, line: index + 1, name });
    }
  }
  return found;
}

function trackedSourceFiles() {
  return execFileSync("git", ["ls-files"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
    .split("\n")
    .filter((file) => file.length > 0 && SOURCE_EXTENSIONS.test(file) && !SELF_EXCLUDED.has(file));
}

export function collectUndatedTags(files = trackedSourceFiles()) {
  const found = [];
  for (const file of files) {
    let contents;
    try {
      contents = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (!contents.includes("COMPAT(")) continue;
    found.push(...findUndatedTags(file, contents));
  }
  return found.sort((left, right) => left.key.localeCompare(right.key));
}

function readBaseline() {
  try {
    const parsed = JSON.parse(readFileSync(BASELINE_URL, "utf8"));
    return Array.isArray(parsed.tags) ? parsed.tags : [];
  } catch {
    return [];
  }
}

function writeBaseline(keys) {
  const payload = {
    comment:
      "COMPAT tags that predate scripts/check-compat-expiry.mjs. Only shrinks. " +
      "Give a tag a removal date or condition, then remove its entry.",
    tags: keys,
  };
  writeFileSync(BASELINE_URL, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function main() {
  const update = process.argv.includes("--update");
  const undated = collectUndatedTags();
  const keys = undated.map((tag) => tag.key);

  if (update) {
    writeBaseline(keys);
    console.log(`Wrote ${keys.length} baseline COMPAT tags to ${fileURLToPath(BASELINE_URL)}`);
    return;
  }

  const baseline = new Set(readBaseline());
  const added = undated.filter((tag) => !baseline.has(tag.key));
  const removed = [...baseline].filter((key) => !keys.includes(key));

  if (added.length > 0) {
    console.error(
      `${added.length} COMPAT tag(s) carry no removal date and no removal condition.\n` +
        "docs/protocol-compatibility.md: give the tag a name, a version, and a removal date or condition.\n",
    );
    for (const tag of added) console.error(`  ${tag.file}:${tag.line}  COMPAT(${tag.name})`);
    process.exitCode = 1;
  }

  if (removed.length > 0) {
    console.error(
      `\n${removed.length} baseline COMPAT tag(s) no longer match.\n` +
        "Run 'npm run compat:expiry:update' to shrink the baseline.\n",
    );
    for (const key of removed) console.error(`  ${key}`);
    process.exitCode = 1;
  }

  if (process.exitCode !== 1) {
    console.log(`COMPAT expiry gate: ${keys.length} baseline tag(s), no new undated tags.`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
