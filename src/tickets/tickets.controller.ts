import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ApiPaginatedResponse } from '../common/dto/api-paginated-response.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { TicketStatsDto } from './dto/ticket-stats.dto';
import { TicketDto } from './dto/ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { toTicketDto } from './ticket.mapper';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @ApiOperation({ summary: 'Raise a ticket, stamping its SLA deadlines' })
  @ApiResponse({ status: HttpStatus.CREATED, type: TicketDto })
  async create(
    @Body() dto: CreateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TicketDto> {
    return toTicketDto(await this.ticketsService.create(dto, user));
  }

  @Get()
  @ApiOperation({ summary: 'List tickets; clients only ever see their own' })
  @ApiPaginatedResponse(TicketDto)
  async findMany(@Query() query: QueryTicketsDto, @CurrentUser() user: AuthenticatedUser) {
    const result = await this.ticketsService.findMany(query, user);
    return { data: result.data.map(toTicketDto), meta: result.meta };
  }

  @Get('stats')
  @Roles(Role.AGENT)
  @ApiOperation({ summary: 'Aggregate counts for the agent dashboard' })
  @ApiOkResponse({ type: TicketStatsDto })
  stats(): Promise<TicketStatsDto> {
    return this.ticketsService.stats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a single ticket' })
  @ApiOkResponse({ type: TicketDto })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TicketDto> {
    return toTicketDto(await this.ticketsService.findOne(id, user));
  }

  @Patch(':id')
  @Roles(Role.AGENT)
  @ApiOperation({ summary: 'Update a ticket; status and priority changes move the SLA clock' })
  @ApiOkResponse({ type: TicketDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TicketDto> {
    return toTicketDto(await this.ticketsService.update(id, dto, user));
  }
}
