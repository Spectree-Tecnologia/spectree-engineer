import { Entity, Result } from '../base/index.js';
import { TransactionContext } from './transaction.manager.js';

export interface CreateRepository<T extends Entity<any, any>> {
  create(entity: T, tx?: TransactionContext): Promise<Result<void>>;
}
