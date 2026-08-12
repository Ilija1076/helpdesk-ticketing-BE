import { Injectable } from '@nestjs/common';
import { TicketPriority } from '@prisma/client';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const SLA_CLOCKS = ['first_response', 'resolution'] as const;
export type SlaClock = (typeof SLA_CLOCKS)[number];

@Injectable()
export class MetricsService {
  readonly registry = new Registry();

  readonly slaBreaches = new Counter({
    name: 'helpdesk_sla_breaches_total',
    help: 'SLA deadlines breached, counted when the scanner flags them',
    labelNames: ['clock', 'priority'] as const,
    registers: [this.registry],
  });

  readonly slaScanDuration = new Histogram({
    name: 'helpdesk_sla_scan_duration_seconds',
    help: 'Wall-clock duration of one SLA breach scan',
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
    registers: [this.registry],
  });

  readonly httpDuration = new Histogram({
    name: 'helpdesk_http_duration_seconds',
    help: 'HTTP request duration by route template',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    for (const clock of SLA_CLOCKS) {
      for (const priority of Object.values(TicketPriority)) {
        this.slaBreaches.inc({ clock, priority }, 0);
      }
    }
  }

  render(): Promise<string> {
    return this.registry.metrics();
  }
}
