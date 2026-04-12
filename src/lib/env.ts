/**
 * Secure Environment Configuration
 * 
 * Validates and sanitizes all environment variables
 * Prevents runtime errors from missing/invalid env vars
 * Never exposes sensitive values to client
 */

import { z } from 'zod'

// ============================================================================
// ENVIRONMENT SCHEMAS - Strict validation
// ============================================================================

/**
 * Server-side environment variables (Node.js/Vite process)
 * These are read ONLY by the server, never bundled to client
 */
export const ServerEnvSchema = z.object({
  // Amadeus API credentials
  AMADEUS_CLIENT_ID: z.string().min(10, 'Amadeus Client ID too short').optional(),
  AMADEUS_CLIENT_SECRET: z.string().min(10, 'Amadeus Client Secret too short').optional(),
  
  // RapidAPI key
  RAPIDAPI_KEY: z.string().min(20, 'RapidAPI key too short').optional(),
  
  // SerpAPI key
  SERPAPI_KEY: z.string().min(20, 'SerpAPI key too short').optional(),
  
  // AviationStack key
  AVIATIONSTACK_KEY: z.string().min(10, 'AviationStack key too short').optional(),
  
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // API timeouts (milliseconds)
  API_TIMEOUT_MS: z.union([z.string(), z.number()])
    .transform(val => typeof val === 'string' ? parseInt(val, 10) : val)
    .pipe(z.number().int().min(5000).max(60000))
    .default(30000),
})

/**
 * Client-side environment variables (exposed to browser)
 * These MUST NOT contain secrets - only public config
 */
export const ClientEnvSchema = z.object({
  // Public app URL
  VITE_APP_URL: z.string().url().default('http://localhost:5173'),
  
  // Analytics/tracking (if needed)
  VITE_GA_TRACKING_ID: z.string().regex(/^G-[A-Z0-9]+$/).optional(),
  
  // Feature flags (public)
  VITE_ENABLE_ANALYTICS: z.enum(['true', 'false']).default('false'),
  VITE_ENABLE_DEBUG: z.enum(['true', 'false']).default('false'),
})

// Type exports
type ServerEnv = z.infer<typeof ServerEnvSchema>
type ClientEnv = z.infer<typeof ClientEnvSchema>

// ============================================================================
// ENVIRONMENT STATE
// ============================================================================

let serverEnv: ServerEnv | null = null
let clientEnv: ClientEnv | null = null

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate and load server-side environment variables
 * Call this once at server startup
 */
export function validateServerEnv(): ServerEnv {
  if (serverEnv) return serverEnv
  
  try {
    serverEnv = ServerEnvSchema.parse({
      AMADEUS_CLIENT_ID: process.env.AMADEUS_CLIENT_ID,
      AMADEUS_CLIENT_SECRET: process.env.AMADEUS_CLIENT_SECRET,
      RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
      SERPAPI_KEY: process.env.SERPAPI_KEY,
      AVIATIONSTACK_KEY: process.env.AVIATIONSTACK_KEY,
      NODE_ENV: process.env.NODE_ENV,
      API_TIMEOUT_MS: process.env.API_TIMEOUT_MS,
    })
    
    return serverEnv
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
      throw new Error(`Server environment validation failed: ${issues}`)
    }
    throw error
  }
}

/**
 * Validate and load client-side environment variables
 * Call this in browser context
 */
export function validateClientEnv(): ClientEnv {
  if (clientEnv) return clientEnv
  if (typeof import.meta === 'undefined') {
    throw new Error('validateClientEnv() must be called in browser context')
  }
  
  try {
    clientEnv = ClientEnvSchema.parse({
      VITE_APP_URL: import.meta.env.VITE_APP_URL,
      VITE_GA_TRACKING_ID: import.meta.env.VITE_GA_TRACKING_ID,
      VITE_ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS,
      VITE_ENABLE_DEBUG: import.meta.env.VITE_ENABLE_DEBUG,
    })
    
    return clientEnv
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
      throw new Error(`Client environment validation failed: ${issues}`)
    }
    throw error
  }
}

