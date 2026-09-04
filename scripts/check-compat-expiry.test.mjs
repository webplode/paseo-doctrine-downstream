import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  baselineTotal,
  collectUndatedTags,
  commentBlockAt,
  countByKey,
  findUndatedTags,
  hasRemovalPlan,
  readBaseline,
  tagNamesOnLine,
} from "./check-compat-expiry.mjs";

const tag = (text) => `// COMPAT(x): ${text}.`;

test("a removal verb with a deadline satisfies the rule", () => {
  assert.ok(hasRemovalPlan(tag("added in v0.2.0, remove after 2027-01-18")));
  assert.ok(hasRemovalPlan(tag("Stop emitting it after 2027-01-17 once clients update")));
  assert.ok(hasRemovalPlan(tag("drop the gate when the floor is >= v0.1.48")));
});

test("until ends the shim whatever verb carries it", () => {
  assert.ok(hasRemovalPlan(tag("keep legacy paseo.json parseable until 2026-12-31")));
  assert.ok(
    hasRemovalPlan(tag("replay reconstructed rows to legacy clients until the floor is v0.5.0")),
  );
  assert.ok(hasRemovalPlan(tag("keep optional until the daemon floor is v0.2.4")));
});

test("a retention verb with after is not a removal plan", () => {
  // `keep this shim after X` says the shim survives X. Only `until` and `through`
  // bound a retention clause, so pairing retention with `after` must not pass.
  assert.equal(hasRemovalPlan(tag("keep this shim after the daemon floor reaches v1")), false);
  assert.equal(hasRemovalPlan(tag("support the legacy shape after v1 ships")), false);
});

test("a date that is not a removal date does not satisfy the rule", () => {
  // `added 2026-09-01` says when the shim arrived, not when it goes.
  assert.equal(hasRemovalPlan(tag("introduced 2026-09-01; old clients need this")), false);
  assert.equal(hasRemovalPlan(tag("ships alongside providers (v0.1.48, 2026-04-05)")), false);
});

test("a bare description satisfies neither", () => {
  assert.equal(hasRemovalPlan(tag("old daemons omit assignments")), false);
});

test("a removal condition may span a sentence boundary", () => {
  // Real tags write `Drop the fallbacks and the .optional() in messages.ts when ...`,
  // so the window between the verb and the condition has to tolerate a period.
  assert.ok(
    hasRemovalPlan(
      "// COMPAT(x): accept the legacy shape. Drop the fallbacks and the " +
        ".optional() in messages.ts when the client floor is high enough.",
    ),
  );
});

test("a cross-reference alone is not a tag site", () => {
  assert.deepEqual(tagNamesOnLine("// See COMPAT(xterm-ipad-ctrl-c) in terminal-keys.ts."), []);
});

test("a cross-reference does not hide a real tag on the same line", () => {
  // Skipping the whole line would let an undated tag through just because its
  // explanation happens to mention another tag.
  assert.deepEqual(
    tagNamesOnLine("// COMPAT(newShim): old clients need this; see COMPAT(oldShim)"),
    ["newShim"],
  );
});

test("a continuation comment counts toward the removal plan", () => {
  const lines = [
    "// COMPAT(peerDelegation): added in v0.4.0-paseo.27,",
    "//   remove after 2027-02-01 once every client advertises the feature.",
    "const value = 1;",
  ];
  assert.ok(hasRemovalPlan(commentBlockAt(lines, 0)));
});

test("the next tag does not leak into the previous tag's block", () => {
  const lines = [
    "// COMPAT(first): old clients omit this field.",
    "// COMPAT(second): remove after 2027-03-01.",
  ];
  assert.equal(hasRemovalPlan(commentBlockAt(lines, 0)), false);
});

test("findUndatedTags reports the undated tag and skips the planned one", () => {
  const contents = [
    "// COMPAT(dated): remove after 2027-01-01.",
    "const a = 1;",
    "// COMPAT(undated): old daemons omit this.",
    "const b = 2;",
  ].join("\n");
  const found = findUndatedTags("packages/example/src/thing.ts", contents);
  assert.deepEqual(
    found.map((entry) => entry.name),
    ["undated"],
  );
  assert.equal(found[0].line, 3);
  assert.equal(found[0].key, "packages/example/src/thing.ts::undated");
});

test("repeated undated names in one file raise the count, not the key", () => {
  // A per-name count catches a second undated occurrence without giving the tag a
  // positional identity.
  const contents = [
    "// COMPAT(shared): old clients omit this.",
    "const a = 1;",
    "// COMPAT(shared): a different site, also undated.",
  ].join("\n");
  const counts = countByKey(findUndatedTags("packages/example/src/thing.ts", contents));
  assert.equal(counts.get("packages/example/src/thing.ts::shared"), 2);
});

test("adding or removing a planned sibling does not move the identity", () => {
  // A positional ordinal deadlocked here: adding a planned sibling renumbered the
  // undated tag, the check reported one addition and one removal, and --update refused
  // the new key. The count has to stay put so the baseline still matches.
  const withoutSibling = ["// COMPAT(shared): still undated."].join("\n");
  const withSibling = [
    "// COMPAT(shared): a planned sibling, remove after 2027-01-01.",
    "const a = 1;",
    "// COMPAT(shared): still undated.",
  ].join("\n");
  const before = countByKey(findUndatedTags("packages/example/src/thing.ts", withoutSibling));
  const after = countByKey(findUndatedTags("packages/example/src/thing.ts", withSibling));
  assert.deepEqual([...after], [...before]);
  assert.equal(after.get("packages/example/src/thing.ts::shared"), 1);
});

test("the checker does not scan itself or its own fixtures", () => {
  // Both files carry COMPAT-shaped literals and test fixtures. Before this exclusion the
  // gate reported its own strings the moment the files became tracked.
  const scanned = new Set(collectUndatedTags().map((entry) => entry.file));
  assert.equal(scanned.has("scripts/check-compat-expiry.mjs"), false);
  assert.equal(scanned.has("scripts/check-compat-expiry.test.mjs"), false);
});

test("the checked-in baseline matches the repository exactly", () => {
  // The gate only blocks new undated tags. If this fails, either a new tag needs a
  // removal date or condition, or a tag was fixed and the baseline must shrink:
  // npm run compat:expiry:update
  const baseline = readBaseline();
  const counts = countByKey(collectUndatedTags());
  assert.deepEqual(
    Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b))),
    baseline,
  );
});

test("the baseline only shrinks", () => {
  // Recorded so a future edit that grows the baseline has to change this number and
  // explain why. Drop the baseline entirely when it reaches zero.
  const total = baselineTotal(readBaseline());
  assert.ok(
    total <= 60,
    `baseline grew to ${total}; give the new tag a removal date or condition instead`,
  );
});

test("every baseline count is a positive integer", () => {
  const baseline = readBaseline();
  for (const [key, count] of Object.entries(baseline)) {
    assert.ok(Number.isInteger(count) && count > 0, `${key} has a bad count: ${count}`);
  }
});

test("the baseline file parses and keys look like path::name", () => {
  const parsed = JSON.parse(
    readFileSync(new URL("./compat-expiry-baseline.json", import.meta.url)),
  );
  assert.equal(typeof parsed.tags, "object");
  for (const key of Object.keys(parsed.tags)) assert.match(key, /^[^:]+::[^:]+$/u);
});
