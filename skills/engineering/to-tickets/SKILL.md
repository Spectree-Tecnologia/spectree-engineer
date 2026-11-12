---
name: to-tickets
user-invocable: false
description: "For the full-stack-developer that plans a goal: break a goal contract into tickets, tracer-bullet vertical slices that each fit one fresh context, with their blocking edges, one file per ticket under .scratch/<slug>/issues/. Each ticket is then built by a new full-stack-developer. The orchestrator never calls this skill."
---

# To Tickets

Break a goal into **tickets**: tracer-bullet vertical slices, each declaring the tickets that **block** it.

This is Matt Pocock's `to-tickets`, adapted to Goal Driven Development. The source is the goal contract (`docs/goals/<slug>.md`), not a spec. The one who writes the tickets is the `full-stack-developer` that plans the goal, because the breakdown is part of the how and the how belongs to whoever sees the code. Nobody asks the user about the breakdown: the plan is judged against the architecture rules instead.

If you are the orchestrator (you talk to the user and dispatch the others), stop: you never write tickets. An item from before Goal Driven Development, with a spec and no contract, goes to the adoption path: read `commands/engineer.md`, three folders above this skill's base directory, section 3, "Projeto em andamento de antes do Goal Driven".

## Why tickets

Each ticket is built by a **new** `full-stack-developer`, in a fresh context. An agent that holds a whole goal re-reads its whole context on every turn, and that is where a goal's tokens go. A ticket is the unit that keeps the context small. So write each one for a reader who has the contract, the plan, the ticket and the code, and nothing else.

## Process

### 1. Read

The contract, `docs/architecture.md`, the glossary, the ADRs of the area and the code the goal touches. Titles and descriptions use the project's vocabulary.

Look for prefactoring that makes the goal easier. "Make the change easy, then make the easy change."

### 2. Draft vertical slices

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests): vertical, NOT a horizontal slice of one layer
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window, with room to spare
- Any prefactoring is done first, in a ticket that changes no behaviour
- The first ticket is the tracer bullet: the smallest path from the test of one success criterion down to the database
- Every success criterion of the contract is advanced by at least one ticket

</vertical-slice-rules>

Give each ticket its **blocking edges**: the other tickets that must be done before it can start. A ticket with no blockers can start immediately.

**Wide refactors are the exception to vertical slicing.** A wide refactor is one mechanical change (rename a column, retype a shared symbol) whose blast radius fans across the whole codebase, so no vertical slice can land green. Sequence it as **expand and contract**. First expand: add the new form beside the old, so nothing breaks. Then migrate the callers in batches sized by blast radius (per package), each batch its own ticket blocked by the expand, each one green because the old form still exists. Finally contract: delete the old form, alone, in a ticket blocked by every batch.

### 3. Write the tickets and the plan

One file per ticket, `.scratch/<slug>/issues/<NN>-<name>.md`, numbered from `01` in dependency order, blockers first. Never one combined file.

<ticket-template>

# <NN>: <Ticket title>

**What to build:** the end-to-end behaviour this ticket makes work, seen from outside, not a layer-by-layer list.

**Criteria:** the numbers of the contract's success criteria this ticket advances, and what proves each one here.

**Blocked by:** the numbers of the tickets that gate this one, or "None (can start immediately)".

**Reuses:** what already exists and this ticket uses, in the order of architecture rule 15: this codebase, `@<ns>/shared`, the platform and the standard library, an installed dependency. Name the path.

**New:** what this ticket creates, and why nothing that exists served.

**Status:** ready

</ticket-template>

Outside `Reuses`, avoid file paths and code snippets: they go stale. The exception is a snippet that encodes a decision more precisely than prose can (a state machine, a schema, a type shape).

`.scratch/<slug>/plan.md` is the index of the goal, and what every later `full-stack-developer` reads first:

- the tickets in order, one line each, with the criteria each advances;
- the modules and aggregates the goal touches or creates. A new module, a new event between modules and a change to `packages/shared` carry their reason;
- one line per decision, with its why (`- <what I decided>. Because <reason>.`).

### 4. The plan goes back before any code

Report the plan and stop. The orchestrator has it judged against the numbered rules of `docs/architecture.md`; `violates rule N` comes back to you to redo that part. A path the judge would not have chosen, inside the rules, is yours and stays.

### 5. Working a ticket

Work the **frontier**: a ticket whose blockers are all done. One ticket per agent.

When yours is done, write in its file `**Status:** done`, `**Done:** <sha>`, and `**Next needs:**` with what the tickets it blocks need to know and cannot read in the code: the seam you opened, the fixture that serves, the trap you found. Whoever builds them starts from zero.
