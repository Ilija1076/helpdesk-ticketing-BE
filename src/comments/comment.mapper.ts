import { Prisma } from '@prisma/client';
import { CommentDto } from './dto/comment.dto';

export const commentInclude = {
  author: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.CommentInclude;

export type CommentWithAuthor = Prisma.CommentGetPayload<{ include: typeof commentInclude }>;

export function toCommentDto(comment: CommentWithAuthor): CommentDto {
  return {
    id: comment.id,
    ticketId: comment.ticketId,
    body: comment.body,
    isInternal: comment.isInternal,
    author: comment.author,
    createdAt: comment.createdAt,
  };
}
