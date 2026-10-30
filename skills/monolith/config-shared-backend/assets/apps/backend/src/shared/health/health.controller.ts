import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../db/prisma.service.js';
import { Public } from '../decorators/public.decorator.js';

// liveness and readiness for the container runtime: public and unthrottled, so a probe never gets 401 or 429
@Controller()
@Public()
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('database unreachable');
    }
    return { status: 'ok' };
  }
}
