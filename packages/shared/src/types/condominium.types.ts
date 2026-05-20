import type { PlanName, SubscriptionStatus, UserRole } from '../constants/enums';

export interface Plan {
  id: string;
  name: PlanName;
  max_units: number;
  max_ai_calls: number;
  price_monthly: number;
  stripe_price_id?: string;
  created_at: string;
}

export interface Condominium {
  id: string;
  name: string;
  address?: string;
  cnpj?: string;
  plan_id?: string;
  plan?: Plan;
  // Billing
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_status: SubscriptionStatus;
  trial_ends_at?: string;
  past_due_since?: string;
  // Estado derivado
  current_version: number;
  activated: boolean;
  onboarding_completed: boolean;
  onboarding_step: number;
  active: boolean;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface Block {
  id: string;
  name: string;
  condominium_id: string;
  created_at: string;
}

export interface Unit {
  id: string;
  number: string;
  block_id?: string;
  block?: Block;
  condominium_id: string;
  fraction: number;
  created_at: string;
}

export interface Profile {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  condominium_id?: string;
  unit_id?: string;
  unit?: Unit;
  push_token?: string;
  whatsapp?: string;
  active: boolean;
  is_active: boolean;
  last_active_at?: string;
  created_at: string;
}

export interface AdministradoraCondominio {
  id: string;
  profile_id: string;
  condominium_id: string;
  condominium?: Condominium;
  created_at: string;
}

export interface Invite {
  id: string;
  token: string;
  email?: string;
  unit_id?: string;
  role: 'morador' | 'prestador';
  condominium_id: string;
  created_by?: string;
  channel?: 'whatsapp' | 'email' | 'qr' | 'csv';
  expires_at: string;
  used_at?: string;
  used_by?: string;
  created_at: string;
}
