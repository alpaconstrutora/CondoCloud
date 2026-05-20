import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './infrastructure/supabase/supabase.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { EventsModule } from './events/events.module';
import { WorkersModule } from './workers/workers.module';
import { AuthModule } from './modules/auth/auth.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { InviteModule } from './modules/invite/invite.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { MessageModule } from './modules/message/message.module';
import { FinancialModule } from './modules/financial/financial.module';
import { ChargeModule } from './modules/charge/charge.module';
import { AssemblyModule } from './modules/assembly/assembly.module';
import { ReservationModule } from './modules/reservation/reservation.module';
import { DocumentModule } from './modules/document/document.module';
import { VendorModule } from './modules/vendor/vendor.module';
import { BillingModule } from './modules/billing/billing.module';
import { ProposalModule } from './modules/proposal/proposal.module';
import { NotificationModule } from './modules/notification/notification.module';
import { AiModule } from './modules/ai/ai.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      useFactory: () => [
        {
          ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
          limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
        },
      ],
    }),
    SupabaseModule,
    RedisModule.forRootAsync(),
    EventsModule,
    WorkersModule,
    AuthModule,
    OnboardingModule,
    InviteModule,
    TicketModule,
    MessageModule,
    FinancialModule,
    ChargeModule,
    AssemblyModule,
    ReservationModule,
    DocumentModule,
    VendorModule,
    BillingModule,
    ProposalModule,
    NotificationModule,
    AiModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [AppService, AuditInterceptor],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
