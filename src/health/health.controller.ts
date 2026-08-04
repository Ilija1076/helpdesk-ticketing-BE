import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SLA_QUEUE } from '../sla/sla.constants';

type ComponentState = 'up' | 'down';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SLA_QUEUE) private readonly queue: Queue,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness and dependency check' })
  async check() {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const status = database === 'up' && redis === 'up' ? 'ok' : 'degraded';
    const body = { status, details: { database, redis } };

    if (status !== 'ok') {
      throw new ServiceUnavailableException(body);
    }

    return body;
  }

  private async checkDatabase(): Promise<ComponentState> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<ComponentState> {
    try {
      const client = (await this.queue.client) as unknown as Redis;
      const pong = await client.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
