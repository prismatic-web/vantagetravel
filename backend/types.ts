// Backend Types for Cloudflare Worker

export interface Env {
  // Database
  DB: D1Database;
  
  // Google OAuth
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  
  // JWT
  JWT_SECRET: string;
  
  // Stripe
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID: string;
  
  // App
  APP_URL: string;
}

export interface JWTPayload {
  sub: string;        // User ID
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

export interface User {
  id: string;
  email: string;
  google_id: string;
  name: string;
  avatar_url: string | null;
  created_at: number;
  updated_at: number;
  last_login_at: number;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete';
  tier: 'free' | 'pro' | 'enterprise';
  current_period_start: number;
  current_period_end: number;
}

export interface Session {
  id: string;
  user_id: string;
  expires_at: number;
  revoked_at: number | null;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
