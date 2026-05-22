import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsQueryDto } from './dto/metrics.dto';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse } from '../../common/dto/api-response.dto';

@Controller('metrics')
@UseGuards(RolesGuard)
@Roles('sindico', 'sindico_administradora', 'desenvolvedor')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getLatest(
    @CurrentTenant() condoId: string,
    @Query() query: MetricsQueryDto,
  ): Promise<ApiResponse> {
    const data = await this.metricsService.getLatest(condoId, query.metric_name);
    return ApiResponse.ok(data);
  }

  @Get('history')
  async getHistory(
    @CurrentTenant() condoId: string,
    @Query() query: MetricsQueryDto,
  ): Promise<ApiResponse> {
    const data = await this.metricsService.getHistory(condoId, query.metric_name ?? '', query.days);
    return ApiResponse.ok(data);
  }

  @Get('channels')
  async getChannels(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    const data = await this.metricsService.getChannelStats(condoId);
    return ApiResponse.ok(data);
  }

  @Get('dashboard')
  async getDashboard(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    if (!condoId) throw new BadRequestException('Condomínio não identificado. Envie o header X-Active-Condo-ID.');
    const data = await this.metricsService.getDashboardSummary(condoId);
    return ApiResponse.ok(data);
  }
}
