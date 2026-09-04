# Doctrine enforcement gaps

This doc answers one question: which doctrine rules does a machine check, and which ones exist only as prose. It does not own the kernel and policy ownership matrix, that is [slp-bundled-policy-pack-audit.md](slp-bundled-policy-pack-audit.md). It does not own the doctrine itself, that is [foundation-doctrine.md](foundation-doctrine.md).

The reason it exists: `foundation/manifest.json` hashes every distributed file, so no normative document drifts silently. Hashing bytes says nothing about meaning. A clause can be well formed, pass the validator, and still not say what the doctrine requires.

## What a machine actually checks

| Artifact                                     | What it checks                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `foundation/dist/skills/role-bundles.json`   | Skill admission per role, read by skill policy and the Foundation CLI    |
| `skills/role-admission.json`                 | Council is admitted to Lead only                                         |
| `templates/workspace-protocol-contract.json` | Protocol file syntax: title, version marker, placeholders, two fields    |
| `profiles/native/role-definitions.json`      | Role instructions; the daemon refuses to load on `contractVersion` drift |
| `scripts/agent-instructions.test.mjs`        | The `CLAUDE.md` byte budget and the `AGENTS.md` symlink                  |
| `scripts/check-compat-expiry.mjs`            | A new COMPAT tag carries a removal date or condition                     |
| `foundation/manifest.json`                   | SHA-256 of every distributed file                                        |

## Gaps

**The issue tracker clause is checked for presence only.** `packages/server/src/utils/workspace-protocol-file.ts` runs `hasOneNonBlankField(content, "issue tracker")`, which wants exactly one `- issue tracker:` line with something non blank after the colon. `- issue tracker: none` passes, the protocol binds, and mutating work proceeds. `canonicalIssueTrackerValue` does hold the exact clause text, but it only feeds the baseline template and is never compared against a repository's real file. The mandate is neither enforced nor deliberately relaxed.

**The kernel still encodes SLP rules.** Two of them live in `packages/server/src/server/agent/agent-manager.ts`: a Supervisor's Lead child detaches when the parent is archived, and a mutating Peer cannot launch without a verifier grant. Both are doctrine, not mechanism, so both belong in the policy pack.

**The registry cannot admit a second pack.** `packages/server/src/server/policy/bundled-policy-pack.ts` pins `id` to the literal `slp`, and `assertLocalPluginIdAvailable` stops a local plugin from claiming that id. The six kernel hooks all exist, but only the first party pack reaches them. The third party plugin SDK has no way to contribute policy.

**Role vocabulary still belongs to the protocol.** `PASEO_ROLE_IDS` is a closed enum in `packages/protocol/src/role-binding.ts`. The pack derives its own generation digest from that constant, so the doctrine's identity depends on the kernel.

**Protocol clauses carry no reason and no review trigger.** `WORKSPACE_PROTOCOL.md` is a flat list of `- <field>: <prose>` bullets. The only review adjacent value anywhere is `last_reviewed` inside the identity clause, and nothing computes staleness from it. A clause can carry a rule without recording why it exists, and without any condition that would prompt someone to revisit it.

**Most of the doctrine has no test behind it.** Nothing checks the invariants in `ROLE_CONTRACTS.md`, either the assignment or the handback packet shape, the no self accept rule, topology minimality, or the anti pattern catalogs. They are byte pinned, not semantically checked.

## Decisions still open

Neither of these is closed by any agent. Both need a Human.

1. Which way the issue tracker clause goes: compare against the canonical text that is already pinned, or add an explicit mandatory level so a side project can run best effort. It is currently neither.
2. Whether to move the two SLP rules out of `agent-manager.ts` into the pack, and whether to open the policy seam to a second pack. Both are runtime facing and need the local completion gate plus a live canary.

## How to re-measure

These count source files, excluding tests and the `policy/` directory. All reproducible with `rg`.

| Metric                                             | Value |
| -------------------------------------------------- | ----- |
| COMPAT tags total                                  | 432   |
| COMPAT tags with no removal date and no condition  | 66    |
| Role literals in the kernel, outside `policy/`     | 53    |
| Kernel files containing a role literal             | 9     |
| Files outside `policy/` depending on `PaseoRoleId` | 35    |

The metric worth tracking over time is the conflict count at the next upstream merge. It measures how much SLP is still interleaved with upstream code, and it falls as policy moves into the pack.
