import { Id, Result, UseCase } from '@lab/shared'
import { Category, CategoryKind } from '../model/category.entity'
import { CategoryRepository } from '../provider/category.repository'

export interface CreateCategoryInput {
  userId: string
  name: string
  kind: CategoryKind
}

export class CreateCategory implements UseCase<CreateCategoryInput, void> {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(input: CreateCategoryInput): Promise<Result<void>> {
    const category = Category.tryCreate({ id: Id.create().value, ...input })
    if (category.isFailure) return category.withFail
    return this.categoryRepository.create(category.instance)
  }
}
