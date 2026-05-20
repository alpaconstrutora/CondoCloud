import { Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import { InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { QUEUE_NAMES, DomainEvent } from '@condocloud/shared';
import { SupabaseService } from '../infrastructure/supabase/supabase.service';
import { BaseEventProcessor } from '../events/event-processor.base';

// Subscriber universal: consome todos os 10 domain events
// Responsabilidades:
//   - Gravar metrics_snapshots
//   - Emitir metrics_updated para o MetricActionWorker avaliar regras
//   - Refresh das views materializadas (ttv_by_condominium, block_engagement_ranking)
// Tolerância: até 1h de defasagem é aceitável — NÃO calcular em tempo real
@Processor(QUEUE_NAMES.METRICS)
export class MetricsWorker extends BaseEventProcessor {
  protected readonly logger = new Logger(MetricsWorker.name);

  constructor(
    supabaseService: SupabaseService,
    @InjectQueue(QUEUE_NAMES.METRICS) private readonly metricsQueue: Queue,
  ) {
    super(supabaseService);
  }

  @Process('domain_event')
  async onDomainEvent(job: Job<DomainEvent>): Promise<void> {
    await this.process(job.data, 'MetricsWorker');
  }

  protected async handle(event: DomainEvent): Promise<void> {
    // Fase 3 implementará o cálculo completo de métricas
    // Por ora: registra snapshot básico e emite metrics_updated
    const metric = this.extractMetric(event);
    if (!metric) return;

    const supabase = this.supabaseService.getAdminClient();
    await supabase.from('metrics_snapshots').insert({
      condominium_id: event.condo_id,
      metric_name: metric.name,
      metric_value: metric.value,
    });

    // Dispara avaliação de regras no MetricActionWorker
    await this.metricsQueue.add('metrics_updated', {
      metric_name: metric.name,
      metric_value: metric.value,
      condo_id: event.condo_id,
    });
  }

  private extractMetric(event: DomainEvent): { name: string; value: number } | null {
    switch (event.event_name) {
      case 'invite_accepted': {
        const p = event.payload as { hours_to_accept: number };
        return { name: 'ttv_1_hours', value: p.hours_to_accept };
      }
      case 'ticket_resolved': {
        const p = event.payload as { resolution_time_hours: number };
        return { name: 'ticket_resolution_hours', value: p.resolution_time_hours };
      }
      case 'notification_engagement_updated': {
        const p = event.payload as { action: 'opened' | 'clicked' | 'ignored' };
        return {
          name: `notification_${p.action}_count`,
          value: 1,
        };
      }
      default:
        return null;
    }
  }
}
