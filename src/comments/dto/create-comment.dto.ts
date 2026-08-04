import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Proverili smo logove, problem je u sertifikatu.' })
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  body!: string;

  @ApiPropertyOptional({ default: false, description: 'Agents only; hidden from the requester' })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
