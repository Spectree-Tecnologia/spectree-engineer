import { z } from 'zod';

// the whole environment, checked once at boot: a missing variable is a startup error, not a 500 later
export const envSchema = z.object({
  {{BACKEND_PORT_ENV_VAR}}: z.coerce.number().int().positive().default({{BACKEND_PORT}}),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// URL'),
  JWT_SECRET: z.string().min(32, 'must have at least 32 characters'),
  FRONTEND_URL: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${issues.join('\n')}`);
  }
  return result.data;
}
