import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
}
