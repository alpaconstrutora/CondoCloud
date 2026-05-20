import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { InviteService } from './invite.service';
import { CreateInviteDto, AcceptInviteDto } from './dto/invite.dto';
import { Public, SkipTenant } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse } from '../../common/dto/api-response.dto';
import type { Profile } from '@condocloud/shared';

@Controller('invites')
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async create(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
    @Body() dto: CreateInviteDto,
  ): Promise<ApiResponse> {
    const result = await this.inviteService.create(condoId, user.id, dto);
    return ApiResponse.ok(result, 'Convite criado');
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async list(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    const invites = await this.inviteService.list(condoId);
    return ApiResponse.ok(invites);
  }

  // Rota pública — acessada pelo link de convite no frontend
  @Public()
  @Get(':token')
  async getByToken(@Param('token') token: string): Promise<ApiResponse> {
    const result = await this.inviteService.findByToken(token);
    return ApiResponse.ok(result);
  }

  // Aceitar convite — usuário já autenticado vincula-se ao condomínio
  @SkipTenant()
  @Post(':token/accept')
  async accept(
    @Param('token') token: string,
    @CurrentUser() user: Profile,
    @Body() dto: AcceptInviteDto,
  ): Promise<ApiResponse> {
    await this.inviteService.resolveInvite(token, user.id, dto);
    return ApiResponse.ok(null, 'Bem-vindo ao condomínio!');
  }
}
