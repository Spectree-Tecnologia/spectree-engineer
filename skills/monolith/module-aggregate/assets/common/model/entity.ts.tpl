import { Entity, EntityProps, Result } from '__SHARED_PACKAGE__'

export interface __AGGREGATE_CLASS_NAME__Props extends EntityProps {}

export class __AGGREGATE_CLASS_NAME__ extends Entity<
  __AGGREGATE_CLASS_NAME__,
  __AGGREGATE_CLASS_NAME__Props
> {
  private constructor(props: __AGGREGATE_CLASS_NAME__Props) {
    super(props)
  }

  // cloneWith() routes through tryCreate: invariants that span props live here, as Result codes
  static tryCreate(props: __AGGREGATE_CLASS_NAME__Props): Result<__AGGREGATE_CLASS_NAME__> {
    return Result.ok(new __AGGREGATE_CLASS_NAME__(props))
  }
}
