import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { SupabaseService } from '../../infrastructure/supabase/supabase.service';
import type { Profile } from '@condocloud/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: Profile;
      condominiumId?: string;
    }
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly supabaseService: SupabaseService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.slice(7);

    try {
      const {
        data: { user },
        error,
      } = await this.supabaseService.getAnonClient().auth.getUser(token);

      if (error || !user) {
        next();
        return;
      }

      const admin = this.supabaseService.getAdminClient();
      let { data: profile } = await admin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      // Profile não existe: cria profile + condo placeholder
      if (!profile) {
        const { data: condo } = await admin
          .from('condominiums')
          .insert({ name: 'Meu Condomínio', activated: false, onboarding_completed: false })
          .select()
          .maybeSingle();

        const { data: created } = await admin
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            role: 'sindico',
            name: user.user_metadata?.name ?? user.email,
            condominium_id: condo?.id ?? null,
          })
          .select()
          .maybeSingle();
        profile = created;
      }

      if (!profile) {
        next();
        return;
      }

      const role = (profile as Profile).role;

      // ── Roles com acesso multi-condo ──────────────────────────
      if (role === 'desenvolvedor' || role === 'sindico_administradora') {
        const activeCondo = req.headers['x-active-condo-id'] as string | undefined;

        if (activeCondo) {
          if (role === 'desenvolvedor') {
            // Desenvolvedor: acesso total, aceita qualquer condo sem validação
            req.condominiumId = activeCondo;
          } else {
            // sindico_administradora: valida que o condo está vinculado ao perfil
            const { data: vinculo } = await admin
              .from('administradora_condominios')
              .select('condominium_id')
              .eq('profile_id', (profile as Profile).id)
              .eq('condominium_id', activeCondo)
              .maybeSingle();

            req.condominiumId = vinculo ? activeCondo : undefined;
          }
        } else {
          // Sem header: usa o condominium_id do próprio profile como fallback
          req.condominiumId = (profile as Profile).condominium_id ?? undefined;
        }

        req.user = profile as Profile;
        next();
        return;
      }

      // ── Roles mono-condo (sindico, morador, prestador) ────────
      const isInviteAccept = req.path.includes('/invites/') && req.path.endsWith('/accept');

      if (!(profile as Profile).condominium_id && !isInviteAccept) {
        const { data: condo } = await admin
          .from('condominiums')
          .insert({ name: 'Meu Condomínio', activated: false, onboarding_completed: false })
          .select()
          .maybeSingle();

        if (condo) {
          await admin
            .from('profiles')
            .update({ condominium_id: condo.id, role: 'sindico' })
            .eq('id', (profile as Profile).id);
          (profile as Record<string, unknown>)['condominium_id'] = condo.id;
        }
      }

      req.user = profile as Profile;
      req.condominiumId = (profile as Profile).condominium_id ?? undefined;
    } catch {
      // Falha silenciosa — guards rejeitarão rotas protegidas
    }

    next();
  }
}
