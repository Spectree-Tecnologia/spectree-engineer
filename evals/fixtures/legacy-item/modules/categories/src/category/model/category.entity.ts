import { Entity, EntityProps, Id, Result } from '@lab/shared'

export type CategoryKind = 'income' | 'expense'

export interface CategoryProps extends EntityProps {
  userId: string
  name: string
  kind: CategoryKind
}

export class Category extends Entity<Category, CategoryProps> {
  private constructor(props: CategoryProps) {
    super(props)
  }

  static tryCreate(props: CategoryProps): Result<Category> {
    const ids = Result.combine([Id.tryCreate(props.id), Id.tryCreate(props.userId)])
    if (ids.isFailure) return ids.withFail
    const name = props.name.trim()
    if (name.length === 0) return Result.fail('CATEGORY_NAME_REQUIRED')
    if (name.length > 40) return Result.fail('CATEGORY_NAME_TOO_LONG')
    if (props.kind !== 'income' && props.kind !== 'expense') return Result.fail('CATEGORY_KIND_INVALID')
    return Result.ok(new Category({ ...props, name }))
  }
}
