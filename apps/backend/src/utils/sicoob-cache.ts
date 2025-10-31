/**
 * Sicoob Cache Service
 * Token caching with automatic renewal
 */

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class SicoobCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private ttl: number; // milliseconds

  constructor(ttlSeconds: number = 3600) {
    this.ttl = ttlSeconds * 1000;
  }

  set(key: string, value: T, ttlSeconds?: number): void {
    const expiresAt =
      Date.now() + (ttlSeconds ? ttlSeconds * 1000 : this.ttl);
    this.cache.set(key, { value, expiresAt });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getTimeToExpire(key: string): number | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const timeToExpire = entry.expiresAt - Date.now();
    if (timeToExpire <= 0) {
      this.cache.delete(key);
      return null;
    }

    return timeToExpire;
  }

  shouldRefresh(key: string, refreshBeforeSeconds: number = 300): boolean {
    const timeToExpire = this.getTimeToExpire(key);
    if (timeToExpire === null) return true;
    return timeToExpire < refreshBeforeSeconds * 1000;
  }
}

/**
 * Token Cache - Specific implementation for access tokens
 */
export class TokenCache {
  private cache: SicoobCache<string>;
  private readonly REFRESH_BEFORE_SECONDS = 300; // Refresh 5 minutes before expiry

  constructor() {
    this.cache = new SicoobCache<string>(3600); // Default 1 hour TTL
  }

  setToken(token: string, expiresInSeconds: number): void {
    this.cache.set('access_token', token, expiresInSeconds);
  }

  getToken(): string | null {
    return this.cache.get('access_token');
  }

  hasValidToken(): boolean {
    return this.cache.has('access_token');
  }

  shouldRefreshToken(): boolean {
    return this.cache.shouldRefresh(
      'access_token',
      this.REFRESH_BEFORE_SECONDS
    );
  }

  clearToken(): void {
    this.cache.delete('access_token');
  }

  getTimeToExpire(): number | null {
    return this.cache.getTimeToExpire('access_token');
  }
}
