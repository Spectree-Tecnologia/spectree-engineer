---
name: module-value-object
user-invocable: false
description: Create, review or guide the implementation of module Value Objects in the project. Use when the request involves "value object", "VO", validation and normalization rules for domain attributes, creating new files with the `ValueObject` + `Result` pattern, or the `module-value-object` skill.
---

# Module Value Object

## Overview

Apply the project's Value Object pattern, ensuring immutability, validation of invariants, data normalization and the `create/tryCreate` interface with `Result`.

## Guidelines

- Read `references/vo-pattern.md` before creating or modifying VOs.
- Reuse the existing pattern of `ValueObject`, `Result` and `ValueObjectConfig`.
- Prefer explicit validations with static error codes (e.g. `INVALID_EMAIL`).
- Expose helper methods only when they add value (e.g. derived getters).

## Workflow

1. Identify the VO's base type (string, number, etc.) and its invariants.
2. Check existing VOs to avoid duplication or to align rules.
3. Implement the VO following the standard skeleton (see the reference).
4. Add tests in `packages/shared/test/vo` (global VOs) or `modules/<domain>/test/<feature>/` (module VOs), mirroring the cases in the reference.
5. Review the public API to keep it consistent (`create`, `tryCreate`, errors).

## References

See `references/vo-pattern.md` for patterns, examples and the project's relevant paths.
