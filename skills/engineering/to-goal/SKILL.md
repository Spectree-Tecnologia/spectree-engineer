---
name: to-goal
description: "Turn a request into a goal contract for Goal Driven Development: the objective, the success criteria with the proof that decides each one, the limits and the budget. Never the solution. Use when the user wants an outcome delivered and leaves the how to the agent that will own it."
---

A goal contract says what must be true when the work is done and how anyone can check it. It says nothing about how to get there. Modules, aggregates, files, libraries and the order of the work belong to the agent that will own the goal, and a contract that names them has taken the decision away from the one who will be able to see the code.

The contract has two readers who never talk to each other: the owner, who builds from it, and the verifier, who checks the result against it without seeing the owner's reasoning. Write it so that either one could work from it alone.

## Process

1. Read the project's vocabulary before writing: the domain glossary, the ADRs of the area, the architecture rules, and the roadmap line when the goal comes from one. Use its terms.

2. Write the **objective**: one paragraph saying who gets what, and why it matters now. If the sentence names a table, an endpoint, a component or a library, it is a solution. Move up one level, until the sentence would still be true under a different implementation.

3. Find the **success criteria**. For each thing the user wants to be true, ask "what would I run or look at to know?", and keep asking until there is an answer. A criterion is:

   - **Observable from outside the code.** A behaviour through the API or the screen, a number, a state of the data. Never "the code has X" or "uses Y".
   - **Decided by a proof.** A command whose exit code decides it, a measurement against a threshold, or an observation someone else can repeat (the built screen against the approved artboard). The proof may name a test that does not exist yet: say what it must assert, and at which seam.
   - **Not an adjective.** "Faster", "simpler", "robust" and "secure" are wishes. Turn each into the number or the observable behind it, or ask the user for it.
   - **Negative too.** What must be refused, what must not appear, what must not regress. A goal stated only by its happy path is met by the wrong system as well.

   Three to seven criteria. More than that is usually more than one goal: split it.

4. Write the **limits**: what must stay true and what must not be touched while getting there. Public contracts other code or other people depend on, data that already exists, money and external services, and what is out of scope. A limit is a boundary the owner stops at and reports, not a preference.

5. Set the **budget**: how many rounds of independent verification the goal gets before the user is asked again. Default 3.

6. Do not restate the project's standing gates (build, tests, boundary checks, latency budgets, review). They hold for every goal and live in the project's own documents. Name one here only when this goal tightens it, as a criterion with its number.

7. The objective and the criteria are the user's. Show them once, with your recommendation for anything you had to choose, and record the approval in the contract. Never ask the user how to build it.

8. Write the contract to `docs/goals/<slug>.md` with the template below. The slug is the branch's slug.

<goal-template>

# Goal: <slug>

Status: proposed
Type: <feat | fix | refactor | perf | chore>

## Objective

Who gets what, and why it matters now. No solution.

## Success criteria

| # | Criterion | Proof |
|---|-----------|-------|
| 1 | What is true, seen from outside the code. | The command, measurement or observation that decides it, and what it must assert. |

## Limits

- What must stay true or untouched.
- Out of scope: what this goal does not deliver.

## Budget

Verification rounds: 3.

## Evidence

Filled by whoever verifies, never by the owner. One row per criterion per round.

| # | Round | Verdict | Command run by the verifier and its exit code |
|---|-------|---------|-----------------------------------------------|

</goal-template>

`Status` moves through `proposed`, `approved by <who> on <date>`, `met on <date>` or `stopped on <date>: <why>`. Verdicts are `met`, `not met` or `weak proof` (the proof passes but would also pass without the behaviour).

<criterion-examples>

Weak: "The dashboard loads fast."
Strong: "The dashboard's first request answers within 300 ms at p95 with 10 000 charges in the tenant." Proof: the latency budget command for that route, on a database seeded with that volume.

Weak: "Residents can get a second copy of a bill."
Strong: "A resident with an open charge receives the second copy by e-mail within one request; a resident of another condominium asking for the same charge gets 404 and no e-mail is sent." Proof: an e2e test at the HTTP seam that asserts both, including the empty outbox.

Weak: "Use the new SDK."
Strong: "No request to the provider uses the v1 API." Proof: the contract test against the provider's sandbox recording passes, and a search for the v1 host in the source returns nothing.

</criterion-examples>
