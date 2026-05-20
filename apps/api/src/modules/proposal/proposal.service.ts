import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { EventEmitterService } from '../../events/event-emitter.service';
import { DOMAIN_EVENTS } from '@condocloud/shared';
import { CreateProposalDto, TrackInteractionDto } from './dto/proposal.dto';

interface Proposal {
  id: string;
  condominium_id: string;
  plan_id?: string;
  created_by?: string;
  token: string;
  pdf_url?: string;
  trial_snapshot?: Record<string, unknown>;
  expires_at: string;
  converted_at?: string;
  created_at: string;
}

@Injectable()
export class ProposalService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitterService,
  ) {}

  async create(condoId: string, createdBy: string, dto: CreateProposalDto): Promise<Proposal> {
    const supabase = this.supabaseService.getAdminClient();
    const token = uuidv4().replace(/-/g, '');

    // Captura snapshot do trial atual
    const { data: condo } = await supabase
      .from('condominiums')
      .select('name, activated, onboarding_completed, subscription_status, trial_ends_at, settings')
      .eq('id', condoId)
      .single();

    const { count: totalTickets } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('condominium_id', condoId);

    const { count: activeResidents } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('condominium_id', condoId)
      .eq('role', 'morador')
      .eq('active', true);

    const trialSnapshot = {
      ...(condo as Record<string, unknown>),
      total_tickets: totalTickets ?? 0,
      active_residents: activeResidents ?? 0,
      snapshot_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('proposals')
      .insert({
        condominium_id: condoId,
        plan_id: dto.plan_id,
        created_by: createdBy,
        token,
        trial_snapshot: trialSnapshot,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    const proposal = data as Proposal;

    await this.eventEmitter.emit({
      event_name: DOMAIN_EVENTS.PROPOSAL_CREATED,
      aggregate_id: proposal.id,
      aggregate_type: 'proposal',
      event_version: 1,
      source: 'api',
      condo_id: condoId,
      payload: { condominium_id: condoId, plan_id: dto.plan_id },
    });

    return proposal;
  }

  async findByToken(token: string): Promise<Proposal & { plan: Record<string, unknown> | null }> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('proposals')
      .select('*, plans(name, price_monthly, features)')
      .eq('token', token)
      .single();

    if (!data) throw new NotFoundException('Proposta não encontrada');
    return data as Proposal & { plan: Record<string, unknown> | null };
  }

  async trackInteraction(token: string, dto: TrackInteractionDto, ipAddress?: string): Promise<void> {
    const proposal = await this.findByToken(token);

    const { data: interaction, error } = await this.supabaseService
      .getAdminClient()
      .from('proposal_interactions')
      .insert({
        proposal_id: proposal.id,
        viewer_name: dto.viewer_name,
        viewer_email: dto.viewer_email,
        action: dto.action,
        comment: dto.comment,
        time_on_page_seconds: dto.time_on_page_seconds,
        ip_address: ipAddress,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    // aggregate_id = interação individual, version sempre 1 (BaseEventProcessor por interação)
    await this.eventEmitter.emit({
      event_name: DOMAIN_EVENTS.PROPOSAL_INTERACTION,
      aggregate_id: (interaction as { id: string }).id,
      aggregate_type: 'proposal',
      event_version: 1,
      source: 'api',
      condo_id: proposal.condominium_id,
      payload: {
        profile_id: dto.viewer_email ?? 'anonymous',
        action: dto.action === 'viewed' ? 'viewed' : 'voted',
        time_on_page_seconds: dto.time_on_page_seconds,
      },
    });
  }

  async convert(token: string): Promise<Proposal> {
    const proposal = await this.findByToken(token);

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('proposals')
      .update({ converted_at: new Date().toISOString() })
      .eq('id', proposal.id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await this.eventEmitter.emit({
      event_name: DOMAIN_EVENTS.PROPOSAL_STATUS_CHANGED,
      aggregate_id: proposal.id,
      aggregate_type: 'proposal',
      event_version: 3,
      source: 'api',
      condo_id: proposal.condominium_id,
      payload: { status: 'approved' },
    });

    return data as Proposal;
  }

  async listByCondominium(condoId: string): Promise<Proposal[]> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('proposals')
      .select('*, plans(name), proposal_interactions(count)')
      .eq('condominium_id', condoId)
      .order('created_at', { ascending: false });

    return (data ?? []) as Proposal[];
  }
}
