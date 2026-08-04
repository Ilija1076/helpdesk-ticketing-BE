import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ example: 'VPN klijent ne uspostavlja konekciju' })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'Od jutros dobijam error 809 pri konektovanju sa laptopa.' })
  @IsString()
  @MinLength(10)
  @MaxLength(10_000)
  description!: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}
