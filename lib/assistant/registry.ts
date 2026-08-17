import { companiesAdapter } from './adapters/companies';
import { eventsAdapter } from './adapters/events';
import { peopleAdapter } from './adapters/people';
import type { AssistantEntity, EntityAdapter } from './types';

type AnyAdapter = EntityAdapter<never>;

const defaults: Record<AssistantEntity, AnyAdapter> = {
  companies: companiesAdapter as unknown as AnyAdapter,
  events: eventsAdapter as unknown as AnyAdapter,
  people: peopleAdapter as unknown as AnyAdapter,
};

const registry: Record<AssistantEntity, AnyAdapter> = { ...defaults };

export function adapterFor(entity: AssistantEntity): AnyAdapter {
  return registry[entity];
}

/** Test seam — lets a suite swap in a fake adapter without a database. */
export function setAdapterForTests(entity: AssistantEntity, adapter: AnyAdapter): void {
  registry[entity] = adapter;
}

export function resetAdapters(): void {
  for (const entity of Object.keys(defaults) as AssistantEntity[]) {
    registry[entity] = defaults[entity];
  }
}
