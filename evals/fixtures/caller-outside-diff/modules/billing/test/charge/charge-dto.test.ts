import { describe, expect, it } from 'vitest'
import { toChargeDto } from '../../src/charge/dto/charge.dto'
import { Charge } from '../../src/charge/model'

const id = '0c9d8e7f-6a5b-4c3d-8e2f-1a0b9c8d7e6f'
const unitId = '7b0f4a1e-5c1d-4a57-9f0a-1f2e3d4c5b6a'

const charge = (amount: number) =>
  Charge.create({ id, unitId, description: 'Condominium fee', amount, status: 'open', dueDate: '2026-12-10' })

describe('toChargeDto', () => {
  it('carries the amount as a decimal string with four places', () => {
    expect(toChargeDto(charge(150)).amount).toBe('150.0000')
    expect(toChargeDto(charge(0.1 + 0.2)).amount).toBe('0.3000')
  })

  it('carries zero as 0.0000', () => {
    expect(toChargeDto(charge(0)).amount).toBe('0.0000')
  })
})
