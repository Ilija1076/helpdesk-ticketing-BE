import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SLA_QUEUE } from './sla.constants';
import { BreachScanResult, SlaBreachService } from './sla-breach.service';

@Processor(SLA_QUEUE)
export class SlaBreachProcessor extends WorkerHost {
  private readonly logger = new Logger(SlaBreachProcessor.name);

  constructor(private readonly breachService: SlaBreachService) {
    super();
  }

  async process(job: Job): Promise<BreachScanResult> {
    this.logger.debug(`Running ${job.name}`);
    return this.breachService.scan();
  }
}
