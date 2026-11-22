import { randomUUID } from 'node:crypto';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { DbModule } from '../db/db.module.js';
import { JwtStrategy } from './auth/jwt.strategy.js';
import { JwtGuard } from './auth/jwt.guard.js';
import { validateEnv } from './config/env.schema.js';
import { LOG_REDACT_PATHS, REQUEST_LOG_SERIALIZERS } from './config/log-redact.js';
import { HealthController } from './health/health.controller.js';

@Global()
@Module({
  imports: [
    // validateEnv runs here, before any provider: a bad .env never gets as far as listening
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // JwtGuard assigns userId once it knows it; assignResponse puts it on the final request line too
        assignResponse: true,
        pinoHttp: {
          level: configService.get<string>('LOG_LEVEL', 'info'),
          genReqId: (req, res) => {
            const incoming = req.headers['x-request-id'];
            const id = typeof incoming === 'string' ? incoming : randomUUID();
            res.setHeader('x-request-id', id);
            return id;
          },
          customAttributeKeys: { reqId: 'requestId' },
          quietReqLogger: true,
          // the request line by allowlist: no header, no query (a refresh token in set-cookie, a magic link's ?token=)
          redact: LOG_REDACT_PATHS,
          serializers: REQUEST_LOG_SERIALIZERS,
          autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/ready' },
        },
      }),
    }),
    DbModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // no default: the app refuses to boot without a real secret
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
    // THROTTLE_LIMIT exists for `npm run perf`, which fires far more than 100/min at one route on purpose
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: Number(process.env.THROTTLE_LIMIT ?? 100) }] }),
  ],
  controllers: [HealthController],
  providers: [
    JwtStrategy,
    JwtGuard,
    // every route is closed unless it carries @Public(); every client is rate-limited
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtGuard },
  ],
  exports: [JwtModule, JwtGuard],
})
export class SharedModule {}
