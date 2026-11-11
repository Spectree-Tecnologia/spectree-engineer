import { ChargeDto } from '../../charge/dto/charge.dto'

export interface StatementDto {
  unitId: string
  /** What the unit still owes, the largest charge first. */
  openCharges: ChargeDto[]
}

export const toStatementDto = (unitId: string, charges: ChargeDto[]): StatementDto => ({
  unitId,
  openCharges: charges.filter((charge) => charge.status === 'open').sort((a, b) => (a.amount > b.amount ? -1 : 1)),
})
