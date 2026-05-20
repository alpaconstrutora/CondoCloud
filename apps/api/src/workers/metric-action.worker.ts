import { Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import { InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { QUEUE_NAMES } from '@condocloud/shared';
import { SupabaseService } from '../infrastructure/supabase/supabase.service';

interface MetricsUpdatedJob {
  metric_name: string;
  metric_value: number;
  condo_id: string;
}

interface MetricRule {
  id: string;
  name: string;
  metric_name: string;
  condition: '>' | '<' | '>=' | '<=' | '=';
  threshold: number;
  action_type:
    | 'update_activation_template'
    | 'deprioritize_channel'
    | 'increase_notification_interval'
    | 'decrease_notification_interval'
    | 'activate_sequence'
    | 'pause_sequence'
    | 'change_incentive';
  action_payload: Record<string, unknown>;
  cooldown_hours: number;
  last_triggered_at: string | null;
}

@Processor(QUEUE_NAMES.METRICS)
export class MetricActionWorker {
  private readonly logger = new Logger(MetricActionWorker.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @InjectQueue(QUEUE_NAMES.AUDIT) private readonly auditQueue: Queue,
  ) {}

  @Process('metrics_updated')
  async onMetricsUpdated(job: Job<MetricsUpdatedJob>): Promise<void> {
    const { metric_name, metric_value, condo_id } = job.data;
    const supabase = this.supabaseService.getAdminClient();

    const { data: rules, error } = await supabase
      .from('metric_rules')
      .select('*')
      .eq('metric_name', metric_name)
      .eq('active', true);

    if (error) {
      this.logger.error(`Erro ao buscar metric_rules: ${error.message}`);
      return;
    }

    for (const rule of (rules ?? []) as MetricRule[]) {
      if (!this.isCooldownExpired(rule)) continue;
      if (!this.evaluate(metric_value, rule.condition, rule.threshold)) continue;

      await this.executeAction(rule, condo_id);

      // Toda ação automática DEVE ser auditável
      await this.auditQueue.add('log', {
        action: 'metric_rule.triggered',
        entity_type: 'metric_rule',
        entity_id: rule.id,
        condominium_id: condo_id,
        payload: { metric_name, metric_value, rule_name: rule.name },
        reason: `Regra "${rule.name}" disparada: ${metric_name} ${rule.condition} ${rule.threshold}`,
      });

      await supabase
        .from('metric_rules')
        .update({ last_triggered_at: new Date().toISOString() })
        .eq('id', rule.id);
    }
  }

  private isCooldownExpired(rule: MetricRule): boolean {
    if (!rule.last_triggered_at) return true;
    const hoursSince =
      (Date.now() - new Date(rule.last_triggered_at).getTime()) / 3_600_000;
    return hoursSince >= rule.cooldown_hours;
  }

  private evaluate(
    value: number,
    condition: MetricRule['condition'],
    threshold: number,
  ): boolean {
    const ops: Record<MetricRule['condition'], (a: number, b: number) => boolean> = {
      '>':  (a, b) => a > b,
      '<':  (a, b) => a < b,
      '>=': (a, b) => a >= b,
      '<=': (a, b) => a <= b,
      '=':  (a, b) => a === b,
    };
    return ops[condition](value, threshold);
  }

  private async executeAction(rule: MetricRule, condoId: string): Promise<void> {
    const supabase = this.supabaseService.getAdminClient();

    switch (rule.action_type) {
      case 'update_activation_template':
        await supabase
          .from('activation_sequences')
          .update({ metadata: rule.action_payload })
          .eq('condominium_id', condoId)
          .eq('completed', false);
        break;

      case 'deprioritize_channel':
        await supabase.from('invite_channel_stats').upsert({
          condominium_id: condoId,
          channel: rule.action_payload['channel'],
          week_start: new Date().toISOString().split('T')[0],
          ...rule.action_payload,
        });
        break;

      case 'increase_notification_interval':
      case 'decrease_notification_interval': {
        const minDays = Number(rule.action_payload['min_days_between'] ?? 3);
        const cooldownMs = minDays * 24 * 3_600_000;
        const cooldownUntil = new Date(Date.now() + cooldownMs).toISOString();
        // Atualiza cooldown para todos os perfis ativos do condomínio
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('condominium_id', condoId)
          .eq('active', true);
        if (profiles?.length) {
          await Promise.all(
            (profiles as { id: string }[]).map((p) =>
              supabase.from('notification_preferences').upsert({
                profile_id: p.id,
                cooldown_until: cooldownUntil,
              }),
            ),
          );
        }
        break;
      }

      case 'activate_sequence':
        await supabase.from('activation_sequences').insert({
          condominium_id: condoId,
          current_step: rule.action_payload['sequence'] ?? 'start',
          next_run_at: new Date().toISOString(),
          completed: false,
          metadata: rule.action_payload,
        });
        break;

      case 'pause_sequence':
        await supabase
          .from('activation_sequences')
          .update({ completed: true })
          .eq('condominium_id', condoId)
          .eq('current_step', rule.action_payload['sequence'])
          .eq('completed', false);
        break;

      case 'change_incentive':
        // Stub — implementado no InviteModule (Fase 3)
        this.logger.log(`change_incentive para ${condoId}: ${JSON.stringify(rule.action_payload)}`);
        break;

      default:
        this.logger.warn(`action_type desconhecido: ${rule.action_type as string}`);
    }
  }
}
