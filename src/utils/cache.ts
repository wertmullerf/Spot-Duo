/**
 * Sistema de cache simple para queries
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live en milisegundos
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutos por defecto

  /**
   * Obtiene un valor del cache si existe y no ha expirado
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Expiró, eliminar del cache
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Guarda un valor en el cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * Elimina una entrada del cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Limpia todo el cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Invalida entradas que coincidan con un patrón
   * El patrón puede ser una string simple (coincidencia parcial) o regex
   */
  invalidatePattern(pattern: string): void {
    // Si el patrón no tiene caracteres especiales de regex, buscar como substring
    const isSimplePattern = !pattern.includes('^') && !pattern.includes('$') && !pattern.includes('.*');
    const regex = isSimplePattern 
      ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // Escapar caracteres especiales
      : new RegExp(pattern);
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Invalida una entrada específica del cache
   */
  invalidateCache(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Obtiene o ejecuta una función y cachea el resultado
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }
}

export const cache = new SimpleCache();

// Keys para diferentes tipos de datos
export const cacheKeys = {
  place: (id: string) => `place:${id}`,
  placeReviews: (id: string, groupId?: string) => 
    `place:${id}:reviews:${groupId || 'all'}`,
  userReviews: (userId: string, groupId?: string) =>
    `user:${userId}:reviews:${groupId || 'all'}`,
  userGroups: (userId: string) => `user:${userId}:groups`,
  groupMembers: (groupId: string) => `group:${groupId}:members`,
  placesWithReviews: (groupId?: string) => `places:reviews:${groupId || 'all'}`,
};

