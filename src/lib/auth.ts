/**
 * Authentication API Client
 * Communicates with Cloudflare Worker backend
 * NO secrets stored here - all tokens are httpOnly cookies
 */

const API_URL = import.meta.env.VITE_API_URL || 'https://vantagetravel-api.your-subdomain.workers.dev';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: number;
}

export interface Subscription {
  status: 'active' | 'canceled' | 'past_due';
  tier: 'free' | 'pro' | 'enterprise';
  current_period_end: number;
  isPremium: boolean;
  features: string[];
}

export interface AuthState {
  user: User | null;
  subscription: Subscription | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Check if user is logged in by calling /api/auth/me
 * Backend reads httpOnly cookie automatically
 */
export async function getCurrentUser(): Promise<{ user: User; subscription: Subscription } | null> {
  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      method: 'GET',
      credentials: 'include', // Sends cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Try to refresh token
        const refreshed = await refreshAccessToken();
        if (!refreshed) return null;
        
        // Retry with new token
        return getCurrentUser();
      }
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Auth check failed:', error);
    return null;
  }
}

/**
 * Refresh access token using refresh token cookie
 * Backend handles everything - we just make the request
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Sends refresh_token cookie
    });

    return response.ok;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
}

/**
 * Login with Google OAuth
 * Redirects to Google's login page
 */
export function loginWithGoogle(redirectUrl: string = '/'): void {
  const encodedRedirect = encodeURIComponent(redirectUrl);
  window.location.href = `${API_URL}/api/auth/google?redirect=${encodedRedirect}`;
}

/**
 * Logout - revokes session on backend
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
  
  // Clear any local state
  window.location.href = '/';
}

/**
 * Get subscription status
 */
export async function getSubscription(): Promise<Subscription | null> {
  try {
    const response = await fetch(`${API_URL}/api/payments/subscription`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) return null;
    
    return await response.json();
  } catch (error) {
    console.error('Failed to get subscription:', error);
    return null;
  }
}

/**
 * Create Stripe checkout session (for when you add Stripe later)
 */
export async function createCheckoutSession(): Promise<{ url: string } | null> {
  try {
    const response = await fetch(`${API_URL}/api/payments/checkout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create checkout');
    }

    return await response.json();
  } catch (error) {
    console.error('Checkout creation failed:', error);
    throw error;
  }
}

/**
 * Cancel subscription (for when you add Stripe later)
 */
export async function cancelSubscription(): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/api/payments/subscription`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to cancel subscription');
    }
  } catch (error) {
    console.error('Cancel subscription failed:', error);
    throw error;
  }
}

/**
 * React Hook for authentication state
 * Usage in components:
 * const { user, subscription, isLoading, isAuthenticated, login, logout } = useAuth();
 */
import { useState, useEffect, useCallback } from 'react';

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    subscription: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const checkAuth = useCallback(async () => {
    const result = await getCurrentUser();
    
    if (result) {
      setState({
        user: result.user,
        subscription: result.subscription,
        isLoading: false,
        isAuthenticated: true,
      });
    } else {
      setState({
        user: null,
        subscription: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(() => {
    loginWithGoogle();
  }, []);

  const logoutUser = useCallback(async () => {
    await logout();
    setState({
      user: null,
      subscription: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  return {
    ...state,
    login,
    logout: logoutUser,
    refresh: checkAuth,
  };
}

/**
 * Check if user has premium access
 */
export function hasPremiumAccess(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  return subscription.tier === 'pro' || subscription.tier === 'enterprise';
}
