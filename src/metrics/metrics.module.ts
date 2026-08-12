import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SLA_QUEUE } from '../sla/sla.constants';
import { DomainMetricsService } from './domain-metrics.service';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: SLA_QUEUE })],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    DomainMetricsService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
