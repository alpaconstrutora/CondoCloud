import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { EventEmitterService } from '../../events/event-emitter.service';
import { DOMAIN_EVENTS } from '@condocloud/shared';
import { UpdatePreferencesDto } from './dto/notification.dto';

interface Notification {
  id: string;
  profile_id: string;
  title: string;
  body?: string;
  type: string;
  entity_id?: string;
  channel: string;
  read_at?: string;
  clicked_at?: string;
  sent_at?: string;
  condominium_id?: string;
  created_at: string;
}

interface NotificationPreferences {
  profile_id: string;
  consecutive_ignored: number;
  cooldown_until?: string;
  last_opened_at?: string;
  silenced_types: string[];
  updated_at: string;
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitterService,
  ) {}

  async findAll(profileId: string, condoId: string, limit = 50): Promise<Notification[]> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('notifications')
      .select('*')
      .eq('profile_id', profileId)
      .eq('condominium_id', condoId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return (data ?? []) as Notification[];
  }

  async markRead(notifId: string, profileId: string): Promise<void> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('notifications')
      .select('id, profile_id, condominium_id')
      .eq('id', notifId)
      .single();

    if (!data || (data as { profile_id: string }).profile_id !== profileId) {
      throw new NotFoundException('Notificação não encontrada');
    }
    const condoId = (data as { condominium_id: string }).condominium_id;

    await this.supabaseService
      .getAdminClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notifId)
      .is('read_at', null);

    // Atualiza preferências: reset consecutive_ignored ao abrir
    await this.supabaseService
      .getAdminClient()
      .from('notification_preferences')
      .upsert({
        profile_id: profileId,
        consecutive_ignored: 0,
        last_opened_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    await this.eventEmitter.emit({
      event_name: DOMAIN_EVENTS.NOTIFICATION_ENGAGEMENT_UPDATED,
      aggregate_id: notifId,
      aggregate_type: 'notification',
      event_version: 1,
      source: 'api',
      condo_id: condoId,
      payload: { action: 'opened' },
    });
  }

  async markClicked(notifId: string, profileId: string): Promise<void> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('notifications')
      .select('id, profile_id, condominium_id')
      .eq('id', notifId)
      .single();

    if (!data || (data as { profile_id: string }).profile_id !== profileId) {
      throw new NotFoundException('Notificação não encontrada');
    }
    const condoId = (data as { condominium_id: string }).condominium_id;

    await this.supabaseService
      .getAdminClient()
      .from('notifications')
      .update({
        clicked_at: new Date().toISOString(),
        read_at: new Date().toISOString(), // clicked implica lida
      })
      .eq('id', notifId);

    await this.eventEmitter.emit({
      event_name: DOMAIN_EVENTS.NOTIFICATION_ENGAGEMENT_UPDATED,
      aggregate_id: notifId,
      aggregate_type: 'notification',
      event_version: 2,
      source: 'api',
      condo_id: condoId,
      payload: { action: 'clicked' },
    });
  }

  async getPreferences(profileId: string): Promise<NotificationPreferences> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('notification_preferences')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle();

    // Retorna defaults se não existe ainda
    return (data ?? {
      profile_id: profileId,
      consecutive_ignored: 0,
      cooldown_until: null,
      last_opened_at: null,
      silenced_types: [],
      updated_at: new Date().toISOString(),
    }) as NotificationPreferences;
  }

  async updatePreferences(profileId: string, dto: UpdatePreferencesDto): Promise<NotificationPreferences> {
    const updates: Record<string, unknown> = {
      profile_id: profileId,
      updated_at: new Date().toISOString(),
    };

    if (dto.silenced_types !== undefined) updates['silenced_types'] = dto.silenced_types;
    if (dto.reset_cooldown) updates['cooldown_until'] = null;

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('notification_preferences')
      .upsert(updates)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as NotificationPreferences;
  }

  async getUnreadCount(profileId: string, condoId: string): Promise<number> {
    const { count } = await this.supabaseService
      .getAdminClient()
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('profile_id', profileId)
      .eq('condominium_id', condoId)
      .is('read_at', null);

    return count ?? 0;
  }
}
