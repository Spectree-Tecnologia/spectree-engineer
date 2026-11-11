---
name: to-goal
description: "For the orchestrator only (the Engineer, the one agent that talks to the user): turn a request into a goal contract for Goal Driven Development, with the objective, the context the builder needs, the success criteria and the proof that decides each one, the limits and the budget. Never the solution. Also turns a spec and tickets from before Goal Driven Development into a contract. A subagent never calls this skill."
---

Only the orchestrator uses this skill: the agent that talks to the user and dispatches the others. If you were dispatched with a mission (you build, review, explore or operate), stop: the contract is not yours to write or change. Read it and carry on.

A goal contract says what must be true when the work is done, how anyone can check it, and everything the builder needs to know to get there well. It says nothing about how to get there. Modules, aggregates, files, libraries and the order of the work belong to the `full-stack-developer`, the agent that builds the goal, and a contract that names them has taken the decision away from the one who will be able to see the code.

The contract has two kinds of reader who never talk to each other: the `full-stack-developer`, who builds from it, and the `quality-engineer` and the `security-engineer`, who check the result against it without seeing the full-stack-developer's reasoning. Write it so that either one could work from it alone. It replaces the spec, the tickets and the implementation brief: nothing else is handed to the full-stack-developer.

## Process

1. Read the project's vocabulary before writing: the domain glossary, the ADRs of the area, the architecture rules, the decisions already recorded, and the roadmap line when the goal comes from one. Use its terms.

2. Write the **objective**: one paragraph saying who gets what, and why it matters now. If the sentence names a table, an endpoint, a component or a library, it is a solution. Move up one level, until the sentence would still be true under a different implementation.

3. Write the **context**. A capable builder fails for lack of context far more often than for lack of skill, and it cannot ask you later. Give it what you know and it cannot read from the code, and point at what it can:

   - **Actors and scenarios.** Who uses this and what each one is trying to do, as short scenarios: the main path, the paths that go wrong, the ones that must be refused. This is where the breadth of the behaviour lives; the criteria below pick what decides the goal.
   - **Decided already.** The product rules that are settled, each with its reason, because a reason lets the builder decide the cases you did not foresee. Cite the glossary term, the ADR or the decision line.
   - **What exists today.** What the goal touches or resembles in the product as it is: the modules and screens involved, the contracts already there, and one piece of existing work that is the house pattern to read first. State facts ("accounts already refuses another user's id with 404"), never instructions ("add a guard").
   - **Facts from outside.** What an external system really does, with the source: version, payload, limit, error. Never from memory. A vendor's example payload keeps its shape and its id formats, since that is the point of quoting it, except for token-shaped values (card tokens, keys, wallet ids, Pix keys): those become a placeholder such as `<docs-example-token>` before anything is committed, because a secret scan reads every commit and cannot be told it was only an example.
   - **Prior thinking, when there is some.** An approach someone sketched, a prototype, a spec from before. Label it as that: it informs the full-stack-developer and does not bind it.
   - **Unknowns.** What you do not know and the full-stack-developer will have to find out or raise. An honest gap is worth more than a confident guess.
   - **Priorities.** What wins when two good things pull apart (simplicity over configurability, correctness of money over latency).

   Context describes; it never prescribes. If a sentence tells the full-stack-developer what to build or in which order, turn it into the fact or the reason behind it, or delete it.

