import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * @Global means any module can inject PrismaService without importing
 * PrismaModule explicitly. DB access is needed almost everywhere, so making it
 * global avoids repetitive imports. (Use @Global sparingly — it's the right
 * call for truly cross-cutting infrastructure like the DB client.)
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
