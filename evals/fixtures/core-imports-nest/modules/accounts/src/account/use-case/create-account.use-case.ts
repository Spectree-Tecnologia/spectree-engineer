import { Injectable } from '@nestjs/common'
import { Result, UseCase } from '@lab/shared'
import { Account } from '../model'
import { AccountRepository } from '../provider'

export interface CreateAccountInput {
  userId: string
  name: string
  type: string
  initialBalance?: number
}

@Injectable()
export class CreateAccount implements UseCase<CreateAccountInput, string> {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(input: CreateAccountInput): Promise<Result<string>> {
    const account = Account.tryCreate({
      id: crypto.randomUUID(),
      userId: input.userId,
      name: input.name,
      type: input.type,
      initialBalance: input.initialBalance ?? 0,
      active: true,
    })
    if (account.isFailure) return account.withFail

    const exists = await this.accountRepository.existsByName(input.userId, account.instance.props.name)
    if (exists.isFailure) return exists.withFail
    if (exists.instance) return Result.fail('ACCOUNT_NAME_ALREADY_EXISTS')

    const saved = await this.accountRepository.create(account.instance)
    if (saved.isFailure) return saved.withFail
    return Result.ok(account.instance.id)
  }
}
