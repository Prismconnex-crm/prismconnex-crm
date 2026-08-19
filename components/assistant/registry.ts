import { peopleBinding } from './bindings/people';
import { eventsBinding } from './bindings/events';
import type { AssistantEntity } from '@/lib/assistant/types';
import type { PageBinding } from './types';

type AnyBinding = PageBinding<never, never>;

const defaults: Partial<Record<AssistantEntity, AnyBinding>> = {
  people: peopleBinding as unknown as AnyBinding,
  events: eventsBinding as unknown as AnyBinding,
  // companies lands in Spec 2c.
};

const registry: Partial<Record<AssistantEntity, AnyBinding>> = { ...defaults };

export function bindingFor(entity: AssistantEntity): AnyBinding {
  const binding = registry[entity];
  if (!binding) {
    throw new Error(`no binding registered for "${entity}" (added in Spec 2b)`);
  }
  return binding;
}

/** Lets callers skip an entity whose binding has not shipped yet. */
export function hasBinding(entity: AssistantEntity): boolean {
  return Boolean(registry[entity]);
}

/** Test seam. */
export function setBindingForTests(entity: AssistantEntity, binding: AnyBinding): void {
  registry[entity] = binding;
}

export function resetBindings(): void {
  for (const key of Object.keys(registry) as AssistantEntity[]) {
    delete registry[key];
  }
  Object.assign(registry, defaults);
}
