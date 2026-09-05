# Docs index

`docs/` is the source of truth for system-level and process-level knowledge. "The docs" always
means this directory — not the web. The docs capture gotchas and conventions you cannot derive
from the code or external sources.

| Doc                                                                                                                    | What's in it                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [product.md](product.md)                                                                                               | What Paseo is, who it's for, where it's going                                                                                  |
| [architecture.md](architecture.md)                                                                                     | System design, package layering, WebSocket protocol, agent lifecycle, data flow                                                |
| [agent-lifecycle.md](agent-lifecycle.md)                                                                               | Agent states, parent/child relationships, archive semantics, tabs vs archive, subagents track                                  |
| [data-model.md](data-model.md)                                                                                         | File-based JSON persistence, Zod schemas, atomic writes, no migrations                                                         |
| [glossary.md](glossary.md)                                                                                             | Authoritative terminology — UI label wins, no synonyms                                                                         |
| [coding-standards.md](coding-standards.md)                                                                             | Type hygiene, error handling, state design, React patterns, file organization                                                  |
| [design.md](design.md)                                                                                                 | Design system — tokens, buttons, hierarchy, density, alignment rails, states, what's forbidden                                 |
| [forms.md](forms.md)                                                                                                   | Form architecture — non-React form model, form kit, load-state gating; the schedule form is the golden example                 |
| [hover.md](hover.md)                                                                                                   | Hover — the canonical pattern (plain View + onPointerEnter/Leave, separate inner Pressable) and the three ways agents break it |
| [unistyles.md](unistyles.md)                                                                                           | Unistyles gotchas — `useUnistyles()` is forbidden, alternatives in order                                                       |
| [floating-panels.md](floating-panels.md)                                                                               | Anchored popovers — Portal/Modal escape for Android, lifecycle gates, keyboard-shared-value, status-bar offset, the flash      |
| [menus.md](menus.md)                                                                                                   | The menu engine — popover vs sheet, submenu pages, hover intent, when a decision earns a submenu                               |
| [expo-router.md](expo-router.md)                                                                                       | Expo Router route ownership, startup restore, and native blank-screen gotchas                                                  |
| [file-icons.md](file-icons.md)                                                                                         | Material icon theme integration for the file explorer                                                                          |
| [providers.md](providers.md)                                                                                           | Adding a new agent provider end-to-end                                                                                         |
| [forge-providers.md](forge-providers.md)                                                                               | Adding a git forge: registry/manifest, drop-in checklist, self-host/GHES, the two facts tiers                                  |
| [custom-providers.md](custom-providers.md)                                                                             | Custom provider config: Z.AI, Alibaba/Qwen, ACP agents, profiles, custom binaries                                              |
| [native-role-binding.md](native-role-binding.md)                                                                       | Native Foundation roles, immutable launch contracts, provider capability, and qualification gates                              |
| [foundation-product.md](foundation-product.md)                                                                         | Foundation distribution, macOS installer, Control Workspace, WebUI provider credentials                                        |
| [foundation-first-run.md](foundation-first-run.md)                                                                     | Guided first-run flow for protocol admission, profiles, Lead, Peer, Supervisor, Room, and Council                              |
| [foundation-doctrine.md](foundation-doctrine.md)                                                                       | Foundation doctrine, authority model, evidence rules, topology, and product additions                                          |
| [slp-usage.md](slp-usage.md)                                                                                           | Operating guidance for Supervisor, Lead, and Peer                                                                              |
| [slp-bundled-policy-pack-audit.md](slp-bundled-policy-pack-audit.md)                                                   | Source ownership matrix for bundled SLP policy semantics, kernel hooks, compatibility, and parity gates                        |
| [slp-coordination-handoff.md](slp-coordination-handoff.md)                                                             | Coordination signals, attention routing, and adjacent-Lead handoff between Supervisor, Lead, and Peer                          |
| [doctrine-enforcement-gaps.md](doctrine-enforcement-gaps.md)                                                           | Which doctrine rules are machine-checked, which are prose only, and the decisions still open                                   |
| [skill-system.md](skill-system.md)                                                                                     | Paseo workflow skills, Foundation role bundles, admission, triggers, and provider projection                                   |
| [dev-pilot.md](dev-pilot.md)                                                                                           | Controlled macOS dev-pilot install, qualification, stop conditions, rollback, and known limits                                 |
| [plugins.md](plugins.md)                                                                                               | Local plugin manifest, directory source config, RPCs, native surfaces, and attachment sources                                  |
| [service-proxy.md](service-proxy.md)                                                                                   | Service proxy: exposing workspace scripts at public URLs, DNS setup, reverse proxy config                                      |
| [development.md](development.md)                                                                                       | Dev server, build sync gotchas, CLI reference, agent state, Playwright MCP                                                     |
| [rpc-namespacing.md](rpc-namespacing.md)                                                                               | WebSocket RPC naming convention — dotted namespaces and `.request`/`.response` pairs                                           |
| [protocol-compatibility.md](protocol-compatibility.md)                                                                 | Why app/daemon versions drift, protocol vs feature contract, capability gating, COMPAT tagging                                 |
| [protocol-validation.md](protocol-validation.md)                                                                       | zod-aot generated inbound WebSocket validation, patched compiler regressions, schema-purity rules                              |
| [terminal-performance.md](terminal-performance.md)                                                                     | Terminal latency pipeline, coalescing/backpressure invariants, benchmark + perf spec usage                                     |
| [file-observation.md](file-observation.md)                                                                             | Recursive watcher ownership, Linux constraints, teardown invariants, and Parcel comparison                                     |
| [testing.md](testing.md)                                                                                               | TDD workflow, determinism, real dependencies over mocks, test organization                                                     |
| [qa.md](qa.md)                                                                                                         | QA evidence bar for pull requests — platform matrix, version drift, performance, UI proof                                      |
| [mobile-testing.md](mobile-testing.md)                                                                                 | Maestro and mobile test workflows                                                                                              |
| [mobile-panels.md](mobile-panels.md)                                                                                   | Compact left/center/right panel ownership, worklet motion, gesture revisions, and Fabric constraints                           |
| [explorer-sidebar.md](explorer-sidebar.md)                                                                             | Explorer navigation dock, ordinary side-pane hosts, placement preferences, and lifecycle                                       |
| [platform-gating.md](platform-gating.md)                                                                               | Platform gates — the four gates, decision matrix, Metro file-extension and Electron-module rules                               |
| [ad-hoc-daemon-testing.md](ad-hoc-daemon-testing.md)                                                                   | Isolated in-process daemon test harness                                                                                        |
| [browser-capture-harness.md](browser-capture-harness.md)                                                               | Real-Electron browser screenshot harness and compositor-surface gotcha                                                         |
| [android.md](android.md)                                                                                               | App variants, local/cloud builds, EAS workflows                                                                                |
| [docker.md](docker.md)                                                                                                 | Running the daemon and bundled web UI in Docker, volumes, agent images, security                                               |
| [release.md](release.md)                                                                                               | Release playbook, draft releases, completion checklist                                                                         |
| [research/upstream-v0.5.0-stable-integration-2026-08-24.md](research/upstream-v0.5.0-stable-integration-2026-08-24.md) | Stable-only upstream integration source, resolution policy, exclusions, and acceptance gates                                   |
| [research/upstream-v0.6.0-stable-integration-2026-08-25.md](research/upstream-v0.6.0-stable-integration-2026-08-25.md) | Stable v0.6.0 source boundary, component decisions, semantic ownership, and acceptance gates                                   |
| [terminal-activity.md](terminal-activity.md)                                                                           | Terminal activity indicators — source-agnostic tracker, agent hook reporting, adding a new hook provider                       |
| [SECURITY.md](../SECURITY.md)                                                                                          | Relay threat model, E2E encryption, DNS rebinding, agent auth                                                                  |
| [public-docs/hub/security.md](../public-docs/hub/security.md)                                                          | Public Hub guide — trust boundaries, untrusted triggers, provider controls, and output authority                               |

