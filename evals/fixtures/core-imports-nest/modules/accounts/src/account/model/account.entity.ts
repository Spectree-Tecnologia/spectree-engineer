import { Entity, EntityProps, Id, Result } from '@lab/shared'
import { AccountName } from './account-name.vo'
import { AccountType, AccountTypeValue } from './account-type.vo'
import { Money } from './money.vo'

export interface AccountProps extends EntityProps {
  userId: string
  name: string
  type: AccountTypeValue
  initialBalance: number
  active: boolean
}

export class Account extends Entity<Account, AccountProps> {
  private constructor(props: AccountProps) {
    super(props)
  }

  static tryCreate(props: AccountProps): Result<Account> {
    const parts = Result.combine([
      Id.tryCreate(props.id),
      Id.tryCreate(props.userId),
      AccountName.tryCreate(props.name),
      AccountType.tryCreate(props.type),
      Money.tryCreate(props.initialBalance),
    ])
    if (parts.isFailure) return parts.withFail
    const [id, userId, name, type, balance] = parts.instance
    if (balance.value < 0 && type.value !== 'checking') {
      return Result.fail('ACCOUNT_NEGATIVE_BALANCE_NOT_ALLOWED')
    }
    return Result.ok(new Account({ ...props, id: id.value, userId: userId.value, name: name.value, type: type.value, initialBalance: balance.value }))
  }

  /** Partial edit: omitted fields keep their current value. Inactive accounts are not editable. */
  update(changes: { name?: string; type?: string; initialBalance?: number }): Result<Account> {
    if (!this.props.active) return Result.fail('ACCOUNT_INACTIVE_NOT_EDITABLE')
    const defined = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined))
    return this.cloneWith(defined as Partial<AccountProps>)
  }
}
