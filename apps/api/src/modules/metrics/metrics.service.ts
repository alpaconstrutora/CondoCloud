import { Injectable } from '@nestjs/common';
import { subDays } from 'date-fns';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

interface MetricSnapshot {
  id: string;
  condominium_id: string;
  metric_name: string;
  metric_value: number;
  created_at: string;
}

interface ChannelStats {
  channel: string;
  invites_sent: number;
  invites_accepted: number;
  avg_hours_to_accept?: number;
  week_start: string;
}

@Injectable()
export class MetricsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getLatest(condoId: string, metricName?: string): Promise<MetricSnapshot[]> {
    // Retorna o snapshot mais recente de cada métrica
    let query = this.supabaseService
      .getAdminClient()
      .from('metrics_snapshots')
      .select('*')
      .eq('condominium_id', condoId)
      .order('created_at', { ascending: false });

    if (metricName) {
      query = query.eq('metric_name', metricName).limit(1);
    } else {
      query = query.limit(50);
    }

    const { data } = await query;
    return (data ?? []) as MetricSnapshot[];
  }

  async getHistory(condoId: string, metricName: string, days = 30): Promise<MetricSnapshot[]> {
    const since = subDays(new Date(), days).toISOString();

    const { data } = await this.supabaseService
      .getAdminClient()
      .from('metrics_snapshots')
      .select('*')
      .eq('condominium_id', condoId)
      .eq('metric_name', metricName)
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    return (data ?? []) as MetricSnapshot[];
  }

  async getChannelStats(condoId: string): Promise<ChannelStats[]> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('invite_channel_stats')
      .select('*')
      .eq('condominium_id', condoId)
      .order('week_start', { ascending: false })
      .limit(20);

    return (data ?? []) as ChannelStats[];
  }

  async getDashboardSummary(condoId: string): Promise<Record<string, number>> {
    if (!condoId) throw new Error('condominium_id ausente');

    const supabase = this.supabaseService.getAdminClient();

    const [ticketsOpen, ticketsInProgress, ticketsResolved, residents, chargesPending, chargesOverdue, messages] =
      await Promise.all([
        supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('condominium_id', condoId).eq('status', 'open'),
        supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('condominium_id', condoId).eq('status', 'in_progress'),
        supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('condominium_id', condoId).eq('status', 'resolved'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('condominium_id', condoId).eq('role', 'morador').eq('active', true),
        supabase.from('charges').select('*', { count: 'exact', head: true }).eq('condominium_id', condoId).eq('status', 'pending'),
        supabase.from('charges').select('*', { count: 'exact', head: true }).eq('condominium_id', condoId).eq('status', 'overdue'),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('condominium_id', condoId),
      ]);

    return {
      tickets_open: ticketsOpen.count ?? 0,
      tickets_in_progress: ticketsInProgress.count ?? 0,
      tickets_resolved: ticketsResolved.count ?? 0,
      active_residents: residents.count ?? 0,
      charges_pending: chargesPending.count ?? 0,
      charges_overdue: chargesOverdue.count ?? 0,
      total_messages: messages.count ?? 0,
    };
  }
}
