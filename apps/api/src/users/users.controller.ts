import { Controller, Get, NotFoundException } from '@nestjs/common';
import type { PublicUser } from '@saas/contracts';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { UsersService } from './users.service';

/**
 * Routes about the CURRENTLY logged-in user. There's intentionally no "get any
 * user by id" endpoint — in a multi-tenant app you expose users only through
 * the org they belong to, never globally.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** GET /users/me — the profile of whoever's access token was sent. */
  @Get('me')
  async me(@CurrentUser() current: AuthenticatedUser): Promise<PublicUser> {
    const user = await this.users.findById(current.id);
    if (!user) throw new NotFoundException('User not found');
    return UsersService.toPublic(user);
  }
}
