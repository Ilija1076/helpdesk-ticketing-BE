import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Gauge } from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';
import { SLA_QUEUE } from '../sla/sla.constants';
import { MetricsService } from './metrics.service';

const QUEUE_STATES = ['waiting', 'active', 'completed', 'failed', 'delayed'] as const;

@Injectable()
export class DomainMetricsService implements OnModuleInit {
  private readonly logger = new Logger(DomainMetricsService.name);

  constructor(
    private readonly metrics: MetricsService,
    private readonly prisma: PrismaService,
    @InjectQueue(SLA_QUEUE) private readonly queue: Queue,
  ) {}

  onModuleInit(): void {
    this.registerTicketGauge();
    this.registerQueueGauge();
  }

  private registerTicketGauge(): void {
    const prisma = this.prisma;
    const logger = this.logger;

    new Gauge({
      name: 'helpdesk_tickets',
      help: 'Current ticket count by status and priority',
      labelNames: ['status', 'priority'] as const,
      registers: [this.metrics.registry],
      async collect() {
        try {
          const rows = await prisma.ticket.groupBy({
            by: ['status', 'priority'],
            _count: true,
            orderBy: [{ status: 'asc' }, { priority: 'asc' }],
          });

          this.reset();
          for (const row of rows) {
            this.set({ status: row.status, priority: row.priority }, row._count);
          }
        } catch (error) {
          logger.warn(`Could not collect ticket gauge: ${(error as Error).message}`);
        }
      },
    });
  }

  private registerQueueGauge(): void {
    const queue = this.queue;
    const logger = this.logger;

    new Gauge({
      name: 'helpdesk_queue_jobs',
      help: 'Jobs in the BullMQ queue by state',
      labelNames: ['queue', 'state'] as const,
      registers: [this.metrics.registry],
      async collect() {
        try {
          const counts = await queue.getJobCounts(...QUEUE_STATES);

          this.reset();
          for (const state of QUEUE_STATES) {
            this.set({ queue: SLA_QUEUE, state }, counts[state] ?? 0);
          }
        } catch (error) {
          logger.warn(`Could not collect queue gauge: ${(error as Error).message}`);
        }
      },
    });
  }
}
