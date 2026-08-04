import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SlaPolicy, TicketPriority } from '@prisma/client';
import { AppConfiguration } from '../config/configuration';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessCalendar, addBusinessMinutes, businessMinutesBetween } from './business-calendar';

export interface SlaDeadlines {
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
}

@Injectable()
export class SlaService {
  constructor(
    private readonly config: ConfigService<AppConfiguration, true>,
    private readonly prisma: PrismaService,
  ) {}

  get calendar(): BusinessCalendar {
    return this.config.get('businessCalendar', { infer: true });
  }

  async policyFor(priority: TicketPriority): Promise<SlaPolicy> {
    const policy = await this.prisma.slaPolicy.findUnique({ where: { priority } });
    if (!policy) {
      throw new NotFoundException(`No SLA policy configured for priority ${priority}`);
    }
    return policy;
  }

  computeDeadlines(startedAt: Date, policy: SlaPolicy, pausedMinutes = 0): SlaDeadlines {
    return {
      firstResponseDueAt: addBusinessMinutes(
        startedAt,
        policy.firstResponseMinutes + pausedMinutes,
        this.calendar,
      ),
      resolutionDueAt: addBusinessMinutes(
        startedAt,
        policy.resolutionMinutes + pausedMinutes,
        this.calendar,
      ),
    };
  }

  pausedMinutesSince(pausedAt: Date, now: Date): number {
    return businessMinutesBetween(pausedAt, now, this.calendar);
  }

  shiftDeadline(deadline: Date, minutes: number): Date {
    return addBusinessMinutes(deadline, minutes, this.calendar);
  }
}
