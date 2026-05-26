import { Module } from '@nestjs/common';
import { MetricsWorker } from './metrics.worker';
import { MetricActionWorker } from './metric-action.worker';
import { ActivationWorker } from './activation.worker';
import { NotificationWorker } from './notification.worker';
import { ActivationStepJob } from '../jobs/activation-step.job';
import { BillingReconciliationJob } from '../jobs/billing-reconciliation.job';
import { RecurringFinancialJob } from '../jobs/recurring-financial.job';
import { MetricsRefreshJob } from '../jobs/metrics-refresh.job';
import { ActiveUsersJob } from '../jobs/active-users.job';
import { ChargeOverdueJob } from '../jobs/charge-overdue.job';
import { EventsModule } from '../events/events.module';
import { ResendModule } from '../infrastructure/resend/resend.module';
import { WhatsAppModule } from '../infrastructure/whatsapp/whatsapp.module';
import { WhatsappSettingsModule } from '../modules/whatsapp-settings/whatsapp-settings.module';
import { ChargeModule } from '../modules/charge/charge.module';
import { ExpoPushModule } from '../infrastructure/expo/expo-push.module';

@Module({
  imports: [EventsModule, ResendModule, WhatsAppModule, WhatsappSettingsModule, ChargeModule, ExpoPushModule],
  providers: [
    MetricsWorker,
    MetricActionWorker,
    ActivationWorker,
    NotificationWorker,
    ActivationStepJob,
    BillingReconciliationJob,
    MetricsRefreshJob,
    ActiveUsersJob,
    RecurringFinancialJob,
    ChargeOverdueJob,
  ],
})
export class WorkersModule {}
