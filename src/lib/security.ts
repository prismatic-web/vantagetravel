/**
 * Security Utilities - Input Validation, Sanitization, and Security Helpers
 * 
 * OWASP Compliance: Input Validation, Output Encoding, Secure Communication
 * Security Level: Enterprise-grade with defense in depth
 */

import { z } from 'zod'

// ============================================================================
// INPUT VALIDATION SCHEMAS (Zod-based strict validation)
// ============================================================================

/** IATA airport code: exactly 3 uppercase letters */
export const IataCodeSchema = z.string()
  .length(3, 'IATA code must be exactly 3 characters')
  .regex(/^[A-Z]{3}$/, 'IATA code must be 3 uppercase letters')
  .transform(val => val.toUpperCase().trim())

/** Date in YYYY-MM-DD format */
export const DateSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine(val => {
    const date = new Date(val)
    return !isNaN(date.getTime()) && date > new Date('2000-01-01')
  }, 'Invalid date or date too old')

/** Number of adults: 1-9 (reasonable limit) */
export const AdultsSchema = z.number()
  .int('Must be whole number')
  .min(1, 'Minimum 1 adult')
  .max(9, 'Maximum 9 adults')

/** City name: 1-100 chars, letters/spaces/hyphens only */
export const CitySchema = z.string()
  .min(1, 'City name required')
  .max(100, 'City name too long (max 100 chars)')
  .regex(/^[\p{L}\s\-'.]+$/u, 'City name contains invalid characters')
  .transform(val => val.trim())

/** Country name: 1-100 chars, letters/spaces only */
export const CountrySchema = z.string()
  .min(1, 'Country name required')
  .max(100, 'Country name too long')
  .regex(/^[\p{L}\s\-'.]+$/u, 'Country name contains invalid characters')
  .transform(val => val.trim())

/** Airport label from dropdown */
export const AirportLabelSchema = z.string()
  .min(3, 'Invalid airport selection')
  .max(100, 'Airport label too long')
  .regex(/^[A-Z]{3}\s*-.+$/, 'Invalid airport format')
  .transform(val => val.trim())

/** Travel style enum */
export const TravelStyleSchema = z.enum([
  'adventure', 'relaxation', 'foodie', 'culture', 'business'
])

/** Date flexibility options */
export const DateFlexibilitySchema = z.enum([
  'exact', 'flexible', 'timeframe'
])

/** Budget: reasonable range 50-100000 USD */
export const BudgetSchema = z.number()
  .int()
  .min(50, 'Minimum budget $50')
  .max(100000, 'Maximum budget $100,000')

/** Group size: 1-20 (reasonable limit) */
export const GroupSizeSchema = z.number()
  .int()
  .min(1, 'Minimum 1 person')
  .max(20, 'Maximum 20 people')

/** Fitness level enum */
export const FitnessLevelSchema = z.enum([
  'low', 'moderate', 'high'
])

/** Weather preference enum */
export const WeatherPreferenceSchema = z.enum([
  'sunny', 'cloudy', 'rainy', 'snowy', 'any'
])

/** Flexible days: 0-14 */
export const FlexibleDaysSchema = z.number()
  .int()
  .min(0)
  .max(14, 'Maximum 14 days flexibility')

// ============================================================================
// STRICT TRIP GENERATION REQUEST SCHEMA
// ============================================================================

export const TripGenerationRequestSchema = z.object({
  departureAirport: AirportLabelSchema,
  destination: CitySchema,
  country: CountrySchema,
  departureDate: DateSchema,
  returnDate: DateSchema,
  dateFlexibility: DateFlexibilitySchema,
  flexibleDays: FlexibleDaysSchema.optional().default(0),
  timeframeStart: DateSchema.optional(),
  timeframeEnd: DateSchema.optional(),
  dailyBudget: BudgetSchema,
  travelStyle: TravelStyleSchema,
  groupSize: GroupSizeSchema,
  fitnessLevel: FitnessLevelSchema,
  weatherPreference: WeatherPreferenceSchema,
}).strict() // Reject unexpected fields

// Type derived from schema
export type ValidatedTripRequest = z.infer<typeof TripGenerationRequestSchema>

// ============================================================================
// OUTPUT SANITIZATION
// ============================================================================

/** Sanitize string for safe HTML display (XSS prevention) */
export function sanitizeForDisplay(input: string): string {
  if (!input || typeof input !== 'string') return ''
  
  // Remove script tags and event handlers
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<iframe/gi, '&lt;iframe')
    .replace(/<object/gi, '&lt;object')
    .replace(/<embed/gi, '&lt;embed')
    .replace(/<form/gi, '&lt;form')
    .replace(/<input/gi, '&lt;input')
    .replace(/<button/gi, '&lt;button')
    .trim()
}

/** Sanitize for URL query parameters */
export function sanitizeForUrl(input: string): string {
  if (!input || typeof input !== 'string') return ''
  
  // Allow only safe URL characters
  return input
    .replace(/[^a-zA-Z0-9\-_\s]/g, '')
    .trim()
}

/** Validate and sanitize IATA code */
export function sanitizeIataCode(input: string): string | null {
  const cleaned = input?.toUpperCase().trim().slice(0, 3)
  if (!/^[A-Z]{3}$/.test(cleaned)) return null
  return cleaned
}

// ============================================================================
// SECURITY CONSTANTS
// ============================================================================

/** Maximum itinerary generation time (prevent DoS) */
export const MAX_GENERATION_TIME_MS = 30000 // 30 seconds

/** Maximum trip duration (prevent abuse) */
export const MAX_TRIP_DAYS = 30

/** Minimum trip duration */
export const MIN_TRIP_DAYS = 1

/** Rate limiting: Max requests per window */
export const RATE_LIMITS = {
  perIp: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute per IP
  },
  perUser: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50, // 50 requests per hour per user
  },
  global: {
    windowMs: 60 * 1000,
    maxRequests: 100, // 100 requests per minute globally
  }
}

// ============================================================================
// SECURITY HEADERS CONFIGURATION
// ============================================================================

export const SECURITY_HEADERS = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // XSS Protection (legacy browsers)
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions policy
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  
  // Content Security Policy
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://test.api.amadeus.com https://pagead2.googlesyndication.com",
    "frame-src https://googleads.g.doubleclick.net",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; '),
}

