import { Result, UseCase } from '@lab/shared'
import { ChargeRepository } from '../provider'

export interface ArchiveChargeInput {
  unitId: string
  id: string
}

export class ArchiveCharge implements UseCase<ArchiveChargeInput, void> {
  constructor(private readonly chargeRepository: ChargeRepository) {}

  async execute(input: ArchiveChargeInput): Promise<Result<void>> {
    const found = await this.chargeRepository.findCharge(input.unitId, input.id)
    if (found.isFailure) return found.withFail
    if (found.instance.props.status === 'open') return Result.fail('CHARGE_OPEN_NOT_ARCHIVABLE')
    return this.chargeRepository.update(found.instance.cloneWith({ status: 'cancelled' }).instance)
  }
}
