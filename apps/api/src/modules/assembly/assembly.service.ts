import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { CreateAssemblyDto, CreateAssemblyItemDto, VoteDto } from './dto/assembly.dto';

interface Assembly {
  id: string;
  title: string;
  description?: string;
  date: string;
  location?: string;
  status: string;
  quorum_required: number;
  minutes_url?: string;
  condominium_id: string;
  created_by?: string;
  created_at: string;
}

interface AssemblyItem {
  id: string;
  assembly_id: string;
  title: string;
  description?: string;
  order_index: number;
  result?: string;
  created_at: string;
}

@Injectable()
export class AssemblyService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async create(condoId: string, createdBy: string, dto: CreateAssemblyDto): Promise<Assembly> {
    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('assemblies')
      .insert({ ...dto, condominium_id: condoId, created_by: createdBy })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Assembly;
  }

  async findAll(condoId: string): Promise<Assembly[]> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('assemblies')
      .select('*')
      .eq('condominium_id', condoId)
      .order('date', { ascending: false });

    return (data ?? []) as Assembly[];
  }

  async findOne(condoId: string, id: string): Promise<Assembly & { items: AssemblyItem[] }> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('assemblies')
      .select('*, assembly_items(*, votes(*))')
      .eq('id', id)
      .eq('condominium_id', condoId)
      .single();

    if (!data) throw new NotFoundException('Assembleia não encontrada');
    return data as Assembly & { items: AssemblyItem[] };
  }

  async setStatus(condoId: string, id: string, status: 'open' | 'closed' | 'cancelled'): Promise<Assembly> {
    const assembly = await this.findOne(condoId, id);

    const transitions: Record<string, string[]> = {
      scheduled: ['open', 'cancelled'],
      open: ['closed', 'cancelled'],
    };

    if (!transitions[assembly.status]?.includes(status)) {
      throw new BadRequestException(`Não é possível alterar de '${assembly.status}' para '${status}'`);
    }

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('assemblies')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Assembly;
  }

  async addItem(condoId: string, assemblyId: string, dto: CreateAssemblyItemDto): Promise<AssemblyItem> {
    const assembly = await this.findOne(condoId, assemblyId);
    if (assembly.status !== 'scheduled' && assembly.status !== 'open') {
      throw new BadRequestException('Não é possível adicionar pautas a uma assembleia encerrada');
    }

    const { data, error } = await this.supabaseService
      .getAdminClient()
      .from('assembly_items')
      .insert({ ...dto, assembly_id: assemblyId, order_index: dto.order_index ?? 0 })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as AssemblyItem;
  }

  async vote(condoId: string, assemblyId: string, itemId: string, profileId: string, dto: VoteDto): Promise<void> {
    const assembly = await this.findOne(condoId, assemblyId);
    if (assembly.status !== 'open') {
      throw new BadRequestException('Votação encerrada');
    }

    // Valida que o item pertence a esta assembleia (evita votar em pautas de outra assembleia)
    const { data: item } = await this.supabaseService
      .getAdminClient()
      .from('assembly_items')
      .select('id')
      .eq('id', itemId)
      .eq('assembly_id', assemblyId)
      .single();

    if (!item) throw new NotFoundException('Pauta não encontrada nesta assembleia');

    // unique(assembly_item_id, profile_id) garante 1 voto por perfil — upsert não permite trocar voto
    const { error } = await this.supabaseService
      .getAdminClient()
      .from('votes')
      .insert({ assembly_item_id: itemId, profile_id: profileId, vote: dto.vote });

    if (error) throw new BadRequestException('Voto já registrado para esta pauta');
  }

  async getVoteSummary(condoId: string, assemblyId: string, itemId: string): Promise<{ yes: number; no: number; abstain: number }> {
    await this.findOne(condoId, assemblyId);

    const { data } = await this.supabaseService
      .getAdminClient()
      .from('votes')
      .select('vote')
      .eq('assembly_item_id', itemId);

    const votes = (data ?? []) as { vote: string }[];
    return {
      yes: votes.filter((v) => v.vote === 'yes').length,
      no: votes.filter((v) => v.vote === 'no').length,
      abstain: votes.filter((v) => v.vote === 'abstain').length,
    };
  }
}
