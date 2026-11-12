import { Entity, EntityProps, Id, Result } from '@lab/shared'

export type ChargeStatus = 'open' | 'paid' | 'cancelled'

export interface ChargeProps extends EntityProps {
  unitId: string
  description: string
  amount: number
  status: ChargeStatus
  dueDate: string
}

export class Charge extends Entity<Charge, ChargeProps> {
  private constructor(props: ChargeProps) {
    super(props)
  }

  static tryCreate(props: ChargeProps): Result<Charge> {
    const parts = Result.combine([Id.tryCreate(props.id), Id.tryCreate(props.unitId)])
    if (parts.isFailure) return parts.withFail
    if (props.amount < 0) return Result.fail('CHARGE_NEGATIVE_AMOUNT')
    return Result.ok(new Charge(props))
  }

  static create(props: ChargeProps): Charge {
    const result = Charge.tryCreate(props)
    result.throwsIfFailed()
    return result.instance
  }
}
