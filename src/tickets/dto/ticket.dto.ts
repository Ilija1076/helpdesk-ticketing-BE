import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role, TicketPriority, TicketStatus } from '@prisma/client';

export class TicketPartyDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: Role })
  role!: Role;
}

export class SlaClockDto {
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  dueAt!: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  metAt!: Date | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  breachedAt!: Date | null;
}

export class TicketSlaDto {
  @ApiProperty({ type: SlaClockDto })
  firstResponse!: SlaClockDto;

  @ApiProperty({ type: SlaClockDto })
  resolution!: SlaClockDto;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  pausedAt!: Date | null;

  @ApiProperty()
  pausedMinutes!: number;

  @ApiPropertyOptional({ nullable: true })
  policyName!: string | null;
}

export class TicketDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'HD-1042' })
  reference!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: TicketStatus })
  status!: TicketStatus;

  @ApiProperty({ enum: TicketPriority })
  priority!: TicketPriority;

  @ApiProperty({ type: TicketPartyDto })
  requester!: TicketPartyDto;

  @ApiPropertyOptional({ type: TicketPartyDto, nullable: true })
  assignee!: TicketPartyDto | null;

  @ApiProperty({ type: TicketSlaDto })
  sla!: TicketSlaDto;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
