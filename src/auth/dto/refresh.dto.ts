import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'The refresh token issued by login, register or a previous refresh' })
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  refreshToken!: string;
}
