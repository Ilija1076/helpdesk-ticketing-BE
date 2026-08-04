import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { toCommentDto } from './comment.mapper';
import { CommentsService } from './comments.service';
import { CommentDto } from './dto/comment.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('comments')
@ApiBearerAuth()
@Controller('tickets/:ticketId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Add a comment; an agent reply stops the first-response clock' })
  @ApiResponse({ status: HttpStatus.CREATED, type: CommentDto })
  async create(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CommentDto> {
    return toCommentDto(await this.commentsService.create(ticketId, dto, user));
  }

  @Get()
  @ApiOperation({ summary: 'List comments; internal notes are hidden from clients' })
  @ApiOkResponse({ type: CommentDto, isArray: true })
  async findMany(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.commentsService.findMany(ticketId, query, user);
    return { data: result.data.map(toCommentDto), meta: result.meta };
  }
}
