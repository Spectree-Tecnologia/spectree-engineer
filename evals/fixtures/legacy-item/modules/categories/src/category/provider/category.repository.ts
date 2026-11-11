import { Result } from '@lab/shared'
import { Category } from '../model/category.entity'

export interface CategoryRepository {
  create(entity: Category): Promise<Result<void>>
}
