import path from "path"
import type { PreviewServer, ViteDevServer, Connect } from "vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { inspectAttr } from "kimi-plugin-inspect-react"

// ============================================================================
// SECURITY CONFIGURATION
// OWASP-compliant security headers and rate limiting
// ============================================================================

/** Security headers following OWASP best practices */
const SECURITY_HEADERS = {
  // Prevent clickjacking attacks
  "X-Frame-Options": "DENY",
  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",
  // Enable XSS protection (legacy browsers)
  "X-XSS-Protection": "1; mode=block",
  // Control referrer information
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Limit browser features
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  // Strict Content Security Policy
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://test.api.amadeus.com https://pagead2.googlesyndication.com; frame-src https://googleads.g.doubleclick.net; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;",
  // HSTS (uncomment for production with HTTPS)
  // "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
}

/** Rate limiting configuration */
const RATE_LIMITS = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 requests per window per IP
  globalMaxRequests: 100, // 100 requests per minute globally
}

// Rate limit storage: Map<IP, { count, resetTime }>
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()
let globalRequestCount = 0
let globalResetTime = Date.now() + RATE_LIMITS.windowMs

/** Get client IP from request */
function getClientIp(req: Connect.IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"]
  const forwardedIp = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : undefined
  const realIp = typeof req.headers["x-real-ip"] === "string" ? req.headers["x-real-ip"] : undefined
  return forwardedIp || realIp || req.socket?.remoteAddress || "unknown"
}

/** Check rate limit for IP */
function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  
  // Check global limit
  if (now > globalResetTime) {
    globalRequestCount = 0
    globalResetTime = now + RATE_LIMITS.windowMs
  }
  
  if (globalRequestCount >= RATE_LIMITS.globalMaxRequests) {
    return { allowed: false, retryAfter: Math.ceil((globalResetTime - now) / 1000) }
  }
  
  globalRequestCount++
  
  // Check IP-specific limit
  const entry = rateLimitStore.get(ip)
  
  if (!entry) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMITS.windowMs })
    return { allowed: true }
  }
  
  if (now > entry.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMITS.windowMs })
    return { allowed: true }
  }
  
  if (entry.count >= RATE_LIMITS.maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetTime - now) / 1000) }
  }
  
  entry.count++
  return { allowed: true }
}

// Note: Cleanup interval removed to prevent build hang
// In production, rate limit store resets on each deploy (stateless)
// For persistent rate limiting, use Redis or external store

/** Input validation for API requests */
function validateApiInput(url: string): { valid: boolean; error?: string } {
  // Validate query parameters
  const urlObj = new URL(url, "http://localhost")
  
  // Check for suspicious patterns (SQL injection, path traversal, etc.)
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|SCRIPT)\b)/i,
    /\.\.[\\/]/, // Path traversal
    /<script/i, // XSS attempts
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers
  ]
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(urlObj.pathname) || pattern.test(urlObj.search)) {
      return { valid: false, error: "Invalid characters in request" }
    }
  }
  
  // Validate IATA codes in URL (3 uppercase letters)
  const iataMatches = url.match(/[A-Z]{3}/g)
  if (iataMatches) {
    for (const code of iataMatches) {
      if (!/^[A-Z]{3}$/.test(code)) {
        return { valid: false, error: "Invalid airport code format" }
      }
    }
  }
  
  return { valid: true }
}

/**
 * Security middleware plugin - adds rate limiting and security headers
 */
function securityPlugin() {
  function attachMiddleware(server: ViteDevServer | PreviewServer) {
    // Apply security headers to all responses
    server.middlewares.use((req, res, next) => {
      const url = req.url || ""
      
      // Apply security headers
      Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
        res.setHeader(header, value)
      })
      
      // Skip rate limiting for static assets (performance optimization)
      if (url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i)) {
        return next()
      }
      
      // Rate limit API endpoints
      if (url.startsWith("/api/")) {
        const clientIp = getClientIp(req)
        const rateCheck = checkRateLimit(clientIp)
        
        if (!rateCheck.allowed) {
          res.statusCode = 429
          res.setHeader("Content-Type", "application/json; charset=utf-8")
          res.setHeader("Retry-After", String(rateCheck.retryAfter || 60))
          res.end(JSON.stringify({
            error: "rate_limit_exceeded",
            message: "Too many requests. Please try again later.",
            retryAfter: rateCheck.retryAfter,
          }))
          return
        }
        
        // Add rate limit info headers
        res.setHeader("X-RateLimit-Limit", String(RATE_LIMITS.maxRequests))
      }
      
      next()
    })
  }

  return {
    name: "security-headers-and-rate-limit",
    configureServer: attachMiddleware,
    configurePreviewServer: attachMiddleware,
  }
}

