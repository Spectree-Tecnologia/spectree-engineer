import { Result } from '../base/index.js';
import { TransactionContext } from './transaction.manager.js';

export interface DeleteRepository {
  delete(id: string, tx?: TransactionContext): Promise<Result<void>>;
}
