import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TipoMoradorService } from './tipo-morador.service';
import { CreateTipoMoradorDto, UpdateTipoMoradorDto } from './dto/tipo-morador.dto';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse } from '../../common/dto/api-response.dto';

@Controller('tipos-morador')
@UseGuards(RolesGuard)
@Roles('sindico', 'sindico_administradora', 'desenvolvedor')
export class TipoMoradorController {
  constructor(private readonly tipoMoradorService: TipoMoradorService) {}

  @Get()
  async list(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    const data = await this.tipoMoradorService.list(condoId);
    return ApiResponse.ok(data);
  }

  @Post()
  async create(
    @CurrentTenant() condoId: string,
    @Body() dto: CreateTipoMoradorDto,
  ): Promise<ApiResponse> {
    const data = await this.tipoMoradorService.create(condoId, dto.nome.trim());
    return ApiResponse.ok(data, 'Tipo criado com sucesso');
  }

  @Patch(':id')
  async update(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTipoMoradorDto,
  ): Promise<ApiResponse> {
    const data = await this.tipoMoradorService.update(condoId, id, dto.nome.trim());
    return ApiResponse.ok(data, 'Tipo atualizado');
  }

  @Delete(':id')
  async remove(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    await this.tipoMoradorService.remove(condoId, id);
    return ApiResponse.ok(null, 'Tipo removido');
  }
}
