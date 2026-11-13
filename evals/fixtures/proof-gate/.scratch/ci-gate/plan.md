# Plan — ci-gate

## Tickets

1. `issues/01-workflow-proof.md` — The workflow check (tracer bullet). Advances criterion 1.
2. `issues/02-specs-proof.md` — The specs check. Advances criterion 2. Blocked by 01.
3. `issues/03-faster-workflow.md` — The faster workflow, under both checks. Blocked by 01 and 02.

## Decisions

- One script with two modes, `workflow` and `specs`. Because both read the baseline the same way.
- The script has no dependency: it reads the YAML with a small parser of its own. Because the check runs before `npm ci`.
