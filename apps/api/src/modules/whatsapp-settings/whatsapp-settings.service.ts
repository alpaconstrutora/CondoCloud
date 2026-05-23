import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

export interface ProfileWa {
  id: string;
  name?: string;
  role: string;
  whatsapp?: string;
  whatsapp_opt_in: boolean;
  units?: { number: string }[] | null;
}

export interface WhatsappSettings {
  disabled_events: string[];
  profiles: ProfileWa[];
}

@Injectable()
export class WhatsappSettingsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getSettings(condoId: string): Promise<WhatsappSettings> {
    const db = this.supabase.getAdminClient();

    const [{ data: condo }, { data: profiles }] = await Promise.all([
      db.from('condominiums').select('whatsapp_disabled_events').eq('id', condoId).single(),
      db
        .from('profiles')
        .select('id, name, role, whatsapp, whatsapp_opt_in, units!unit_id(number)')
        .eq('condominium_id', condoId)
        .eq('active', true)
        .order('name'),
    ]);

    return {
      disabled_events: (condo as { whatsapp_disabled_events?: string[] } | null)?.whatsapp_disabled_events ?? [],
      profiles: (profiles ?? []) as unknown as ProfileWa[],
    };
  }

  async toggleEvent(condoId: string, eventName: string, enabled: boolean): Promise<string[]> {
    const db = this.supabase.getAdminClient();

    const { data: current } = await db
      .from('condominiums')
      .select('whatsapp_disabled_events')
      .eq('id', condoId)
      .single();

    const existing: string[] = (current as { whatsapp_disabled_events?: string[] } | null)?.whatsapp_disabled_events ?? [];

    const updated = enabled
      ? existing.filter((e) => e !== eventName)
      : [...new Set([...existing, eventName])];

    await db.from('condominiums').update({ whatsapp_disabled_events: updated }).eq('id', condoId);

    return updated;
  }

  async updateProfile(
    condoId: string,
    profileId: string,
    patch: { whatsapp?: string; whatsapp_opt_in?: boolean },
  ): Promise<void> {
    const allowed = ['whatsapp', 'whatsapp_opt_in'];
    const clean = Object.fromEntries(
      Object.entries(patch).filter(([k]) => allowed.includes(k)),
    );
    if (!Object.keys(clean).length) return;

    await this.supabase
      .getAdminClient()
      .from('profiles')
      .update(clean)
      .eq('id', profileId)
      .eq('condominium_id', condoId);
  }

  async isEventDisabled(condoId: string, eventName: string): Promise<boolean> {
    const { data } = await this.supabase
      .getAdminClient()
      .from('condominiums')
      .select('whatsapp_disabled_events')
      .eq('id', condoId)
      .single();

    return ((data as { whatsapp_disabled_events?: string[] } | null)?.whatsapp_disabled_events ?? []).includes(eventName);
  }
}