// ============================================================================
// SECURE GETTERS - Never expose sensitive data
// ============================================================================

/**
 * Check if a server-side API key is configured (without exposing the value)
 */
export function hasServerApiKey(keyName: keyof ServerEnv): boolean {
  const env = validateServerEnv()
  const value = env[keyName]
  return typeof value === 'string' && value.length > 0
}

/**
 * Get server-side API key (for server use only)
 * WARNING: Only call this in server context (vite.config.ts, API routes)
 */
export function getServerApiKey(keyName: keyof ServerEnv): string | undefined {
  const env = validateServerEnv()
  return env[keyName] as string | undefined
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  try {
    return validateServerEnv().NODE_ENV === 'production'
  } catch {
    return false
  }
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  try {
    return validateServerEnv().NODE_ENV === 'development'
  } catch {
    return true
  }
}

/**
 * Get API timeout (milliseconds)
 */
export function getApiTimeout(): number {
  try {
    return validateServerEnv().API_TIMEOUT_MS
  } catch {
    return 30000 // Default 30 seconds
  }
}

// ============================================================================
// CLIENT-SIDE SAFE GETTERS
// ============================================================================

/**
 * Get public app URL (safe for client)
 */
export function getAppUrl(): string {
  try {
    return validateClientEnv().VITE_APP_URL
  } catch {
    return 'http://localhost:5173'
  }
}

/**
 * Check if analytics is enabled (safe for client)
 */
export function isAnalyticsEnabled(): boolean {
  try {
    return validateClientEnv().VITE_ENABLE_ANALYTICS === 'true'
  } catch {
    return false
  }
}

/**
 * Check if debug mode is enabled (safe for client)
 */
export function isDebugEnabled(): boolean {
  try {
    return validateClientEnv().VITE_ENABLE_DEBUG === 'true'
  } catch {
    return false
  }
}

// ============================================================================
// SECURITY HELPERS
// ============================================================================

/**
 * Log environment status (safe - doesn't expose secrets)
 * Call this at startup for monitoring
 */
export function logEnvironmentStatus(): void {
  const hasAmadeus = hasServerApiKey('AMADEUS_CLIENT_ID') && hasServerApiKey('AMADEUS_CLIENT_SECRET')
  const hasRapidApi = hasServerApiKey('RAPIDAPI_KEY')
  const hasSerpApi = hasServerApiKey('SERPAPI_KEY')
  const hasAviationStack = hasServerApiKey('AVIATIONSTACK_KEY')
  
  console.log('Environment Status:', {
    nodeEnv: isProduction() ? 'production' : 'development',
    apiProviders: {
      amadeus: hasAmadeus ? 'configured' : 'not configured',
      rapidApi: hasRapidApi ? 'configured' : 'not configured',
      serpApi: hasSerpApi ? 'configured' : 'not configured',
      aviationStack: hasAviationStack ? 'configured' : 'not configured',
    },
    apiTimeout: getApiTimeout(),
    appUrl: getAppUrl(),
  })
}

/**
 * Rotate API key (for key rotation procedures)
 * In production, implement key rotation via external secret management
 */
export function rotateApiKey(_keyName: keyof ServerEnv, _newValue: string): void {
  // This is a placeholder for key rotation logic
  // In production, integrate with:
  // - AWS Secrets Manager
  // - HashiCorp Vault
  // - Azure Key Vault
  // - Google Secret Manager
  throw new Error('Key rotation must be performed via external secret management in production')
}

// ============================================================================
// EXPORTS
// ============================================================================

export const EnvUtils = {
  validateServerEnv,
  validateClientEnv,
  hasServerApiKey,
  getServerApiKey,
  isProduction,
  isDevelopment,
  getApiTimeout,
  getAppUrl,
  isAnalyticsEnabled,
  isDebugEnabled,
  logEnvironmentStatus,
}

export default EnvUtils
