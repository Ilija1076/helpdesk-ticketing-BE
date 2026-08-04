import { Prisma } from '@prisma/client';
import { TicketDto } from './dto/ticket.dto';

export const ticketInclude = {
  requester: { select: { id: true, name: true, email: true, role: true } },
  assignee: { select: { id: true, name: true, email: true, role: true } },
  slaPolicy: { select: { name: true } },
} satisfies Prisma.TicketInclude;

export type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

export function formatReference(number: number): string {
  return `HD-${number}`;
}

export function toTicketDto(ticket: TicketWithRelations): TicketDto {
  return {
    id: ticket.id,
    reference: formatReference(ticket.number),
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    requester: ticket.requester,
    assignee: ticket.assignee,
    sla: {
      firstResponse: {
        dueAt: ticket.firstResponseDueAt,
        metAt: ticket.firstRespondedAt,
        breachedAt: ticket.firstResponseBreachedAt,
      },
      resolution: {
        dueAt: ticket.resolutionDueAt,
        metAt: ticket.resolvedAt,
        breachedAt: ticket.resolutionBreachedAt,
      },
      pausedAt: ticket.slaPausedAt,
      pausedMinutes: ticket.slaPausedMinutes,
      policyName: ticket.slaPolicy?.name ?? null,
    },
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  };
}
