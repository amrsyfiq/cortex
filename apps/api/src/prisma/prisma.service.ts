import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Wraps the generated PrismaClient as an injectable Nest provider so every
 * service receives the SAME pooled client via dependency injection (instead of
 * each file `new`-ing its own connection pool).
 *
 * It hooks into Nest's lifecycle:
 *  - onModuleInit  → open the DB connection when the app starts.
 *  - onModuleDestroy → close it cleanly on shutdown (important for tests and
 *    for not leaking connections on redeploys).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
