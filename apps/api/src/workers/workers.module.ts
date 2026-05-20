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
import { EventsModule } from '../events/events.module';
import { ResendModule } from '../infrastructure/resend/resend.module';
import { WhatsAppModule } from '../infrastructure/whatsapp/whatsapp.module';

@Module({
  imports: [EventsModule, ResendModule, WhatsAppModule],
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
  ],
})
export class WorkersModule {}
