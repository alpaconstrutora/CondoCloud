import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ChargeService } from './charge.service';
import { CreateChargeDto, MarkPaidDto } from './dto/charge.dto';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse } from '../../common/dto/api-response.dto';

@Controller('charges')
export class ChargeController {
  constructor(private readonly chargeService: ChargeService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async create(
    @CurrentTenant() condoId: string,
    @Body() dto: CreateChargeDto,
  ): Promise<ApiResponse> {
    const charge = await this.chargeService.create(condoId, dto);
    return ApiResponse.ok(charge, 'Cobrança criada');
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async findAll(
    @CurrentTenant() condoId: string,
    @Query('status') status?: string,
    @Query('competencia') competencia?: string,
  ): Promise<ApiResponse> {
    const charges = await this.chargeService.findAll(condoId, status, competencia);
    return ApiResponse.ok(charges);
  }

  @Get('unit/:unitId')
  async findByUnit(
    @CurrentTenant() condoId: string,
    @Param('unitId') unitId: string,
  ): Promise<ApiResponse> {
    const charges = await this.chargeService.findByUnit(condoId, unitId);
    return ApiResponse.ok(charges);
  }

  @Patch(':id/pay')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async markPaid(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
    @Body() dto: MarkPaidDto,
  ): Promise<ApiResponse> {
    const charge = await this.chargeService.markPaid(condoId, id, dto);
    return ApiResponse.ok(charge, 'Cobrança marcada como paga');
  }

  @Patch(':id/unpay')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async unmarkPaid(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    const charge = await this.chargeService.unmarkPaid(condoId, id);
    return ApiResponse.ok(charge, 'Pagamento cancelado');
  }

  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async cancel(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    await this.chargeService.cancel(condoId, id);
    return ApiResponse.ok(null, 'Cobrança cancelada');
  }

  @Patch('cancel-by-competencia/:competencia')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async cancelByCompetencia(
    @CurrentTenant() condoId: string,
    @Param('competencia') competencia: string,
  ): Promise<ApiResponse> {
    const count = await this.chargeService.cancelByCompetencia(condoId, competencia);
    return ApiResponse.ok({ count }, `${count} cobrança(s) cancelada(s)`);
  }
}
