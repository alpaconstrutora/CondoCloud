import { Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { DOMAIN_EVENTS, QUEUE_NAMES, DomainEvent } from '@condocloud/shared';
import { SupabaseService } from '../infrastructure/supabase/supabase.service';
import { BaseEventProcessor } from '../events/event-processor.base';
import { EventEmitterService } from '../events/event-emitter.service';

interface CondoActivationState {
  current_version: number;
  invites_sent: number;
  residents_active: number;
}

@Processor(QUEUE_NAMES.ACTIVATION_SEQUENCES)
export class ActivationWorker extends BaseEventProcessor {
  protected readonly logger = new Logger(ActivationWorker.name);

  constructor(
    supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitterService,
  ) {
    super(supabaseService);
  }

  @Process('domain_event')
  async onDomainEvent(job: Job<DomainEvent>): Promise<void> {
    await this.process(job.data, 'ActivationWorker');
  }

  protected async handle(event: DomainEvent): Promise<void> {
    switch (event.event_name) {
      case DOMAIN_EVENTS.USER_REGISTERED:
        await this.handleUserRegistered(event);
        break;
      case DOMAIN_EVENTS.INVITE_SENT:
        await this.incrementInvites(event.condo_id);
        break;
      case DOMAIN_EVENTS.INVITE_ACCEPTED:
        await this.handleInviteAccepted(event);
        break;
      case DOMAIN_EVENTS.ACTIVATION_PROGRESS_UPDATED:
        await this.handleActivationProgress(event);
        break;
    }
  }

  private async handleUserRegistered(event: DomainEvent): Promise<void> {
    const payload = event.payload as { role: string; condominium_id: string };
    if (payload.role !== 'sindico') return;

    await this.supabaseService.getAdminClient().from('activation_sequences').insert({
      condominium_id: payload.condominium_id,
      current_step: 'wait_invite',
      next_run_at: new Date(Date.now() + 30 * 60_000).toISOString(), // T+30min
      completed: false,
    });

    this.logger.log(`Sequência de ativação criada para condomínio ${payload.condominium_id}`);
  }

  private async incrementInvites(condoId: string): Promise<void> {
    const supabase = this.supabaseService.getAdminClient();
    // Não existe coluna invites_sent em condominiums — rastreado via events
    // Registra apenas para uso posterior do ActivationStepJob
    await supabase.from('metrics_snapshots').insert({
      condominium_id: condoId,
      metric_name: 'invites_sent_count',
      metric_value: 1,
    });
  }

  private async handleInviteAccepted(event: DomainEvent): Promise<void> {
    const payload = event.payload as { condominium_id: string };
    const condoId = payload.condominium_id || event.condo_id;
    const state = await this.getCondoActivationState(condoId);

    await this.eventEmitter.emit({
      event_name: DOMAIN_EVENTS.ACTIVATION_PROGRESS_UPDATED,
      aggregate_id: condoId,
      aggregate_type: 'condominium',
      event_version: state.current_version + 1,
      source: 'worker',
      condo_id: condoId,
      payload: {
        invites_sent: state.invites_sent,
        residents_active: state.residents_active + 1,
      },
    });
  }

  private async handleActivationProgress(event: DomainEvent): Promise<void> {
    const payload = event.payload as { residents_active: number; invites_sent: number };

    // Critério mínimo de ativação: ao menos 1 morador ativo
    if (payload.residents_active < 1) return;

    const supabase = this.supabaseService.getAdminClient();

    await supabase
      .from('condominiums')
      .update({ activated: true })
      .eq('id', event.condo_id);

    await supabase
      .from('activation_sequences')
      .update({ completed: true })
      .eq('condominium_id', event.condo_id)
      .eq('completed', false);

    await supabase.from('product_events').insert({
      condominium_id: event.condo_id,
      event_name: 'activation_completed',
      properties: {
        invites_sent: payload.invites_sent,
        residents_active: payload.residents_active,
      },
    });

    this.logger.log(`Condomínio ${event.condo_id} ativado com ${payload.residents_active} morador(es)`);
  }

  private async getCondoActivationState(condoId: string): Promise<CondoActivationState> {
    const supabase = this.supabaseService.getAdminClient();

    const { data: condo } = await supabase
      .from('condominiums')
      .select('current_version')
      .eq('id', condoId)
      .single();

    const { count: invitesSent } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('condo_id', condoId)
      .eq('event_name', DOMAIN_EVENTS.INVITE_SENT);

    const { count: residentsActive } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('condominium_id', condoId)
      .eq('role', 'morador')
      .eq('active', true);

    return {
      current_version: (condo as { current_version: number } | null)?.current_version ?? 0,
      invites_sent: invitesSent ?? 0,
      residents_active: residentsActive ?? 0,
    };
  }
}
