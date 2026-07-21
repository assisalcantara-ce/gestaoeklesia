import { CacheStore, CacheStats } from './types';
import { ComercialViewModel } from '../commercial/types';

export class CommercialCache {
  private static instance: CommercialCache | null = null;
  
  // TTL curto de 2 segundos para manter em memória apenas no ciclo de vida da mesma requisição
  private readonly TTL_MS = 2000;

  private store: CacheStore = {
    list: null,
    timestamp: null,
    stats: {
      cacheHits: 0,
      cacheMisses: 0,
      queriesExecutadas: 0,
      buildersExecutados: 0
    }
  };

  private constructor() {}

  static getInstance(): CommercialCache {
    if (!this.instance) {
      this.instance = new CommercialCache();
    }
    return this.instance;
  }

  /**
   * Obtém a lista em cache se ela for válida (dentro do TTL).
   */
  get(): ComercialViewModel[] | null {
    const now = Date.now();
    if (this.store.list && this.store.timestamp && (now - this.store.timestamp < this.TTL_MS)) {
      this.store.stats.cacheHits++;
      return this.store.list;
    }
    this.store.stats.cacheMisses++;
    return null;
  }

  /**
   * Grava a lista no cache.
   */
  set(list: ComercialViewModel[]): void {
    this.store.list = list;
    this.store.timestamp = Date.now();
  }

  /**
   * Limpa o cache.
   */
  clear(): void {
    this.store.list = null;
    this.store.timestamp = null;
  }

  /**
   * Registra a execução de queries.
   */
  recordQuery(): void {
    this.store.stats.queriesExecutadas++;
  }

  /**
   * Registra a execução do builder.
   */
  recordBuilder(): void {
    this.store.stats.buildersExecutados++;
  }

  /**
   * Retorna as métricas de diagnóstico do cache.
   */
  getStats(): CacheStats {
    return { ...this.store.stats };
  }

  /**
   * Reseta as métricas do cache.
   */
  resetStats(): void {
    this.store.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      queriesExecutadas: 0,
      buildersExecutados: 0
    };
  }
}
