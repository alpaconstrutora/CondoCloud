import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

export interface TipoMorador {
  id: string;
  nome: string;
  condominium_id: string;
  created_at: string;
}

@Injectable()
export class TipoMoradorService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async list(condoId: string): Promise<TipoMorador[]> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('tipos_morador')
      .select('*')
      .eq('condominium_id', condoId)
      .order('nome');
    return (data ?? []) as TipoMorador[];
  }

  async create(condoId: string, nome: string): Promise<TipoMorador> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('tipos_morador')
      .insert({ nome: nome.trim(), condominium_id: condoId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as TipoMorador;
  }

  async update(condoId: string, id: string, nome: string): Promise<TipoMorador> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('tipos_morador')
      .update({ nome: nome.trim() })
      .eq('id', id)
      .eq('condominium_id', condoId)
      .select()
      .single();
    if (error || !data) throw new NotFoundException('Tipo não encontrado');
    return data as TipoMorador;
  }

  async remove(condoId: string, id: string): Promise<void> {
    const { error } = await this.supabaseService
      .getAdminClient()
      .from('tipos_morador')
      .delete()
      .eq('id', id)
      .eq('condominium_id', condoId);
    if (error) throw new Error(error.message);
  }
}
