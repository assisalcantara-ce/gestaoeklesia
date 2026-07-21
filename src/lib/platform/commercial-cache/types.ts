import { ComercialViewModel } from '../commercial/types';

export interface CacheStats {
  cacheHits: number;
  cacheMisses: number;
  queriesExecutadas: number;
  buildersExecutados: number;
}

export interface CacheStore {
  list: ComercialViewModel[] | null;
  timestamp: number | null;
  stats: CacheStats;
}
