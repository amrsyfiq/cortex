import { SetMetadata } from '@nestjs/common';

/**
 * Our JwtAuthGuard is registered GLOBALLY, so by default every route requires a
 * valid access token. Mark a route handler (or whole controller) with @Public()
 * to opt OUT — e.g. /auth/login, /auth/register, /health.
 *
 * The guard reads this metadata key and skips auth when it's present.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
