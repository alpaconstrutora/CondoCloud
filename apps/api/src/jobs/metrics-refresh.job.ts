import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { startOfWeek, subWeeks } from 'date-fns';
import { SupabaseService } from '../infrastructure/supabase/supabase.service';

@Injectable()
export class MetricsRefreshJob {
  private readonly logger = new Logger(MetricsRefreshJob.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // Toda segunda-feira às 03:00 UTC — recalcula stats da semana anterior
  @Cron('0 3 * * 1')
  async run(): Promise<void> {
    const supabase = this.supabaseService.getAdminClient();

    const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
    const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

    const { data: condos } = await supabase
      .from('condominiums')
      .select('id')
      .in('subscription_status', ['active', 'trialing', 'past_due']);

    if (!condos?.length) return;

    for (const condo of condos as { id: string }[]) {
      for (const channel of ['whatsapp', 'email', 'qr', 'csv'] as const) {
        const { count: sent } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('condo_id', condo.id)
          .eq('event_name', 'invite_sent')
          .eq('payload->>channel', channel)
          .gte('created_at', lastWeekStart.toISOString())
          .lt('created_at', thisWeekStart.toISOString());

        const { count: accepted } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('condo_id', condo.id)
          .eq('event_name', 'invite_accepted')
          .eq('payload->>channel', channel)
          .gte('created_at', lastWeekStart.toISOString())
          .lt('created_at', thisWeekStart.toISOString());

        if (!sent && !accepted) continue;

        await supabase.from('invite_channel_stats').upsert({
          condominium_id: condo.id,
          channel,
          invites_sent: sent ?? 0,
          invites_accepted: accepted ?? 0,
          week_start: lastWeekStart.toISOString().split('T')[0],
        });
      }
    }

    this.logger.log(`Canal stats recalculados para ${condos.length} condomínio(s)`);
  }
}
