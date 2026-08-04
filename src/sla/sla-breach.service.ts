import { Injectable, Logger } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface BreachScanResult {
  firstResponseBreaches: number;
  resolutionBreaches: number;
}

const SETTLED_STATUSES: TicketStatus[] = [TicketStatus.RESOLVED, TicketStatus.CLOSED];

@Injectable()
export class SlaBreachService {
  private readonly logger = new Logger(SlaBreachService.name);

  constructor(private readonly prisma: PrismaService) {}

  async scan(now: Date = new Date()): Promise<BreachScanResult> {
    const [firstResponse, resolution] = await this.prisma.$transaction([
      this.prisma.ticket.updateMany({
        where: {
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
          status: { notIn: SETTLED_STATUSES },
          slaPausedAt: null,
          resolvedAt: null,
          resolutionBreachedAt: null,
          resolutionDueAt: { lt: now },
        },
        data: { resolutionBreachedAt: now },
      }),
    ]);

    const result: BreachScanResult = {
      firstResponseBreaches: firstResponse.count,
      resolutionBreaches: resolution.count,
    };

    if (result.firstResponseBreaches > 0 || result.resolutionBreaches > 0) {
      this.logger.warn(
        `SLA breached: ${result.firstResponseBreaches} first-response, ${result.resolutionBreaches} resolution`,
      );
    }

    return result;
  }
}
