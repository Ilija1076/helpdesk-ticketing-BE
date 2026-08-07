import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createUser, login, resetDatabase } from './test-app';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new account as a client and returns a usable token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'nova@example.com', name: 'Nova Korisnica', password: 'password123' })
      .expect(201);

    expect(response.body.user).toMatchObject({ email: 'nova@example.com', role: Role.CLIENT });
    expect(typeof response.body.accessToken).toBe('string');

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${response.body.accessToken}`)
      .expect(200)
      .expect(({ body }: { body: Record<string, unknown> }) =>
        expect(body.email).toBe('nova@example.com'),
      );
  });

  it('never lets registration mint an agent account', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'samozvani@example.com',
        name: 'Samozvani Agent',
        password: 'password123',
        role: Role.AGENT,
      })
      .expect(400);
  });

  it('rejects a duplicate email', async () => {
    await createUser(prisma, 'zauzeta@example.com', Role.CLIENT);

    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'zauzeta@example.com', name: 'Neko Drugi', password: 'password123' })
      .expect(409);
  });

  it('rejects a wrong password and an unknown email alike', async () => {
    await createUser(prisma, 'postoji@example.com', Role.CLIENT);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'postoji@example.com', password: 'pogresna-sifra' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'ne-postoji@example.com', password: 'password123' })
      .expect(401);
  });

  it('refuses protected routes without a token', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    await request(app.getHttpServer()).get('/api/tickets').expect(401);
  });

  it('stops a client from reaching agent-only routes', async () => {
    await createUser(prisma, 'klijent@example.com', Role.CLIENT);
    const token = await login(app, 'klijent@example.com');

    await request(app.getHttpServer())
      .get('/api/tickets/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('serves health without authentication', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect(({ body }: { body: Record<string, unknown> }) => expect(body.status).toBe('ok'));
  });
});
