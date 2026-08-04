import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export const TICKET_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'priority',
  'resolutionDueAt',
] as const;
export type TicketSortField = (typeof TICKET_SORT_FIELDS)[number];

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
};

export class QueryTicketsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TicketStatus, isArray: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : String(value).split(',')))
  @IsEnum(TicketStatus, { each: true })
  status?: TicketStatus[];

  @ApiPropertyOptional({ enum: TicketPriority, isArray: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : String(value).split(',')))
  @IsEnum(TicketPriority, { each: true })
  priority?: TicketPriority[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requesterId?: string;

  @ApiPropertyOptional({ description: 'Only tickets that have breached any SLA clock' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  breached?: boolean;

  @ApiPropertyOptional({ description: 'Only tickets with no assignee' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unassigned?: boolean;

  @ApiPropertyOptional({ description: 'Case-insensitive match on title and description' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: TICKET_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(TICKET_SORT_FIELDS)
  sortBy: TicketSortField = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
