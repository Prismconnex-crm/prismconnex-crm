/** The three datasets the assistant can answer from. */
export type AssistantEntity = 'companies' | 'events' | 'people';

export const ASSISTANT_ENTITIES: readonly AssistantEntity[] = [
  'companies',
  'events',
  'people',
] as const;

/** A classifier signal word. `weight` defaults to 1. */
export type Signal = { word: string; weight?: number };

/** Display form of one applied filter, for the panel's chip row. */
export type FilterChip = { key: string; label: string; value: string };

export type RouteAction = 'answer_inline' | 'navigate' | 'confirm';

export type DegradedReason = 'missing_api_key' | 'model_error' | 'no_tool_call';

/** The routing verdict, emitted as the first stream event. */
export type RouteDecision = {
  targetEntity: AssistantEntity;
  action: RouteAction;
  confidence: number;
  handoffMessage: string;
  interpretedFilters: unknown;
  droppedFilters: string[];
  /** Always null in Spec 1. Reserved for cross-entity queries. */
  crossReference: null;
  degraded?: DegradedReason;
};

/** The NDJSON wire format. `route` is always first. */
export type AssistantEvent =
  | ({ type: 'route' } & RouteDecision)
  | { type: 'filters'; chips: FilterChip[] }
  | { type: 'results'; rows: unknown[]; total: number | null }
  /** Operator diagnostics (e.g. a rejected API key). Admin-only, server-gated. */
  | { type: 'notice'; text: string }
  | { type: 'token'; text: string }
  | { type: 'suggestions'; items: string[] }
  | { type: 'done' }
  | { type: 'error'; code: string; message: string };

/** `total` is null when counting is too expensive — companies always is. */
export type SearchResult = { rows: unknown[]; total: number | null };

/**
 * One entity's whole world: its filter type, parser, search and prose.
 *
 * An adapter knows nothing about the other two entities. That is what makes a
 * wrong-entity answer unrepresentable rather than merely discouraged — the
 * events adapter physically cannot return a Person.
 */
export type EntityAdapter<F> = {
  entity: AssistantEntity;
  /** Feeds both the deterministic classifier and the system prompt. */
  signals: readonly Signal[];
  /** JSON Schema used as the Claude tool `input_schema` for this entity. */
  filterSchema: Record<string, unknown>;
  emptyFilters(): F;
  parseLocally(message: string, base: F): F;
  /** Translate another entity's filters onto this one. Unmappable keys are dropped, never guessed. */
  carryOver(foreign: Record<string, unknown>): { filters: Partial<F>; dropped: string[] };
  search(filters: F, page: number): Promise<SearchResult>;
  chips(filters: F): FilterChip[];
  describe(filters: F, total: number | null): string;
  suggest(filters: F, total: number | null): string[];
};
