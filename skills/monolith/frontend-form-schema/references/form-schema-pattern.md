# Frontend Form + Schema Pattern

## Reference paths

- Validator and shared components:
  - `apps/frontend/src/shared/components/form/validator/*`
  - `apps/frontend/src/shared/components/form/form.component.tsx`
- Schemas (examples):
  - `apps/frontend/src/modules/auth/data/login.schema.ts`
  - `apps/frontend/src/modules/auth/data/create-user.schema.ts`
  - `apps/frontend/src/modules/product/data/create-product.schema.ts`
  - `apps/frontend/src/modules/product/data/update-product.schema.ts`
- Forms (examples):
  - `apps/frontend/src/modules/auth/pages/create-user.page.tsx`
  - `apps/frontend/src/modules/product/components/product-form.component.tsx`
  - `apps/frontend/src/modules/auth/components/change-password-form.component.tsx`

## Main pattern

- Default stack:
  - `react-hook-form` + `v` (`@namespace/shared`)
- Schema:
  - `v.defineObject({...})`
  - `v.defineArray(...)`
  - `.refine(...)` for cross-field validation
- Typing:
  - `type XxxFormData = v.infer<typeof xxxSchema>`
- Resolver:
  - `resolver: v.resolver(xxxSchema)`

## Create vs Update

- Create schema:
  - fields usually required.
- Update schema:
  - optional fields when the endpoint accepts a partial payload:
    - `{ vo: Name, optional: true }`

## Complex fields

- Array of VOs:
  - `v.defineArray(URL, { optional: true })`
- Array of objects:
  - `v.defineArray({ name: SubCategoryName, id: { vo: Id, optional: true } })`
- VO config:
  - `{ vo: Description, config: { minLength: 10 } }`

## UI composition

- Use the shared components:
  - `Form`
  - `FormField`
  - `FormItem`
  - `FormControl`
  - `FormMessage`
  - `FormButtonSubmit`
- Avoid rendering errors manually when `FormMessage` handles the case.

## Exceptions and legacy

- Zod is used in a few places in the project, but the pattern to follow is `v`.
- During maintenance, prefer migrating to `v` when changing legacy forms.

## Checklist

- [ ] Schema created/updated in the correct module.
- [ ] `FormData` inferred with `v.infer`.
- [ ] `resolver: v.resolver(schema)` applied.
- [ ] `defaultValues` consistent with the schema and mode (create/update).
- [ ] Error messages shown via `FormMessage`.
- [ ] Barrel `index.ts` updated when a new schema is added.

## Common pitfalls

- Mixing Zod and `v` needlessly in the same flow.
- Forgetting `optional: true` in update forms.
- Not converting the input type before sending (e.g. `string` -> `number`).
- Not using `.refine` for rules across fields (e.g. password confirmation).
