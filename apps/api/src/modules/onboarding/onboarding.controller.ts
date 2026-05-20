import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { Step1Dto, Step2Dto, Step4Dto } from './dto/onboarding.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SkipTenant } from '../../common/decorators/public.decorator';
import { ApiResponse } from '../../common/dto/api-response.dto';
import type { Profile } from '@condocloud/shared';

@Controller('onboarding')
@UseGuards(RolesGuard)
@Roles('sindico', 'sindico_administradora', 'desenvolvedor')
@SkipTenant()
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  async status(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    const result = await this.onboardingService.getStatus(condoId);
    return ApiResponse.ok(result);
  }

  @Patch('step/1')
  async step1(@CurrentTenant() condoId: string, @Body() dto: Step1Dto): Promise<ApiResponse> {
    await this.onboardingService.completeStep1(condoId, dto);
    return ApiResponse.ok(null, 'Dados do condomínio salvos');
  }

  @Post('step/2')
  async step2(@CurrentTenant() condoId: string, @Body() dto: Step2Dto): Promise<ApiResponse> {
    const result = await this.onboardingService.completeStep2(condoId, dto);
    return ApiResponse.ok(result, `${result.units_created} unidades criadas`);
  }

  @Post('step/3/invite')
  async step3Invite(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
  ): Promise<ApiResponse> {
    const result = await this.onboardingService.generateInviteLink(condoId, user.id);
    return ApiResponse.ok(result);
  }

  @Patch('step/4')
  async step4(@CurrentTenant() condoId: string, @Body() dto: Step4Dto): Promise<ApiResponse> {
    await this.onboardingService.completeStep4(condoId, dto);
    return ApiResponse.ok(null, 'Configurações salvas');
  }

  @Post('step/5/complete')
  async step5(
    @CurrentTenant() condoId: string,
    @CurrentUser() user: Profile,
  ): Promise<ApiResponse> {
    await this.onboardingService.completeStep5(condoId, user.id);
    return ApiResponse.ok(null, 'Onboarding concluído! Seu condomínio está funcionando.');
  }
}
