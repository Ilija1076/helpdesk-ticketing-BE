import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SlaBreachProcessor } from './sla-breach.processor';
import { SlaBreachScheduler } from './sla-breach.scheduler';
import { SlaBreachService } from './sla-breach.service';
import { SLA_QUEUE } from './sla.constants';
import { SlaService } from './sla.service';

@Module({
  imports: [BullModule.registerQueue({ name: SLA_QUEUE })],
  providers: [SlaService, SlaBreachService, SlaBreachProcessor, SlaBreachScheduler],
  exports: [SlaService, SlaBreachService],
})
export class SlaModule {}
