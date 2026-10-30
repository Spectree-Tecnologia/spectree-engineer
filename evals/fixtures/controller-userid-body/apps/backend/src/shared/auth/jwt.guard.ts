import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/** Registered as APP_GUARD: every route is closed unless marked @Public(). */
@Injectable()
export class JwtGuard extends AuthGuard('jwt') {}
