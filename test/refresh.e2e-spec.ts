import { INestApplication } from '@nestjs/common';
import { Role } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createUser, resetDatabase } from './test-app';

describe('Refresh tokens (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const loginRaw = () =>
    request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'klijent@example.com', password: 'password123' })
      .expect(200);

  const refresh = (token: string) =>
    request(app.getHttpServer()).post('/api/auth/refresh').send({ refreshToken: token });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    await createUser(prisma, 'klijent@example.com', Role.CLIENT);
  });

  afterAll(async () => {
    await app.close();
  });

  it('hands out a refresh token alongside the access token', async () => {
    const { body } = await loginRaw();

    expect(typeof body.refreshToken).toBe('string');
    expect(body.refreshToken.length).toBeGreaterThan(20);
    expect(new Date(body.refreshTokenExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('stores only a hash of the refresh token', async () => {
    const { body } = await loginRaw();

    const stored = await prisma.refreshToken.findMany();
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).not.toBe(body.refreshToken);
    expect(stored[0].tokenHash).toHaveLength(64);
  });

  it('rotates the token and keeps the new access token usable', async () => {
    const first = await loginRaw();

    const rotated = await refresh(first.body.refreshToken).expect(200);
    expect(rotated.body.refreshToken).not.toBe(first.body.refreshToken);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${rotated.body.accessToken}`)
      .expect(200);
  });

  it('revokes every session when a used refresh token comes back', async () => {
    const first = await loginRaw();
    const second = await refresh(first.body.refreshToken).expect(200);

    await refresh(first.body.refreshToken).expect(401);

    await refresh(second.body.refreshToken).expect(401);

    const active = await prisma.refreshToken.count({ where: { revokedAt: null } });
    expect(active).toBe(0);
  });

  it('rejects an unknown or expired token', async () => {
    await refresh('a'.repeat(64)).expect(401);

    const { body } = await loginRaw();
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await refresh(body.refreshToken).expect(401);
  });

  it('revokes the token on logout', async () => {
    const { body } = await loginRaw();

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken: body.refreshToken })
      .expect(204);

    await refresh(body.refreshToken).expect(401);
  });

  it('drops refresh tokens when the user is deleted', async () => {
    await loginRaw();
    await prisma.user.deleteMany({ where: { email: 'klijent@example.com' } });

    expect(await prisma.refreshToken.count()).toBe(0);
  });
});
