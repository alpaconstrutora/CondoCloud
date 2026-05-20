import { Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { DOMAIN_EVENTS, QUEUE_NAMES, DomainEvent } from '@condocloud/shared';
import { SupabaseService } from '../infrastructure/supabase/supabase.service';
import { BaseEventProcessor } from '../events/event-processor.base';
import { ResendService } from '../infrastructure/resend/resend.service';
import { WhatsAppService } from '../infrastructure/whatsapp/whatsapp.service';
import {
  ticketResolvedEmail,
  newResidentEmail,
  proposalApprovedEmail,
} from '../infrastructure/resend/email-templates';

interface ProfileContact {
  id: string;
  email?: string;
  whatsapp?: string;
  name?: string;
}

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationWorker extends BaseEventProcessor {
  protected readonly logger = new Logger(NotificationWorker.name);

  constructor(
    supabaseService: SupabaseService,
    private readonly resend: ResendService,
    private readonly whatsapp: WhatsAppService,
  ) {
    super(supabaseService);
  }

  @Process('domain_event')
  async onDomainEvent(job: Job<DomainEvent>): Promise<void> {
    await this.process(job.data, 'NotificationWorker');
  }

  protected async handle(event: DomainEvent): Promise<void> {
    switch (event.event_name) {
      case DOMAIN_EVENTS.TICKET_RESOLVED:
        await this.notifyTicketResolved(event);
        break;
      case DOMAIN_EVENTS.INVITE_ACCEPTED:
        await this.notifyInviteAccepted(event);
        break;
      case DOMAIN_EVENTS.PROPOSAL_INTERACTION:
        await this.notifyProposalInteraction(event);
        break;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────

  private async getProfile(profileId: string): Promise<ProfileContact | null> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('profiles')
      .select('id, email, whatsapp, name')
      .eq('id', profileId)
      .single();
    return data as ProfileContact | null;
  }

  private async getCondoName(condoId: string): Promise<string> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .select('name')
      .eq('id', condoId)
      .single();
    return (data as { name?: string } | null)?.name ?? 'Seu Condomínio';
  }

  private async deliver(
    profile: ProfileContact,
    subject: string,
    html: string,
    whatsappText: string,
  ): Promise<void> {
    const tasks: Promise<void>[] = [];
    if (profile.email) tasks.push(this.resend.sendEmail(profile.email, subject, html));
    if (profile.whatsapp) tasks.push(this.whatsapp.sendMessage(profile.whatsapp, whatsappText));
    await Promise.allSettled(tasks);
  }

  private async createNotification(
    profileId: string,
    title: string,
    body: string,
    type: string,
    entityId: string,
    condoId: string,
  ): Promise<void> {
    await this.supabaseService.getAdminClient().from('notifications').insert({
      profile_id: profileId,
      title,
      body,
      type,
      entity_id: entityId,
      channel: 'push',
      condominium_id: condoId,
    });
  }

  // ── Handlers ───────────────────────────────────────────────────

  private async notifyTicketResolved(event: DomainEvent): Promise<void> {
    const supabase = this.supabaseService.getAdminClient();

    const { data: ticket } = await supabase
      .from('tickets')
      .select('title, created_by, condominium_id')
      .eq('id', event.aggregate_id)
      .single();

    if (!ticket) return;
    const t = ticket as { title: string; created_by?: string; condominium_id: string };
    if (!t.created_by) return;

    await this.createNotification(
      t.created_by,
      'Chamado resolvido',
      `Seu chamado "${t.title}" foi resolvido.`,
      'ticket',
      event.aggregate_id,
      t.condominium_id,
    );

    const [profile, condoName] = await Promise.all([
      this.getProfile(t.created_by),
      this.getCondoName(t.condominium_id),
    ]);
    if (!profile) return;

    await this.deliver(
      profile,
      `✅ Chamado resolvido — ${condoName}`,
      ticketResolvedEmail(condoName, t.title),
      `✅ *CondoCloud — ${condoName}*\n\nSeu chamado _"${t.title}"_ foi resolvido. Acesse o app para ver os detalhes.`,
    );
  }

  private async notifyInviteAccepted(event: DomainEvent): Promise<void> {
    const supabase = this.supabaseService.getAdminClient();
    const condoId = event.condo_id;

    const { data: sindicos } = await supabase
      .from('profiles')
      .select('id, email, whatsapp, name')
      .eq('condominium_id', condoId)
      .eq('role', 'sindico')
      .eq('active', true);

    if (!sindicos?.length) return;

    const condoName = await this.getCondoName(condoId);

    await Promise.all(
      (sindicos as ProfileContact[]).map(async (s) => {
        await this.createNotification(
          s.id,
          'Novo morador entrou',
          'Um morador aceitou o convite e entrou no CondoCloud.',
          'system',
          event.aggregate_id,
          condoId,
        );
        await this.deliver(
          s,
          `👋 Novo morador — ${condoName}`,
          newResidentEmail(condoName),
          `👋 *CondoCloud — ${condoName}*\n\nUm novo morador aceitou o convite e entrou no condomínio. Acesse o painel para ver a lista atualizada.`,
        );
      }),
    );
  }

  private async notifyProposalInteraction(event: DomainEvent): Promise<void> {
    const payload = event.payload as { action: string };
    if (payload.action !== 'voted') return;

    const supabase = this.supabaseService.getAdminClient();
    const { data: proposal } = await supabase
      .from('proposals')
      .select('created_by, condominium_id')
      .eq('id', event.aggregate_id)
      .single();

    if (!proposal) return;
    const p = proposal as { created_by?: string; condominium_id: string };
    if (!p.created_by) return;

    await this.createNotification(
      p.created_by,
      'Proposta aprovada',
      'Alguém aprovou sua proposta comercial.',
      'system',
      event.aggregate_id,
      p.condominium_id,
    );

    const [profile, condoName] = await Promise.all([
      this.getProfile(p.created_by),
      this.getCondoName(p.condominium_id),
    ]);
    if (!profile) return;

    await this.deliver(
      profile,
      `👍 Proposta aprovada — ${condoName}`,
      proposalApprovedEmail(condoName),
      `👍 *CondoCloud — ${condoName}*\n\nAlguém aprovou sua proposta comercial. Acesse o app para ver os detalhes.`,
    );
  }
}
