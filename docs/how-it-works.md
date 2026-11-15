# How it works

This page is the reference for **Goal-Driven Development (GDD)**, the methodology Spectree created and the squad follows. The README gives the overview; the source of truth is the orchestrator itself, [`commands/engineer.md`](../commands/engineer.md), and the agent cards in [`agents/`](../agents/).

## The idea in one paragraph

You say what outcome you want. The Engineer turns it into a **contract** (`docs/goals/<slug>.md`): the goal, the context the builder needs, three to seven success criteria each with the proof that decides it, the limits, and a budget of verification rounds. Nobody writes a spec, and nobody hands the builder a plan. **How** to build (modules, aggregates, tickets, order) belongs to the `full-stack-developer`, who decides by reading the code, inside the rules of [`ARCHITECTURE.md`](../ARCHITECTURE.md). The `quality-engineer` and the `security-engineer` verify without having built: they run each proof, judge whether it proves the criterion and try to refute it, until every criterion is met.

## The pieces

| | |
|---|---|
| **What you give** | The outcome you want; in the interview, the goal roadmap; for a new screen, approval of the prototype. |
| **What goes down to the builder** | A contract and nothing else: the goal; context (actors and scenarios, what was decided and why, what exists today, external facts with sources, unknowns, priorities); three to seven success criteria with their proofs; limits; a round budget. No plan. |
| **Who writes the contract** | Only the Engineer, through the `to-goal` skill. The panel refuses that skill, and writes under `docs/goals/`, to any subagent. |
| **Who decides how** | The `full-stack-developer`. Its plan lives in `.scratch/<slug>/plan.md`, with one file per ticket in `.scratch/<slug>/issues/` (the `to-tickets` skill, adapted from Matt Pocock: a vertical slice that fits one fresh context, with the tickets that block it). The planner only plans; each ticket is built by a new `full-stack-developer`, which resumes from the plan and also fixes its own ticket. |
| **Contract attack** | Before any code, the `quality-engineer` reads only the contract and says, per criterion, which wrong system would still pass the proof, which case is missing, and which proof an exit code does not decide. One pass: a weak proof found here costs a read, not a round. |
| **Architecture gate** | Before any code, the `solutions-architect` judges the plan against the numbered rules of `docs/architecture.md`. Only a written rule fails a plan; preference does not. A criterion that can only be met by breaking a rule goes to you. |
| **Ticket graph** | `npm run goal -- graph <slug>` reads the tickets as a graph: no cycle, every criterion covered by a ticket, and two tickets that may run together never share a folder. It prints the frontier (tickets free to start). `--plan` is the plan gate, and `--prove <ticket>` runs a ticket's proof. |
| **Proof attack** | For a goal with more than one ticket, at the plan gate, the `quality-engineer` reads the contract and the tickets and says what the planned proofs would let through. Each finding becomes a criterion of the ticket before code exists. |
| **Goal start** | A script, not an agent: `goal-start.mjs <slug> --branch <type>/<slug>` cuts the branch and aligns the squad's tooling; `--baseline` runs build, tests and audit in the background and writes `.scratch/<slug>/baseline.md`. The plan does not wait for the baseline. |
| **Checkpoint per ticket** | A ticket closes before the next one starts. The Engineer runs a cheap gate by exit code with the ticket's proof; the `quality-engineer` reviews the ticket's commit, and the `security-engineer` does too when the ticket touches a trust boundary, while nobody writes to the checkout. The builder fixes once and the finder re-checks once; what stays open goes to final verification. |
| **Two lanes** | When the graph prints `parallel:`, two free tickets with no folder in common run at the same time: one in the main checkout, one in a worktree with its own database and ports. A ticket closed in the second lane is merged while the first lane is paused. Never more than two `full-stack-developer` agents per machine. |
| **Final verification** | Before the PR, three mandatory layers: a deterministic one by exit code (build, tests starting with `check-boundaries`, `goal check`, every contract proof in UTC on a scratch database, e2e, capacity); an adversarial one (`quality-engineer`, with mutation testing, and `security-engineer`), which never sees the plan or the builder's report; and the PR's CI. The Engineer never lowers a severity or skips a layer. |
| **Executable proofs** | A proof a command decides goes in the contract as ``run: `<command>` ``, and `npm run goal -- prove <slug>` runs them all. Everyone runs the same line; the exit code is the evidence. Proofs that only the PR run or merged `main` can give are written `in ci:` or `after merge:`, stay `pending`, and the contract is `landed` until they run. |
| **Contract ready** | `npm run goal -- check --ready` requires an approved contract with every criterion `met` or waived by amendment. It runs in `check:pr` and in CI, so the PR cannot open without it. |
| **Next round** | The deterministic layer runs in full again; the adversarial agents look at the fix's diff and the reopened criteria, and a criterion the fix did not touch stays `met` by its proof. |
| **Close the class** | A criterion failed for the second time gets no patch: the `full-stack-developer` names the class of defect and the construction that makes it impossible, and the next round judges the construction. From the third round on, the fix and its verification move up to a stronger model. |
| **Risk policy** | Decided once in the interview, in `docs/risk-policy.md`. When it applies, a `low` residue from the `security-engineer` or a `should` from the `quality-engineer` becomes a criterion of a hardening goal and the PR goes on without asking. |
| **Amendments** | A criterion only changes through a line in `## Amendments`, with the date, who decided and where the rest continues. There is no "met with reservations". |
| **Size** | Each contract has a budget of changed product lines (4,000 by default; tests, docs and lockfiles do not count), measured at every checkpoint. When it is exceeded, what is met ships as a PR and the rest becomes a continuation goal. |
| **Lean code** | Rule 15: nothing exists that the goal does not need. The plan says what it reuses and what it creates, the gate refuses to create what already exists, and the `quality-engineer` reads callers the diff did not touch and flags code no criterion requires. A deliberate shortcut is marked `shortcut: <limit>, <when to upgrade>`. Validation at trust boundaries, error handling that prevents data loss, security and accessibility are never cut. |
| **Short missions** | Every tool call re-reads the whole context, so long missions cost more per call. At a `full-stack-developer`'s 60th tool call the panel refuses one call as a warning; the agent wraps up, writes what is left into the ticket and reports `handoff`, and a new one continues. |
| **Automatic resume** | A goal session that stopped on a usage limit or an API error is resumed by the panel without you: a minute after the window reopens, or at intervals of 2 to 60 minutes, up to nine attempts. A turn that ended in a reply is never resumed, because it may be a question for you; typing anything cancels. |
| **Numbers** | `npm run goal -- stats` reads the contracts: rounds per goal, first-pass rate, budgets spent, decisions escalated to you, model escalations, lines and CI minutes. `npm run goal -- spent <slug>` reads the local Claude Code transcripts: wall clock, hours stopped on usage limits or API errors, hours waiting for you, tokens spent on rework, and tokens and turns per role. |
| **Tooling in sync** | `tooling-sync.mjs` brings the squad's newer scripts into an older project in the first commit of a goal branch. A script the project changed is never overwritten. |
| **Conversation language** | On first contact the main session asks, in English, which language you want and records it in `.engineer.local.json`, which is gitignored because the choice is per person. You can change it any time by saying so. Item sessions never ask: they report in the recorded language, or in English. Everything else (contracts, missions, code, docs, commits, PRs) is English. |
| **When you are asked** | A request outside the roadmap, a criterion that creates a new business rule, narrowing or waiving a criterion outside the risk policy, a round budget spent with a residue the policy does not cover, and the four gates. |

