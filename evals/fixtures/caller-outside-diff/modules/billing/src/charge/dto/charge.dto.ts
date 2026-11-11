import { Charge, ChargeStatus } from '../model'

export interface ChargeDto {
  id: string
  unitId: string
  description: string
  /** Decimal string with four places (architecture rule 12). */
  amount: string
  status: ChargeStatus
  dueDate: string
}

export const toChargeDto = (charge: Charge): ChargeDto => ({
  id: charge.props.id,
  unitId: charge.props.unitId,
  description: charge.props.description,
  amount: charge.props.amount.toFixed(4),
  status: charge.props.status,
  dueDate: charge.props.dueDate,
})
