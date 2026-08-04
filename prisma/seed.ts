import 'dotenv/config';
import { PrismaClient, Role, TicketPriority, TicketStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { configuration } from '../src/config/configuration';
import { addBusinessMinutes } from '../src/sla/business-calendar';

const prisma = new PrismaClient();

const POLICIES = [
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

async function main(): Promise<void> {
  const password = process.env.SEED_PASSWORD ?? 'password123';
  const passwordHash = await bcrypt.hash(password, 12);
  const calendar = configuration().businessCalendar;

  for (const policy of POLICIES) {
    await prisma.slaPolicy.upsert({
      where: { priority: policy.priority },
      update: policy,
      create: policy,
    });
  }

  const agent = await prisma.user.upsert({
    where: { email: 'agent@helpdesk.local' },
    update: {},
    create: {
      email: 'agent@helpdesk.local',
      name: 'Mila Agentić',
      role: Role.AGENT,
      passwordHash,
    },
  });

  const client = await prisma.user.upsert({
    where: { email: 'client@helpdesk.local' },
    update: {},
    create: {
      email: 'client@helpdesk.local',
      name: 'Petar Klijentović',
      role: Role.CLIENT,
      passwordHash,
    },
  });

  if ((await prisma.ticket.count()) > 0) {
    console.log('Tickets already present, skipping demo tickets');
    return;
  }

  const policies = await prisma.slaPolicy.findMany();
  const policyFor = (priority: TicketPriority) =>
    policies.find((entry) => entry.priority === priority)!;

  const now = Date.now();
  const hoursAgo = (hours: number) => new Date(now - hours * 60 * 60 * 1000);

  const demoTickets = [
    {
      title: 'VPN klijent ne uspostavlja konekciju',
      description: 'Od jutros dobijam error 809 pri konektovanju sa laptopa iz kancelarije.',
      priority: TicketPriority.URGENT,
      status: TicketStatus.OPEN,
      createdAt: hoursAgo(30),
      assigneeId: null as string | null,
    },
    {
      title: 'Ne mogu da resetujem lozinku na portalu',
      description: 'Link za reset lozinke stize ali vraca gresku da je token istekao.',
      priority: TicketPriority.HIGH,
      status: TicketStatus.IN_PROGRESS,
      createdAt: hoursAgo(6),
      assigneeId: agent.id,
    },
    {
      title: 'Zahtev za novu licencu za Office',
      description: 'Potrebna mi je licenca za novog kolegu koji pocinje u ponedeljak.',
      priority: TicketPriority.LOW,
      status: TicketStatus.WAITING_ON_CUSTOMER,
      createdAt: hoursAgo(48),
      assigneeId: agent.id,
    },
    {
      title: 'Stampac na drugom spratu ne radi',
      description: 'Stampac izbacuje gresku PC LOAD LETTER i ne reaguje na restart.',
      priority: TicketPriority.MEDIUM,
      status: TicketStatus.RESOLVED,
      createdAt: hoursAgo(72),
      assigneeId: agent.id,
    },
  ];

  for (const ticket of demoTickets) {
    const policy = policyFor(ticket.priority);

    await prisma.ticket.create({
      data: {
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        status: ticket.status,
        createdAt: ticket.createdAt,
        requesterId: client.id,
        assigneeId: ticket.assigneeId,
        slaPolicyId: policy.id,
        firstResponseDueAt: addBusinessMinutes(
          ticket.createdAt,
          policy.firstResponseMinutes,
          calendar,
        ),
        resolutionDueAt: addBusinessMinutes(ticket.createdAt, policy.resolutionMinutes, calendar),
        firstRespondedAt: ticket.status === TicketStatus.OPEN ? null : ticket.createdAt,
        resolvedAt: ticket.status === TicketStatus.RESOLVED ? hoursAgo(60) : null,
        slaPausedAt: ticket.status === TicketStatus.WAITING_ON_CUSTOMER ? hoursAgo(24) : null,
        comments: {
          create: [
            {
              body: 'Prijavljujem problem, hvala unapred.',
              authorId: client.id,
              createdAt: ticket.createdAt,
            },
          ],
        },
      },
    });
  }

  console.log(`Seeded ${POLICIES.length} SLA policies, 2 users and ${demoTickets.length} tickets`);
  console.log(`Login with agent@helpdesk.local / client@helpdesk.local, password: ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
