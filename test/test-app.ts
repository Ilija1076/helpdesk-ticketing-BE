import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Role, TicketPriority } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
}

export const POLICIES = [
  {
    name: 'Urgent',
    priority: TicketPriority.URGENT,
    firstResponseMinutes: 30,
    resolutionMinutes: 240,
  },
  { name: 'High', priority: TicketPriority.HIGH, firstResponseMinutes: 60, resolutionMinutes: 480 },
  {
    name: 'Standard',
    priority: TicketPriority.MEDIUM,
    firstResponseMinutes: 240,
    resolutionMinutes: 1440,
  },
  { name: 'Low', priority: TicketPriority.LOW, firstResponseMinutes: 480, resolutionMinutes: 2400 },
];

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();

  return { app, prisma: app.get(PrismaService) };
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.truncateAll();
  await prisma.slaPolicy.createMany({ data: POLICIES });
}

export async function createUser(
  prisma: PrismaService,
  email: string,
  role: Role,
  password = 'password123',
) {
  return prisma.user.create({
    data: {
      email,
      name: email.split('@')[0],
      role,
      passwordHash: await bcrypt.hash(password, 4),
    },
  });
}

export async function login(
  app: INestApplication,
  email: string,
  password = 'password123',
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);

  return response.body.accessToken as string;
}
