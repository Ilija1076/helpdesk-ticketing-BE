import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: Role })
  role!: Role;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Short-lived bearer token' })
  accessToken!: string;

  @ApiProperty({ description: 'Opaque token, rotated on every use' })
  refreshToken!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  refreshTokenExpiresAt!: Date;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
