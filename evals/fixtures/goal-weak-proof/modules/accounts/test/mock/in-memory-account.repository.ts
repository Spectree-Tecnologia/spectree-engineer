import { Result } from '@lab/shared'
import { Account } from '../../src/account/model'
import { AccountRepository } from '../../src/account/provider'

export class InMemoryAccountRepository implements AccountRepository {
  constructor(public items: Account[] = []) {}

  async findAccount(userId: string, id: string): Promise<Result<Account>> {
    const found = this.items.find((one) => one.props.id === id && one.props.userId === userId)
    return found ? Result.ok(found) : Result.fail('ACCOUNT_NOT_FOUND')
  }

  async existsByName(userId: string, name: string, excludeId?: string): Promise<Result<boolean>> {
    return Result.ok(this.items.some((one) => one.props.userId === userId && one.props.name === name && one.props.id !== excludeId))
  }

  async update(entity: Account): Promise<Result<void>> {
    this.items = this.items.map((one) => (one.props.id === entity.props.id ? entity : one))
    return Result.ok()
  }
}
