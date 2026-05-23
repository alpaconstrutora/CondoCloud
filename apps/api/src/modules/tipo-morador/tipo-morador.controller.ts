import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TipoMoradorService } from './tipo-morador.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse } from '../../common/dto/api-response.dto';

@UseGuards(RolesGuard)
@Roles('sindico', 'sindico_administradora', 'desenvolvedor')
@Controller('tipos-morador')
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
    @Body('nome') nome: string,
  ): Promise<ApiResponse> {
    const data = await this.tipoMoradorService.create(condoId, nome);
    return ApiResponse.ok(data, 'Tipo criado com sucesso');
  }

  @Patch(':id')
  async update(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
    @Body('nome') nome: string,
  ): Promise<ApiResponse> {
    const data = await this.tipoMoradorService.update(condoId, id, nome);
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
