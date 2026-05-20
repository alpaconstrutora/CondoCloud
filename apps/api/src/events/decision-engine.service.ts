import { Injectable } from '@nestjs/common';
import type { SystemState } from '@condocloud/shared';

export type ActionType =
  | 'notification'
  | 'sequence_step'
  | 'referral'
  | 'proposal'
  | 'metric_action';

export type Priority =
  | 'financial_critical'
  | 'activation'
  | 'proposal'
  | 'engagement'
  | 'referral';

export interface DecisionInput {
  condo_id: string;
  profile_id?: string;
  condo_state: SystemState;
  activated: boolean;
  active_sequences: string[];
  notification_prefs?: { cooldown_until?: string; consecutive_ignored: number };
  action_type: ActionType;
  event_name: string;
}

export interface DecisionOutput {
  allow: boolean;
  priority: Priority;
  reason: string;
  override_cooldown: boolean;
  defer_minutes?: number;
}

@Injectable()
export class DecisionEngineService {
  // Função pura — sem side effects, testável unitariamente
  evaluate(input: DecisionInput): DecisionOutput {
    // BLOQUEIO ABSOLUTO — billing bloqueado para tudo exceto rotas de billing
    if (input.condo_state === 'billing_blocked') {
      return {
        allow: false,
        priority: 'financial_critical',
        reason: 'billing_blocked',
        override_cooldown: false,
      };
    }

    // FINANCEIRO CRÍTICO — sempre permitido, prioridade máxima
    if (input.action_type === 'notification' && input.event_name === 'charge_overdue') {
      return {
        allow: true,
        priority: 'financial_critical',
        reason: 'financial_critical',
        override_cooldown: true,
      };
    }

    // ATIVAÇÃO — segunda prioridade, passa mesmo com cooldown
    if (!input.activated && ['notification', 'sequence_step'].includes(input.action_type)) {
      return {
        allow: true,
        priority: 'activation',
        reason: 'activation_priority',
        override_cooldown: true,
      };
    }

    // PROPOSTA — terceira prioridade
    if (input.action_type === 'proposal') {
      if (!input.activated) {
        return {
          allow: false,
          priority: 'activation',
          reason: 'activation_not_completed',
          override_cooldown: false,
          defer_minutes: 60 * 48,
        };
      }
      return { allow: true, priority: 'proposal', reason: 'ok', override_cooldown: false };
    }

    // REFERRAL — bloqueado se proposta em andamento
    if (
      input.action_type === 'referral' &&
      input.active_sequences.includes('proposal_workflow')
    ) {
      return {
        allow: false,
        priority: 'proposal',
        reason: 'proposal_in_progress',
        override_cooldown: false,
      };
    }

    // ENGAJAMENTO — bloqueado por cooldown
    if (input.action_type === 'notification' && input.notification_prefs) {
      const cooldownUntil = input.notification_prefs.cooldown_until;
      if (cooldownUntil && new Date(cooldownUntil) > new Date()) {
        return {
          allow: false,
          priority: 'engagement',
          reason: 'notification_cooldown_active',
          override_cooldown: false,
        };
      }
    }

    // EXCEÇÃO: proposal_high_intent override cooldown (síndico precisa agir agora)
    if (input.event_name === 'proposal_high_intent_detected') {
      return {
        allow: true,
        priority: 'proposal',
        reason: 'high_intent_override',
        override_cooldown: true,
      };
    }

    return { allow: true, priority: 'engagement', reason: 'ok', override_cooldown: false };
  }
}