4. Find the **success criteria**. For each thing the user wants to be true, ask "what would I run or look at to know?", and keep asking until there is an answer. A criterion is:

   - **Observable from outside the code.** A behaviour through the API or the screen, a number, a state of the data. Never "the code has X" or "uses Y".
   - **Decided by a proof.** A command whose exit code decides it, a measurement against a threshold, or an observation someone else can repeat (the built screen against the approved artboard). The proof may name a test that does not exist yet: say what it must assert, and at which seam, the highest one that exercises the behaviour.
   - **Run by a script wherever a command can decide it.** Write the command in the Proof cell as ``run: `<command>` ``, runnable from the project root, then what it must assert. The full-stack-developer, the verifier and the orchestrator all run the same line through `npm run goal -- prove <slug>`, and the exit code is the verdict's evidence. A proof that needs a database is still one command: whoever runs it gives it a database of its own. A proof with no `run:` is decided by hand, so keep those for what only eyes can judge.
   - **Deferred only when it must be.** A proof that only the pull request's run or the merged main can give (a trigger that fires on merge, a scheduled job) starts with `in ci:` or `after merge:`, before its `run:`. It is not run before the pull request, its verdict is `pending` until it can be, and the goal is `landed`, not `met`, while one is pending. Whatever a command can decide before the merge is decided before the merge.
   - **Exact about what was approved.** A criterion about an approved screen names the artboard and quotes its copy and its geometry as the artboard has them (or points at the line of the artboard's code), never a paraphrase from notes: the full-stack-developer builds what the criterion says, and a paraphrase that drifts from the approved visual costs a round.
   - **Complete in its cases.** Name the cases inside the criterion: the main one, the edges, what is refused. A verifier will try the case you left out.
   - **Not an adjective.** "Faster", "simpler", "robust" and "secure" are wishes. Turn each into the number or the observable behind it, or ask the user for it.
   - **Negative too.** What must be refused, what must not appear, what must not regress. A goal stated only by its happy path is met by the wrong system as well.
   - **Closed at the trust boundary.** When the goal opens a route, accepts input or shows data, one criterion says who must be refused and what they must not learn from the refusal.

   Three to seven criteria. More than that is usually more than one goal: split it by outcome, never by layer.

5. Write the **limits**: what must stay true and what must not be touched while getting there. Public contracts other code or other people depend on, data that already exists, money and external services, and what is out of scope. A limit is a boundary the full-stack-developer stops at and reports, not a preference.

6. Set the **budget**: how many rounds of independent verification the goal gets before the user is asked again (default 3), and how large the change may grow before it is landed in parts (default 4000 changed lines of product code; tests, documents and the lockfile do not count). Set it by what a reviewer can hold, and remember that every part landed is a pull request and a CI run: a budget too small buys runs, not quality. A goal that passes its size is not finished later: what is met lands, and the rest continues as its own goal.

7. Do not restate the project's standing gates (build, tests, boundary checks, latency budgets, review). They hold for every goal and live in the project's own documents. Name one here only when this goal tightens it, as a criterion with its number.

8. The objective is the user's; the criteria are yours to write. When the objective is already approved scope (an item of the roadmap), derive the criteria from what is already decided, record the approval and report the contract without waiting. Ask the user, once, only when the goal is new scope or a criterion makes a product rule nobody decided: show the contract, with your recommendation. Never ask the user how to build it.

9. Write the contract to `docs/goals/<slug>.md` with the template below. The slug is the branch's slug. Where the project has the script, `npm run goal -- check <slug>` must exit 0 before you go on.

10. Read it once more as the full-stack-developer would, with nothing else in hand. Whatever you had to remember to understand it is missing from the context: add it.

11. Have it attacked before it is built. Hand the contract alone to a verifier and ask, criterion by criterion, which wrong system would pass the proof, which case the criterion does not name, and which proof an exit code cannot decide. Fix the contract with what comes back, once: before approval it is an edit, after it an amendment. A weak proof found here costs one reading; found after the code, it costs a round.

<goal-template>

# Goal: <slug>

Status: proposed
Type: <feat | fix | refactor | perf | chore>

## Objective

Who gets what, and why it matters now. No solution.

## Context

### Actors and scenarios

- <actor>: <what they are trying to do>, and what happens when it goes wrong or must be refused.

### Decided already

- <rule>. Because <reason>. (<glossary term, ADR or decision line>)

### What exists today

- <fact about the product as it is>. Read first: <the existing work that is the house pattern>.

### Facts from outside

- <what the external system does>. Source: <link, with the date read>.

### Prior thinking

- <an approach already sketched, labelled as not binding>. Omit the section when there is none.

### Unknowns

- <what nobody knows yet>.

### Priorities

- <what wins over what>.

## Success criteria

| # | Criterion | Proof |
|---|-----------|-------|
| 1 | What is true, seen from outside the code, with its cases. | The command, measurement or observation that decides it, what it must assert, and at which seam. |

## Limits

- What must stay true or untouched.
- Out of scope: what this goal does not deliver.

## Budget

Verification rounds: 3.
Size: 4000 changed lines of product code.

## Evidence

Filled by the orchestrator from what the verifiers ran, never by the full-stack-developer. One row per criterion per round.

| # | Round | Verdict | Command run by the verifier and its exit code |
|---|-------|---------|-----------------------------------------------|

## Amendments

A criterion changes only here, never by editing the table above in silence.

| Date | # | Change | Decided by | Follow-up |
|------|---|--------|------------|-----------|

</goal-template>

`Status` moves through `proposed`, `approved by <who> on <date>`, `landed on <date>` (merged, with an `after merge:` proof still to run), `met on <date>` or `stopped on <date>: <why>`. Verdicts are `met`, `not met`, `weak proof` (the proof passes but would also pass without the behaviour), `waived` (an amendment took the criterion out) or `pending` (only for a proof written `in ci:` or `after merge:`, until it can run). When the pull request merges, the orchestrator adds one line under `Status`, `Landed: PR #<n>, <lines> product lines, CI <minutes> min`, which `npm run goal -- stats` reads. There is no "met, with a caveat": a criterion that was not met as written is amended or it is not met.

## Amending a contract

A contract changes after approval only by a row in `## Amendments`, written by the orchestrator, with the date, the criterion, who decided and where the rest continues. The `Change` cell starts with the kind and then says what changed, keeping the words that were replaced:

- `narrowed`: the criterion now asks for less. The user decides, or the project's risk policy where it covers the case (`Decided by` then reads `risk policy (<its date>)`). The part left out continues in a goal named in Follow-up. The narrowed criterion gets one more evidence row in the same round, `met`, saying `as narrowed on <date>` and which findings moved: it is the only way a round's reproof becomes `met` without another round.
- `waived`: the criterion is dropped from this goal. The user decides. Follow-up names the goal that takes it, or says why nothing does.
- `moved`: the criterion goes to a continuation goal because this one passed its size or was split by outcome. Same approved scope, so the orchestrator decides. Follow-up names the new goal, and the row leaves this contract's criteria table.
- `added`: a new criterion. The user decides when it makes a product rule nobody decided; the orchestrator when it follows from one already recorded.
- `reworded`: the same demand in clearer words, or a proof corrected. The orchestrator decides.
- `extended`: more verification rounds than the budget gave. The user decides. The `#` cell reads `budget`, and the `Change` cell says how many.

Then edit the criteria table to match, and record `waived` in the evidence for a waived criterion.

<criterion-examples>

Weak: "The dashboard loads fast."
Strong: "The dashboard's first request answers within 300 ms at p95 with 10 000 charges in the tenant." Proof: the latency budget command for that route, on a database seeded with that volume.

Weak: "Residents can get a second copy of a bill."
Strong: "A resident with an open charge receives the second copy by e-mail within one request; a resident of another condominium asking for the same charge gets 404 and no e-mail is sent." Proof: an e2e test at the HTTP seam that asserts both, including the empty outbox.

Weak: "Use the new SDK."
Strong: "No request to the provider uses the v1 API." Proof: the contract test against the provider's sandbox recording passes, and a search for the v1 host in the source returns nothing.

</criterion-examples>

<context-examples>

Prescribes (wrong): "Create a `SecondCopy` use case in the billing module and call the mailer from it."
Describes (right): "Billing already issues charges and stores the PDF of each one; e-mail goes out through the notifications module, which other modules reach by domain event (architecture rule 13). Read first: how billing announces a paid charge."

Prescribes (wrong): "Add an index on `charges.tenant_id`."
Describes (right): "A tenant has up to 10 000 open charges; the list route's latency budget is 300 ms at p95 and it is measured on a seeded database of that size."

</context-examples>

## A spec and tickets from before Goal Driven Development

A project that started with a spec and tickets carries the same knowledge in another shape. Turn it into a contract without losing any of it and without deleting anything: the spec and the tickets stay where they are, as history.

- **Objective** comes from the spec's problem statement and solution, with the solution's implementation detail left out.
- **Actors and scenarios** come from the user stories, grouped by actor.
- **Success criteria** come from the acceptance criteria of the tickets and from the user stories: group them by outcome into three to seven, keep every case, and give each the proof (the spec's testing decisions name the seam). A criterion already built is still a criterion: the verifier decides it like any other.
- **Decided already** comes from the decisions recorded beside the spec.
- **Prior thinking** takes the spec's implementation decisions and the tickets still open, labelled as the earlier plan: a suggestion of slices to the full-stack-developer, not an order.
- **What exists today** says what is already built: which tickets were merged, on which branch, at which commit, and which branches hold work that was never merged.
- **Limits** come from the spec's out of scope.

Record in the contract's first line under `Status` where it came from: `Adopted from <path of the spec> on <date>`.
