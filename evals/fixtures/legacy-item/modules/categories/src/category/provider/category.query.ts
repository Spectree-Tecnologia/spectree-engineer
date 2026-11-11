import { Result } from '@lab/shared'

export interface CategoryListItem {
  id: string
  name: string
  kind: 'income' | 'expense'
}

export interface CategoryQuery {
  listByUser(userId: string): Promise<Result<CategoryListItem[]>>
}
