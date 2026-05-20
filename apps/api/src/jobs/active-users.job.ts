import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { subDays } from 'date-fns';
import { SupabaseService } from '../infrastructure/supabase/supabase.service';

@Injectable()
export class ActiveUsersJob {
  private readonly logger = new Logger(ActiveUsersJob.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  // Diariamente às 04:00 UTC — calcula taxa de moradores ativos na semana
  @Cron('0 4 * * *')
  async run(): Promise<void> {
    const supabase = this.supabaseService.getAdminClient();
    const sevenDaysAgo = subDays(new Date(), 7).toISOString();

    const { data: condos } = await supabase
      .from('condominiums')
      .select('id')
      .eq('activated', true)
      .in('subscription_status', ['active', 'trialing']);

    if (!condos?.length) return;

    let processed = 0;
    for (const condo of condos as { id: string }[]) {
      const { count: totalResidents } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('condominium_id', condo.id)
        .eq('role', 'morador')
        .eq('active', true);

      if (!totalResidents) continue;

      // Considera morador ativo se criou ticket, votou, ou leu notificação nos últimos 7 dias
      const { count: activeInTickets } = await supabase
        .from('tickets')
        .select('created_by', { count: 'exact', head: true })
        .eq('condominium_id', condo.id)
        .gte('created_at', sevenDaysAgo);

      // votes não tem condominium_id — filtra via assembly_items → assemblies
      const { data: assemblyIds } = await supabase
        .from('assemblies')
        .select('id')
        .eq('condominium_id', condo.id);
      const aIds = (assemblyIds ?? []).map((a: { id: string }) => a.id);

      const { count: activeInVotes } = aIds.length
        ? await supabase
            .from('votes')
            .select('profile_id', { count: 'exact', head: true })
            .in('assembly_id', aIds)
            .gte('created_at', sevenDaysAgo)
        : { count: 0 };

      const { count: activeInNotifs } = await supabase
        .from('notifications')
        .select('profile_id', { count: 'exact', head: true })
        .eq('condominium_id', condo.id)
        .not('read_at', 'is', null)
        .gte('read_at', sevenDaysAgo);

      // Aproximação conservadora: soma atividades únicas (pode haver sobreposição)
      const roughActiveCount = Math.min(
        totalResidents,
        (activeInTickets ?? 0) + (activeInVotes ?? 0) + (activeInNotifs ?? 0),
      );
      const pct = roughActiveCount / totalResidents;

      await supabase.from('metrics_snapshots').insert({
        condominium_id: condo.id,
        metric_name: 'weekly_active_residents_pct',
        metric_value: parseFloat(pct.toFixed(4)),
      });

      processed++;
    }

    this.logger.log(`weekly_active_residents_pct calculado para ${processed} condomínio(s)`);
  }
}
