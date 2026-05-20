import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';

const crashLogger = new Logger('Process');

process.on('unhandledRejection', (reason: unknown) => {
  crashLogger.error('unhandledRejection — API mantida viva:', reason);
});

process.on('uncaughtException', (err: Error) => {
  crashLogger.error('uncaughtException — API mantida viva:', err.message, err.stack);
});
import helmet from 'helmet';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { BillingGuard } from './common/guards/billing.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { SupabaseService } from './infrastructure/supabase/supabase.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // necessário para webhooks do Stripe
  });

  app.use(helmet());

  const corsOriginsStr = process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:3001';
  app.enableCors({
    origin: corsOriginsStr.split(','),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const reflector = app.get(Reflector);
  const supabaseService = app.get(SupabaseService);

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalGuards(
    new JwtAuthGuard(reflector),
    new TenantGuard(reflector),
    new BillingGuard(reflector, supabaseService),
  );
  app.useGlobalInterceptors(app.get(AuditInterceptor));

  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`API rodando em: http://localhost:${port}/api/v1`);
}

async function bootstrapWithRetry(retries = 5, delayMs = 2000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await bootstrap();
      return;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE' && i < retries - 1) {
        console.warn(`Porta em uso, tentando novamente em ${delayMs}ms... (${i + 1}/${retries})`);
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        console.error('Falha ao iniciar a aplicação', err);
        process.exit(1);
      }
    }
  }
}

bootstrapWithRetry();
