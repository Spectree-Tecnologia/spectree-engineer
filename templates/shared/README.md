# shared

Shared infrastructure library for domain-driven projects. It provides the DDD building blocks (`Result`, `Entity`, `ValueObject`, `UseCase`), repository contracts, a structured error system and a library of ready-to-use Value Objects.

---

## The Result pattern

The core of the library. It makes success and failure part of a function's return type, so the domain flow has no exceptions.

```typescript
// Static factories
Result.ok(value); // success with a value
Result.ok(); // success with no value (void)
Result.empty<T>(); // success with a null instance
Result.fail('ERR_CODE'); // failure with one error
Result.fail(['E1', 'E2']); // failure with several errors

// Automatic exception capture
Result.try(() => new MyVO(value)); // synchronous
await Result.tryAsync(() => repository.findById(id)); // asynchronous

// Combine several Results; collects every error if any fails
Result.combine([r1, r2, r3] as const);
await Result.combineAsync([promise1, promise2]);
```

### `ResultValidator`: fluent guard clauses

```typescript
result.validator
  .throwsIfFailed() // throws if result.isFailure
  .throwsIfNull('ERR') // throws if instance == null
  .throwsIfTrue('ERR').result; // throws if instance === true // returns the original Result
```

Every method takes an optional second parameter, `exceptionFactory`, to replace the default `ResultError` with any exception type.

### `String.prototype` extensions

The `Result` module adds three properties to the primitive `string` type:

| Extension        | Behavior                                                                          |
| ---------------- | --------------------------------------------------------------------------------- |
| `.code`          | Maps error constants to semantic codes (`INVALID_EMAIL` → `'email.invalid'`)      |
| `.value`         | Returns `this.toString()`, for compatibility with the VO interface                |
| `.equals(other)` | Compares with a string or with `{ value: string }`                                |

---

## Domain building blocks

### `Entity<Type, Props>`

Abstract class for objects with a persistent identity (a UUID). It fills in `id`, `createdAt`, `updatedAt` and `deletedAt` when they are not given.

**Cloning with a diff:**

```typescript
// Returns the new props and a typed diff of what changed
const { props, diff } = entity.cloneProps({ name: 'new' });
// diff = { name: { previous: 'old', current: 'new' } }

// Builds a new instance from the overrides and returns a Result
const result = entity.clone({ status: 'active' });
```

`clone` calls the subclass's `tryCreate` when there is one, so the entity's invariants hold.

### `ValueObject<T, Config>`

Immutable objects identified by value, not by reference. `equals` compares `value`; `config` carries context metadata.

### `UseCase<IN, OUT>`

The standard contract of the application layer:

```typescript
class CreateUser implements UseCase<CreateUserDto, User> {
  async execute(dto: CreateUserDto): Promise<Result<User>> { ... }
}
```

---

## Structured errors

### `Metadata`

Immutable, fluent context that enriches validation errors.

```typescript
const meta = new Metadata({ module: 'auth', object: 'user' });
const emailMeta = meta.to('email', 'invalid-value');
// { module: 'auth', object: 'user', attribute: 'email', value: 'invalid-value' }
```

Fields: `module`, `object`, `attribute`, `value`, `id`. Methods: `withModule/Object/Attribute/Value/Id`, `to(attribute, value?)`.

### `ValidationError`

An exception that carries `Message[]` (code + metadata) and an HTTP status. Used by VOs that need rich context.

```typescript
throw new ValidationError({ code: 'cpf.invalid', meta: meta.props }, 422);
```

### `ResultError`

A simple exception with `errors: string[]`. `ResultValidator` uses it by default when no `exceptionFactory` is given.

---

## The `create` / `tryCreate` pattern

Every VO and entity follows this contract:

| Method           | Returns     | On failure                              |
| ---------------- | ----------- | --------------------------------------- |
| `tryCreate(...)` | `Result<T>` | Returns `Result.fail`; never throws     |
| `create(...)`    | `T`         | Throws through `validator.throwsIfFailed()` |

---

## Value Objects

### Identity and text

