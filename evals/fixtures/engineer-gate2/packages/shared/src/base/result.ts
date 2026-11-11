export class Result<T> {
  static ok<T>(instance?: T): Result<T>
  static fail<T>(code: string): Result<T>
  static combine(results: Result<unknown>[]): Result<unknown[]>
  readonly isFailure: boolean
  readonly instance: T
  readonly errors: string[]
  readonly withFail: Result<never>
}
export interface UseCase<I, O> { execute(input: I): Promise<Result<O>> }
export abstract class Entity<E, P extends { id: string }> { readonly id: string; readonly props: P; cloneWith(changes: Partial<P>): Result<E> }
export abstract class ValueObject<V> { readonly value: V }
