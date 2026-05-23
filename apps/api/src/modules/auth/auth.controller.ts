import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { Public, SkipTenant } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiResponse } from '../../common/dto/api-response.dto';
import type { Profile } from '@condocloud/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  async signup(@Body() dto: SignupDto): Promise<ApiResponse> {
    const result = await this.authService.signup(dto);
    return ApiResponse.ok(result, 'Conta criada com sucesso');
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto): Promise<ApiResponse> {
    const result = await this.authService.login(dto);
    return ApiResponse.ok(result);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body('refresh_token') refreshToken: string): Promise<ApiResponse> {
    const result = await this.authService.refreshToken(refreshToken);
    return ApiResponse.ok(result);
  }

  @SkipTenant()
  @Post('reclaim-sindico')
  async reclaimSindico(@CurrentUser() user: Profile): Promise<ApiResponse> {
    const profile = await this.authService.reclaimSindico(user.id);
    return ApiResponse.ok(profile, 'Perfil restaurado como síndico');
  }

  @SkipTenant()
  @Get('me')
  async me(@CurrentUser() user: Profile): Promise<ApiResponse> {
    const profile = await this.authService.getMe(user.id);
    return ApiResponse.ok(profile);
  }

  // Lista condominios acessíveis: para sindico_administradora e desenvolvedor
  @SkipTenant()
  @Get('my-condominiums')
  async myCondominiums(@CurrentUser() user: Profile): Promise<ApiResponse> {
    const condominiums = await this.authService.getMyCondominiums(user.id, user.role);
    return ApiResponse.ok(condominiums);
  }

  // Vincula um condominio a um sindico_administradora (apenas desenvolvedor)
  @UseGuards(RolesGuard)
  @Roles('desenvolvedor')
  @SkipTenant()
  @Post('link-condominium')
  async linkCondominium(
    @Body() dto: { profile_id: string; condominium_id: string },
  ): Promise<ApiResponse> {
    await this.authService.linkCondominiumToAdm(dto.profile_id, dto.condominium_id);
    return ApiResponse.ok(null, 'Condomínio vinculado com sucesso');
  }

  // Remove vínculo de condominio (apenas desenvolvedor)
  @UseGuards(RolesGuard)
  @Roles('desenvolvedor')
  @SkipTenant()
  @Delete('link-condominium')
  async unlinkCondominium(
    @Body() dto: { profile_id: string; condominium_id: string },
  ): Promise<ApiResponse> {
    await this.authService.unlinkCondominiumFromAdm(dto.profile_id, dto.condominium_id);
    return ApiResponse.ok(null, 'Condomínio desvinculado com sucesso');
  }

  @Get('profiles')
  async listProfiles(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    const profiles = await this.authService.listProfiles(condoId);
    return ApiResponse.ok(profiles);
  }

  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  @Get('profiles/:id')
  async getProfileById(
    @Param('id') id: string,
    @CurrentTenant() condoId: string,
  ): Promise<ApiResponse> {
    const profile = await this.authService.getProfileById(condoId, id);
    return ApiResponse.ok(profile);
  }

  @SkipTenant()
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: Profile,
    @Body() dto: Record<string, unknown>,
  ): Promise<ApiResponse> {
    const updated = await this.authService.updateProfile(user.id, dto);
    return ApiResponse.ok(updated);
  }

  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  @Patch('profiles/:id')
  async updateProfileById(
    @Param('id') id: string,
    @CurrentTenant() condoId: string,
    @Body() dto: Record<string, unknown>,
  ): Promise<ApiResponse> {
    const updated = await this.authService.updateProfileById(condoId, id, dto);
    return ApiResponse.ok(updated);
  }

  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  @Delete('profiles/:id')
  async deleteProfile(
    @Param('id') id: string,
    @CurrentTenant() condoId: string,
  ): Promise<ApiResponse> {
    await this.authService.deleteProfile(condoId, id);
    return ApiResponse.ok(null, 'Morador removido');
  }

  @SkipTenant()
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: Profile,
    @Body() dto: { current_password: string; new_password: string },
  ): Promise<ApiResponse> {
    await this.authService.changePassword(user.id, dto.current_password, dto.new_password);
    return ApiResponse.ok(null, 'Senha alterada com sucesso');
  }

  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  @Post('residents')
  async createResident(
    @CurrentTenant() condoId: string,
    @Body() dto: { name: string; email: string; phone?: string; role: string; unit_id?: string },
  ): Promise<ApiResponse> {
    const result = await this.authService.createResident(condoId, dto);
    return ApiResponse.ok(result, 'Morador cadastrado com sucesso');
  }
}
