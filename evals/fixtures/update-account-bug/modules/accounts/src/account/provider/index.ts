import { Result } from '@lab/shared'
import { Account } from '../model'

export interface AccountRepository {
  findAccount(userId: string, id: string): Promise<Result<Account>>
  existsByName(userId: string, name: string, excludeId?: string): Promise<Result<boolean>>
  update(entity: Account): Promise<Result<void>>
}
