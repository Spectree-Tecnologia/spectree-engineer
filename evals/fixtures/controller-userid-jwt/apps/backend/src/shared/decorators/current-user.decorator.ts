import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { AuthenticatedUser } from '@lab/shared'

/** The user the JwtGuard put on the request; `@CurrentUser('id')` reads one field. */
export const CurrentUser = createParamDecorator((field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
  const user = ctx.switchToHttp().getRequest().user as AuthenticatedUser
  return field ? user[field] : user
})
