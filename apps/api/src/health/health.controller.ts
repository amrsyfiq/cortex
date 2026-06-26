import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Health checks. Load balancers, Kubernetes, and uptime monitors hit these to
 * decide whether the instance is alive and ready to serve traffic.
 *  - /health      → "is the process up?" (liveness)
 *  - /health/ready → "can it actually reach the DB?" (readiness)
 *
 * Both are @Public so they don't require a token.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  liveness() {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  async readiness() {
    // A trivial query proves the DB connection is usable, not just configured.
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', db: 'up' };
  }
}
