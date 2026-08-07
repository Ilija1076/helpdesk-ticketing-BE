import { INestApplication } from '@nestjs/common';
import { Role, TicketPriority, TicketStatus, User } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp, createUser, login, resetDatabase } from './test-app';

describe('Tickets (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let agent: User;
  let client: User;
  let otherClient: User;
  let agentToken: string;
  let clientToken: string;
  let otherClientToken: string;

  const raiseTicket = async (token: string, priority: TicketPriority = TicketPriority.MEDIUM) => {
    const response = await request(app.getHttpServer())
      .post('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'VPN klijent ne uspostavlja konekciju',
        description: 'Od jutros dobijam error 809 pri konektovanju sa laptopa.',
        priority,
      })
      .expect(201);

    return response.body;
  };

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    agent = await createUser(prisma, 'agent@example.com', Role.AGENT);
    client = await createUser(prisma, 'klijent@example.com', Role.CLIENT);
    otherClient = await createUser(prisma, 'drugi@example.com', Role.CLIENT);
    agentToken = await login(app, agent.email);
    clientToken = await login(app, client.email);
    otherClientToken = await login(app, otherClient.email);
  });

  afterAll(async () => {
    await app.close();
  });

  it('stamps SLA deadlines and a reference when a ticket is raised', async () => {
    const ticket = await raiseTicket(clientToken, TicketPriority.URGENT);

    expect(ticket.reference).toMatch(/^HD-\d+$/);
    expect(ticket.status).toBe(TicketStatus.OPEN);
    expect(ticket.requester.id).toBe(client.id);
    expect(ticket.sla.policyName).toBe('Urgent');
    expect(new Date(ticket.sla.firstResponse.dueAt).getTime()).toBeGreaterThan(
      new Date(ticket.createdAt).getTime(),
    );
    expect(new Date(ticket.sla.resolution.dueAt).getTime()).toBeGreaterThan(
      new Date(ticket.sla.firstResponse.dueAt).getTime(),
    );
  });

  it('gives a tighter deadline to a higher priority', async () => {
    const urgent = await raiseTicket(clientToken, TicketPriority.URGENT);
    const low = await raiseTicket(clientToken, TicketPriority.LOW);

    expect(new Date(urgent.sla.resolution.dueAt).getTime()).toBeLessThan(
      new Date(low.sla.resolution.dueAt).getTime(),
    );
  });

  it('hides other clients tickets but shows them to an agent', async () => {
    const ticket = await raiseTicket(clientToken);

    await request(app.getHttpServer())
      .get(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${otherClientToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    const asOtherClient = await request(app.getHttpServer())
      .get('/api/tickets')
      .set('Authorization', `Bearer ${otherClientToken}`)
      .expect(200);

    expect(asOtherClient.body.data).toHaveLength(0);
  });

  it('filters, paginates and sorts the list', async () => {
    await raiseTicket(clientToken, TicketPriority.LOW);
    await raiseTicket(clientToken, TicketPriority.URGENT);
    await raiseTicket(clientToken, TicketPriority.HIGH);

    const filtered = await request(app.getHttpServer())
      .get('/api/tickets')
      .query({ priority: 'URGENT,HIGH', sortBy: 'priority', sortOrder: 'desc' })
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    expect(filtered.body.data.map((ticket: { priority: string }) => ticket.priority)).toEqual([
      TicketPriority.URGENT,
      TicketPriority.HIGH,
    ]);

    const paged = await request(app.getHttpServer())
      .get('/api/tickets')
      .query({ page: 2, pageSize: 2 })
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    expect(paged.body.data).toHaveLength(1);
    expect(paged.body.meta).toMatchObject({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
  });

  it('lets only an agent update a ticket', async () => {
    const ticket = await raiseTicket(clientToken);

    await request(app.getHttpServer())
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ status: TicketStatus.RESOLVED })
      .expect(403);

    const updated = await request(app.getHttpServer())
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: TicketStatus.IN_PROGRESS, assigneeId: agent.id })
      .expect(200);

    expect(updated.body.status).toBe(TicketStatus.IN_PROGRESS);
    expect(updated.body.assignee.id).toBe(agent.id);
  });

  it('refuses to assign a ticket to a client', async () => {
    const ticket = await raiseTicket(clientToken);

    await request(app.getHttpServer())
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ assigneeId: client.id })
      .expect(400);
  });

  it('refuses an illegal status transition', async () => {
    const ticket = await raiseTicket(clientToken);

    await request(app.getHttpServer())
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: TicketStatus.CLOSED })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: TicketStatus.IN_PROGRESS })
      .expect(400);
  });

  it('records the resolution time when a ticket is resolved', async () => {
    const ticket = await raiseTicket(clientToken);

    const resolved = await request(app.getHttpServer())
      .patch(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: TicketStatus.RESOLVED })
      .expect(200);

    expect(resolved.body.sla.resolution.metAt).not.toBeNull();
  });

  it('reports dashboard counts to an agent', async () => {
    await raiseTicket(clientToken, TicketPriority.URGENT);
    const second = await raiseTicket(clientToken, TicketPriority.LOW);

    await request(app.getHttpServer())
      .patch(`/api/tickets/${second.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: TicketStatus.RESOLVED })
      .expect(200);

    const stats = await request(app.getHttpServer())
      .get('/api/tickets/stats')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    expect(stats.body).toMatchObject({ total: 2, open: 1, unassigned: 1 });
    expect(stats.body.byStatus[TicketStatus.RESOLVED]).toBe(1);
  });

  it('rejects a ticket that fails validation', async () => {
    await request(app.getHttpServer())
      .post('/api/tickets')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'kr', description: 'prekratko' })
      .expect(400);
  });
});
