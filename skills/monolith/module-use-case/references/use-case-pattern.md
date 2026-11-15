# Use Case Pattern

## Paths

- Base contract: `packages/shared/src/base/use-case.ts`
- Use cases (examples):
  - `modules/product/src/product/use-case/create-product.use-case.ts`
  - `modules/product/src/product/use-case/update-product.use-case.ts`
  - `modules/auth/src/user/use-case/update-user.use-case.ts`
  - `modules/auth/src/user/use-case/login.use-case.ts`
  - `modules/stock/src/movement/use-case/create-movement-out.use-case.ts`
- Tests (examples):
  - `modules/branch/test/branch/create-branch.test.ts`
  - `modules/stock/test/movement/create-movement-in.test.ts`
  - `modules/stock/test/snapshot/get-stock-quantity.use-case.test.ts`
  - `modules/product/test/category/category.use-case.test.ts`

## Expected structure

1. Define `XxxIn` (and `XxxOut` when needed).
2. Declare the class as a verb, with no suffix: `CreateThing implements UseCase<CreateThingIn, void>`. A use case is a command and returns `Result<void>`; a read is a query (`module-query-cqrs`).
3. Inject dependencies through the constructor (`Repository`, `Query`, `Checker`, `Provider`).
4. Implement `execute(data)` returning `Promise<Result<...>>`.
5. Apply flow validations with an early return on failure.
6. Delegate domain invariants to the entity/VO (`tryCreate`, `cloneWith`).
7. Return the provider/repo failure or `Result.ok()`: a command returns neither a DTO nor an aggregate.

## Patterns observed in the code

- The use case orchestrates; it does not persist directly.
- Known errors are mapped to domain constants (`...Errors.NOT_FOUND`, etc.).
- The dependency may be a `Query` or a `Repository` depending on the purpose of the case:
  - Read/projection: prefer a `Query` returning a DTO.
  - Command/write: prefer a `Repository` and a domain entity.
- Combining providers is common:
  - Example: validates existence and creates the dependency if needed (`CreateMovementIn`).
- In an update:
  - Load the current state (`findById`).
  - Build the new state falling back to the current fields.
  - Revalidate with the entity (`tryCreate`/`cloneWith`) before persisting.

## Implementation checklist

- Contract:
  - `UseCase<IN, OUT>` implemented correctly.
  - `execute` with an asynchronous signature and a `Result` return.
- Dependencies:
  - Typed by interfaces (do not couple to concrete infrastructure).
  - Injected in the constructor.
- Errors:
  - Handle each dependency's failure explicitly.
  - Propagate `withFail` when it is already in the expected shape.
- Domain:
  - Create/update entities with `tryCreate` or `cloneWith`.
  - Avoid putting entity rules inside the use case.
- Persistence/reads:
  - Use `repo/query` only for data access.
  - For reads for the API/front end, prioritize a `Query` with an output DTO.
  - For writes, read with a `Repository` when needed to preserve invariants and save the entity.

## Testing strategy

- Complete happy path.
- Invalid preconditions (quantity <= 0, missing input, etc.).
- Dependency failures (repo/query returning `isFailure`).
- Conditional behavior (with snapshot/without snapshot, existing/nonexistent item).
- Expected side effect (creation in the mock repository, update called with a valid entity).

## Common pitfalls

- Mixing entity validation logic into the use case without reusing `tryCreate`.
- Not mapping dependency failures to a domain error when needed.
- Updating partially without preserving the existing `props`.
- Throwing an exception instead of returning `Result.fail` within the normal flow.

## Minimal example

```ts
import { Result, UseCase } from '@namespace/shared';
import { Thing } from '../model/thing.entity';
import { ThingRepository } from '../provider/thing.repository';

export interface CreateThingIn {
  name: string;
}

export class CreateThing implements UseCase<CreateThingIn, void> {
  constructor(private readonly repo: ThingRepository) {}

  async execute(data: CreateThingIn): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      const thingResult = Thing.tryCreate({ name: data.name }).validator.throwsIfFailed().result.instance;

      const tryCreateThing = await this.repo.create(thingResult);
      tryCreateThing.validator.throwsIfFailed();
    });
  }
}
```

## Complete example with a query to create a user

```ts
import { Password, PasswordCryptoProvider, PasswordRepository } from 'fake/path';
import { Result, TransactionManager, UseCase } from '@namespace/shared';
import { User, UserErrors, UserRepository } from 'fake/path';
import { UserExistsQuery } from 'fake/path';

export interface CreateUserIn {
  name: string;
  email: string;
  avatarUrl?: string;
  password: string;
}

export class CreateUser implements UseCase<CreateUserIn, void> {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passRepo: PasswordRepository,
    private readonly userExistsQuery: UserExistsQuery,
    private readonly passwordCryptoProvider: PasswordCryptoProvider,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(data: CreateUserIn): Promise<Result<void>> {
    return Result.tryAsync(async () => {
      const tryUserExists = await this.userExistsQuery.execute({
        email: data.email,
      });
      tryUserExists.validator.throwsIfFailed().throwsIfTrue(UserErrors.EMAIL_ALREADY_EXISTS);

      const tryHashedPassword = await this.passwordCryptoProvider.hash(data.password);
      const password = Password.create({ content: tryHashedPassword });
      const user = User.tryCreate({
        name: data.name,
        email: data.email,
        avatarUrl: data.avatarUrl?.trim() || undefined,
      }).validator.throwsIfFailed().result.instance;

      await this.transactionManager.runInTransaction(async (tx) => {
        const tryCreateUser = await this.userRepo.create(user, tx);
        tryCreateUser.validator.throwsIfFailed();

        const tryCreatePass = await this.passRepo.create(password, user.id, tx);
        tryCreatePass.validator.throwsIfFailed();
      });
    });
  }
}
```
