import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { AppConfiguration } from '../config/configuration';
import { SLA_BREACH_SCAN_JOB, SLA_BREACH_SCHEDULER_ID, SLA_QUEUE } from './sla.constants';

@Injectable()
export class SlaBreachScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(SlaBreachScheduler.name);

  constructor(
    @InjectQueue(SLA_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService<AppConfiguration, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const every = this.config.get('sla.scanIntervalMs', { infer: true });

    await this.queue.upsertJobScheduler(
      SLA_BREACH_SCHEDULER_ID,
      { every },
      {
        name: SLA_BREACH_SCAN_JOB,
        opts: { removeOnComplete: 100, removeOnFail: 100 },
      },
    );

    this.logger.log(`SLA breach scanner scheduled every ${every}ms`);
  }
}
