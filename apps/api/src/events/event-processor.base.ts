import { Logger } from '@nestjs/common';
import { DomainEvent } from '@condocloud/shared';
import { SupabaseService } from '../infrastructure/supabase/supabase.service';

export abstract class BaseEventProcessor {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly supabaseService: SupabaseService) {}

  async process(event: DomainEvent, workerName: string): Promise<void> {
    const supabase = this.supabaseService.getAdminClient();

    // 1. Idempotência: já processado por este worker?
    const { data: already } = await supabase
      .from('processed_events')
      .select('event_id')
      .eq('event_id', event.event_id)
      .eq('worker', workerName)
      .maybeSingle();
    if (already) return;

    // 2. Event ordering: versão do evento vs versão atual do aggregate
    const { data: agg } = await supabase
      .from('aggregate_versions')
      .select('current_version')
      .eq('aggregate_id', event.aggregate_id)
      .eq('aggregate_type', event.aggregate_type)
      .maybeSingle();

    const currentVersion = (agg as { current_version: number } | null)?.current_version ?? 0;
    if (event.event_version <= currentVersion) {
      this.logger.debug(
        `Descartado: ${event.event_name} v${event.event_version} <= atual v${currentVersion}`,
      );
      return;
    }

    // 3. Processar
    await this.handle(event);

    // 4. Atualizar versão do aggregate
    await supabase.from('aggregate_versions').upsert({
      aggregate_id: event.aggregate_id,
      aggregate_type: event.aggregate_type,
      current_version: event.event_version,
      updated_at: new Date().toISOString(),
    });

    // 5. Marcar como processado (idempotência futura)
    await supabase.from('processed_events').insert({
      event_id: event.event_id,
      worker: workerName,
      processed_at: new Date().toISOString(),
    });
  }

  protected abstract handle(event: DomainEvent): Promise<void>;
}
