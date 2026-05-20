import type { SubscriptionStatus, PlanName } from '../constants/enums';

export interface BillingStatus {
  subscription_status: SubscriptionStatus;
  plan_name: PlanName;
  trial_ends_at?: string;
  past_due_since?: string;
  days_until_blocked?: number;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  portal_url?: string;
}

export interface CheckoutSessionDto {
  plan_name: PlanName;
  success_url: string;
  cancel_url: string;
}

export interface CheckoutSessionResponse {
  url: string;
  session_id: string;
}

// Feature gating por plano
export interface PlanFeatures {
  max_units: number;
  max_ai_calls: number;
  unlimited_tickets: boolean;
  unlimited_messages: boolean;
  unlimited_votes: boolean;
  common_areas_limit: number; // -1 = ilimitado
  monthly_report: boolean;
  multi_condo: boolean; // apenas enterprise
}

export const PLAN_FEATURES: Record<PlanName, PlanFeatures> = {
  starter: {
    max_units: 50,
    max_ai_calls: 100,
    unlimited_tickets: true,
    unlimited_messages: true,
    unlimited_votes: true,
    common_areas_limit: 3,
    monthly_report: false,
    multi_condo: false,
  },
  pro: {
    max_units: 200,
    max_ai_calls: 500,
    unlimited_tickets: true,
    unlimited_messages: true,
    unlimited_votes: true,
    common_areas_limit: -1,
    monthly_report: true,
    multi_condo: false,
  },
  enterprise: {
    max_units: 9999,
    max_ai_calls: 9999,
    unlimited_tickets: true,
    unlimited_messages: true,
    unlimited_votes: true,
    common_areas_limit: -1,
    monthly_report: true,
    multi_condo: true,
  },
};

// REGRA: Assembleia NUNCA bloqueada em nenhum plano
export const NEVER_BLOCKED_FEATURES = ['assembly', 'vote'] as const;