// ============================================================================
// ERROR HANDLING (Don't leak sensitive info)
// ============================================================================

export class SecurityError extends Error {
  code: string
  statusCode: number
  
  constructor(code: string, message: string, statusCode: number = 400) {
    super(message)
    this.name = 'SecurityError'
    this.code = code
    this.statusCode = statusCode
  }
}

export const SAFE_ERROR_MESSAGES: Record<string, string> = {
  'validation_failed': 'Invalid input provided',
  'rate_limit_exceeded': 'Too many requests. Please try again later',
  'unauthorized': 'Authentication required',
  'forbidden': 'Access denied',
  'not_found': 'Resource not found',
  'server_error': 'An error occurred. Please try again later',
}

export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof SecurityError) {
    return SAFE_ERROR_MESSAGES[error.code] || 'An error occurred'
  }
  return 'An unexpected error occurred'
}

// ============================================================================
// HELPER: Validate date range
// ============================================================================

export function validateDateRange(departure: string, returnDate: string): void {
  const dep = new Date(departure)
  const ret = new Date(returnDate)
  const now = new Date()
  
  if (isNaN(dep.getTime()) || isNaN(ret.getTime())) {
    throw new SecurityError('validation_failed', 'Invalid dates provided')
  }
  
  // Departure must be today or future
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (dep < today) {
    throw new SecurityError('validation_failed', 'Departure date cannot be in the past')
  }
  
  // Return must be after departure
  if (ret <= dep) {
    throw new SecurityError('validation_failed', 'Return date must be after departure')
  }
  
  // Max trip duration
  const diffDays = Math.ceil((ret.getTime() - dep.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays > MAX_TRIP_DAYS) {
    throw new SecurityError('validation_failed', `Trip duration exceeds maximum of ${MAX_TRIP_DAYS} days`)
  }
  
  if (diffDays < MIN_TRIP_DAYS) {
    throw new SecurityError('validation_failed', 'Trip must be at least 1 day')
  }
  
  // Max advance booking (2 years)
  const maxAdvance = new Date()
  maxAdvance.setFullYear(maxAdvance.getFullYear() + 2)
  if (dep > maxAdvance) {
    throw new SecurityError('validation_failed', 'Departure date too far in advance')
  }
}

// ============================================================================
// HELPER: Generate secure random ID
// ============================================================================

export function generateSecureId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

// ============================================================================
// HELPER: Deep freeze object (immutable)
// ============================================================================

export function deepFreeze<T extends Record<string, unknown>>(obj: T): T {
  const propNames = Object.getOwnPropertyNames(obj)
  for (const name of propNames) {
    const value = obj[name]
    if (value && typeof value === 'object') {
      deepFreeze(value as Record<string, unknown>)
    }
  }
  return Object.freeze(obj)
}

// ============================================================================
// EXPORT SECURITY UTILITIES
// ============================================================================

export const SecurityUtils = {
  sanitizeForDisplay,
  sanitizeForUrl,
  sanitizeIataCode,
  validateDateRange,
  generateSecureId,
  deepFreeze,
  getSafeErrorMessage,
}

export default SecurityUtils
