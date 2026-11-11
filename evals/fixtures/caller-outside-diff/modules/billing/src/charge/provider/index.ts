import { Result } from '@lab/shared'
import { Charge } from '../model'

export interface ChargeRepository {
  findCharge(unitId: string, id: string): Promise<Result<Charge>>
  update(entity: Charge): Promise<Result<void>>
}
