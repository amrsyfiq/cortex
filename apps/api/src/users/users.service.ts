import { Injectable } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import type { PublicUser } from '@saas/contracts';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Users data-access + small domain helpers. Notice this service knows NOTHING
 * about HTTP, requests, or JWTs — it only deals in users and the database. That
 * makes it trivially reusable (auth uses it) and unit-testable.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  updateRefreshTokenHash(userId: string, hashedRefreshToken: string | null): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });
  }

  /**
   * Map a full DB User to the PUBLIC shape we're allowed to send to clients.
   * This is the chokepoint that guarantees passwordHash / hashedRefreshToken
   * never leak into an API response.
   */
  static toPublic(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}
