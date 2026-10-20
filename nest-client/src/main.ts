import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

// Load nest-client/.env when present (Node >= 20.12); real environment variables win.
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the environment.
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
