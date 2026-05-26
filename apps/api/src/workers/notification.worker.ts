import { Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { DOMAIN_EVENTS, QUEUE_NAMES, DomainEvent } from '@condocloud/shared';
import { SupabaseService } from '../infrastructure/supabase/supabase.service';
import { BaseEventProcessor } from '../events/event-processor.base';
import { ResendService } from '../infrastructure/resend/resend.service';
import { WhatsAppService } from '../infrastructure/whatsapp/whatsapp.service';
import { WhatsappSettingsService } from '../modules/whatsapp-settings/whatsapp-settings.service';
import { ExpoPushService } from '../infrastructure/expo/expo-push.service';
import { whatsappTemplates } from '../infrastructure/whatsapp/whatsapp-message.templates';
import {
  ticketResolvedEmail,
  newResidentEmail,
  proposalApprovedEmail,
  proposalConvertedEmail,
  roiUpdatedEmail,
  chargeCreatedEmail,
  messagePublishedEmail,
  ticketCreatedEmail,
} from '../infrastructure/resend/email-templates';

interface ProfileContact {
  id: string;
  email?: string;
  whatsapp?: string;
  whatsapp_opt_in?: boolean;
  name?: string;
  push_token?: string | null;
}

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationWorker extends BaseEventProcessor {
  protected readonly logger = new Logger(NotificationWorker.name);

  constructor(
    supabaseService: SupabaseService,
    private readonly resend: ResendService,
    private readonly whatsapp: WhatsAppService,
    private readonly waSettings: WhatsappSettingsService,
    private readonly expoPush: ExpoPushService,
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
      case DOMAIN_EVENTS.PROPOSAL_STATUS_CHANGED:
        await this.notifyProposalStatusChanged(event);
        break;
      case DOMAIN_EVENTS.ROI_UPDATED:
        await this.notifyRoiUpdated(event);
        break;
      case DOMAIN_EVENTS.CHARGE_CREATED:
        await this.notifyChargeCreated(event);
        break;
      case DOMAIN_EVENTS.MESSAGE_PUBLISHED:
        await this.notifyMessagePublished(event);
        break;
      case DOMAIN_EVENTS.TICKET_CREATED:
        await this.notifyTicketCreated(event);
        break;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────

  private async getProfile(profileId: string): Promise<ProfileContact | null> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('profiles')
      .select('id, email, whatsapp, whatsapp_opt_in, name, push_token')
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
    skipWhatsapp = false,
  ): Promise<void> {
    const tasks: Promise<void>[] = [];

    if (profile.email) {
      tasks.push(this.resend.sendEmail(profile.email, subject, html));
    }

    if (!skipWhatsapp && profile.whatsapp && profile.whatsapp_opt_in) {
      tasks.push(this.whatsapp.sendMessage(profile.whatsapp, whatsappText, profile.id));
    }

    // Push notification via Expo (best-effort)
    if (profile.push_token) {
      tasks.push(this.expoPush.sendOne(profile.push_token, subject, whatsappText));
    }

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

    const [profile, condoName, skip] = await Promise.all([
      this.getProfile(t.created_by),
      this.getCondoName(t.condominium_id),
      this.waSettings.isEventDisabled(t.condominium_id, DOMAIN_EVENTS.TICKET_RESOLVED),
    ]);
    if (!profile) return;

    await this.deliver(
      profile,
      `✅ Chamado resolvido — ${condoName}`,
      ticketResolvedEmail(condoName, t.title),
      whatsappTemplates.ticketResolved(condoName, t.title),
      skip,
    );
  }

  private async notifyInviteAccepted(event: DomainEvent): Promise<void> {
    const supabase = this.supabaseService.getAdminClient();
    const condoId = event.condo_id;

    const [{ data: sindicos }, skip] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, whatsapp, whatsapp_opt_in, name, push_token')
        .eq('condominium_id', condoId)
        .eq('role', 'sindico')
        .eq('active', true),
      this.waSettings.isEventDisabled(condoId, DOMAIN_EVENTS.INVITE_ACCEPTED),
    ]);

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
          whatsappTemplates.newResident(condoName),
          skip,
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

    const [profile, condoName, skip] = await Promise.all([
      this.getProfile(p.created_by),
      this.getCondoName(p.condominium_id),
      this.waSettings.isEventDisabled(p.condominium_id, DOMAIN_EVENTS.PROPOSAL_INTERACTION),
    ]);
    if (!profile) return;

    await this.deliver(
      profile,
      `👍 Proposta aprovada — ${condoName}`,
      proposalApprovedEmail(condoName),
      whatsappTemplates.proposalInteraction(condoName),
      skip,
    );
  }

  private async notifyProposalStatusChanged(event: DomainEvent): Promise<void> {
    const payload = event.payload as { status: string };
    if (payload.status !== 'approved') return;

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
      'Proposta convertida',
      'Sua proposta comercial foi marcada como convertida.',
      'system',
      event.aggregate_id,
      p.condominium_id,
    );

    const [profile, condoName, skip] = await Promise.all([
      this.getProfile(p.created_by),
      this.getCondoName(p.condominium_id),
      this.waSettings.isEventDisabled(p.condominium_id, DOMAIN_EVENTS.PROPOSAL_STATUS_CHANGED),
    ]);
    if (!profile) return;

    await this.deliver(
      profile,
      `🎉 Proposta convertida — ${condoName}`,
      proposalConvertedEmail(condoName),
      whatsappTemplates.proposalApproved(condoName),
      skip,
    );
  }

  private async notifyChargeCreated(event: DomainEvent): Promise<void> {
    const payload = event.payload as unknown as { profile_id?: string; amount: number; due_date: string; description: string };
    if (!payload.profile_id) return;

    const [profile, condoName, skip] = await Promise.all([
      this.getProfile(payload.profile_id),
      this.getCondoName(event.condo_id),
      this.waSettings.isEventDisabled(event.condo_id, DOMAIN_EVENTS.CHARGE_CREATED),
    ]);
    if (!profile) return;

    await this.deliver(
      profile,
      `💰 Nova cobrança — ${condoName}`,
      chargeCreatedEmail(condoName, payload.description, payload.amount, payload.due_date),
      whatsappTemplates.chargeCreated(condoName, payload.description, payload.amount, payload.due_date),
      skip,
    );
  }

  private async notifyMessagePublished(event: DomainEvent): Promise<void> {
    const payload = event.payload as unknown as { title: string; content: string; audience: string; target_id?: string };
    const condoId = event.condo_id;

    const supabase = this.supabaseService.getAdminClient();

    let profileQuery = supabase
      .from('profiles')
      .select('id, email, whatsapp, whatsapp_opt_in, name, push_token')
      .eq('condominium_id', condoId)
      .eq('active', true)
      .in('role', ['morador', 'prestador']);

    if (payload.audience === 'block' && payload.target_id) {
      profileQuery = supabase
        .from('profiles')
        .select('id, email, whatsapp, whatsapp_opt_in, name, push_token')
        .eq('condominium_id', condoId)
        .eq('active', true)
        .eq('block_id', payload.target_id)
        .in('role', ['morador', 'prestador']);
    } else if (payload.audience === 'unit' && payload.target_id) {
      profileQuery = supabase
        .from('profiles')
        .select('id, email, whatsapp, whatsapp_opt_in, name, push_token')
        .eq('condominium_id', condoId)
        .eq('active', true)
        .eq('unit_id', payload.target_id)
        .in('role', ['morador', 'prestador']);
    }

    const [{ data: profiles }, condoName, skip] = await Promise.all([
      profileQuery,
      this.getCondoName(condoId),
      this.waSettings.isEventDisabled(condoId, DOMAIN_EVENTS.MESSAGE_PUBLISHED),
    ]);

    if (!profiles?.length) return;

    await Promise.all(
      (profiles as ProfileContact[]).map((p) =>
        this.deliver(
          p,
          `📢 Novo comunicado — ${condoName}`,
          messagePublishedEmail(condoName, payload.title, payload.content),
          whatsappTemplates.messagePublished(condoName, payload.title),
          skip,
        ),
      ),
    );
  }

  private async notifyTicketCreated(event: DomainEvent): Promise<void> {
    const payload = event.payload as unknown as { title: string; category: string; priority: string; created_by: string };
    const condoId = event.condo_id;

    const supabase = this.supabaseService.getAdminClient();
    const [{ data: sindicos }, condoName, skip] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, whatsapp, whatsapp_opt_in, name, push_token')
        .eq('condominium_id', condoId)
        .in('role', ['sindico', 'sindico_administradora'])
        .eq('active', true),
      this.getCondoName(condoId),
      this.waSettings.isEventDisabled(condoId, DOMAIN_EVENTS.TICKET_CREATED),
    ]);

    if (!sindicos?.length) return;

    await Promise.all(
      (sindicos as ProfileContact[]).map((s) =>
        this.deliver(
          s,
          `🎫 Novo chamado — ${condoName}`,
          ticketCreatedEmail(condoName, payload.title, payload.category),
          whatsappTemplates.ticketCreated(condoName, payload.title, payload.category),
          skip,
        ),
      ),
    );
  }

  private async notifyRoiUpdated(event: DomainEvent): Promise<void> {
    const payload = event.payload as { messages_avoided: number; tickets_resolved: number };
    const condoId = event.condo_id;

    const supabase = this.supabaseService.getAdminClient();
    const [{ data: sindicos }, condoName, skip] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, whatsapp, whatsapp_opt_in, name, push_token')
        .eq('condominium_id', condoId)
        .in('role', ['sindico', 'sindico_administradora'])
        .eq('active', true),
      this.getCondoName(condoId),
      this.waSettings.isEventDisabled(condoId, DOMAIN_EVENTS.ROI_UPDATED),
    ]);

    if (!sindicos?.length) return;

    await Promise.all(
      (sindicos as ProfileContact[]).map((s) =>
        this.deliver(
          s,
          `📊 Resumo do dia — ${condoName}`,
          roiUpdatedEmail(condoName, payload.messages_avoided, payload.tickets_resolved),
          whatsappTemplates.roiUpdated(condoName, payload.messages_avoided, payload.tickets_resolved),
          skip,
        ),
      ),
    );
  }
}
