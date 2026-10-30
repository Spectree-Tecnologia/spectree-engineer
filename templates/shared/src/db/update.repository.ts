import { Entity, Result } from '../base/index.js';
import { TransactionContext } from './transaction.manager.js';

export interface UpdateRepository<T extends Entity<any, any>> {
  update(entity: T, tx?: TransactionContext): Promise<Result<void>>;
}
