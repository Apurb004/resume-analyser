/**
 * @file server/middleware/rateLimit.ts
 * In-memory sliding-window rate limiting middleware.
 * Enforces per-IP request quotas, sets standard RateLimit headers,
 * and automatically purges expired IP records to prevent memory leaks.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errorHandler.ts';

interface RateLimitRecord {
  timestamps: number[];
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
  code?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

// In-memory store mapping limiterId -> ipKey -> timestamps
const rateLimitStores = new Map<string, Map<string, RateLimitRecord>>();

/**
 * Resets all rate limit stores (useful in unit testing).
 */
export function resetRateLimits(): void {
  rateLimitStores.clear();
}

/**
 * Creates an Express rate-limiting middleware instance.
 */
export function createRateLimiter(options: RateLimiterOptions, limiterId = 'default') {
  const {
    windowMs,
    max,
    message = 'Too many requests. Please slow down and try again shortly.',
    code = 'RATE_LIMIT_EXCEEDED',
    keyGenerator = (req: Request) =>
      req.ip ||
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'anonymous',
    skip,
  } = options;

  if (!rateLimitStores.has(limiterId)) {
    rateLimitStores.set(limiterId, new Map<string, RateLimitRecord>());
  }
  const store = rateLimitStores.get(limiterId)!;

  if (process.env.NODE_ENV !== 'test') {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of store.entries()) {
        record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
        if (record.timestamps.length === 0) {
          store.delete(key);
        }
      }
    }, 60_000);
    if (cleanupInterval.unref) {
      cleanupInterval.unref();
    }
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, bypass rate limiting unless explicit test header is provided
    if (process.env.NODE_ENV === 'test' && !req.headers?.['x-test-rate-limit']) {
      return next();
    }

    if (skip && skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();

    let record = store.get(key);
    if (!record) {
      record = { timestamps: [] };
      store.set(key, record);
    }

    // Retain only requests within the sliding window
    record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

    const remaining = Math.max(0, max - record.timestamps.length);
    const oldestTimestamp = record.timestamps[0] || now;
    const resetTimeSeconds = Math.ceil((oldestTimestamp + windowMs - now) / 1000);

    if (typeof res.setHeader === 'function') {
      res.setHeader('RateLimit-Limit', max);
      res.setHeader('RateLimit-Remaining', Math.max(0, remaining - 1));
      res.setHeader('RateLimit-Reset', resetTimeSeconds);
    }

    if (record.timestamps.length >= max) {
      if (typeof res.setHeader === 'function') {
        res.setHeader('Retry-After', resetTimeSeconds);
      }
      return next(
        new AppError(
          `${message} Rate limit exceeded: maximum ${max} requests per ${Math.round(windowMs / 1000)}s.`,
          429,
          code,
          {
            limit: max,
            windowSeconds: Math.round(windowMs / 1000),
            retryAfterSeconds: resetTimeSeconds,
          }
        )
      );
    }

    record.timestamps.push(now);
    next();
  };
}

/**
 * Standard API rate limiter: 120 requests per minute per IP.
 */
export const apiRateLimiter = createRateLimiter(
  {
    windowMs: 60_000,
    max: 120,
    message: 'Too many API requests from this client IP. Please wait before retrying.',
    code: 'API_RATE_LIMIT_EXCEEDED',
  },
  'api'
);

/**
 * Stricter rate limiter for resource-intensive operations (resume upload and parsing):
 * 20 requests per minute per IP.
 */
export const uploadRateLimiter = createRateLimiter(
  {
    windowMs: 60_000,
    max: 20,
    message: 'Upload frequency limit reached. Please wait before uploading another resume.',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
  },
  'upload'
);
