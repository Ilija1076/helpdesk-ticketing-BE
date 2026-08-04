import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'agent@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'super-secret-password' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
