import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DOMAIN_EVENTS } from '@condocloud/shared';
import { SupabaseService } from '../infrastructure/supabase/supabase.service';
import { DecisionEngineService } from '../events/decision-engine.service';
import { resolveSystemState } from '../common/state-resolver';
import type { Condominium } from '@condocloud/shared';

interface ActivationSequence {
  id: string;
  condominium_id: string;
  current_step: string;
  next_run_at: string;
  completed: boolean;
  metadata: Record<string, unknown>;
  condominiums: Condominium;
}

@Injectable()
export class ActivationStepJob {
  private readonly logger = new Logger(ActivationStepJob.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly decisionEngine: DecisionEngineService,
  ) {}

  // Roda a cada hora — verifica sequências pendentes
  @Cron('0 * * * *')
  async runPendingSteps(): Promise<void> {
    const supabase = this.supabaseService.getAdminClient();

    const { data: sequences } = await supabase
      .from('activation_sequences')
      .select('*, condominiums(*)')
      .eq('completed', false)
      .lte('next_run_at', new Date().toISOString());

    if (!sequences?.length) return;

    for (const seq of sequences as ActivationSequence[]) {
      await this.processSequence(seq);
    }
  }

  private async processSequence(seq: ActivationSequence): Promise<void> {
    const condo = seq.condominiums;
    const supabase = this.supabaseService.getAdminClient();

    // Sequência encerra se o condomínio já está ativado
    if (condo.activated) {
      await supabase.from('activation_sequences').update({ completed: true }).eq('id', seq.id);
      return;
    }

    const state = resolveSystemState(condo);

    const decision = this.decisionEngine.evaluate({
      condo_id: condo.id,
      condo_state: state,
      activated: condo.activated,
      active_sequences: ['activation_sequence'],
      action_type: 'sequence_step',
      event_name: 'activation_step',
    });

    if (!decision.allow) {
      await this.reschedule(seq.id, 60);
      return;
    }

    // Busca estado atual de ativação
    const { count: invitesSent } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('condo_id', condo.id)
      .eq('event_name', DOMAIN_EVENTS.INVITE_SENT);

    const { count: residentsActive } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('condominium_id', condo.id)
      .eq('role', 'morador')
      .eq('active', true);

    const sent = invitesSent ?? 0;
    const active = residentsActive ?? 0;

    // Lógica da sequência T+30min → T+7d
    if (sent === 0) {
      await this.sendActivationNotification(condo.id, 'no_invites_yet', 'sindico');
    } else if (active === 0) {
      await this.sendActivationNotification(condo.id, 'no_accepts_yet', 'sindico');
    } else {
      // Estado intermediário: há convites e aceites mas ainda não ativado
      await this.sendActivationNotification(condo.id, 'almost_there', 'sindico');
    }

    // Agenda próximo step em 24h
    await this.reschedule(seq.id, 24 * 60);

    this.logger.log(
      `Sequência ${seq.id} processada — enviados: ${sent}, ativos: ${active}`,
    );
  }

  private async sendActivationNotification(
    condoId: string,
    step: string,
    targetRole: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getAdminClient();

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('condominium_id', condoId)
      .eq('role', targetRole)
      .eq('active', true);

    if (!profiles?.length) return;

    const messages: Record<string, { title: string; body: string }> = {
      no_invites_yet: {
        title: 'Seus moradores ainda não sabem',
        body: 'Compartilhe o link de convite agora. Leva menos de 1 minuto →',
      },
      no_accepts_yet: {
        title: 'Seus vizinhos ainda não entraram',
        body: 'Reenviar o convite? A maioria dos moradores entra no primeiro dia →',
      },
      almost_there: {
        title: 'Quase lá!',
        body: 'Seu condomínio está quase funcionando. Convide os moradores restantes →',
      },
    };

    const msg = messages[step] ?? messages['almost_there'];

    await Promise.all(
      (profiles as { id: string }[]).map((p) =>
        supabase.from('notifications').insert({
          profile_id: p.id,
          title: msg.title,
          body: msg.body,
          type: 'activation',
          channel: 'push',
          condominium_id: condoId,
        }),
      ),
    );
  }

  private async reschedule(sequenceId: string, delayMinutes: number): Promise<void> {
    const nextRunAt = new Date(Date.now() + delayMinutes * 60_000).toISOString();
    await this.supabaseService
      .getAdminClient()
      .from('activation_sequences')
      .update({ next_run_at: nextRunAt })
      .eq('id', sequenceId);
  }
}
