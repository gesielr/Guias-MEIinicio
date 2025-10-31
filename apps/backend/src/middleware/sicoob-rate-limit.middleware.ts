import { Request, Response, NextFunction } from 'express';
import { sicoobLogger } from '../utils/sicoob-logger';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitState {
  hits: number;
  expiresAt: number;
}

export function createSicoobRateLimitMiddleware(
  options: RateLimitOptions
) {
  const store = new Map<string, RateLimitState>();
  const windowMs = options.windowMs;
  const max = options.max;
  const keyGenerator =
    options.keyGenerator || ((req: Request) => req.ip ?? 'unknown');

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();
    const existing = store.get(key);

    if (!existing || existing.expiresAt <= now) {
      store.set(key, {
        hits: 1,
        expiresAt: now + windowMs,
      });
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', (max - 1).toString());
      return next();
    }

    if (existing.hits >= max) {
      const retryAfter = Math.ceil((existing.expiresAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-RateLimit-Limit', max.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      sicoobLogger.warn('Rate limit atingido', {
        key,
        retryAfter,
        path: req.path,
      });
      res.status(429).json({ error: 'Too many requests' });
      return;
    }

    existing.hits += 1;
    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', (max - existing.hits).toString());
    next();
  };
}