## Writing docs

- **Integrate, don't append.** Find the doc that owns the subject and rewrite the part that is now wrong. The standard failure is finishing a task and adding a paragraph to the bottom of the closest-looking doc; ten tasks later the doc is a pile of paragraphs in discovery order. `custom-providers.md` is what that looks like.
- **Don't document logic.** Prose that restates code drifts from the code and loses. Write down what the code can't tell you: why something is shaped the way it is, the gotcha that cost an afternoon, conventions nothing enforces, constraints that span packages or versions. If a reader could get it in two minutes by opening the file, cut it.
- **One fact, one doc.** Every other mention is a link. If you are about to write the same paragraph in two docs, one of them is a link.
- **Respect the layers.** `CONTRIBUTING.md` and `CLAUDE.md` name things and link out. Activity docs like `docs/qa.md` and `docs/testing.md` set the bar for a kind of work. Subject docs like `docs/unistyles.md` own one thing completely. A layer never re-explains the one below it.
- **One subject per doc.** If the subject doesn't fit in a sentence, split the doc. A section per provider, vendor, or platform is a table plus one worked example.
- **Delete.** Obsolete sections go. Prefer a `packages/app/src/thing.ts:120` reference over a pasted block.
- **New doc?** Add a row to the table above and link it from the docs that should send readers there.
- **Standing instructions stay cache-stable.** No timestamps, counters, or generated content in `CLAUDE.md`, `WORKSPACE_PROTOCOL.md`, or bundled skills — any byte change invalidates the shared prompt-cache prefix for every session that loads them.
- Code-level facts belong in comments next to the code, not here.

## Doc voice

Plain and short. Second person. State the rule, then the reason when the reason isn't obvious. Match the doc you're editing.

Do not:

- Write a sentence to land a point. "It's not X, it's Y", "That's not a Z, that's a W", and every other setup-and-punchline shape.
- Add a clause that only asserts importance: "and that matters", "which is what keeps it working", "this is critical".
- Use "honest", "robust", "seamless", "powerful", "simply", "just", "delightful".
- Restate something you already said, in different words, for emphasis.
- Hedge with "generally", "typically", or "you may want to" when the answer is "do this".
- Clear your throat: "It's worth noting that", "In order to", "This section covers".
