import { Injectable, Logger } from '@nestjs/common';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';

export interface BreachScanResult {
  firstResponseBreaches: number;
  resolutionBreaches: number;
}

interface PriorityBreaches {
  priority: TicketPriority;
  firstResponse: number;
  resolution: number;
}

const SETTLED_STATUSES: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED];

@Injectable()
export class SlaBreachService {
  private readonly logger = new Logger(SlaBreachService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async scan(now: Date = new Date()): Promise<BreachScanResult> {
    const stopTimer = this.metrics.slaScanDuration.startTimer();

    try {
      const breakdown = await this.runScan(now);
      const result: BreachScanResult = { firstResponseBreaches: 0, resolutionBreaches: 0 };

      for (const row of breakdown) {
        this.metrics.slaBreaches.inc(
          { clock: 'first_response', priority: row.priority },
          row.firstResponse,
        );
        this.metrics.slaBreaches.inc(
          { clock: 'resolution', priority: row.priority },
          row.resolution,
        );

        result.firstResponseBreaches += row.firstResponse;
        result.resolutionBreaches += row.resolution;
      }

      if (result.firstResponseBreaches > 0 || result.resolutionBreaches > 0) {
        this.logger.warn(
          `SLA breached: ${result.firstResponseBreaches} first-response, ${result.resolutionBreaches} resolution`,
        );
      }

      return result;
    } finally {
      stopTimer();
    }
  }

  private async runScan(now: Date): Promise<PriorityBreaches[]> {
    const priorities = Object.values(TicketPriority);

    const counts = await this.prisma.$transaction(
      priorities.flatMap((priority) => [
        this.prisma.ticket.updateMany({
          where: {
            priority,
            status: { notIn: SETTLED_STATUSES },
            slaPausedAt: null,
            firstRespondedAt: null,
            firstResponseBreachedAt: null,
            firstResponseDueAt: { lt: now },
          },
          data: { firstResponseBreachedAt: now },
        }),
        this.prisma.ticket.updateMany({
          where: {
            priority,
            status: { notIn: SETTLED_STATUSES },
            slaPausedAt: null,
            resolvedAt: null,
            resolutionBreachedAt: null,
            resolutionDueAt: { lt: now },
          },
          data: { resolutionBreachedAt: now },
        }),
      ]),
    );

    return priorities.map((priority, index) => ({
      priority,
      firstResponse: counts[index * 2].count,
      resolution: counts[index * 2 + 1].count,
    }));
  }
}