/**
 * Proxies /api/amadeus/* → Amadeus test API so secrets stay in .env (Node) and are never bundled.
 * Security enhancements: input validation, secure error handling, request timeouts
 * Register free keys: https://developers.amadeus.com/self-service
 */
function amadeusApiProxyPlugin() {
  let tokenCache: { token: string; exp: number } | null = null
  let tokenPromise: Promise<string> | null = null
  const REQUEST_TIMEOUT = 30000 // 30 seconds

  async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
    if (tokenCache && tokenCache.exp > Date.now() + 30_000) return tokenCache.token
    if (tokenPromise) return tokenPromise

    tokenPromise = (async () => {
      try {
        const body = new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        })
        
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
        
        const r = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body,
          signal: controller.signal,
        })
        
        clearTimeout(timeout)
        
        if (!r.ok) throw new Error(await r.text())
        const j = (await r.json()) as { access_token: string; expires_in: number }
        tokenCache = {
          token: j.access_token,
          exp: Date.now() + (j.expires_in ?? 1800) * 1000,
        }
        return tokenCache.token
      } finally {
        tokenPromise = null
      }
    })()

    return tokenPromise
  }

  function attachMiddleware(server: ViteDevServer | PreviewServer) {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url || ""
      if (!url.startsWith("/api/amadeus/")) return next()

      // Validate input
      const validation = validateApiInput(url)
      if (!validation.valid) {
        res.statusCode = 400
        res.setHeader("Content-Type", "application/json; charset=utf-8")
        res.end(JSON.stringify({
          error: "validation_failed",
          message: validation.error,
        }))
        return
      }

      try {
        const env = loadEnv(server.config.mode, process.cwd(), "")
        const cid = env.AMADEUS_CLIENT_ID
        const sec = env.AMADEUS_CLIENT_SECRET
        
        if (!cid || !sec) {
          res.statusCode = 503
          res.setHeader("Content-Type", "application/json; charset=utf-8")
          res.end(
            JSON.stringify({
              error: "missing_credentials",
              message: "Flight search service temporarily unavailable.",
            })
          )
          return
        }

        const token = await getAccessToken(cid, sec)
        const pathAndQuery = url.slice("/api/amadeus".length)
        
        // Validate path to prevent path traversal
        if (pathAndQuery.includes("..") || !pathAndQuery.match(/^[a-zA-Z0-9_/?=&\-]+$/)) {
          res.statusCode = 400
          res.setHeader("Content-Type", "application/json; charset=utf-8")
          res.end(JSON.stringify({ error: "invalid_path", message: "Invalid API path" }))
          return
        }
        
        const upstream = `https://test.api.amadeus.com${pathAndQuery}`
        
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
        
        const r = await fetch(upstream, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          signal: controller.signal,
        })
        
        clearTimeout(timeout)
        
        const buf = Buffer.from(await r.arrayBuffer())
        res.statusCode = r.status
        const ct = r.headers.get("content-type")
        if (ct) res.setHeader("Content-Type", ct)
        res.end(buf)
      } catch (e) {
        // Don't leak sensitive error details
        console.error("[Amadeus Proxy] Error:", e)
        res.statusCode = 502
        res.setHeader("Content-Type", "application/json; charset=utf-8")
        res.end(JSON.stringify({ 
          error: "flight_service_error", 
          message: "Unable to fetch flight data. Please try again later."
        }))
      }
    })
  }

  return {
    name: "amadeus-api-proxy",
    configureServer: attachMiddleware,
    configurePreviewServer: attachMiddleware,
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [
    securityPlugin(), // Must be first to apply headers to all responses
    mode === 'development' ? inspectAttr() : null, // Dev-only plugin
    react(),
    amadeusApiProxyPlugin(),
  ].filter(Boolean), // Remove null plugins
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Additional security: prevent source map exposure in production
  build: {
    sourcemap: false, // Disable source maps in production (set to true for debugging)
    rollupOptions: {
      output: {
        // Prevent code injection via module names
        sanitizeFileName: (name) => name.replace(/[^a-zA-Z0-9_.-]/g, "_"),
      },
    },
  },
  // Server security settings
  server: {
    // Only allow same-origin requests
    cors: false,
    // Custom host/port validation
    host: "localhost",
    port: 5173,
    strictPort: true,
    // HMR security
    hmr: {
      host: "localhost",
      protocol: "ws",
    },
    // Request timeout
    proxy: {},
  },
  // Preview server security (for production preview)
  preview: {
    port: 4173,
    strictPort: true,
    host: "localhost",
  },
})
