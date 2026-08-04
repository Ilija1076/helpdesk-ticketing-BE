import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, TicketPriority, TicketStatus } from '@prisma/client';
import { paginate } from '../common/dto/paginated.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { SlaService } from '../sla/sla.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { assertTransitionAllowed } from './ticket-status';
import { TicketWithRelations, ticketInclude } from './ticket.mapper';

const OPEN_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_ON_CUSTOMER,
];

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sla: SlaService,
  ) {}

  async create(dto: CreateTicketDto, actor: AuthenticatedUser): Promise<TicketWithRelations> {
    const priority = dto.priority ?? TicketPriority.MEDIUM;
    const policy = await this.sla.policyFor(priority);
    const createdAt = new Date();
    const deadlines = this.sla.computeDeadlines(createdAt, policy);

    return this.prisma.ticket.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority,
        createdAt,
        requester: { connect: { id: actor.id } },
        slaPolicy: { connect: { id: policy.id } },
        firstResponseDueAt: deadlines.firstResponseDueAt,
        resolutionDueAt: deadlines.resolutionDueAt,
      },
      include: ticketInclude,
    });
  }

  async findMany(query: QueryTicketsDto, actor: AuthenticatedUser) {
    const where = this.buildWhere(query, actor);
    const skip = (query.page - 1) * query.pageSize;

    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        include: ticketInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip,
        take: query.pageSize,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return paginate(tickets, total, query.page, query.pageSize);
  }

  async findOne(id: string, actor: AuthenticatedUser): Promise<TicketWithRelations> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id }, include: ticketInclude });

    if (!ticket || (actor.role === Role.CLIENT && ticket.requesterId !== actor.id)) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return ticket;
  }

  async update(id: string, dto: UpdateTicketDto, actor: AuthenticatedUser) {
    const ticket = await this.findOne(id, actor);
    const now = new Date();
    const data: Prisma.TicketUpdateInput = {};

    if (dto.title !== undefined) {
      data.title = dto.title;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.assigneeId !== undefined) {
      data.assignee = await this.buildAssigneeUpdate(dto.assigneeId);
    }

    let pausedMinutes = ticket.slaPausedMinutes;
    let nextStatus = ticket.status;

    if (dto.status !== undefined && dto.status !== ticket.status) {
      assertTransitionAllowed(ticket.status, dto.status);
      nextStatus = dto.status;
      data.status = dto.status;

      const wasPaused = ticket.status === TicketStatus.WAITING_ON_CUSTOMER;
      const willPause = dto.status === TicketStatus.WAITING_ON_CUSTOMER;

      if (wasPaused && !willPause && ticket.slaPausedAt) {
        const elapsed = this.sla.pausedMinutesSince(ticket.slaPausedAt, now);
        pausedMinutes += elapsed;
        data.slaPausedAt = null;
        data.slaPausedMinutes = pausedMinutes;

        if (!ticket.firstRespondedAt && ticket.firstResponseDueAt) {
          data.firstResponseDueAt = this.sla.shiftDeadline(ticket.firstResponseDueAt, elapsed);
        }
        if (!ticket.resolvedAt && ticket.resolutionDueAt) {
          data.resolutionDueAt = this.sla.shiftDeadline(ticket.resolutionDueAt, elapsed);
        }
      }

      if (willPause && !wasPaused) {
        data.slaPausedAt = now;
      }

      if (dto.status === TicketStatus.RESOLVED && !ticket.resolvedAt) {
        data.resolvedAt = now;
      }
      if (
        ticket.resolvedAt &&
        dto.status !== TicketStatus.RESOLVED &&
        dto.status !== TicketStatus.CLOSED
      ) {
        data.resolvedAt = null;
      }
    }

    if (dto.priority !== undefined && dto.priority !== ticket.priority) {
      const policy = await this.sla.policyFor(dto.priority);
      const deadlines = this.sla.computeDeadlines(ticket.createdAt, policy, pausedMinutes);

      data.priority = dto.priority;
      data.slaPolicy = { connect: { id: policy.id } };

      if (!ticket.firstRespondedAt) {
        data.firstResponseDueAt = deadlines.firstResponseDueAt;
        data.firstResponseBreachedAt = null;
      }
      if (!ticket.resolvedAt && nextStatus !== TicketStatus.RESOLVED) {
        data.resolutionDueAt = deadlines.resolutionDueAt;
        data.resolutionBreachedAt = null;
      }
    }

    return this.prisma.ticket.update({ where: { id }, data, include: ticketInclude });
  }

  async recordFirstResponse(ticketId: string, at: Date): Promise<void> {
    await this.prisma.ticket.updateMany({
      where: { id: ticketId, firstRespondedAt: null },
      data: { firstRespondedAt: at },
    });
  }

  async stats() {
    const breachedWhere: Prisma.TicketWhereInput = {
      OR: [{ firstResponseBreachedAt: { not: null } }, { resolutionBreachedAt: { not: null } }],
    };

    const [byStatus, byPriority, total, open, breached, unassigned] =
      await this.prisma.$transaction([
        this.prisma.ticket.groupBy({ by: ['status'], _count: true, orderBy: { status: 'asc' } }),
        this.prisma.ticket.groupBy({
          by: ['priority'],
          _count: true,
          orderBy: { priority: 'asc' },
        }),
        this.prisma.ticket.count(),
        this.prisma.ticket.count({ where: { status: { in: OPEN_STATUSES } } }),
        this.prisma.ticket.count({ where: breachedWhere }),
        this.prisma.ticket.count({
          where: { assigneeId: null, status: { in: OPEN_STATUSES } },
        }),
      ]);

    return {
      total,
      open,
      breached,
      unassigned,
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count])),
      byPriority: Object.fromEntries(byPriority.map((row) => [row.priority, row._count])),
    };
  }

  private async buildAssigneeUpdate(assigneeId: string | null) {
    if (assigneeId === null) {
      return { disconnect: true };
    }

    const assignee = await this.prisma.user.findUnique({ where: { id: assigneeId } });
    if (!assignee || assignee.role !== Role.AGENT) {
      throw new BadRequestException('Tickets can only be assigned to an agent');
    }

    return { connect: { id: assigneeId } };
  }

  private buildWhere(query: QueryTicketsDto, actor: AuthenticatedUser): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = {};

    if (actor.role === Role.CLIENT) {
      where.requesterId = actor.id;
    } else if (query.requesterId) {
      where.requesterId = query.requesterId;
    }

    if (query.status?.length) {
      where.status = { in: query.status };
    }
    if (query.priority?.length) {
      where.priority = { in: query.priority };
    }
    if (query.unassigned) {
      where.assigneeId = null;
    } else if (query.assigneeId) {
      where.assigneeId = query.assigneeId;
    }
    if (query.breached) {
      where.OR = [
        { firstResponseBreachedAt: { not: null } },
        { resolutionBreachedAt: { not: null } },
      ];
    }
    if (query.search) {
      where.AND = [
        {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    return where;
  }
}
