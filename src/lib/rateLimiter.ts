/**
 * Rate Limiting Middleware for Vite Dev Server
 * 
 * Implements IP-based and global rate limiting with sliding window algorithm
 * OWASP: Rate limiting protects against brute force and DoS attacks
 * 
 * Security Features:
 * - IP-based rate limiting (prevents abuse from single source)
 * - Global rate limiting (prevents server overload)
 * - Sliding window algorithm (smooth rate distribution)
 * - Graceful 429 responses with Retry-After header
 * - Automatic cleanup of expired entries
 */

import type { ViteDevServer, PreviewServer } from 'vite'
import { RATE_LIMITS } from './security'

// Rate limit store: Map<key, { count: number; resetTime: number }>
interface RateLimitEntry {
  count: number
  resetTime: number
}

// Separate stores for different rate limit types
const ipStore = new Map<string, RateLimitEntry>()
const globalStore: RateLimitEntry = { count: 0, resetTime: Date.now() }

/**
 * Get client IP address from request
 * Checks X-Forwarded-For for proxies, falls back to connection remoteAddress
 */
function getClientIp(req: { headers: { [key: string]: string | string[] | undefined }; socket?: { remoteAddress?: string } }): string {
  // Check X-Forwarded-For header (for proxies)
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    const ips = forwarded.split(',').map(ip => ip.trim())
    if (ips.length > 0 && ips[0]) return ips[0]
  }
  
  // Check X-Real-IP header
  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp) return realIp
  
  // Fall back to socket remote address
  return req.socket?.remoteAddress || 'unknown'
}

/**
 * Check if request is within rate limit
 * Returns { allowed: boolean, retryAfter?: number }
 */
function checkRateLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const entry = store.get(key)
  
  // Clean up expired entry
  if (entry && now > entry.resetTime) {
    store.delete(key)
  }
  
  // Get or create entry
  const current = store.get(key)
  if (!current) {
    store.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })
    return { allowed: true }
  }
  
  // Check if over limit
  if (current.count >= maxRequests) {
    const retryAfter = Math.ceil((current.resetTime - now) / 1000)
    return { allowed: false, retryAfter }
  }
  
  // Increment counter
  current.count++
  return { allowed: true }
}

/**
 * Check global rate limit (all requests combined)
 */
function checkGlobalRateLimit(maxRequests: number, windowMs: number): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  
  // Reset if window expired
  if (now > globalStore.resetTime) {
    globalStore.count = 0
    globalStore.resetTime = now + windowMs
  }
  
  if (globalStore.count >= maxRequests) {
    const retryAfter = Math.ceil((globalStore.resetTime - now) / 1000)
    return { allowed: false, retryAfter }
  }
  
  globalStore.count++
  return { allowed: true }
}

/**
 * Clean up expired rate limit entries periodically
 * Prevents memory leaks from abandoned entries
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [key, entry] of ipStore) {
    if (now > entry.resetTime) {
      ipStore.delete(key)
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000)

/**
 * Rate limiting middleware factory
 * Returns Vite plugin that adds rate limiting to dev/preview server
 */
export function rateLimitPlugin() {
  return {
    name: 'security-rate-limiter',
    
    configureServer(server: ViteDevServer) {
      server.middlewares.use(createRateLimitMiddleware())
    },
    
    configurePreviewServer(server: PreviewServer) {
      server.middlewares.use(createRateLimitMiddleware())
    },
  }
}

/**
 * Create the rate limiting middleware function
 */
function createRateLimitMiddleware() {
  return (req: { url?: string; headers: { [key: string]: string | string[] | undefined }; socket?: { remoteAddress?: string } }, 
          res: { statusCode?: number; setHeader?: (name: string, value: string | number) => void; end?: (data: string) => void }, 
          next: () => void) => {
    
    // Skip rate limiting for static assets (performance optimization)
    const url = req.url || ''
    if (url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
      return next()
    }
    
    // Only rate limit API endpoints
    if (!url.startsWith('/api/')) {
      return next()
    }
    
    const clientIp = getClientIp(req)
    const now = Date.now()
    
    // Check global rate limit first (protects server resources)
    const globalCheck = checkGlobalRateLimit(
      RATE_LIMITS.global.maxRequests,
      RATE_LIMITS.global.windowMs
    )
    
    if (!globalCheck.allowed) {
      res.statusCode = 429
      res.setHeader?.('Content-Type', 'application/json')
      res.setHeader?.('Retry-After', globalCheck.retryAfter || 60)
      res.setHeader?.('X-RateLimit-Limit', RATE_LIMITS.global.maxRequests)
      res.setHeader?.('X-RateLimit-Reset', Math.ceil((now + RATE_LIMITS.global.windowMs) / 1000))
      res.end?.(JSON.stringify({
        error: 'rate_limit_global',
        message: 'Server is experiencing high traffic. Please try again later.',
        retryAfter: globalCheck.retryAfter,
      }))
      return
    }
    
    // Check IP-based rate limit (prevents abuse from single source)
    const ipCheck = checkRateLimit(
      ipStore,
      clientIp,
      RATE_LIMITS.perIp.maxRequests,
      RATE_LIMITS.perIp.windowMs
    )
    
    if (!ipCheck.allowed) {
      res.statusCode = 429
      res.setHeader?.('Content-Type', 'application/json')
      res.setHeader?.('Retry-After', ipCheck.retryAfter || 60)
      res.setHeader?.('X-RateLimit-Limit', RATE_LIMITS.perIp.maxRequests)
      res.setHeader?.('X-RateLimit-Reset', Math.ceil((now + RATE_LIMITS.perIp.windowMs) / 1000))
      res.end?.(JSON.stringify({
        error: 'rate_limit_ip',
        message: 'Too many requests from your IP. Please try again later.',
        retryAfter: ipCheck.retryAfter,
      }))
      return
    }
    
    // Add rate limit headers to successful responses (transparency)
    const originalEnd = res.end
    res.end = function(data: string) {
      res.setHeader?.('X-RateLimit-Limit', RATE_LIMITS.perIp.maxRequests)
      res.setHeader?.('X-RateLimit-Remaining', Math.max(0, RATE_LIMITS.perIp.maxRequests - (ipStore.get(clientIp)?.count || 0)))
      return originalEnd?.call(this, data)
    }
    
    next()
  }
}

/**
 * Get current rate limit status for an IP (for monitoring)
 */
export function getRateLimitStatus(ip: string): {
  ipLimit: { current: number; max: number; resetIn: number }
  globalLimit: { current: number; max: number; resetIn: number }
} {
  const now = Date.now()
  const ipEntry = ipStore.get(ip)
  
  return {
    ipLimit: {
      current: ipEntry?.count || 0,
      max: RATE_LIMITS.perIp.maxRequests,
      resetIn: ipEntry ? Math.max(0, ipEntry.resetTime - now) : 0,
    },
    globalLimit: {
      current: globalStore.count,
      max: RATE_LIMITS.global.maxRequests,
      resetIn: Math.max(0, globalStore.resetTime - now),
    },
  }
}

export default rateLimitPlugin
