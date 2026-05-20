import { Body, Controller, Get, Headers, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ProposalService } from './proposal.service';
import { CreateProposalDto, TrackInteractionDto } from './dto/proposal.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ApiResponse } from '../../common/dto/api-response.dto';
import type { Profile } from '@condocloud/shared';

@Controller('proposals')
export class ProposalController {
  constructor(private readonly proposalService: ProposalService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async create(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Body() dto: CreateProposalDto,
  ): Promise<ApiResponse> {
    const proposal = await this.proposalService.create(condoId, user.id, dto);
    return ApiResponse.ok(proposal, 'Proposta gerada');
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async list(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    const proposals = await this.proposalService.listByCondominium(condoId);
    return ApiResponse.ok(proposals);
  }

  // Rotas públicas — acessadas pelo link da proposta
  @Public()
  @Get(':token')
  async findByToken(@Param('token') token: string): Promise<ApiResponse> {
    const proposal = await this.proposalService.findByToken(token);
    return ApiResponse.ok(proposal);
  }

  @Public()
  @Post(':token/interact')
  async interact(
    @Param('token') token: string,
    @Body() dto: TrackInteractionDto,
    @Headers('x-forwarded-for') ip?: string,
  ): Promise<ApiResponse> {
    await this.proposalService.trackInteraction(token, dto, ip);
    return ApiResponse.ok(null, 'Interação registrada');
  }

  @Patch(':token/convert')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async convert(@Param('token') token: string): Promise<ApiResponse> {
    const proposal = await this.proposalService.convert(token);
    return ApiResponse.ok(proposal, 'Proposta convertida');
  }
}
