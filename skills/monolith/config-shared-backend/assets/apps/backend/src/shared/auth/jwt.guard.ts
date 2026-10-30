import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PinoLogger } from 'nestjs-pino';
import { PUBLIC_ROUTE } from '../decorators/public.decorator.js';
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
    // from here on every log line of this request, the final one included, names who made it
    this.logger.assign({ userId: context.switchToHttp().getRequest<AuthenticatedRequest>().user.id });
    return allowed;
  }
}
