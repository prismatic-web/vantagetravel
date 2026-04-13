import { Env } from './types';
import { createJWT, verifyJWT, hashToken, generateSecureId } from './crypto';

// ============================================================================
// SECURE AUTHENTICATION MODULE
// Google OAuth + JWT tokens (server-side only)
// ============================================================================

/**
 * Google OAuth Login Flow - Step 1
 * Generates authorization URL and redirects user to Google
 */
export async function handleGoogleAuth(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const redirectUrl = url.searchParams.get('redirect') || '/';
  
  // Generate cryptographically secure state parameter (CSRF protection)
  const state = generateSecureId(32);
  const codeVerifier = generateSecureId(64); // PKCE
  
  // Store state in D1 (expires in 10 minutes)
  const expiresAt = Math.floor(Date.now() / 1000) + 600;
  await env.DB.prepare(
    'INSERT INTO oauth_states (state, redirect_url, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(state, redirectUrl, Math.floor(Date.now() / 1000), expiresAt).run();
  
  // Build Google OAuth URL
  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set('redirect_uri', `${env.APP_URL}/api/auth/google/callback`);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('state', state);
  googleAuthUrl.searchParams.set('code_challenge', await hashCodeVerifier(codeVerifier));
  googleAuthUrl.searchParams.set('code_challenge_method', 'S256');
  
  // Store code verifier in cookie (httpOnly, secure)
  const headers = new Headers();
  headers.set('Location', googleAuthUrl.toString());
  headers.append('Set-Cookie', `oauth_code_verifier=${codeVerifier}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/api/auth`);
  
  return new Response(null, { 
    status: 302, 
    headers 
  });
}

/**
 * Google OAuth Callback - Step 2
 * Exchanges code for tokens, creates/updates user, issues JWT
 */
export async function handleGoogleCallback(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  if (!code || !state) {
    return jsonResponse({ error: 'Invalid OAuth callback' }, 400);
  }
  
  // Validate state parameter (prevent CSRF)
  const stateRecord = await env.DB.prepare(
    'SELECT redirect_url FROM oauth_states WHERE state = ? AND expires_at > ?'
  ).bind(state, Math.floor(Date.now() / 1000)).first<{ redirect_url: string }>();
  
  if (!stateRecord) {
    return jsonResponse({ error: 'Invalid or expired OAuth state' }, 400);
  }
  
  // Delete used state
  await env.DB.prepare('DELETE FROM oauth_states WHERE state = ?').bind(state).run();
  
  // Get code verifier from cookie
  const cookieHeader = request.headers.get('Cookie') || '';
  const codeVerifier = extractCookieValue(cookieHeader, 'oauth_code_verifier');
  
  if (!codeVerifier) {
    return jsonResponse({ error: 'Missing OAuth code verifier' }, 400);
  }
  
  // Exchange code for tokens with Google
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${env.APP_URL}/api/auth/google/callback`,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });
  
  if (!tokenResponse.ok) {
    return jsonResponse({ error: 'Failed to exchange OAuth code' }, 400);
  }
  
  const tokenData = await tokenResponse.json() as { 
    access_token: string; 
    id_token: string;
  };
  
  // Fetch user info from Google
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  
  if (!userInfoResponse.ok) {
    return jsonResponse({ error: 'Failed to fetch user info' }, 400);
  }
  
  const googleUser = await userInfoResponse.json() as {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
  
  // Create or update user in database
  const userId = await createOrUpdateUser(env, googleUser);
  
  // ============================================================================
  // JWT TOKEN CREATION - Server-side only!
  // ============================================================================
  const { accessToken, refreshToken } = await createSession(env, userId, request);
  
  // Log successful login
  await logAuditEvent(env, userId, 'login', request);
  
  // Set cookies and redirect
  const headers = new Headers();
  headers.set('Location', stateRecord.redirect_url);
  
  // Access token: 15 minutes, httpOnly, Secure, SameSite=Strict
  headers.append('Set-Cookie', `auth_token=${accessToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=900; Path=/`);
  
  // Refresh token: 7 days, httpOnly, Secure, SameSite=Strict
  // Path is restricted to /api/auth to limit exposure
  headers.append('Set-Cookie', `refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/api/auth`);
  
  // Clear OAuth cookies
  headers.append('Set-Cookie', 'oauth_code_verifier=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/api/auth');
  
  return new Response(null, { status: 302, headers });
}

/**
 * Create or update user from Google OAuth data
 */
async function createOrUpdateUser(env: Env, googleUser: {
  id: string;
  email: string;
  name: string;
  picture?: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  // Check if user exists
  const existingUser = await env.DB.prepare(
    'SELECT id FROM users WHERE google_id = ? OR email = ?'
  ).bind(googleUser.id, googleUser.email).first<{ id: string }>();
  
  if (existingUser) {
    // Update existing user
    await env.DB.prepare(
      'UPDATE users SET name = ?, avatar_url = ?, last_login_at = ?, updated_at = ?, google_id = ? WHERE id = ?'
    ).bind(
      googleUser.name,
      googleUser.picture || null,
      now,
      now,
      googleUser.id,
      existingUser.id
    ).run();
    
    return existingUser.id;
  }
  
  // Create new user
  const userId = generateSecureId(32);
  
  await env.DB.prepare(
    'INSERT INTO users (id, email, google_id, name, avatar_url, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    userId,
    googleUser.email,
    googleUser.id,
    googleUser.name,
    googleUser.picture || null,
    now,
    now,
    now
  ).run();
  
  // Create free tier subscription
  await env.DB.prepare(
    'INSERT INTO subscriptions (id, user_id, status, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(generateSecureId(32), userId, 'active', 'free', now, now).run();
  
  return userId;
}

/**
 * Create session with JWT tokens
 * Access token: 15 minutes
 * Refresh token: 7 days (stored as hash in DB)
 */
async function createSession(env: Env, userId: string, request: Request): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const now = Math.floor(Date.now() / 1000);
  
  // ============================================================================
  // ACCESS TOKEN: 15 minutes expiry
  // ============================================================================
  const accessToken = await createJWT({
    sub: userId,
    type: 'access',
    iat: now,
    exp: now + 900, // 15 minutes
  }, env.JWT_SECRET);
  
  // ============================================================================
  // REFRESH TOKEN: 7 days expiry
  // Raw token sent to client (in httpOnly cookie)
  // Hash stored in database (never store raw refresh token!)
  // ============================================================================
  const refreshTokenRaw = generateSecureId(64);
  const refreshTokenHash = await hashToken(refreshTokenRaw);
  
  // Store refresh token hash in database
  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at, user_agent, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(
    refreshTokenHash,
    userId,
    now + 604800, // 7 days
    now,
    request.headers.get('User-Agent') || 'Unknown',
    request.headers.get('CF-Connecting-IP') || 'Unknown'
  ).run();
  
  return { accessToken, refreshToken: refreshTokenRaw };
}

/**
 * Refresh access token using refresh token
 * Client sends refresh_token cookie, we verify and issue new access token
 */
export async function handleRefreshToken(env: Env, request: Request): Promise<Response> {
  const cookieHeader = request.headers.get('Cookie') || '';
  const refreshToken = extractCookieValue(cookieHeader, 'refresh_token');
  
  if (!refreshToken) {
    return jsonResponse({ error: 'No refresh token provided' }, 401);
  }
  
  // Hash the provided refresh token
  const tokenHash = await hashToken(refreshToken);
  
  // Check if token exists and is not revoked
  const session = await env.DB.prepare(
    'SELECT user_id, expires_at, revoked_at FROM sessions WHERE id = ?'
  ).bind(tokenHash).first<{ user_id: string; expires_at: number; revoked_at: number | null }>();
  
  if (!session || session.revoked_at || session.expires_at < Math.floor(Date.now() / 1000)) {
    return jsonResponse({ error: 'Invalid or expired refresh token' }, 401);
  }
  
  // Issue new access token (15 minutes)
  const now = Math.floor(Date.now() / 1000);
  const newAccessToken = await createJWT({
    sub: session.user_id,
    type: 'access',
    iat: now,
    exp: now + 900,
  }, env.JWT_SECRET);
  
  // Set new cookie
  const headers = new Headers();
  headers.set('Set-Cookie', `auth_token=${newAccessToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=900; Path=/`);
  
  return jsonResponse({ success: true }, 200, headers);
}

/**
 * Logout - revoke refresh token
 * Sets revoked_at timestamp in database
 */
export async function handleLogout(env: Env, request: Request): Promise<Response> {
  const cookieHeader = request.headers.get('Cookie') || '';
  const refreshToken = extractCookieValue(cookieHeader, 'refresh_token');
  
  if (refreshToken) {
    // Hash and revoke the refresh token
    const tokenHash = await hashToken(refreshToken);
    await env.DB.prepare(
      'UPDATE sessions SET revoked_at = ? WHERE id = ?'
    ).bind(Math.floor(Date.now() / 1000), tokenHash).run();
  }
  
  // Clear both cookies
  const headers = new Headers();
  headers.append('Set-Cookie', 'auth_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/');
  headers.append('Set-Cookie', 'refresh_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/api/auth');
  
  return jsonResponse({ success: true }, 200, headers);
}

/**
 * Verify authentication middleware
 * Checks auth_token cookie, verifies JWT signature and expiry
 */
export async function verifyAuth(env: Env, request: Request): Promise<{ userId: string; email: string } | null> {
  const cookieHeader = request.headers.get('Cookie') || '';
  const token = extractCookieValue(cookieHeader, 'auth_token');
  
  if (!token) return null;
  
  try {
    // Verify JWT (checks signature AND expiration)
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload || payload.type !== 'access') return null;
    
    // Get user info
    const user = await env.DB.prepare(
      'SELECT id, email FROM users WHERE id = ?'
    ).bind(payload.sub).first<{ id: string; email: string }>();
    
    if (!user) return null;
    
    return { userId: user.id, email: user.email };
  } catch {
    return null;
  }
}

/**
 * Get current user info
 */
export async function handleGetUser(env: Env, request: Request): Promise<Response> {
  const auth = await verifyAuth(env, request);
  
  if (!auth) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }
  
  const user = await env.DB.prepare(
    'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?'
  ).bind(auth.userId).first();
  
  if (!user) {
    return jsonResponse({ error: 'User not found' }, 404);
  }
  
  // Get subscription
  const subscription = await env.DB.prepare(
    'SELECT status, tier, current_period_end FROM subscriptions WHERE user_id = ?'
  ).bind(auth.userId).first();
  
  return jsonResponse({
    user,
    subscription: subscription || { status: 'active', tier: 'free' },
  });
}

// ============================================================================
// Helpers
// ============================================================================

async function hashCodeVerifier(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64 = btoa(String.fromCharCode(...hashArray));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function extractCookieValue(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
}

function jsonResponse(data: unknown, status: number = 200, headers?: Headers): Response {
  const responseHeaders = headers || new Headers();
  responseHeaders.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
}

async function logAuditEvent(env: Env, userId: string, eventType: string, request: Request): Promise<void> {
  try {
    await env.DB.prepare(
      'INSERT INTO audit_log (user_id, event_type, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(
      userId,
      eventType,
      request.headers.get('CF-Connecting-IP') || 'Unknown',
      request.headers.get('User-Agent') || 'Unknown',
      Math.floor(Date.now() / 1000)
    ).run();
  } catch {
    // Silent fail for audit logs
  }
}
