import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { differenceInDays } from 'date-fns';
import { SupabaseService } from '../infrastructure/supabase/supabase.service';
import { EventEmitterService } from '../events/event-emitter.service';
import { DOMAIN_EVENTS } from '@condocloud/shared';

interface CondoRow {
  id: string;
  subscription_status: string;
  trial_ends_at?: string;
  past_due_since?: string;
}

@Injectable()
export class BillingReconciliationJob {
  private readonly logger = new Logger(BillingReconciliationJob.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitterService,
  ) {}

  // Roda diariamente às 02:00 UTC
  @Cron('0 2 * * *')
  async run(): Promise<void> {
    await Promise.all([
      this.reconcileTrials(),
      this.reconcilePastDue(),
      this.emitRoiUpdates(),
    ]);
  }

  private async reconcileTrials(): Promise<void> {
    // Condôminos em trial cujo período expirou → past_due
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .select('id')
      .eq('subscription_status', 'trialing')
      .lt('trial_ends_at', new Date().toISOString());

    if (!data?.length) return;

    const ids = (data as { id: string }[]).map((c) => c.id);
    await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .update({ subscription_status: 'past_due', past_due_since: new Date().toISOString() })
      .in('id', ids);

    this.logger.log(`${ids.length} condomínio(s) com trial expirado → past_due`);
  }

  private async reconcilePastDue(): Promise<void> {
    // Condôminos em past_due há mais de 30 dias → canceled
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .select('id, past_due_since')
      .eq('subscription_status', 'past_due')
      .not('past_due_since', 'is', null);

    if (!data?.length) return;

    const toCancel = (data as CondoRow[]).filter((c) => {
      if (!c.past_due_since) return false;
      return differenceInDays(new Date(), new Date(c.past_due_since)) > 30;
    });

    if (!toCancel.length) return;

    await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .update({ subscription_status: 'canceled' })
      .in('id', toCancel.map((c) => c.id));

    this.logger.log(`${toCancel.length} condomínio(s) cancelados por inadimplência > 30 dias`);
  }

  private async emitRoiUpdates(): Promise<void> {
    // Para condôminos ativos, emite ROI_UPDATED com métricas do dia
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .select('id')
      .eq('subscription_status', 'active')
      .eq('activated', true);

    if (!data?.length) return;

    const condos = data as { id: string }[];
    const supabase = this.supabaseService.getAdminClient();

    for (const condo of condos) {
      const { count: messagesAvoided } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('condominium_id', condo.id);

      const { count: ticketsResolved } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })
        .eq('condominium_id', condo.id)
        .eq('status', 'resolved');

      await this.eventEmitter.emit({
        event_name: DOMAIN_EVENTS.ROI_UPDATED,
        aggregate_id: condo.id,
        aggregate_type: 'condominium',
        event_version: 1,
        source: 'job',
        condo_id: condo.id,
        payload: {
          messages_avoided: messagesAvoided ?? 0,
          tickets_resolved: ticketsResolved ?? 0,
        },
      });
    }
  }
}
