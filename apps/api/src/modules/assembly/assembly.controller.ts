import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AssemblyService } from './assembly.service';
import { CreateAssemblyDto, CreateAssemblyItemDto, VoteDto } from './dto/assembly.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse } from '../../common/dto/api-response.dto';
import type { Profile } from '@condocloud/shared';

@Controller('assemblies')
export class AssemblyController {
  constructor(private readonly assemblyService: AssemblyService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async create(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Body() dto: CreateAssemblyDto,
  ): Promise<ApiResponse> {
    const assembly = await this.assemblyService.create(condoId, user.id, dto);
    return ApiResponse.ok(assembly, 'Assembleia criada');
  }

  @Get()
  async findAll(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    const assemblies = await this.assemblyService.findAll(condoId);
    return ApiResponse.ok(assemblies);
  }

  @Get(':id')
  async findOne(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    const assembly = await this.assemblyService.findOne(condoId, id);
    return ApiResponse.ok(assembly);
  }

  @Patch(':id/open')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async open(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    const assembly = await this.assemblyService.setStatus(condoId, id, 'open');
    return ApiResponse.ok(assembly, 'Votação aberta');
  }

  @Patch(':id/close')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async close(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    const assembly = await this.assemblyService.setStatus(condoId, id, 'closed');
    return ApiResponse.ok(assembly, 'Assembleia encerrada');
  }

  @Post(':id/items')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async addItem(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
    @Body() dto: CreateAssemblyItemDto,
  ): Promise<ApiResponse> {
    const item = await this.assemblyService.addItem(condoId, id, dto);
    return ApiResponse.ok(item, 'Pauta adicionada');
  }

  @Post(':id/items/:itemId/vote')
  async vote(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: VoteDto,
  ): Promise<ApiResponse> {
    await this.assemblyService.vote(condoId, id, itemId, user.id, dto);
    return ApiResponse.ok(null, 'Voto registrado');
  }

  @Get(':id/items/:itemId/votes')
  async voteSummary(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<ApiResponse> {
    const summary = await this.assemblyService.getVoteSummary(condoId, id, itemId);
    return ApiResponse.ok(summary);
  }
}
