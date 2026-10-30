import { Result, UseCase } from '@lab/shared'
import { Account } from '../model'
import { AccountRepository } from '../provider'

export interface UpdateAccountInput {
  userId: string
  id: string
  name?: string
  type?: string
  initialBalance?: number
}

export class UpdateAccount implements UseCase<UpdateAccountInput, void> {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(input: UpdateAccountInput): Promise<Result<void>> {
    const found = await this.accountRepository.findAccount(input.userId, input.id)
    if (found.isFailure) return found.withFail
    const current = found.instance.props

    const updated = Account.tryCreate({
      ...current,
      name: input.name ?? '',
      type: input.type ?? 'checking',
      initialBalance: input.initialBalance ?? 0,
    })
    if (updated.isFailure) return updated.withFail

    const exists = await this.accountRepository.existsByName(input.userId, updated.instance.props.name, input.id)
    if (exists.isFailure) return exists.withFail
    if (exists.instance) return Result.fail('ACCOUNT_NAME_ALREADY_EXISTS')

    return this.accountRepository.update(updated.instance)
  }
}
