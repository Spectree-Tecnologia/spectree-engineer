# VO Pattern

## Paths

- Global VOs (shared):
  - `packages/shared/src/vo/*.vo.ts`
  - `packages/shared/test/vo/*.vo.test.ts`
- Module VOs (domain):
  - `modules/<domain>/src/<feature>/model/<name>.vo.ts`
  - `modules/<domain>/test/<feature>/<name>.vo.test.ts`
- Base VO: `packages/shared/src/base/vo.ts`
- Result: `packages/shared/src/base/result.ts`

## Core Principles

- Immutability: value set in the constructor and no setters.
- Invariants: validate in `tryCreate` and return `Result.fail` when violated.
- Normalization: apply `trim`, `toLowerCase`, formatting or defaults when it makes sense.
- Errors: use static constants with a readable code (e.g. `INVALID_EMAIL`).
- Consistent API: `create` -> calls `tryCreate`, `throwsIfFailed`, returns `instance`.

## Skeleton

```ts
import { Result, ValueObject, ValueObjectConfig } from '../base';

export class ExampleVo extends ValueObject<string, ValueObjectConfig> {
  private static readonly INVALID_EXAMPLE = 'INVALID_EXAMPLE';
  private constructor(value: string, config?: ValueObjectConfig) {
    super(value, config);
  }

  public static create(value: string, config?: ValueObjectConfig): ExampleVo {
    const result = ExampleVo.tryCreate(value, config);
    result.validator.throwsIfFailed();
    return result.instance;
  }

  public static tryCreate(value: string, config?: ValueObjectConfig): Result<ExampleVo> {
    try {
      const normalized = value.trim();
      if (!normalized) {
        throw new Error(ExampleVo.INVALID_EXAMPLE);
      }
      return Result.ok(new ExampleVo(normalized, config));
    } catch (error: any) {
      return Result.fail(error.message);
    }
  }
}
```

## Reference VOs

- `email.vo.ts` for normalization, regex and the `local`/`domain` getters.
- `id.vo.ts` for default generation (uuid) and the `required` method.
- `permission-id.vo.ts` for inheritance that only specializes the error message.
- `strong-password.vo.ts` for multiple validations.
- `url.vo.ts` and `number.vo.ts` for cases of different types.

## Test Pattern

- Validate success and failure (`isOk`, `isFailure`, `errors`).
- Check the normalization of the stored value.
- Test `create` throwing an error when invalid.
- Cover derived getters when they exist.
