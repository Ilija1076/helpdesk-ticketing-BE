import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = () =>
  new DocumentBuilder()
    .setTitle('Helpdesk Ticketing API')
    .setDescription('Ticketing backend with business-hours SLA tracking')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
