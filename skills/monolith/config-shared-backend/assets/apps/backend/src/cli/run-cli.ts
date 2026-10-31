import 'reflect-metadata';
import { Module, type DynamicModule, type INestApplicationContext, type Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { envSchema } from '../shared/config/env.schema.js';

type EnvKey = keyof typeof envSchema.shape;

export interface CliOptions {
  /** the command name, for messages */
  name: string;
  /** only the modules the command needs — never AppModule, which drags guards, listeners and senders along */
  modules: Array<Type<unknown> | DynamicModule>;
  /** the variables this command reads; validated with the app's schema, the rest ignored */
  env?: EnvKey[];
  /** the command itself; throw to exit 1 */
  run: (context: INestApplicationContext, args: string[]) => Promise<void>;
}

/**
 * Operator commands (onboard a tenant, rename, backfill) run from the compiled app — `node dist/cli/<name>.js` —
 * never through tsx: it emits no decorator metadata, so Nest cannot resolve constructor parameters.
 * Exit codes: 0 done, 1 the command failed, 2 the environment is invalid.
 */
export async function runCli(options: CliOptions): Promise<never> {
  const mask = {} as Record<EnvKey, true>;
  for (const key of options.env ?? []) mask[key] = true;
  const schema = options.env?.length ? envSchema.pick(mask) : envSchema;
  const validate = (config: Record<string, unknown>) => {
    const result = schema.safeParse(config);
    if (!result.success) {
      const issues = result.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
      console.error(`${options.name}: invalid environment:\n${issues.join('\n')}`);
      process.exit(2);
    }
    return result.data;
  };

  @Module({ imports: [ConfigModule.forRoot({ isGlobal: true, validate }), ...options.modules] })
  class CliModule {}

  const context = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] });
  try {
    await options.run(context, process.argv.slice(2));
    await context.close();
    process.exit(0);
  } catch (error) {
    console.error(`${options.name}: ${error instanceof Error ? error.message : String(error)}`);
    await context.close();
    process.exit(1);
  }
}
