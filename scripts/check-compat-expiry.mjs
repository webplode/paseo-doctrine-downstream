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

// A bare date is not a removal plan. `added 2026-06-11` says when the shim arrived, not
// when it goes. The date only counts when a deadline preposition governs it.
const DEADLINE = /\b(?:after|until|through|by)\b[^.;]{0,40}?\d{4}-\d{2}-\d{2}/iu;
// Or the tag names the condition that ends it, with no date at all.
const CONDITION =
  /\b(?:remove|removed|removal|delete|deleted|drop|dropped|retire|stop|unpin|collapse|keep|kept)\b[\s\S]{0,160}?\b(?:once|when|as soon as|after|until|through)\b/iu;

// `see COMPAT(other)` points at a tag defined elsewhere. Matched against the text
// immediately before one occurrence, so a real tag on the same line still counts.
const CROSS_REFERENCE_LEAD = /\b(?:see|per|matches|mirrors|paired with|companion to)\s+$/iu;

// This checker and its tests carry COMPAT-shaped literals and fixtures on purpose.
const SELF_EXCLUDED = new Set([
  "scripts/check-compat-expiry.mjs",
  "scripts/check-compat-expiry.test.mjs",
]);

export function hasRemovalPlan(block) {
  return DEADLINE.test(block) || CONDITION.test(block);
}

/** Collect the tag line plus the comment lines that continue it. */
export function commentBlockAt(lines, index, maxLookahead = 6) {
  let block = lines[index] ?? "";
  const limit = Math.min(index + 1 + maxLookahead, lines.length);
  for (let cursor = index + 1; cursor < limit; cursor++) {
    const trimmed = (lines[cursor] ?? "").trim();
    if (!COMMENT_CONTINUATION.test(trimmed)) break;
    if (trimmed.includes("COMPAT(")) break;
    block += ` ${trimmed}`;
  }
  return block;
}

/** Tag occurrences on one line, minus the ones that only point at a tag defined elsewhere. */
export function tagNamesOnLine(line) {
  const names = [];
  TAG_PATTERN.lastIndex = 0;
  let found = TAG_PATTERN.exec(line);
  while (found !== null) {
    if (!CROSS_REFERENCE_LEAD.test(line.slice(0, found.index))) names.push(found[1]);
    found = TAG_PATTERN.exec(line);
  }
  return names;
}

/** Every COMPAT tag site in one file that lacks a removal date or condition. */
export function findUndatedTags(filePath, contents) {
  const lines = contents.split("\n");
  // Same-name tags repeat legitimately in one file, so identity needs an occurrence
  // ordinal. Without it a second undated occurrence inherits the first one's baseline
  // entry and passes unnoticed.
  const seen = new Map();
  const found = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.includes("COMPAT(")) continue;
    const names = tagNamesOnLine(line);
    if (names.length === 0) continue;
    const block = commentBlockAt(lines, index);
    const planned = hasRemovalPlan(block);
    for (const name of names) {
      const ordinal = seen.get(name) ?? 0;
      seen.set(name, ordinal + 1);
      if (planned) continue;
      found.push({
        key: `${filePath}::${name}#${ordinal}`,
        file: filePath,
        line: index + 1,
        name,
      });
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

export function readBaseline() {
  try {
    const parsed = JSON.parse(readFileSync(BASELINE_URL, "utf8"));
    return Array.isArray(parsed.tags) ? parsed.tags : null;
  } catch {
    return null;
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

function runUpdate(keys) {
  const baseline = readBaseline();
  if (baseline === null) {
    writeBaseline(keys);
    console.log(`Created baseline with ${keys.length} COMPAT tag(s).`);
    return;
  }
  // --update must never launder a new tag into the baseline. It only drops entries that
  // gained a removal plan or disappeared.
  const known = new Set(baseline);
  const added = keys.filter((key) => !known.has(key));
  if (added.length > 0) {
    console.error(
      `${added.length} COMPAT tag(s) are not in the baseline and cannot be added to it.\n` +
        "Give each one a removal date or condition instead.\n",
    );
    for (const key of added) console.error(`  ${key}`);
    process.exitCode = 1;
    return;
  }
  writeBaseline(keys);
  console.log(`Baseline shrank from ${baseline.length} to ${keys.length} COMPAT tag(s).`);
}

function main() {
  const undated = collectUndatedTags();
  const keys = undated.map((tag) => tag.key);

  if (process.argv.includes("--update")) {
    runUpdate(keys);
    return;
  }

  const baseline = readBaseline() ?? [];
  const known = new Set(baseline);
  const added = undated.filter((tag) => !known.has(tag.key));
  const removed = baseline.filter((key) => !keys.includes(key));

  if (added.length > 0) {
    console.error(
      `${added.length} COMPAT tag(s) carry no removal date and no removal condition.\n` +
        "docs/protocol-compatibility.md: give the tag a name, a version, and a removal plan.\n",
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
