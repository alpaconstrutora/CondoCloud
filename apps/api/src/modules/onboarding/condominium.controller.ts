import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SkipTenant } from '../../common/decorators/public.decorator';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { IsOptional, IsString, IsNumber } from 'class-validator';

class UpdateCondominiumDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() manager_name?: string;
  @IsOptional() @IsString() address_street?: string;
  @IsOptional() @IsString() address_number?: string;
  @IsOptional() @IsString() address_bairro?: string;
  @IsOptional() @IsString() address_city?: string;
  @IsOptional() @IsString() address_state?: string;
  @IsOptional() @IsNumber() sla_manutencao_hours?: number;
  @IsOptional() @IsNumber() sla_urgente_hours?: number;
  @IsOptional() @IsNumber() taxa_condominial?: number;
}

@Controller('condominium')
@UseGuards(RolesGuard)
@Roles('sindico', 'sindico_administradora', 'desenvolvedor')
export class CondominiumController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Post()
  @Roles('desenvolvedor')
  @SkipTenant()
  async create(@Body() dto: { name: string; address?: string; cnpj?: string }): Promise<ApiResponse> {
    const admin = this.supabaseService.getAdminClient();
    const { data, error } = await admin
      .from('condominiums')
      .insert({ name: dto.name, address: dto.address ?? null, cnpj: dto.cnpj ?? null, activated: false, onboarding_completed: false })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return ApiResponse.ok(data, 'Condomínio criado com sucesso');
  }

  @Get('condominiums')
  @Roles('desenvolvedor')
  @SkipTenant()
  async listAll(): Promise<ApiResponse> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .select('id, name, address, cnpj, activated, onboarding_completed, created_at')
      .order('name');
    return ApiResponse.ok(data ?? []);
  }

  @Get('units')
  async listUnits(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('units')
      .select('id, number, block_id, floor, size_sqm, parking_spots, blocks(id, name), unit_profiles(profile_id, is_responsible, profiles(id, name))')
      .eq('condominium_id', condoId)
      .order('number');
    return ApiResponse.ok(data ?? []);
  }

  @Post('units/:id/residents')
  async addResident(
    @CurrentTenant() condoId: string,
    @Param('id') unitId: string,
    @Body() dto: { profile_id: string },
  ): Promise<ApiResponse> {
    const admin = this.supabaseService.getAdminClient();
    const { data: unit } = await admin.from('units').select('id').eq('id', unitId).eq('condominium_id', condoId).single();
    if (!unit) throw new Error('Unidade não encontrada');
    await admin.from('unit_profiles').upsert({ unit_id: unitId, profile_id: dto.profile_id }, { onConflict: 'unit_id,profile_id' });
    return ApiResponse.ok(null, 'Morador vinculado');
  }

  @Delete('units/:id/residents/:profileId')
  async removeResident(
    @CurrentTenant() condoId: string,
    @Param('id') unitId: string,
    @Param('profileId') profileId: string,
  ): Promise<ApiResponse> {
    const admin = this.supabaseService.getAdminClient();
    const { data: unit } = await admin.from('units').select('id').eq('id', unitId).eq('condominium_id', condoId).single();
    if (!unit) throw new Error('Unidade não encontrada');
    await admin.from('unit_profiles').delete().eq('unit_id', unitId).eq('profile_id', profileId);
    return ApiResponse.ok(null, 'Morador desvinculado');
  }

  @Patch('units/:id/residents/:profileId/responsible')
  async setResponsible(
    @CurrentTenant() condoId: string,
    @Param('id') unitId: string,
    @Param('profileId') profileId: string,
  ): Promise<ApiResponse> {
    const admin = this.supabaseService.getAdminClient();
    const { data: unit } = await admin.from('units').select('id').eq('id', unitId).eq('condominium_id', condoId).single();
    if (!unit) throw new Error('Unidade não encontrada');
    // Clear responsible flag for all residents of this unit, then set for the chosen one
    await admin.from('unit_profiles').update({ is_responsible: false }).eq('unit_id', unitId);
    await admin.from('unit_profiles').update({ is_responsible: true }).eq('unit_id', unitId).eq('profile_id', profileId);
    return ApiResponse.ok(null, 'Responsável definido');
  }

  @Get()
  async get(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    const admin = this.supabaseService.getAdminClient();

    const [{ data: condo }, { data: blocks }] = await Promise.all([
      admin.from('condominiums').select('*').eq('id', condoId).single(),
      admin.from('blocks').select('id, name, units(count)').eq('condominium_id', condoId).order('name'),
    ]);

    const { count: total_units } = await admin
      .from('units')
      .select('*', { count: 'exact', head: true })
      .eq('condominium_id', condoId);

    return ApiResponse.ok({ ...condo, blocks: blocks ?? [], total_units: total_units ?? 0 });
  }

  @Patch()
  async update(@CurrentTenant() condoId: string, @Body() dto: UpdateCondominiumDto): Promise<ApiResponse> {
    const admin = this.supabaseService.getAdminClient();

    const { data: current } = await admin
      .from('condominiums')
      .select('settings')
      .eq('id', condoId)
      .single();

    const currentSettings = (current as { settings: Record<string, unknown> } | null)?.settings ?? {};

    // Basic columns that exist on the table
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.address !== undefined) patch.address = dto.address;
    if (dto.cnpj !== undefined) patch.cnpj = dto.cnpj;

    // Extra fields stored in settings JSONB
    patch.settings = {
      ...currentSettings,
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.manager_name !== undefined && { manager_name: dto.manager_name }),
      ...(dto.address_street !== undefined && { address_street: dto.address_street }),
      ...(dto.address_number !== undefined && { address_number: dto.address_number }),
      ...(dto.address_bairro !== undefined && { address_bairro: dto.address_bairro }),
      ...(dto.address_city !== undefined && { address_city: dto.address_city }),
      ...(dto.address_state !== undefined && { address_state: dto.address_state }),
      ...(dto.sla_manutencao_hours !== undefined && { sla_manutencao_hours: dto.sla_manutencao_hours }),
      ...(dto.sla_urgente_hours !== undefined && { sla_urgente_hours: dto.sla_urgente_hours }),
      ...(dto.taxa_condominial !== undefined && { taxa_condominial: dto.taxa_condominial }),
    };

    const { data, error } = await admin
      .from('condominiums')
      .update(patch)
      .eq('id', condoId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return ApiResponse.ok(data, 'Condomínio atualizado');
  }

  @Post('units')
  async createUnit(
    @CurrentTenant() condoId: string,
    @Body() dto: { number: string; block_id: string; floor?: number; size_sqm?: number; parking_spots?: number },
  ): Promise<ApiResponse> {
    const admin = this.supabaseService.getAdminClient();

    const { data, error } = await admin
      .from('units')
      .insert({
        number: dto.number,
        block_id: dto.block_id,
        condominium_id: condoId,
        floor: dto.floor ?? null,
        size_sqm: dto.size_sqm ?? null,
        parking_spots: dto.parking_spots ?? null,
      })
      .select('id, number, block_id, floor, size_sqm, parking_spots, blocks(id, name)')
      .single();

    if (error) throw new Error(error.message);
    return ApiResponse.ok(data, 'Unidade criada');
  }

  @Patch('units/:id')
  async updateUnit(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
    @Body() dto: { number?: string; block_id?: string; floor?: number; size_sqm?: number; parking_spots?: number },
  ): Promise<ApiResponse> {
    const admin = this.supabaseService.getAdminClient();

    const patch: Record<string, unknown> = {};
    if (dto.number !== undefined) patch.number = dto.number;
    if (dto.block_id !== undefined) patch.block_id = dto.block_id;
    if (dto.floor !== undefined) patch.floor = dto.floor;
    if (dto.size_sqm !== undefined) patch.size_sqm = dto.size_sqm;
    if (dto.parking_spots !== undefined) patch.parking_spots = dto.parking_spots;

    const { data, error } = await admin
      .from('units')
      .update(patch)
      .eq('id', id)
      .eq('condominium_id', condoId)
      .select('id, number, block_id, floor, size_sqm, parking_spots, blocks(id, name)')
      .single();

    if (error) throw new Error(error.message);
    return ApiResponse.ok(data, 'Unidade atualizada');
  }

  @Delete('units/:id')
  async deleteUnit(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    const admin = this.supabaseService.getAdminClient();
    const { error } = await admin
      .from('units')
      .delete()
      .eq('id', id)
      .eq('condominium_id', condoId);

    if (error) throw new Error(error.message);
    return ApiResponse.ok(null, 'Unidade removida');
  }

  @Get('blocks')
  async listBlocks(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    const { data } = await this.supabaseService
      .getAdminClient()
      .from('blocks')
      .select('id, name, units(count)')
      .eq('condominium_id', condoId)
      .order('name');
    return ApiResponse.ok(data ?? []);
  }

  @Post('blocks')
  async createBlock(
    @CurrentTenant() condoId: string,
    @Body() dto: { name: string },
  ): Promise<ApiResponse> {
    const admin = this.supabaseService.getAdminClient();
    const { data, error } = await admin
      .from('blocks')
      .insert({ name: dto.name, condominium_id: condoId })
      .select('id, name, units(count)')
      .single();
    if (error) throw new Error(error.message);
    return ApiResponse.ok(data, 'Bloco criado');
  }

  @Patch('blocks/:id')
  async updateBlock(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
    @Body() dto: { name: string },
  ): Promise<ApiResponse> {
    const admin = this.supabaseService.getAdminClient();
    const { data, error } = await admin
      .from('blocks')
      .update({ name: dto.name })
      .eq('id', id)
      .eq('condominium_id', condoId)
      .select('id, name, units(count)')
      .single();
    if (error) throw new Error(error.message);
    return ApiResponse.ok(data, 'Bloco atualizado');
  }

  @Delete('blocks/:id')
  async deleteBlock(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    const admin = this.supabaseService.getAdminClient();
    const { error } = await admin
      .from('blocks')
      .delete()
      .eq('id', id)
      .eq('condominium_id', condoId);
    if (error) throw new Error(error.message);
    return ApiResponse.ok(null, 'Bloco removido');
  }
}
