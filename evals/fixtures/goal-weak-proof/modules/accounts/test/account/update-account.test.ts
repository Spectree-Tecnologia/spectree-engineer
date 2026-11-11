import { describe, expect, it } from 'vitest'
import { Account } from '../../src/account/model'
import { UpdateAccount } from '../../src/account/use-case/update-account.use-case'
import { InMemoryAccountRepository } from '../mock/in-memory-account.repository'

const userId = '7b0f4a1e-5c1d-4a57-9f0a-1f2e3d4c5b6a'
const id = '0c9d8e7f-6a5b-4c3d-8e2f-1a0b9c8d7e6f'

const savings = () =>
  Account.create({ id, userId, name: 'Itau', type: 'savings', initialBalance: 1500, active: true })

describe('UpdateAccount', () => {
  it('edits only the name', async () => {
    const repository = new InMemoryAccountRepository([savings()])

    const result = await new UpdateAccount(repository).execute({ userId, id, name: 'Nubank' })

    expect(result.isOk).toBe(true)
    expect(repository.items[0].props.name).toBe('Nubank')
  })
})
