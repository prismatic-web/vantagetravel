/**
 * VANTAGE TRAVEL - Secure Backend API
 * Cloudflare Worker with D1 Database
 * 
 * Features:
 * - Google OAuth authentication (server-side)
 * - JWT token management (access + refresh)
 * - Stripe subscription handling
 * - Rate limiting and security headers
 * - All secrets stay on the backend - NEVER in frontend
 */

import { Env } from './types';
import { 
  handleGoogleAuth, 
  handleGoogleCallback, 
  handleRefreshToken,
  handleLogout,
  handleGetUser,
  verifyAuth 
} from './auth';
import {
  handleCreateCheckout,
  handleStripeWebhook,
  handleGetSubscription,
  handleCancelSubscription
} from './payments';

// ============================================================================
// CORS Configuration
// ============================================================================
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // Replace with your domain in production
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

// ============================================================================
// Security Headers
// ============================================================================
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

// ============================================================================
// Rate Limiting Store (in-memory, per-worker)
// In production, use Redis or D1 for distributed rate limiting
// ============================================================================
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute per IP

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetTime - now) / 1000) };
  }
  
  entry.count++;
  return { allowed: true };
}

// ============================================================================
// Main Request Handler
// ============================================================================
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    
    // Apply rate limiting
    const rateLimit = checkRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.retryAfter || 60),
          ...SECURITY_HEADERS,
        },
      });
    }
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...CORS_HEADERS, ...SECURITY_HEADERS },
      });
    }
    
    try {
      let response: Response;
      
      // ============================================================================
      // AUTH ROUTES
      // ============================================================================
      
      if (path === '/api/auth/google') {
        // Start Google OAuth flow
        response = await handleGoogleAuth(env, request);
      } 
      else if (path === '/api/auth/google/callback') {
        // Google OAuth callback
        response = await handleGoogleCallback(env, request);
      }
      else if (path === '/api/auth/refresh') {
        // Refresh access token
        response = await handleRefreshToken(env, request);
      }
      else if (path === '/api/auth/logout') {
        // Logout and revoke tokens
        response = await handleLogout(env, request);
      }
      else if (path === '/api/auth/me') {
        // Get current user
        response = await handleGetUser(env, request);
      }
      
      // ============================================================================
      // PAYMENT ROUTES
      // ============================================================================
      
      else if (path === '/api/payments/checkout') {
        // Create Stripe checkout session
        response = await handleCreateCheckout(env, request);
      }
      else if (path === '/api/payments/webhook') {
        // Stripe webhook (no auth required, signature verified)
        response = await handleStripeWebhook(env, request);
      }
      else if (path === '/api/payments/subscription') {
        // Get subscription status
        if (request.method === 'GET') {
          response = await handleGetSubscription(env, request);
        } else if (request.method === 'DELETE') {
          response = await handleCancelSubscription(env, request);
        } else {
          response = new Response('Method not allowed', { status: 405 });
        }
      }
      
      // ============================================================================
      // HEALTH CHECK
      // ============================================================================
      
      else if (path === '/api/health') {
        response = new Response(JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // ============================================================================
      // 404
      // ============================================================================
      
      else {
        response = new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // Add security headers to all responses
      const newHeaders = new Headers(response.headers);
      Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
      
    } catch (error) {
      console.error('API Error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        requestId: generateRequestId()
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...SECURITY_HEADERS,
        },
      });
    }
  },
};

function generateRequestId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
