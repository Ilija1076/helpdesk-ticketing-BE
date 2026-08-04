import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async truncateAll(): Promise<void> {
    await this.$transaction([
      this.comment.deleteMany(),
      this.ticket.deleteMany(),
      this.user.deleteMany(),
      this.slaPolicy.deleteMany(),
    ]);
  }
}
