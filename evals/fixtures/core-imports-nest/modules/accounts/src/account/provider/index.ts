import { Result } from '@lab/shared'
import { Account } from '../model'

export interface AccountRepository {
  create(entity: Account): Promise<Result<void>>
  existsByName(userId: string, name: string, excludeId?: string): Promise<Result<boolean>>
}
