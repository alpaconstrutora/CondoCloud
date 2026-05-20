import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { CreateFinancialRecordDto, GenerateChargesFromRateioDto } from './dto/financial.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse } from '../../common/dto/api-response.dto';
import type { Profile } from '@condocloud/shared';

@Controller('financial')
@UseGuards(RolesGuard)
@Roles('sindico', 'sindico_administradora', 'desenvolvedor')
export class FinancialController {
  constructor(private readonly financialService: FinancialService) {}

  @Post()
  async create(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Body() dto: CreateFinancialRecordDto,
  ): Promise<ApiResponse> {
    const record = await this.financialService.create(condoId, user.id, dto);
    return ApiResponse.ok(record, 'Lançamento registrado');
  }

  @Get()
  async findAll(
    @CurrentTenant() condoId: string,
    @Query('type') type?: string,
    @Query('competencia') competencia?: string,
  ): Promise<ApiResponse> {
    const records = await this.financialService.findAll(condoId, type, competencia);
    return ApiResponse.ok(records);
  }

  @Patch(':id')
  async update(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
  ): Promise<ApiResponse> {
    const record = await this.financialService.update(condoId, id, dto as never);
    return ApiResponse.ok(record, 'Lançamento atualizado');
  }

  @Delete(':id')
  async remove(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    await this.financialService.remove(condoId, id);
    return ApiResponse.ok(null, 'Lançamento excluído');
  }

  @Get('summary')
  async summary(
    @CurrentTenant() condoId: string,
    @Query('competencia') competencia?: string,
  ): Promise<ApiResponse> {
    const summary = await this.financialService.getSummary(condoId, competencia);
    return ApiResponse.ok(summary);
  }

  // ── Fechamentos ───────────────────────────────────────────────

  @Get('closings')
  async listClosings(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    return ApiResponse.ok(await this.financialService.listClosings(condoId));
  }

  @Post('closings')
  async closeMonth(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Body() dto: { competencia: string; notes?: string },
  ): Promise<ApiResponse> {
    const closing = await this.financialService.closeMonth(condoId, user.id, dto.competencia, dto.notes);
    return ApiResponse.ok(closing, 'Mês fechado com sucesso');
  }

  @Delete('closings/:competencia')
  async reopenMonth(
    @CurrentTenant() condoId: string,
    @Param('competencia') competencia: string,
  ): Promise<ApiResponse> {
    await this.financialService.reopenMonth(condoId, competencia);
    return ApiResponse.ok(null, 'Mês reaberto');
  }

  // ── Gerar cobranças de rateio ─────────────────────────────────

  @Post('rateio/generate-charges')
  async generateChargesFromRateio(
    @CurrentTenant() condoId: string,
    @Body() dto: GenerateChargesFromRateioDto,
  ): Promise<ApiResponse> {
    const result = await this.financialService.generateChargesFromRateio(condoId, dto);
    return ApiResponse.ok(result, `${result.created} cobrança(s) gerada(s) com sucesso`);
  }

  // ── Recorrentes ───────────────────────────────────────────────

  @Get('recurring')
  async listRecurring(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    return ApiResponse.ok(await this.financialService.listRecurring(condoId));
  }

  @Post('recurring/generate')
  async generateRecurring(
    @CurrentTenant() condoId: string,
    @Body() dto: { competencia: string },
  ): Promise<ApiResponse> {
    const result = await this.financialService.generateRecurringForMonth(condoId, dto.competencia);
    return ApiResponse.ok(result, `${result.generated} lançamento(s) gerado(s)`);
  }

  @Post('recurring')
  async createRecurring(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Body() dto: { description: string; category: string; amount: number; day_of_month: number },
  ): Promise<ApiResponse> {
    const rec = await this.financialService.createRecurring(condoId, user.id, dto);
    return ApiResponse.ok(rec, 'Despesa fixa criada');
  }

  @Patch('recurring/:id')
  async updateRecurring(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
    @Body() dto: { description?: string; category?: string; amount?: number; day_of_month?: number; active?: boolean },
  ): Promise<ApiResponse> {
    const rec = await this.financialService.updateRecurring(condoId, id, dto);
    return ApiResponse.ok(rec, 'Despesa fixa atualizada');
  }

  @Delete('recurring/:id')
  async deleteRecurring(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    await this.financialService.deleteRecurring(condoId, id);
    return ApiResponse.ok(null, 'Despesa fixa removida');
  }

  // ── Categorias ────────────────────────────────────────────────

  @Get('categories')
  async listCategories(
    @CurrentTenant() condoId: string,
    @Query('type') type?: string,
  ): Promise<ApiResponse> {
    const cats = await this.financialService.listCategories(condoId, type);
    return ApiResponse.ok(cats);
  }

  @Post('categories')
  async createCategory(
    @CurrentTenant() condoId: string,
    @Body() dto: { name: string; type: 'income' | 'expense'; vendor_id?: string },
  ): Promise<ApiResponse> {
    const cat = await this.financialService.createCategory(condoId, dto);
    return ApiResponse.ok(cat, 'Categoria criada');
  }

  @Patch('categories/:id')
  async updateCategory(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
    @Body() dto: { name?: string; active?: boolean; vendor_id?: string | null },
  ): Promise<ApiResponse> {
    const cat = await this.financialService.updateCategory(condoId, id, dto);
    return ApiResponse.ok(cat, 'Categoria atualizada');
  }

  @Delete('categories/:id')
  async deleteCategory(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    await this.financialService.deleteCategory(condoId, id);
    return ApiResponse.ok(null, 'Categoria removida');
  }
}
