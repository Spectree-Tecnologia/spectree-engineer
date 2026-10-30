import { describe, expect, it } from 'vitest';
import { InMemoryEventBus, type DomainEvent } from '../../src/events/index.js';

const event = (name: string): DomainEvent<{ amount: number }> => ({ name, aggregateId: 'a-1', occurredAt: new Date(), payload: { amount: 10 } });

describe('InMemoryEventBus', () => {
  it('delivers to every subscriber of that name, in order, and to nobody else', async () => {
    const bus = new InMemoryEventBus();
    const seen: string[] = [];
    bus.subscribe('account.created', () => void seen.push('first'));
    bus.subscribe('account.created', async () => void seen.push('second'));
    bus.subscribe('account.closed', () => void seen.push('never'));

    await bus.publish(event('account.created'));

    expect(seen).toEqual(['first', 'second']);
  });

  it('unsubscribes with the returned function', async () => {
    const bus = new InMemoryEventBus();
    let calls = 0;
    const off = bus.subscribe('account.created', () => void calls++);
    await bus.publish(event('account.created'));
    off();
    await bus.publish(event('account.created'));

    expect(calls).toBe(1);
  });
});
