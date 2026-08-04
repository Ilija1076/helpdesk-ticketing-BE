import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SLA_QUEUE } from '../sla/sla.constants';
import { HealthController } from './health.controller';

@Module({
  imports: [BullModule.registerQueue({ name: SLA_QUEUE })],
  controllers: [HealthController],
})
export class HealthModule {}
