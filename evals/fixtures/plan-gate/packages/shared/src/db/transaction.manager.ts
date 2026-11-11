export interface TransactionContext { readonly client: unknown }
export interface TransactionManager {
  runInTransaction<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T>
}
export interface CreateRepository<E> { create(entity: E, tx?: TransactionContext): Promise<Result<void>> }
export interface UpdateRepository<E> { update(entity: E, tx?: TransactionContext): Promise<Result<void>> }
// No FindByIdRepository scoped by userId: each module declares its own `findAccount(userId, id)`-style method.
import type { Result } from '../base/result'
