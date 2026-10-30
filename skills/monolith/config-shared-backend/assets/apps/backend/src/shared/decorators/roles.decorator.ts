import { SetMetadata } from '@nestjs/common';

export const REQUIRED_ROLES = 'requiredRoles';

/** Closes the route to tokens carrying at least one of these roles; JwtGuard enforces it after validating the token. */
export const Roles = (...roles: string[]) => SetMetadata(REQUIRED_ROLES, roles);
