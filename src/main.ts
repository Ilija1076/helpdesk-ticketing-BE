import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfiguration } from './config/configuration';
import { swaggerConfig } from './swagger.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<AppConfiguration, true>);

  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig()), {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get('port', { infer: true });
  await app.listen(port);

  new Logger('Bootstrap').log(`API listening on http://localhost:${port}/api (docs at /docs)`);
}

void bootstrap();
