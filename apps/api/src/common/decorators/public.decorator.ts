import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Rotas que requerem auth mas NÃO requerem condominium_id
// Ex: aceitar convite (morador novo ainda sem tenant)
export const SKIP_TENANT_KEY = 'skipTenant';
export const SkipTenant = () => SetMetadata(SKIP_TENANT_KEY, true);
