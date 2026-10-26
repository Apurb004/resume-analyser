/**
 * @file server/middleware/securityHeaders.ts
 * Restrictive security headers and CORS middleware for AI Studio full-stack deployment.
 * Enforces Content Security Policy with frame-ancestors support for AI Studio preview,
 * MIME sniffing protection, XSS defenses, and restrictive origin controls.
 */

import { Request, Response, NextFunction } from 'express';
import { serverConfig } from '../config/env.ts';

/**
 * Validates whether an incoming request Origin is allowed.
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Same-origin or non-browser request

  try {
    const parsed = new URL(origin);
    const host = parsed.hostname;

    // Allow localhost and local loopbacks
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      return true;
    }

    // Allow Google Cloud Run domains and Google AI Studio domains
    if (
      host.endsWith('.run.app') ||
      host.endsWith('.google.com') ||
      host.endsWith('.googleusercontent.com')
    ) {
      return true;
    }

    // Allow configured APP_URL host
    if (serverConfig.appUrl) {
      const appHost = new URL(serverConfig.appUrl).hostname;
      if (host === appHost) return true;
    }
  } catch {
    return false;
  }

  return false;
}

/**
 * Restrictive CORS and HTTP Security Headers middleware.
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;

  // 1. CORS Configuration
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, OPTIONS, HEAD'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Correlation-ID, Cache-Control'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  // Handle CORS OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // 2. MIME Type Sniffing Prevention
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 3. XSS Filter Defense
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // 4. Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 5. Restrictive Hardware Permissions Policy
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // 6. Cross-Domain Policy
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // 7. Content Security Policy (CSP)
  // Allows frame-ancestors for AI Studio preview iframe while restricting arbitrary embedding
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://generativelanguage.googleapis.com",
    "frame-ancestors 'self' https://*.google.com https://*.googleusercontent.com https://*.run.app",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspDirectives);

  next();
}
