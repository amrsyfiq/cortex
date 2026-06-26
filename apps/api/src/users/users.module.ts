import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * Exports UsersService so other modules (notably AuthModule) can inject it.
 * This is how Nest modules share providers: a provider is only visible outside
 * its module if the module lists it in `exports`.
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
