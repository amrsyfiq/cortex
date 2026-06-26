import { type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

/**
 * The default access-token guard, registered GLOBALLY (see AppModule). It runs
 * the 'jwt' Passport strategy on every request — UNLESS the handler/controller
 * is marked @Public(), in which case we skip auth entirely.
 *
 * Global-guard + opt-out-with-a-decorator is the safest default: new endpoints
 * are protected automatically; you have to consciously make something public.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
