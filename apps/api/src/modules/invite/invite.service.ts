import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { differenceInHours } from 'date-fns';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { EventEmitterService } from '../../events/event-emitter.service';
import { DOMAIN_EVENTS } from '@condocloud/shared';
import { CreateInviteDto, AcceptInviteDto } from './dto/invite.dto';

interface InviteRow {
  id: string;
  token: string;
  email: string | null;
  unit_id: string | null;
  role: string;
  condominium_id: string;
  channel: string;
  expires_at: string;
  used_at: string | null;
}

@Injectable()
export class InviteService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitterService,
  ) {}

  async create(condoId: string, createdBy: string, dto: CreateInviteDto): Promise<{ token: string; invite_url: string }> {
    const token = uuidv4().replace(/-/g, '');

    const { data: invite, error } = await this.supabaseService
      .getAdminClient()
      .from('invites')
      .insert({
        token,
        email: dto.email,
        unit_id: dto.unit_id,
        role: dto.role,
        channel: dto.channel,
        condominium_id: condoId,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await this.eventEmitter.emit({
      event_name: DOMAIN_EVENTS.INVITE_SENT,
      aggregate_id: (invite as InviteRow).id,
      aggregate_type: 'invite',
      event_version: 1,
      source: 'api',
      condo_id: condoId,
      payload: { channel: dto.channel, invite_id: (invite as InviteRow).id },
    });

    const appUrl = process.env.WEB_URL ?? 'http://localhost:5173';
    return { token, invite_url: `${appUrl}/convite/${token}` };
  }

  async findByToken(token: string): Promise<{ invite: InviteRow; condominium_name: string }> {
    const { data: invite, error } = await this.supabaseService
      .getAdminClient()
      .from('invites')
      .select('*, condominiums(name)')
      .eq('token', token)
      .maybeSingle();

    if (error || !invite) throw new NotFoundException('Convite não encontrado');
    if ((invite as InviteRow).used_at) throw new BadRequestException('Convite já utilizado');
    if (new Date((invite as InviteRow).expires_at) < new Date()) {
      throw new BadRequestException('Convite expirado');
    }

    return {
      invite: invite as InviteRow,
      condominium_name: (invite as { condominiums: { name: string } }).condominiums?.name ?? '',
    };
  }

  // resolveInvite: vincula o usuário ao condomínio via token — SEMPRE no backend
  async resolveInvite(token: string, userId: string, dto: AcceptInviteDto): Promise<void> {
    const supabase = this.supabaseService.getAdminClient();

    const { invite } = await this.findByToken(token);

    // Verifica o perfil atual para não sobrescrever um admin/síndico existente
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('condominium_id, role')
      .eq('id', userId)
      .maybeSingle();

    const alreadyInCondo = currentProfile?.condominium_id;

    if (alreadyInCondo && alreadyInCondo !== invite.condominium_id) {
      throw new BadRequestException('Esta conta já está vinculada a outro condomínio.');
    }

    // Se já é admin/síndico do mesmo condo, não altera a role — só atualiza dados pessoais
    const isPrivileged = alreadyInCondo &&
      ['sindico', 'admin'].includes((currentProfile as { role: string }).role);

    const updateData: Record<string, unknown> = {
      name: dto.name,
      phone: dto.phone,
      active: true,
    };

    if (!isPrivileged) {
      updateData.role = invite.role;
      updateData.condominium_id = invite.condominium_id;
      updateData.unit_id = invite.unit_id;
    }

    // Atualizar profile
    await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId);

    // Marcar convite como usado
    await supabase
      .from('invites')
      .update({ used_at: new Date().toISOString(), used_by: userId })
      .eq('token', token);

    // Calcular tempo até aceite
    const { data: inviteEvent } = await supabase
      .from('events')
      .select('created_at')
      .eq('event_name', DOMAIN_EVENTS.INVITE_SENT)
      .eq('payload->>invite_id', invite.id)
      .maybeSingle();

    const hoursToAccept = inviteEvent
      ? differenceInHours(new Date(), new Date((inviteEvent as { created_at: string }).created_at))
      : 0;

    await this.eventEmitter.emit({
      event_name: DOMAIN_EVENTS.INVITE_ACCEPTED,
      aggregate_id: invite.id,
      aggregate_type: 'invite',
      event_version: 2,
      source: 'api',
      condo_id: invite.condominium_id,
      payload: {
        channel: invite.channel as 'whatsapp' | 'email' | 'qr' | 'csv',
        hours_to_accept: hoursToAccept,
        condominium_id: invite.condominium_id,
      },
    });
  }

  async list(condoId: string): Promise<InviteRow[]> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('invites')
      .select('*')
      .eq('condominium_id', condoId)
      .order('created_at', { ascending: false });

    return (data ?? []) as InviteRow[];
  }
}
