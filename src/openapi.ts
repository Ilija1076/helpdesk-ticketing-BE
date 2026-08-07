import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { swaggerConfig } from './swagger.config';

async function generate(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');

  const document = SwaggerModule.createDocument(app, swaggerConfig());
  const target = resolve(process.cwd(), 'openapi.json');
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);

  await app.close();
  console.log(`Wrote ${target}`);
  process.exit(0);
}

generate().catch((error) => {
  console.error(error);
  process.exit(1);
});
