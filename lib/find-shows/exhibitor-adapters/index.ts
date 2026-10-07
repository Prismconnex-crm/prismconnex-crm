/**
 * The exhibitor-directory adapters, most specific first. A platform with a
 * machine-readable edition wins over the generic organizer-directory reader
 * when both find a list; a new platform is added here as one more adapter.
 */
import { brandCardCatalogueAdapter } from './brand-card-catalogue';
import { dmgMarketingManualAdapter } from './dmg-marketing-manual';
import { dmgPortalAdapter } from './dmg-portal';
import { easyfairsAdapter } from './easyfairs';
import { mapYourShowAdapter, rxAdapter, swapcardAdapter } from './established';
import { eyeLedAdapter } from './eyeled';
import { hktdcAdapter } from './hktdc';
import { ifemaAdapter } from './ifema';
import { informaAdapter } from './informa';
import { itecaAdapter } from './iteca';
import { jlPortalAdapter } from './jl-portal';
import { messeDuesseldorfAdapter } from './messe-duesseldorf';
import { mtpAdapter } from './mtp';
import { organizerDirectoryAdapter } from './organizer-directory';
import { smallWorldLabsAdapter } from './smallworldlabs';
import type { ExhibitorAdapter } from './types';

export const EXHIBITOR_ADAPTERS: ExhibitorAdapter[] = [
  mapYourShowAdapter,
  rxAdapter,
  messeDuesseldorfAdapter,
  jlPortalAdapter,
  dmgPortalAdapter,
  dmgMarketingManualAdapter,
  eyeLedAdapter,
  smallWorldLabsAdapter,
  informaAdapter,
  brandCardCatalogueAdapter,
  easyfairsAdapter,
  itecaAdapter,
  ifemaAdapter,
  mtpAdapter,
  hktdcAdapter,
  swapcardAdapter,
  organizerDirectoryAdapter,
];

/** Lower is preferred when several adapters verify a list for the same edition. */
export const adapterRank = (id: ExhibitorAdapter['id']) => {
  const index = EXHIBITOR_ADAPTERS.findIndex((adapter) => adapter.id === id);
  return index < 0 ? EXHIBITOR_ADAPTERS.length : index;
};

export * from './types';
export { httpPoster, retryingPoster, type Poster } from './http';