| VO                 | Main rules                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `Id`               | UUID v4; generated when omitted; `createUUID()` returns a standalone string                                    |
| `Email`            | Trims and lowercases; exposes `local`, `domain`, `username`                                                    |
| `Alias`            | Slug `[a-z0-9]+(-[a-z0-9]+)*`; the static `format(value)` converts free text                                   |
| `PersonName`       | 3–50 chars; first and last name required (≥2 chars each); exposes `firstName`, `lastName`, `initials`          |
| `Text`             | String with `minLength`/`maxLength` set through `TextConfig`                                                   |
| `ShortDescription` | Extends `Text`; 15–80 chars by default                                                                         |
| `Description`      | Extends `Text`; 20–2000 chars by default                                                                       |

### Passwords

| VO                  | Purpose                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| `Password`          | Non-empty plain password (no strength rules)                                |
| `StrongPassword`    | At least 8 chars, an uppercase letter, a lowercase letter, a digit, a symbol |
| `HashPassword`      | bcrypt hash validated by a regex (`$2[aby]$...`)                            |
| `EncryptedPassword` | Same format as `HashPassword`; a semantic name for storage contexts         |

### Numbers and dates

| VO                | Rules                                                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PositiveInteger` | Finite integer ≥ 1                                                                                                                                        |
| `NonNegative`     | Number ≥ 0                                                                                                                                                |
| `DayOfMonth`      | Integer 1–31                                                                                                                                              |
| `DateOnly`        | A date with no time; accepts a `string` or a `Date`; normalizes to `YYYY-MM-DD`; exposes `asDate`                                                        |
| `Duration`        | Time in seconds; factories `from({ d, h, m, s })`, `inSeconds(n)`, `zero()`; getters `inMinutes/Hours/Days`, `toHMS`, `toHM`, `toMS`; method `add(duration)` |

### Others

| VO         | Rules                                                                           |
| ---------- | ------------------------------------------------------------------------------- |
| `HexColor` | `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`; normalized to uppercase with `#`       |
| `Cpf`      | Brazilian taxpayer ID; checks the verification digits; exposes `formatted` and `unformatted` |
| `Url`      | HTTP/HTTPS; exposes `domain`, `protocol`, `pathname`, `parameters`              |

---

## Repository contracts

```typescript
interface CreateRepository<T> {
  create(entity: T, tx?): Promise<Result<void>>;
}
interface UpdateRepository<T> {
  update(entity: T, tx?): Promise<Result<void>>;
}
interface FindByIdRepository<T> {
  findById(id: string): Promise<Result<T>>;
}
interface DeleteRepository {
  delete(id: string, tx?): Promise<Result<void>>;
}

// Composes all four
interface CrudRepository<T extends Entity<any, any>>
  extends CreateRepository<T>, UpdateRepository<T>, FindByIdRepository<T>, DeleteRepository {}
```

`TransactionManager<CTX>` abstracts transactions: `runInTransaction(fn)` passes a `TransactionContext` to the operation without exposing the ORM.

---

## Domain events

The only door between modules (rule 13 of `docs/architecture.md`): the publisher does not know who subscribes.

```typescript
interface DomainEvent<Payload> {
  name: string; // 'account.created'
  aggregateId: string;
  occurredAt: Date;
  payload: Payload;
}
interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
} // the port a use case receives
interface EventSubscriptions {
  subscribe(name, subscriber): () => void;
} // what the other module's wiring uses

new InMemoryEventBus(); // implements both; in-process, sequential
```

A use case publishes **after** `runInTransaction` returns `ok`; the subscriber lives in `apps/backend/src/modules/<b>/`, never in the core.

---

## Pagination DTOs

```typescript
interface PaginatedInputDTO {
  page: number;
  pageSize: number;
}
interface PaginationMetaDTO {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
interface PaginatedResultDTO<T> {
  data: T[];
  meta: PaginationMetaDTO;
}
```

---

## Scripts

```bash
npm run build        # Compiles to dist/
npm run dev          # Watch mode
npm test             # Tests (Vitest)
npm run test:cov     # Tests with coverage
```

## Dependencies

| Package | Use                          |
| ------- | ---------------------------- |
| `uuid`  | UUID v4 generation in `Id`   |
