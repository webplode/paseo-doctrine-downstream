import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  collectUndatedTags,
  commentBlockAt,
  findUndatedTags,
  hasRemovalPlan,
  readBaseline,
  tagNamesOnLine,
} from "./check-compat-expiry.mjs";

test("a removal deadline satisfies the rule", () => {
  assert.ok(hasRemovalPlan("// COMPAT(x): added in v0.2.0, remove after 2027-01-18."));
  assert.ok(hasRemovalPlan("// COMPAT(x): keep legacy configs parseable until 2026-12-31."));
  assert.ok(hasRemovalPlan("// COMPAT(x): accept peers that observed v0.2.6 through 2027-01-31."));
});

test("a removal condition satisfies the rule without a date", () => {
  assert.ok(hasRemovalPlan("// COMPAT(x): remove once the daemon floor reaches v0.4.0."));
  assert.ok(hasRemovalPlan("// COMPAT(x): delete when the old wire shape is gone."));
  assert.ok(hasRemovalPlan("// COMPAT(x): keep optional until the daemon floor is v0.2.4."));
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

test("a date that is not a removal date does not satisfy the rule", () => {
  // `added 2026-09-01` says when the shim arrived, not when it goes.
  assert.equal(
    hasRemovalPlan("// COMPAT(x): introduced 2026-09-01; old clients need this."),
    false,
  );
  assert.equal(
    hasRemovalPlan("// COMPAT(x): ships alongside providers (v0.1.48, 2026-04-05)."),
    false,
  );
});

test("a bare description satisfies neither", () => {
  assert.equal(hasRemovalPlan("// COMPAT(x): old daemons omit assignments."), false);
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
    found.map((tag) => tag.name),
    ["undated"],
  );
  assert.equal(found[0].line, 3);
  assert.equal(found[0].key, "packages/example/src/thing.ts::undated#0");
});

test("repeated names in one file get distinct identities", () => {
  // A shared `path::name` key let a second undated occurrence inherit the first one's
  // baseline entry and pass unnoticed.
  const contents = [
    "// COMPAT(shared): old clients omit this.",
    "const a = 1;",
    "// COMPAT(shared): a different site, also undated.",
  ].join("\n");
  const keys = findUndatedTags("packages/example/src/thing.ts", contents).map((tag) => tag.key);
  assert.deepEqual(keys, [
    "packages/example/src/thing.ts::shared#0",
    "packages/example/src/thing.ts::shared#1",
  ]);
});

test("an occurrence ordinal counts planned siblings too", () => {
  // Giving one occurrence a removal plan must not renumber the others, or every
  // baseline entry after it would stop matching.
  const contents = [
    "// COMPAT(shared): remove after 2027-01-01.",
    "const a = 1;",
    "// COMPAT(shared): still undated.",
  ].join("\n");
  const keys = findUndatedTags("packages/example/src/thing.ts", contents).map((tag) => tag.key);
  assert.deepEqual(keys, ["packages/example/src/thing.ts::shared#1"]);
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
  const baseline = readBaseline();
  const actual = collectUndatedTags().map((tag) => tag.key);
  assert.deepEqual(actual, baseline);
});

test("the baseline only shrinks", () => {
  // Recorded so a future edit that grows the baseline has to change this number and
  // explain why. Drop the baseline entirely when it reaches zero.
  const baseline = readBaseline();
  assert.ok(
    baseline.length <= 60,
    `baseline grew to ${baseline.length}; give the new tag a removal date or condition instead`,
  );
});

test("every baseline entry is unique", () => {
  const baseline = readBaseline();
  assert.equal(new Set(baseline).size, baseline.length);
});

test("the baseline file parses and is an array of strings", () => {
  const parsed = JSON.parse(
    readFileSync(new URL("./compat-expiry-baseline.json", import.meta.url)),
  );
  assert.ok(Array.isArray(parsed.tags));
  assert.ok(parsed.tags.every((entry) => typeof entry === "string"));
});
