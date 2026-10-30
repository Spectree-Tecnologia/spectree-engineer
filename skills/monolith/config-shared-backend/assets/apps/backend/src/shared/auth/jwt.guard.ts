import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PinoLogger } from 'nestjs-pino';
import { PUBLIC_ROUTE } from '../decorators/public.decorator.js';
import { REQUIRED_ROLES } from '../decorators/roles.decorator.js';
import { AuthenticatedRequest } from '../types/authenticated-request.type.js';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // passport's guard resolves to a boolean; the Observable in its declared type is the generic CanActivate contract
    const allowed = (await super.canActivate(context)) as boolean;
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    // from here on every log line of this request, the final one included, names who made it
    this.logger.assign({ userId: user.id });

    // @Roles('admin') closes the route to those claims on top of the token (architecture rule 14)
    const required = this.reflector.getAllAndOverride<string[] | undefined>(REQUIRED_ROLES, [context.getHandler(), context.getClass()]);
    if (required?.length && !required.some((role) => user.roles.includes(role))) {
      throw new ForbiddenException('FORBIDDEN_ROLE');
    }
    return allowed;
  }
}
