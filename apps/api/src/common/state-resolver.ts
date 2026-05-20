import { differenceInDays } from 'date-fns';
import type { Condominium, SystemState } from '@condocloud/shared';

// Fonte única de verdade para o estado operacional do condomínio.
// SEMPRE usar esta função — nunca avaliar subscription_status inline.
export function resolveSystemState(condo: Pick<Condominium,
  'subscription_status' | 'past_due_since' | 'onboarding_completed'
>): SystemState {
  const { subscription_status, past_due_since, onboarding_completed } = condo;

  if (subscription_status === 'canceled' || subscription_status === 'paused') {
    return 'billing_blocked';
  }

  if (subscription_status === 'past_due' && past_due_since) {
    const daysPastDue = differenceInDays(new Date(), new Date(past_due_since));
    if (daysPastDue >= 30) return 'billing_blocked';
    return 'billing_warning';
  }

  if (!onboarding_completed) return 'onboarding';

  return 'active';
}
