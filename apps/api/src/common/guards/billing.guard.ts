import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { resolveSystemState } from '../state-resolver';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import type { Condominium } from '@condocloud/shared';

@Injectable()
export class BillingGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ condominiumId?: string }>();
    if (!request.condominiumId) return true; // TenantGuard já cobre esse caso

    const { data: condo } = await this.supabaseService
      .getAdminClient()
      .from('condominiums')
      .select('subscription_status, past_due_since, onboarding_completed')
      .eq('id', request.condominiumId)
      .single();

    if (!condo) return true;

    const state = resolveSystemState(condo as Condominium);

    if (state === 'billing_blocked') {
      throw new HttpException(
        'Acesso bloqueado: pagamento pendente há mais de 30 dias. Regularize sua assinatura.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    if (state === 'billing_warning') {
      // Permite o acesso mas adiciona header de aviso
      const response = context.switchToHttp().getResponse<{ setHeader: (k: string, v: string) => void }>();
      response.setHeader('X-Billing-Warning', 'past_due');
    }

    return true;
  }
}
