// ============================================================
// Enums globais compartilhados entre API, web e mobile
// ============================================================

// ── Roles ────────────────────────────────────────────────────
export type UserRole =
  | 'desenvolvedor'          // acesso total à plataforma
  | 'sindico_administradora' // gerencia múltiplos condos vinculados
  | 'sindico'                // gerencia um único condomínio
  | 'morador'                // residente com acesso restrito
  | 'prestador';             // prestador de serviço

export const USER_ROLES: Record<UserRole, UserRole> = {
  desenvolvedor: 'desenvolvedor',
  sindico_administradora: 'sindico_administradora',
  sindico: 'sindico',
  morador: 'morador',
  prestador: 'prestador',
};

// Roles com poder administrativo (gerenciam condomínios)
export const ADMIN_ROLES: UserRole[] = ['desenvolvedor', 'sindico_administradora', 'sindico'];

// Roles com acesso multi-condo
export const MULTI_CONDO_ROLES: UserRole[] = ['desenvolvedor', 'sindico_administradora'];

// ── Subscription ─────────────────────────────────────────────
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'paused';

export type PlanName = 'starter' | 'pro' | 'enterprise';

export const PLAN_LIMITS: Record<PlanName, { max_units: number; max_ai_calls: number }> = {
  starter: { max_units: 50, max_ai_calls: 100 },
  pro: { max_units: 200, max_ai_calls: 500 },
  enterprise: { max_units: 9999, max_ai_calls: 9999 },
};

// ── Tickets ──────────────────────────────────────────────────
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory =
  | 'manutencao'
  | 'seguranca'
  | 'limpeza'
  | 'barulho'
  | 'area_comum'
  | 'outro';

// SLA padrão por prioridade (em horas)
export const TICKET_SLA_HOURS: Record<TicketPriority, number> = {
  low: 120,     // 5 dias
  medium: 72,   // 3 dias
  high: 24,     // 1 dia
  urgent: 4,    // 4 horas
};

// ── Mensagens ────────────────────────────────────────────────
export type MessageAudience = 'all' | 'block' | 'unit';

// ── Financeiro ───────────────────────────────────────────────
export type FinancialType = 'income' | 'expense';
export type ChargeStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

// ── Assembleias ──────────────────────────────────────────────
export type AssemblyStatus = 'scheduled' | 'open' | 'closed' | 'cancelled';
export type VoteOption = 'yes' | 'no' | 'abstain';

// ── Reservas ─────────────────────────────────────────────────
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'rejected';

// ── Documentos ───────────────────────────────────────────────
export type DocumentCategory =
  | 'regulamento'
  | 'ata'
  | 'contrato'
  | 'planta'
  | 'financeiro'
  | 'outro';
export type DocumentVisibility = 'all' | 'sindico' | 'desenvolvedor';

// ── Convites ─────────────────────────────────────────────────
export type InviteChannel = 'whatsapp' | 'email' | 'qr' | 'csv';
export type InviteRole = 'morador' | 'prestador';

// ── Notificações ─────────────────────────────────────────────
export type NotificationType =
  | 'ticket'
  | 'message'
  | 'financial'
  | 'assembly'
  | 'reservation'
  | 'system'
  | 'activation'
  | 'digest';
export type NotificationChannel = 'push' | 'email' | 'whatsapp';

// ── Sistema / Billing ────────────────────────────────────────
export type SystemState = 'billing_blocked' | 'billing_warning' | 'onboarding' | 'active';

// Onboarding steps
export const ONBOARDING_STEPS = {
  CONDOMINIUM_DATA: 1,
  PHYSICAL_STRUCTURE: 2,
  INVITE_RESIDENTS: 3,
  SETTINGS: 4,
  DASHBOARD: 5,
} as const;
