import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';

export interface TipoMorador {
  id: string;
  nome: string;
  condominium_id: string;
  created_at: string;
}

@Injectable()
export class TipoMoradorService {
  private readonly logger = new Logger(TipoMoradorService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async list(condoId: string): Promise<TipoMorador[]> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('tipos_morador')
      .select('*')
      .eq('condominium_id', condoId)
      .order('nome');
    if (error) {
      this.logger.error('Erro ao listar tipos_morador:', error.message);
      throw new Error(error.message);
    }
    return (data ?? []) as TipoMorador[];
  }

  async create(condoId: string, nome: string): Promise<TipoMorador> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('tipos_morador')
      .insert({ nome, condominium_id: condoId })
      .select()
      .single();
    if (error) {
      this.logger.error('Erro ao criar tipo_morador:', error.message);
      if (error.code === '23505') throw new BadRequestException(`Já existe um tipo com o nome "${nome}"`);
      throw new Error(error.message);
    }
    return data as TipoMorador;
  }

  async update(condoId: string, id: string, nome: string): Promise<TipoMorador> {
    // Verifica se existe antes de atualizar
    const { data: existing } = await this.supabaseService
      .getAdminClient()
      .from('tipos_morador')
      .select('id')
      .eq('id', id)
      .eq('condominium_id', condoId)
      .maybeSingle();

    if (!existing) throw new NotFoundException('Tipo não encontrado');

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('tipos_morador')
      .update({ nome })
      .eq('id', id)
      .eq('condominium_id', condoId)
      .select()
      .maybeSingle();

    if (error) {
      this.logger.error('Erro ao atualizar tipo_morador:', error.message);
      if (error.code === '23505') throw new BadRequestException(`Já existe um tipo com o nome "${nome}"`);
      throw new Error(error.message);
    }
    if (!data) throw new NotFoundException('Tipo não encontrado após atualização');
    return data as TipoMorador;
  }

  async remove(condoId: string, id: string): Promise<void> {
    const { error } = await this.supabaseService
      .getAdminClient()
      .from('tipos_morador')
      .delete()
      .eq('id', id)
      .eq('condominium_id', condoId);
    if (error) {
      this.logger.error('Erro ao remover tipo_morador:', error.message);
      throw new Error(error.message);
    }
  }
}
