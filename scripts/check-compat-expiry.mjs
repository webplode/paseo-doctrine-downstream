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

// Removing the shim at or after some point. Any of these prepositions works.
const REMOVAL_CLAUSE =
  /\b(?:remove|removed|removal|delete|deleted|drop|dropped|retire|retired|stop|unpin|collapse)\b[\s\S]{0,160}?\b(?:after|when|once|until|through|as soon as)\b/iu;
// `until` marks the end of the shim's life on its own, whatever verb carries it:
// `keep parseable until X`, `replay rows to legacy clients until X`. Deliberately not
// `after`, because `keep this shim after X` says the shim survives X rather than ending.
const ENDS_AT = /\buntil\b/iu;
// A bare deadline with a real date, with no verb needed. A date alone is not a removal
// plan, so `added 2026-06-11` must not qualify.
const BARE_DEADLINE = /\b(?:through|by)\b[^.;]{0,40}?\d{4}-\d{2}-\d{2}/iu;

// `see COMPAT(other)` points at a tag defined elsewhere. Matched against the text
// immediately before one occurrence, so a real tag on the same line still counts.
const CROSS_REFERENCE_LEAD = /\b(?:see|per|matches|mirrors|paired with|companion to)\s+$/iu;

// This checker and its tests carry COMPAT-shaped literals and fixtures on purpose.
const SELF_EXCLUDED = new Set([
  "scripts/check-compat-expiry.mjs",
  "scripts/check-compat-expiry.test.mjs",
]);

export function hasRemovalPlan(block) {
  return REMOVAL_CLAUSE.test(block) || ENDS_AT.test(block) || BARE_DEADLINE.test(block);
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
  const found = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.includes("COMPAT(")) continue;
    const names = tagNamesOnLine(line);
    if (names.length === 0) continue;
    if (hasRemovalPlan(commentBlockAt(lines, index))) continue;
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
  return found.sort((left, right) => left.key.localeCompare(right.key) || left.line - right.line);
}

/**
 * Baseline entries count undated tags per file and name, never per position.
 *
 * A positional identity looks tidy and deadlocks the repo: adding or removing a sibling
 * occurrence renumbers a baselined tag, the check reports one addition and one removal,
 * and --update refuses the new key because it is not in the baseline. Counts move only
 * when the amount of undated debt moves, which is the thing being gated.
 */
export function countByKey(tags) {
  const counts = new Map();
  for (const tag of tags) counts.set(tag.key, (counts.get(tag.key) ?? 0) + 1);
  return counts;
}

export function readBaseline() {
  try {
    const parsed = JSON.parse(readFileSync(BASELINE_URL, "utf8"));
    return parsed.tags && typeof parsed.tags === "object" ? parsed.tags : null;
  } catch {
    return null;
  }
}

export function baselineTotal(baseline) {
  return Object.values(baseline).reduce((sum, count) => sum + count, 0);
}

function writeBaseline(counts) {
  const tags = Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b)));
  const payload = {
    comment:
      "Undated COMPAT tags per file and name that predate scripts/check-compat-expiry.mjs. " +
      "Counts only shrink. Give a tag a removal date or condition, then run compat:expiry:update.",
    tags,
  };
  writeFileSync(BASELINE_URL, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

/** Keys whose current count exceeds what the baseline allows. */
function exceedances(counts, baseline) {
  const over = [];
  for (const [key, count] of counts) {
    const allowed = baseline[key] ?? 0;
    if (count > allowed) over.push({ key, count, allowed });
  }
  return over.sort((left, right) => left.key.localeCompare(right.key));
}

function runUpdate(counts) {
  const baseline = readBaseline();
  if (baseline === null) {
    writeBaseline(counts);
    console.log(`Created baseline with ${[...counts.values()].reduce((a, b) => a + b, 0)} tag(s).`);
    return;
  }
  // --update must never launder new debt into the baseline. It only lowers counts.
  const over = exceedances(counts, baseline);
  if (over.length > 0) {
    console.error(
      `${over.length} COMPAT tag name(s) have more undated occurrences than the baseline allows.\n` +
        "Give each new one a removal date or condition instead.\n",
    );
    for (const item of over) console.error(`  ${item.key}: ${item.count} > ${item.allowed}`);
    process.exitCode = 1;
    return;
  }
  const before = baselineTotal(baseline);
  writeBaseline(counts);
  const after = [...counts.values()].reduce((sum, count) => sum + count, 0);
  console.log(`Baseline shrank from ${before} to ${after} undated COMPAT tag(s).`);
}

function main() {
  const undated = collectUndatedTags();
  const counts = countByKey(undated);

  if (process.argv.includes("--update")) {
    runUpdate(counts);
    return;
  }

  const baseline = readBaseline() ?? {};
  const over = exceedances(counts, baseline);
  const stale = Object.keys(baseline).filter((key) => (counts.get(key) ?? 0) < baseline[key]);

  if (over.length > 0) {
    const sites = new Map(
      undated.map((tag) => [tag.key, undated.filter((t) => t.key === tag.key)]),
    );
    console.error(
      `${over.length} COMPAT tag name(s) carry more undated occurrences than the baseline allows.\n` +
        "docs/protocol-compatibility.md: give the tag a name, a version, and a removal plan.\n",
    );
    for (const item of over) {
      console.error(`  ${item.key}  (${item.count} undated, baseline allows ${item.allowed})`);
      for (const site of sites.get(item.key) ?? []) console.error(`    ${site.file}:${site.line}`);
    }
    process.exitCode = 1;
  }

  if (stale.length > 0) {
    console.error(
      `\n${stale.length} baseline entr(y|ies) now cover fewer tags.\n` +
        "Run 'npm run compat:expiry:update' to shrink the baseline.\n",
    );
    for (const key of stale) console.error(`  ${key}: ${counts.get(key) ?? 0} < ${baseline[key]}`);
    process.exitCode = 1;
  }

  if (process.exitCode !== 1) {
    console.log(`COMPAT expiry gate: ${undated.length} baseline tag(s), no new undated tags.`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
