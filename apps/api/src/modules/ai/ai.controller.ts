import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse } from '../../common/dto/api-response.dto';

@Controller('ai')
@UseGuards(RolesGuard)
@Roles('sindico', 'sindico_administradora', 'desenvolvedor')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('tickets/:id/classify')
  async classifyTicket(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    const result = await this.aiService.classifyTicket(condoId, id);
    return ApiResponse.ok(result, 'Chamado classificado pela IA');
  }

  @Post('assemblies/:id/minutes')
  async generateMinutes(
    @CurrentTenant() condoId: string,
    @Param('id') id: string,
  ): Promise<ApiResponse> {
    const result = await this.aiService.generateAssemblyMinutes(condoId, id);
    return ApiResponse.ok(result, 'Ata gerada');
  }
}
