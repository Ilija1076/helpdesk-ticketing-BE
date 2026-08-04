import { ApiProperty } from '@nestjs/swagger';
import { TicketPartyDto } from '../../tickets/dto/ticket.dto';

export class CommentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ticketId!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  isInternal!: boolean;

  @ApiProperty({ type: TicketPartyDto })
  author!: TicketPartyDto;

  @ApiProperty()
  createdAt!: Date;
}
