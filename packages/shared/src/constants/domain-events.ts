// ============================================================
// Os 10 Eventos de Domínio obrigatórios do sistema
// Regra: nunca adicionar evento sem critério operacional
// ============================================================

export const DOMAIN_EVENTS = {
  // ── AQUISIÇÃO / ATIVAÇÃO ──────────────────────────────────
  USER_REGISTERED: 'user_registered',
  INVITE_SENT: 'invite_sent',
  INVITE_ACCEPTED: 'invite_accepted',
  ACTIVATION_PROGRESS_UPDATED: 'activation_progress_updated',

  // ── VALOR ─────────────────────────────────────────────────
  TICKET_RESOLVED: 'ticket_resolved',
  ROI_UPDATED: 'roi_updated',

  // ── CONVERSÃO ─────────────────────────────────────────────
  PROPOSAL_CREATED: 'proposal_created',
  PROPOSAL_INTERACTION: 'proposal_interaction',
  PROPOSAL_STATUS_CHANGED: 'proposal_status_changed',

  // ── RETENÇÃO / CONTROLE ───────────────────────────────────
  NOTIFICATION_ENGAGEMENT_UPDATED: 'notification_engagement_updated',
} as const;

export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

// Payloads tipados por evento
export interface DomainEventPayloads {
  user_registered: { role: 'sindico' | 'morador' | 'prestador'; condominium_id: string };
  invite_sent: { channel: 'whatsapp' | 'email' | 'qr' | 'csv'; invite_id: string };
  invite_accepted: {
    channel: 'whatsapp' | 'email' | 'qr' | 'csv';
    hours_to_accept: number;
    condominium_id: string;
  };
  activation_progress_updated: { invites_sent: number; residents_active: number };
  ticket_resolved: { resolution_time_hours: number; category: string };
  roi_updated: { messages_avoided: number; tickets_resolved: number; ttv_days?: number };
  proposal_created: { condominium_id: string; plan_id: string };
  proposal_interaction: {
    profile_id: string;
    action: 'viewed' | 'voted';
    time_on_page_seconds?: number;
  };
  proposal_status_changed: { status: 'approved' | 'rejected' };
  notification_engagement_updated: { action: 'opened' | 'clicked' | 'ignored' };
}

// Schema completo de evento (obrigatório em TODO emit)
export interface DomainEvent<T extends keyof DomainEventPayloads = keyof DomainEventPayloads> {
  event_id: string; // UUID — garante idempotência
  event_name: T;
  aggregate_id: string; // UUID da entidade que muda estado
  aggregate_type:
    | 'profile'
    | 'condominium'
    | 'invite'
    | 'proposal'
    | 'ticket'
    | 'reservation'
    | 'assembly'
    | 'notification';
  event_version: number; // incremental por aggregate — detecta fora de ordem
  source: 'api' | 'worker' | 'job' | 'system';
  condo_id: string; // tenant isolation obrigatório
  payload: DomainEventPayloads[T];
  created_at: string; // ISO 8601
}

// Filas Bull separadas por domínio (NUNCA fila única)
export const QUEUE_NAMES = {
  ACTIVATION_SEQUENCES: 'queue_activation_sequences',
  NOTIFICATIONS: 'queue_notifications',
  PROPOSALS: 'queue_proposals',
  REFERRALS: 'queue_referrals',
  METRICS: 'queue_metrics',
  AUDIT: 'queue_audit',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
