import { describe, expect, it } from 'vitest'
import { CreateCategory } from '../../src/category/use-case/create-category.use-case'

const userId = '7b0f4a1e-5c1d-4a57-9f0a-1f2e3d4c5b6a'

describe('CreateCategory', () => {
  it('creates a category of the user', async () => {
    const created: unknown[] = []
    const useCase = new CreateCategory({ create: async (entity) => (created.push(entity), { isFailure: false } as never) })
    const result = await useCase.execute({ userId, name: 'Groceries', kind: 'expense' })
    expect(result.isFailure).toBe(false)
    expect(created).toHaveLength(1)
  })

  it('refuses an empty name and an unknown kind', async () => {
    const useCase = new CreateCategory({ create: async () => ({ isFailure: false }) as never })
    expect((await useCase.execute({ userId, name: ' ', kind: 'expense' })).isFailure).toBe(true)
    expect((await useCase.execute({ userId, name: 'Rent', kind: 'other' as never })).isFailure).toBe(true)
  })
})
