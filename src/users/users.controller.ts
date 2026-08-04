import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthUserDto } from '../auth/dto/auth-response.dto';
import { PrismaService } from '../prisma/prisma.service';

class QueryUsersDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(Role.AGENT)
  @ApiOperation({ summary: 'List users, typically to populate an assignee picker' })
  @ApiOkResponse({ type: AuthUserDto, isArray: true })
  findMany(@Query() query: QueryUsersDto): Promise<AuthUserDto[]> {
    return this.prisma.user.findMany({
      where: query.role ? { role: query.role } : undefined,
      select: { id: true, email: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  }
}
