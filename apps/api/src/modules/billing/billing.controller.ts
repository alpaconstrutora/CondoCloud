import { Body, Controller, Get, Headers, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/billing.dto';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public, SkipTenant } from '../../common/decorators/public.decorator';
import { ApiResponse } from '../../common/dto/api-response.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @SkipTenant()
  @Get('plans')
  async plans(): Promise<ApiResponse> {
    const result = await this.billingService.listPlans();
    return ApiResponse.ok(result);
  }

  @Get('status')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async status(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    const result = await this.billingService.getStatus(condoId);
    return ApiResponse.ok(result);
  }

  @Post('checkout')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async checkout(
    @CurrentTenant() condoId: string,
    @Body() dto: CreateCheckoutDto,
  ): Promise<ApiResponse> {
    const result = await this.billingService.createCheckoutSession(condoId, dto);
    return ApiResponse.ok(result);
  }

  @Get('portal')
  @UseGuards(RolesGuard)
  @Roles('sindico', 'sindico_administradora', 'desenvolvedor')
  async portal(@CurrentTenant() condoId: string): Promise<ApiResponse> {
    const result = await this.billingService.createPortalSession(condoId);
    return ApiResponse.ok(result);
  }

  // Webhook Stripe — não autenticado, verificado pela assinatura HMAC
  @Public()
  @Post('webhook/stripe')
  async stripeWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    const rawBody = req.rawBody;
    if (!rawBody) return { received: false };
    await this.billingService.handleStripeWebhook(rawBody, signature);
    return { received: true };
  }

  // Webhook Asaas (gateway brasileiro) — não autenticado
  @Public()
  @Post('webhook/asaas')
  async asaasWebhook(
    @Body() payload: Record<string, unknown>,
  ): Promise<{ received: boolean }> {
    await this.billingService.handleAsaasWebhook(payload);
    return { received: true };
  }
}
