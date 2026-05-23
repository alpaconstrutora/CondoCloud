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

    const [condoRes, profilesRes] = await Promise.all([
      db.from('condominiums').select('whatsapp_disabled_events').eq('id', condoId).single(),
      db
        .from('profiles')
        .select('id, name, role, whatsapp, whatsapp_opt_in, unit_id')
        .eq('condominium_id', condoId)
        .eq('active', true)
        .order('name'),
    ]);

    const rawProfiles = (profilesRes.data ?? []) as Array<{
      id: string; name?: string; role: string; whatsapp?: string;
      whatsapp_opt_in: boolean; unit_id?: string | null;
    }>;

    // Buscar unidades para exibir o número (sem depender do join FK)
    const unitIds = [...new Set(rawProfiles.map(p => p.unit_id).filter(Boolean))] as string[];
    let unitMap: Record<string, string> = {};
    if (unitIds.length > 0) {
      const { data: units } = await db.from('units').select('id, number').in('id', unitIds);
      if (units) {
        (units as { id: string; number: string }[]).forEach(u => { unitMap[u.id] = u.number; });
      }
    }

    const profiles: ProfileWa[] = rawProfiles.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      whatsapp: p.whatsapp,
      whatsapp_opt_in: p.whatsapp_opt_in,
      units: p.unit_id && unitMap[p.unit_id] ? [{ number: unitMap[p.unit_id] }] : null,
    }));

    return {
      disabled_events: (condoRes.data as { whatsapp_disabled_events?: string[] } | null)?.whatsapp_disabled_events ?? [],
      profiles,
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
