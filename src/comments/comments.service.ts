import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, Role, TicketStatus } from '@prisma/client';
import { paginate } from '../common/dto/paginated.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import { TicketsService } from '../tickets/tickets.service';
import { CommentWithAuthor, commentInclude } from './comment.mapper';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
  ) {}

  async create(
    ticketId: string,
    dto: CreateCommentDto,
    actor: AuthenticatedUser,
  ): Promise<CommentWithAuthor> {
    const ticket = await this.ticketsService.findOne(ticketId, actor);

    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Cannot comment on a closed ticket');
    }

    const isInternal = dto.isInternal ?? false;
    if (isInternal && actor.role !== Role.AGENT) {
      throw new ForbiddenException('Only agents can post internal notes');
    }

    const postedAt = new Date();
    const comment = await this.prisma.comment.create({
      data: {
        body: dto.body,
        isInternal,
        ticket: { connect: { id: ticketId } },
        author: { connect: { id: actor.id } },
        createdAt: postedAt,
      },
      include: commentInclude,
    });

    if (!isInternal) {
      if (actor.role === Role.AGENT) {
        await this.ticketsService.recordFirstResponse(ticketId, postedAt);
      } else if (ticket.status === TicketStatus.WAITING_ON_CUSTOMER) {
        await this.ticketsService.update(ticketId, { status: TicketStatus.IN_PROGRESS }, actor);
      }
    }

    return comment;
  }

  async findMany(ticketId: string, query: PaginationQueryDto, actor: AuthenticatedUser) {
    await this.ticketsService.findOne(ticketId, actor);

    const where: Prisma.CommentWhereInput = { ticketId };
    if (actor.role === Role.CLIENT) {
      where.isInternal = false;
    }

    const skip = (query.page - 1) * query.pageSize;

    const [comments, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        include: commentInclude,
        orderBy: { createdAt: 'asc' },
        skip,
        take: query.pageSize,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return paginate(comments, total, query.page, query.pageSize);
  }
}
