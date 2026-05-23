import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import {
  DOMAIN_EVENTS,
  QUEUE_NAMES,
  DomainEvent,
  DomainEventPayloads,
  DomainEventName,
  QueueName,
} from '@condocloud/shared';
import { SupabaseService } from '../infrastructure/supabase/supabase.service';

type EventInput<T extends keyof DomainEventPayloads> = Omit<DomainEvent<T>, 'event_id' | 'created_at'>;

// Roteamento: quais filas cada evento dispara (além de queue_metrics que recebe todos)
const QUEUE_ROUTING: Record<DomainEventName, QueueName[]> = {
  [DOMAIN_EVENTS.USER_REGISTERED]:             [QUEUE_NAMES.ACTIVATION_SEQUENCES],
  [DOMAIN_EVENTS.INVITE_SENT]:                 [QUEUE_NAMES.ACTIVATION_SEQUENCES, QUEUE_NAMES.NOTIFICATIONS],
  [DOMAIN_EVENTS.INVITE_ACCEPTED]:             [QUEUE_NAMES.ACTIVATION_SEQUENCES, QUEUE_NAMES.NOTIFICATIONS],
  [DOMAIN_EVENTS.ACTIVATION_PROGRESS_UPDATED]: [QUEUE_NAMES.ACTIVATION_SEQUENCES],
  [DOMAIN_EVENTS.TICKET_RESOLVED]:             [QUEUE_NAMES.NOTIFICATIONS],
  [DOMAIN_EVENTS.ROI_UPDATED]:                 [QUEUE_NAMES.NOTIFICATIONS, QUEUE_NAMES.PROPOSALS, QUEUE_NAMES.REFERRALS],
  [DOMAIN_EVENTS.PROPOSAL_CREATED]:            [],
  [DOMAIN_EVENTS.PROPOSAL_INTERACTION]:        [QUEUE_NAMES.NOTIFICATIONS, QUEUE_NAMES.PROPOSALS],
  [DOMAIN_EVENTS.PROPOSAL_STATUS_CHANGED]:     [QUEUE_NAMES.NOTIFICATIONS, QUEUE_NAMES.REFERRALS],
  [DOMAIN_EVENTS.NOTIFICATION_ENGAGEMENT_UPDATED]: [QUEUE_NAMES.NOTIFICATIONS],
  [DOMAIN_EVENTS.CHARGE_CREATED]:   [QUEUE_NAMES.NOTIFICATIONS],
  [DOMAIN_EVENTS.MESSAGE_PUBLISHED]: [QUEUE_NAMES.NOTIFICATIONS],
  [DOMAIN_EVENTS.TICKET_CREATED]:   [QUEUE_NAMES.NOTIFICATIONS],
};

@Injectable()
export class EventEmitterService {
  private readonly logger = new Logger(EventEmitterService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @InjectQueue(QUEUE_NAMES.ACTIVATION_SEQUENCES) private readonly activationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.PROPOSALS) private readonly proposalsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.REFERRALS) private readonly referralsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.METRICS) private readonly metricsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AUDIT) private readonly auditQueue: Queue,
  ) {}

  async emit<T extends keyof DomainEventPayloads>(input: EventInput<T>): Promise<DomainEvent<T>> {
    const event: DomainEvent<T> = {
      ...input,
      event_id: uuidv4(),
      created_at: new Date().toISOString(),
    };

    await this.persist(event);
    await this.route(event);

    return event;
  }

  private async persist(event: DomainEvent): Promise<void> {
    const { error } = await this.supabaseService.getAdminClient().from('events').insert({
      event_id: event.event_id,
      event_name: event.event_name,
      aggregate_id: event.aggregate_id,
      aggregate_type: event.aggregate_type,
      event_version: event.event_version,
      source: event.source,
      payload: event.payload,
      condo_id: event.condo_id,
      created_at: event.created_at,
    });

    if (error) {
      this.logger.error(`Falha ao persistir evento ${event.event_name}: ${error.message}`);
      throw error;
    }
  }

  private async route(event: DomainEvent): Promise<void> {
    const queueMap: Record<QueueName, Queue> = {
      [QUEUE_NAMES.ACTIVATION_SEQUENCES]: this.activationQueue,
      [QUEUE_NAMES.NOTIFICATIONS]:        this.notificationsQueue,
      [QUEUE_NAMES.PROPOSALS]:            this.proposalsQueue,
      [QUEUE_NAMES.REFERRALS]:            this.referralsQueue,
      [QUEUE_NAMES.METRICS]:              this.metricsQueue,
      [QUEUE_NAMES.AUDIT]:               this.auditQueue,
    };

    // Todos os eventos vão para métricas
    await this.metricsQueue.add('domain_event', event);

    const targets = QUEUE_ROUTING[event.event_name as DomainEventName] ?? [];
    await Promise.all(
      targets.map((queueName) => queueMap[queueName].add('domain_event', event)),
    );
  }
}
