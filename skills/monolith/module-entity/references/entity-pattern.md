# Entity Pattern

## Paths

- Base entity: `packages/shared/src/base/entity.ts`
- Entities (examples):
  - `modules/auth/src/user/model/user.entity.ts`
  - `modules/auth/src/permission/model/permission.entity.ts`
  - `modules/branch/src/branch/model/branch.entity.ts`
  - `modules/stock/src/movement/model/movement.entity.ts`
  - `modules/product/src/product/model/product.entity.ts`
- Reference tests:
  - `packages/shared/test/base/entity.test.ts`
  - `modules/branch/test/branch/branch.entity.test.ts`
  - `modules/stock/test/movement/movement.entity.test.ts`
  - `modules/stock/test/stock/stock.entity.test.ts`

## Expected structure

1. Define `XxxProps extends EntityProps`.
2. Declare the class `Xxx extends Entity<Xxx, XxxProps>`.
3. `private/protected` constructor + `super(props)`.
4. Getters for relevant fields.
5. `static create(props)` delegating to `tryCreate` + `throwsIfFailed`.
6. `static tryCreate(props)` validating invariants and returning `Result`.
7. `Result.combine([...])` to consolidate VO errors.
8. Return the instance with normalized values (`instance.value`).

## Implementation checklist

- `id`:
  - Use `Id.tryCreate(props.id)` when optional.
  - Use `Id.required(...)` when the field is mandatory (e.g. a mandatory relation).
- VOs:
  - Validate text, name, alias, sku, url, number, price with the appropriate VOs.
- Nested entities:
  - Validate with `Xxx.tryCreate` and store `instance.props`/`instance.value` in `props`.
- Lists:
  - For arrays of IDs/VOs, map to `tryCreate`, combine the results and store normalized values.
- Errors:
  - On failure, return `Result.fail(attributes.errors!)` or `attributes.withFail`.
- Domain methods:
  - When there is a state rule, encapsulate it in an entity method (e.g. `deactivate`, `moveSubcategory`, specific factories).

## Patterns observed in the code

- Identity and timestamps are handled by the base `Entity` class.
- `equals` and `notEquals` are by `id`.
- `cloneWith` does a deep merge and reapplies validation via `tryCreate`.
- Some entities use getters that materialize a VO/Entity from `props` (e.g. `Stock.location`, `Branch.address`).

## Minimal example

```ts
import { Entity, EntityProps, Id, Name, Result } from '@namespace/shared';

export interface ExampleProps extends EntityProps {
  name: string;
}

export class Example extends Entity<Example, ExampleProps> {
  private constructor(props: ExampleProps) {
    super(props);
  }

  static create(props: ExampleProps): Example {
    const result = Example.tryCreate(props);
    result.validator.throwsIfFailed();
    return result.instance;
  }

  static tryCreate(props: ExampleProps): Result<Example> {
    const id = Id.tryCreate(props.id);
    const name = Name.tryCreate(props.name);

    const attrs = Result.combine([id, name]);
    if (attrs.isFailure) return Result.fail(attrs.errors!);

    return Result.ok(
      new Example({
        ...props,
        id: id.instance.value,
        name: name.instance.value,
      }),
    );
  }

  get name(): string {
    return this.props.name;
  }

  get $name(): Name {
    return Name.create(this.props.name);
  }
}
```

## Testing strategy

- Valid creation (`tryCreate.isOk`, `create` returns an instance).
- Invalid creation (`tryCreate.isFailure`, `create` throws an error).
- Equality by `id` (`equals`/`notEquals`).
- `cloneWith` with a valid and an invalid update.
- Normalization scenarios (when there are VOs that normalize input).

## Common pitfalls

- Forgetting normalization when building `new Entity` (using the raw value instead of `instance.value`).
- Not validating arrays (e.g. `roleIds`, URLs).
- Introducing a domain rule outside the entity (scattered in a use case without need).
- Creating a mutable setter instead of using a domain method + `cloneWith`.
