import { INestApplication } from '@nestjs/common';
import { Role, TicketPriority, TicketStatus, User } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { SlaBreachService } from '../src/sla/sla-breach.service';
import { createTestApp, createUser, login, resetDatabase } from './test-app';

describe('SLA lifecycle (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let breachService: SlaBreachService;
  let agent: User;
  let client: User;
  let agentToken: string;
  let clientToken: string;

  const raiseTicket = async (priority: TicketPriority = TicketPriority.MEDIUM) => {
    const response = await request(app.getHttpServer())
      .post('/api/tickets')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        title: 'Ne mogu da resetujem lozinku',
        description: 'Link za reset stize ali vraca gresku da je token istekao.',
        priority,
      })
      .expect(201);

    return response.body;
  };

  const patch = (id: string, body: Record<string, unknown>, token = agentToken) =>
    request(app.getHttpServer())
      .patch(`/api/tickets/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    breachService = app.get(SlaBreachService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    agent = await createUser(prisma, 'agent@example.com', Role.AGENT);
    client = await createUser(prisma, 'klijent@example.com', Role.CLIENT);
    agentToken = await login(app, agent.email);
    clientToken = await login(app, client.email);
  });

  afterAll(async () => {
    await app.close();
  });

  it('stops the first-response clock on an agent reply but not on an internal note', async () => {
    const ticket = await raiseTicket();

    await request(app.getHttpServer())
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ body: 'Interna beleska, proveravam logove.', isInternal: true })
      .expect(201);

    const afterNote = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(afterNote.firstRespondedAt).toBeNull();

    await request(app.getHttpServer())
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ body: 'Dobar dan, gledamo problem.' })
      .expect(201);

    const afterReply = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(afterReply.firstRespondedAt).not.toBeNull();
  });

  it('hides internal notes from the client', async () => {
    const ticket = await raiseTicket();

    await request(app.getHttpServer())
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ body: 'Interna beleska.', isInternal: true })
      .expect(201);

    const asClient = await request(app.getHttpServer())
      .get(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${clientToken}`)
      .expect(200);

    const asAgent = await request(app.getHttpServer())
      .get(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    expect(asClient.body.data).toHaveLength(0);
    expect(asAgent.body.data).toHaveLength(1);
  });

  it('stops a client from writing an internal note', async () => {
    const ticket = await raiseTicket();

    await request(app.getHttpServer())
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ body: 'Pokusavam da sakrijem ovo.', isInternal: true })
      .expect(403);
  });

  it('pauses the clock while waiting on the customer and pushes the deadline on resume', async () => {
    const ticket = await raiseTicket();

    await patch(ticket.id, { status: TicketStatus.WAITING_ON_CUSTOMER }).expect(200);

    const paused = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(paused.slaPausedAt).not.toBeNull();

    const pausedSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { slaPausedAt: pausedSince },
    });

    await patch(ticket.id, { status: TicketStatus.IN_PROGRESS }).expect(200);

    const resumed = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(resumed.slaPausedAt).toBeNull();
    expect(resumed.slaPausedMinutes).toBeGreaterThan(0);
    expect(resumed.resolutionDueAt!.getTime()).toBeGreaterThan(paused.resolutionDueAt!.getTime());
  });

  it('resumes the clock when the client answers a ticket that waits on them', async () => {
    const ticket = await raiseTicket();
    await patch(ticket.id, { status: TicketStatus.WAITING_ON_CUSTOMER }).expect(200);

    await request(app.getHttpServer())
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ body: 'Evo odgovora koji ste trazili.' })
      .expect(201);

    const resumed = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(resumed.status).toBe(TicketStatus.IN_PROGRESS);
    expect(resumed.slaPausedAt).toBeNull();
  });

  it('recomputes both deadlines when the priority changes', async () => {
    const ticket = await raiseTicket(TicketPriority.LOW);
    const before = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });

    await patch(ticket.id, { priority: TicketPriority.URGENT }).expect(200);

    const after = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
      include: { slaPolicy: true },
    });

    expect(after.slaPolicy!.name).toBe('Urgent');
    expect(after.resolutionDueAt!.getTime()).toBeLessThan(before.resolutionDueAt!.getTime());
    expect(after.firstResponseDueAt!.getTime()).toBeLessThan(before.firstResponseDueAt!.getTime());
  });

  it('flags an overdue ticket exactly once', async () => {
    const ticket = await raiseTicket();
    const overdue = new Date(Date.now() - 60 * 60 * 1000);

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { firstResponseDueAt: overdue, resolutionDueAt: overdue },
    });

    const first = await breachService.scan();
    expect(first).toEqual({ firstResponseBreaches: 1, resolutionBreaches: 1 });

    const second = await breachService.scan();
    expect(second).toEqual({ firstResponseBreaches: 0, resolutionBreaches: 0 });

    const flagged = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(flagged.firstResponseBreachedAt).not.toBeNull();
    expect(flagged.resolutionBreachedAt).not.toBeNull();
  });

  it('leaves paused, answered and resolved tickets alone', async () => {
    const overdue = new Date(Date.now() - 60 * 60 * 1000);

    const paused = await raiseTicket();
    await patch(paused.id, { status: TicketStatus.WAITING_ON_CUSTOMER }).expect(200);

    const answered = await raiseTicket();
    const resolved = await raiseTicket();
    await patch(resolved.id, { status: TicketStatus.RESOLVED }).expect(200);

    await prisma.ticket.updateMany({
      data: { firstResponseDueAt: overdue, resolutionDueAt: overdue },
    });
    await prisma.ticket.update({
      where: { id: answered.id },
      data: { firstRespondedAt: new Date() },
    });

    const result = await breachService.scan();

    expect(result.firstResponseBreaches).toBe(0);
    expect(result.resolutionBreaches).toBe(1);
  });

  it('surfaces breached tickets through the list filter', async () => {
    const ticket = await raiseTicket();
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { resolutionBreachedAt: new Date() },
    });
    await raiseTicket();

    const response = await request(app.getHttpServer())
      .get('/api/tickets')
      .query({ breached: true })
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].id).toBe(ticket.id);
  });
});
