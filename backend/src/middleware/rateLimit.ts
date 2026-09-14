import { Request, Response, NextFunction } from 'express';

// Single-process limiter. Use a shared store before enabling cluster mode.
export function rateLimit(limit: number, windowMs: number, key = (req: Request) => req.ip || 'unknown') {
  const entries = new Map<string, { count: number; until: number }>();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of entries) if (entry.until <= now) entries.delete(id);
  }, windowMs);
  cleanup.unref();
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const id = key(req);
    let entry = entries.get(id);
    if (!entry || entry.until <= now) {
      if (entries.size >= 10000 && !entry) {
        res.status(429).json({ error: 'Попробуйте позже' });
        return;
      }
      entry = { count: 0, until: now + windowMs };
      entries.set(id, entry);
    }
    if (++entry.count > limit) {
      res.setHeader('Retry-After', Math.ceil((entry.until - now) / 1000));
      res.status(429).json({ error: 'Слишком много запросов. Попробуйте позже' });
      return;
    }
    next();
  };
}
