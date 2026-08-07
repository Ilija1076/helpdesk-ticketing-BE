import { ApiProperty } from '@nestjs/swagger';
import { TicketPriority, TicketStatus } from '@prisma/client';

export class TicketStatsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty({ description: 'Tickets not yet resolved or closed' })
  open!: number;

  @ApiProperty({ description: 'Tickets that have breached either SLA clock' })
  breached!: number;

  @ApiProperty({ description: 'Open tickets with no assignee' })
  unassigned!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { OPEN: 4, IN_PROGRESS: 2 },
  })
  byStatus!: Partial<Record<TicketStatus, number>>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { LOW: 1, URGENT: 3 },
  })
  byPriority!: Partial<Record<TicketPriority, number>>;
}
