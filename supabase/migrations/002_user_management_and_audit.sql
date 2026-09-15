-- ============================================================
-- 002_user_management_and_audit.sql
-- User Management, JWT Refresh Token Sessions, and Audit Triggers
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 1. USERS TABLE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username         text NOT NULL UNIQUE,
  password_hash    text NOT NULL,
  full_name        text NOT NULL,
  role             text NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'viewer')),
  is_active        boolean NOT NULL DEFAULT true,
  last_activity_at timestamptz DEFAULT now(),
  created_by       text DEFAULT 'admin',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       text DEFAULT 'admin',
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS 'User accounts with role-based permissions and activity tracking.';
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ─────────────────────────────────────────────────────────────
-- 2. USER_SESSIONS TABLE (Refresh tokens with 10-min idle expiration)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash     text NOT NULL UNIQUE,
  expires_at     timestamptz NOT NULL,
  last_used_at   timestamptz NOT NULL DEFAULT now(),
  is_revoked     boolean NOT NULL DEFAULT false,
  ip_address     text,
  user_agent     text,
  created_by     text DEFAULT 'system',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     text DEFAULT 'system',
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_sessions IS 'Active refresh token sessions tracking last_used_at for 10-min idle cancellation.';
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash);

-- ─────────────────────────────────────────────────────────────
-- 3. AUTOMATIC AUDIT TRIGGER FUNCTION
-- Sets created_at, updated_at, created_by, updated_by automatically
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Always update updated_at timestamp
  NEW.updated_at = now();

  -- Set default fallback updated_by if missing
  IF NEW.updated_by IS NULL THEN
    NEW.updated_by := COALESCE(current_setting('app.current_user', true), 'admin');
  END IF;

  -- On INSERT, set created_at and created_by if missing
  IF (TG_OP = 'INSERT') THEN
    IF NEW.created_at IS NULL THEN
      NEW.created_at = now();
    END IF;
    IF NEW.created_by IS NULL THEN
      NEW.created_by = COALESCE(current_setting('app.current_user', true), 'admin');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Audit Trigger to Users and Sessions
DROP TRIGGER IF EXISTS trg_users_audit ON users;
CREATE TRIGGER trg_users_audit
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

DROP TRIGGER IF EXISTS trg_sessions_audit ON user_sessions;
CREATE TRIGGER trg_sessions_audit
  BEFORE INSERT OR UPDATE ON user_sessions
  FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();
