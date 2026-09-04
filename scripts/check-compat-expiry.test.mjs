import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  collectUndatedTags,
  commentBlockAt,
  findUndatedTags,
  hasRemovalPlan,
  isCrossReference,
} from "./check-compat-expiry.mjs";

const baselineUrl = new URL("./compat-expiry-baseline.json", import.meta.url);

test("a removal date satisfies the rule", () => {
  assert.ok(hasRemovalPlan("// COMPAT(x): added in v0.2.0, remove after 2027-01-18."));
});

test("a removal condition satisfies the rule without a date", () => {
  assert.ok(hasRemovalPlan("// COMPAT(x): remove once the daemon floor reaches v0.4.0."));
  assert.ok(hasRemovalPlan("// COMPAT(x): delete when the old wire shape is gone."));
});

test("a bare description satisfies neither", () => {
  assert.equal(hasRemovalPlan("// COMPAT(x): old daemons omit assignments."), false);
});

test("a cross-reference is not a tag site", () => {
  assert.ok(isCrossReference("// See COMPAT(xterm-ipad-ctrl-c) in terminal-keys.ts."));
  assert.equal(isCrossReference("// COMPAT(xterm-ipad-ctrl-c): iPad sends the wrong code."), false);
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

test("findUndatedTags reports the undated tag and skips the dated one", () => {
  const contents = [
    "// COMPAT(dated): remove after 2027-01-01.",
    "const a = 1;",
    "// COMPAT(undated): old daemons omit this.",
    "const b = 2;",
  ].join("\n");
  const found = findUndatedTags("packages/example/src/thing.ts", contents);
  assert.deepEqual(
    found.map((tag) => tag.name),
    ["undated"],
  );
  assert.equal(found[0].line, 3);
  assert.equal(found[0].key, "packages/example/src/thing.ts::undated");
});

test("the checker does not scan itself or its own fixtures", () => {
  // Both files carry COMPAT-shaped literals and test fixtures. Before this exclusion the
  // gate reported its own strings the moment the files became tracked.
  const scanned = new Set(collectUndatedTags().map((tag) => tag.file));
  assert.equal(scanned.has("scripts/check-compat-expiry.mjs"), false);
  assert.equal(scanned.has("scripts/check-compat-expiry.test.mjs"), false);
});

test("the checked-in baseline matches the repository exactly", () => {
  // The gate only blocks new undated tags. If this fails, either a new tag needs a
  // removal date or condition, or a tag was fixed and the baseline must shrink:
  // npm run compat:expiry:update
  const baseline = JSON.parse(readFileSync(baselineUrl, "utf8")).tags;
  const actual = collectUndatedTags().map((tag) => tag.key);
  assert.deepEqual(actual, baseline);
});

test("the baseline only shrinks", () => {
  // Recorded so a future edit that grows the baseline has to change this number and
  // explain why. Drop the baseline entirely when it reaches zero.
  const baseline = JSON.parse(readFileSync(baselineUrl, "utf8")).tags;
  assert.ok(
    baseline.length <= 66,
    `baseline grew to ${baseline.length}; give the new tag a removal date or condition instead`,
  );
});
