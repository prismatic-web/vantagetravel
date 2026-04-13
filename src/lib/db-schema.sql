-- D1 Database Schema for Vantage Travel
-- Run this in Cloudflare Dashboard: Workers & Pages > D1 > [Your DB] > Console

-- Users table: Stores user accounts with Google OAuth
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                          -- UUID v4
  email TEXT UNIQUE NOT NULL,                   -- User email (verified by Google)
  google_id TEXT UNIQUE,                        -- Google OAuth ID
  name TEXT,                                    -- Display name
  avatar_url TEXT,                              -- Profile picture
  created_at INTEGER NOT NULL,                  -- Unix timestamp
  updated_at INTEGER NOT NULL,                  -- Unix timestamp
  last_login_at INTEGER                         -- Last successful login
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Subscriptions table: Tracks premium subscription status
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,                          -- UUID v4
  user_id TEXT NOT NULL,                        -- Reference to users.id
  stripe_customer_id TEXT UNIQUE,               -- Stripe customer ID
  stripe_subscription_id TEXT UNIQUE,           -- Stripe subscription ID
  status TEXT NOT NULL,                         -- 'active', 'canceled', 'past_due', 'unpaid'
  tier TEXT NOT NULL DEFAULT 'free',            -- 'free', 'pro', 'enterprise'
  current_period_start INTEGER,                 -- Unix timestamp
  current_period_end INTEGER,                 -- Unix timestamp
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- Sessions table: JWT refresh token storage (for revocation)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                          -- Refresh token hash (SHA-256)
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,                  -- Unix timestamp
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,                           -- If set, token is revoked
  user_agent TEXT,                              -- Browser/device info
  ip_address TEXT,                              -- IP that created session
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- OAuth states table: CSRF protection for OAuth flow
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,                       -- Random state parameter
  redirect_url TEXT,                            -- Where to redirect after auth
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL                   -- 10 minutes from creation
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

-- Password resets table: For email/password users (backup auth method)
CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,              -- SHA-256 of reset token
  expires_at INTEGER NOT NULL,                  -- 1 hour expiry
  used_at INTEGER,                              -- When token was used
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);

-- Audit log table: Security event tracking
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  event_type TEXT NOT NULL,                     -- 'login', 'logout', 'subscription_created', etc.
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,                                -- JSON blob with event details
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- API keys table: For future API access (enterprise users)
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,                -- SHA-256 of API key
  name TEXT,                                    -- User-friendly name
  scopes TEXT,                                  -- JSON array of permissions
  last_used_at INTEGER,
  expires_at INTEGER,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- Cleanup old expired sessions (run periodically)
DELETE FROM sessions WHERE expires_at < CAST(strftime('%s', 'now') AS INTEGER);
DELETE FROM oauth_states WHERE expires_at < CAST(strftime('%s', 'now') AS INTEGER);
DELETE FROM password_resets WHERE expires_at < CAST(strftime('%s', 'now') AS INTEGER);
