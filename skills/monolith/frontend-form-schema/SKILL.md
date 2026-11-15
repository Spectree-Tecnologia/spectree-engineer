---
name: frontend-form-schema
user-invocable: false
description: 'Create, review or guide frontend forms and validation schemas in the Web project''s pattern. Use when the request involves React Hook Form form components, files `apps/frontend/src/modules/<domain>/data/*.schema.ts`, validation with `v` (`@namespace/shared`), typing with `v.infer`, optional fields/refinements/arrays and error integration with the shared form components.'
---

# Frontend Form Schema

## Overview

Apply the project's form pattern with React Hook Form + the `v` validator, keeping the schema typed, validation consistent and error rendering standardized.

## Guidelines

- Prefer `v` (`@namespace/shared`) as the default schema/resolver.
- Define the schema with `v.defineObject`, arrays with `v.defineArray` and cross-field validation with `.refine`.
- Type the form payload with `v.infer<typeof schema>`.
- Integrate with RHF via `resolver: v.resolver(schema)`.
- Use the shared form components (`Form`, `FormField`, `FormControl`, `FormMessage`, `FormButtonSubmit`).
- In update forms, make fields optional when appropriate (`{ vo: X, optional: true }`).

## Workflow

1. Define the form type (create/update/profile/filter).
2. Create or adjust the schema in `data/*.schema.ts`.
3. Export the `FormData` type with `v.infer`.
4. Connect the schema to `useForm` with `v.resolver`.
5. Review `defaultValues`, field parsing and error messages.
6. Update the schemas' `index.ts` when needed.

## References

See `references/form-schema-pattern.md` for concrete examples, a checklist and pitfalls.

