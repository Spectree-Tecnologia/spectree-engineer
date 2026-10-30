// The only door between modules (architecture rule 13): module A publishes after its transaction
// commits, module B subscribes by name in its own backend wiring. The core never imports a subscriber.
export interface DomainEvent<Payload = unknown> {
  readonly name: string;
  readonly aggregateId: string;
  readonly occurredAt: Date;
  readonly payload: Payload;
}

export type EventSubscriber<Payload = unknown> = (event: DomainEvent<Payload>) => Promise<void> | void;

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

export interface EventSubscriptions {
  subscribe<Payload>(name: string, subscriber: EventSubscriber<Payload>): () => void;
}

// ponytail: in-process and sequential; a queue (BullMQ, SQS) is the ADR when a subscriber must outlive the request
export class InMemoryEventBus implements EventPublisher, EventSubscriptions {
  private readonly subscribers = new Map<string, Set<EventSubscriber<any>>>();

  subscribe<Payload>(name: string, subscriber: EventSubscriber<Payload>): () => void {
    const set = this.subscribers.get(name) ?? new Set();
    set.add(subscriber);
    this.subscribers.set(name, set);
    return () => set.delete(subscriber);
  }

  async publish(event: DomainEvent): Promise<void> {
    for (const subscriber of this.subscribers.get(event.name) ?? []) {
      await subscriber(event);
    }
  }
}
