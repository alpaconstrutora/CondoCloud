import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { CreateMessageDto } from './dto/message.dto';
import type { Message, MessageWithMeta, MessagesPage } from '@condocloud/shared';
import type { UserRole } from '@condocloud/shared';

const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class MessageService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(condoId: string, createdBy: string, dto: CreateMessageDto): Promise<Message> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('messages')
      .insert({
        ...dto,
        condominium_id: condoId,
        created_by: createdBy,
        publish_at: dto.publish_at ?? new Date().toISOString(),
      })
      .select('*, profiles!created_by(name)')
      .single();

    if (error) throw new Error(error.message);

    // Disparar notificação push para os destinatários
    await this.broadcastNotification(condoId, data as Message, dto);

    return data as Message;
  }

  async findAll(
    condoId: string,
    userId: string,
    userRole: UserRole,
    userBlockId?: string | null,
    userUnitId?: string | null,
    pinned?: boolean,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<MessagesPage> {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const now = new Date().toISOString();
    const isAdmin = ['sindico', 'sindico_administradora', 'desenvolvedor'].includes(userRole);

    let query = this.supabaseService
      .getAdminClient()
      .from('messages')
      .select('*, profiles!created_by(name)', { count: 'exact' })
      .eq('condominium_id', condoId)
      .is('deleted_at', null)
      .lte('publish_at', now)
      .order('pinned', { ascending: false })
      .order('publish_at', { ascending: false })
      .range(from, to);

    if (pinned !== undefined) query = query.eq('pinned', pinned);

    // Moradores só veem mensagens que são para eles
    if (!isAdmin) {
      const audienceFilters: string[] = [`audience.eq.all`];
      if (userBlockId) audienceFilters.push(`and(audience.eq.block,target_id.eq.${userBlockId})`);
      if (userUnitId) audienceFilters.push(`and(audience.eq.unit,target_id.eq.${userUnitId})`);
      query = query.or(audienceFilters.join(','));
    }

    const { data, count } = await query;
    const messages = (data ?? []) as Message[];

    // Marcar quais o usuário já leu
    const ids = messages.map(m => m.id);
    let readIds = new Set<string>();
    if (ids.length > 0) {
      const { data: reads } = await this.supabaseService
        .getAdminClient()
        .from('message_reads')
        .select('message_id')
        .eq('profile_id', userId)
        .in('message_id', ids);
      readIds = new Set((reads ?? []).map((r: { message_id: string }) => r.message_id));
    }

    // Para síndicos: incluir contagem de leituras
    let readCounts: Record<string, number> = {};
    if (isAdmin && ids.length > 0) {
      const { data: counts } = await this.supabaseService
        .getAdminClient()
        .from('message_reads')
        .select('message_id')
        .in('message_id', ids);

      (counts ?? []).forEach((r: { message_id: string }) => {
        readCounts[r.message_id] = (readCounts[r.message_id] ?? 0) + 1;
      });
    }

    const enriched: MessageWithMeta[] = messages.map(m => ({
      ...m,
      unread: !readIds.has(m.id),
      read_count: readCounts[m.id] ?? 0,
    }));

    return { data: enriched, total: count ?? 0, page, page_size: pageSize };
  }

  async getReads(condoId: string, messageId: string): Promise<{ profile_id: string; name: string; read_at: string }[]> {
    const { data: msg } = await this.supabaseService
      .getAdminClient()
      .from('messages')
      .select('id')
      .eq('id', messageId)
      .eq('condominium_id', condoId)
      .is('deleted_at', null)
      .single();

    if (!msg) throw new NotFoundException('Comunicado não encontrado');

    const { data } = await this.supabaseService
      .getAdminClient()
      .from('message_reads')
      .select('profile_id, read_at, profiles!profile_id(name)')
      .eq('message_id', messageId)
      .order('read_at', { ascending: false });

    type ReadRow = { profile_id: string; read_at: string; profiles: { name: string } | { name: string }[] | null };
    return ((data ?? []) as ReadRow[]).map(r => {
      const profileName = Array.isArray(r.profiles)
        ? (r.profiles[0]?.name ?? 'Desconhecido')
        : (r.profiles?.name ?? 'Desconhecido');
      return { profile_id: r.profile_id, name: profileName, read_at: r.read_at };
    });
  }

  async markRead(messageId: string, profileId: string): Promise<void> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('messages')
      .select('id')
      .eq('id', messageId)
      .is('deleted_at', null)
      .single();

    if (!data) throw new NotFoundException('Aviso não encontrado');

    await this.supabaseService.getAdminClient().from('message_reads').upsert({
      message_id: messageId,
      profile_id: profileId,
      read_at: new Date().toISOString(),
    });
  }

  async delete(condoId: string, id: string, deletedBy: string): Promise<void> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('messages')
      .select('id')
      .eq('id', id)
      .eq('condominium_id', condoId)
      .is('deleted_at', null)
      .single();

    if (!data) throw new NotFoundException('Comunicado não encontrado');

    await this.supabaseService
      .getAdminClient()
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
  }

  private async broadcastNotification(condoId: string, message: Message, dto: CreateMessageDto): Promise<void> {
    // Não notificar comunicados agendados — serão notificados quando publicados
    if (dto.publish_at && new Date(dto.publish_at) > new Date()) return;

    const supabase = this.supabaseService.getAdminClient();
    let profileQuery = supabase
      .from('profiles')
      .select('id')
      .eq('condominium_id', condoId)
      .in('role', ['morador', 'prestador']);

    if (dto.audience === 'block' && dto.target_id) {
      profileQuery = supabase
        .from('profiles')
        .select('id')
        .eq('condominium_id', condoId)
        .eq('block_id', dto.target_id)
        .in('role', ['morador', 'prestador']);
    } else if (dto.audience === 'unit' && dto.target_id) {
      profileQuery = supabase
        .from('profiles')
        .select('id')
        .eq('condominium_id', condoId)
        .eq('unit_id', dto.target_id)
        .in('role', ['morador', 'prestador']);
    }

    const { data: profiles } = await profileQuery;
    if (!profiles || profiles.length === 0) return;

    const notifications = (profiles as { id: string }[]).map(p => ({
      profile_id: p.id,
      title: message.title,
      body: message.content.substring(0, 150),
      type: 'message',
      entity_id: message.id,
      channel: 'push',
      condominium_id: condoId,
    }));

    await supabase.from('notifications').insert(notifications);
  }
}