## Sessions

In the Claude desktop app a project has two kinds of session:

- **The main session** is the one where you opened the project. It runs the interview, the roadmap, the bootstrap and the design system, then coordinates: it opens one linked session per roadmap goal, reads its report, verifies, tells you, and opens the next.
- **An item session** lives one goal with a fresh context, from contract to merge, and reports back to the main session. Everything it needs is on disk: the roadmap, the glossary, the architecture rules, the contracts and earlier decisions.

Outside the desktop app, the Engineer builds each goal in the same session.

## Projects that started before GDD

A project that began with specs and tickets does not break or restart. On the first `/engineer` after updating, each open item is adopted as a goal: the contract is written from the spec and tickets, what was already built becomes context, the same branch continues, and nothing is deleted or asked again.

## Bugs and audits

- **A bug** is a goal with one criterion: the test that reproduces the defect, red before and green after. The `full-stack-developer` follows the `diagnosing-bugs` skill, and with no reproduction there is no fix.
- **A security audit** runs the full six-phase mode of the `security-audit` skill: on request, before the first public exposure, and every five roadmap items. Confirmed findings become a fix goal with one criterion per finding.

## Versioning

The version lives in `.claude-plugin/plugin.json` and follows SemVer. Every merge to `main` is a release, because `claude plugin update` compares versions, not commits. See [CONTRIBUTING.md](../CONTRIBUTING.md#versioning-and-releases).
