-- ============================================================
-- 004_stored_procedures_and_functions.sql
-- PL/pgSQL Functions, 10-Min Idle Session Cleanup SP & Seed Data
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. FUNCTION: Invalidate Sessions Idle for > 10 Minutes
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_invalidate_idle_sessions(p_max_idle_minutes INT DEFAULT 10)
RETURNS INT AS $$
DECLARE
  v_revoked_count INT;
BEGIN
  UPDATE user_sessions
  SET is_revoked = true,
      updated_at = now(),
      updated_by = 'system'
  WHERE is_revoked = false
    AND last_used_at < (now() - (p_max_idle_minutes || ' minutes')::INTERVAL);

  GET DIAGNOSTICS v_revoked_count = ROW_COUNT;
  RETURN v_revoked_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION fn_invalidate_idle_sessions IS 'Revokes active refresh token sessions that have been idle for more than 10 minutes.';

-- ─────────────────────────────────────────────────────────────
-- 2. FUNCTION: Record User Activity & Touch Session
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_touch_user_session(p_session_id UUID, p_username TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_session_valid BOOLEAN := false;
BEGIN
  -- First clean up any expired idle sessions (> 10 mins)
  PERFORM fn_invalidate_idle_sessions(10);

  -- Check if current session is active and not idle > 10 mins
  UPDATE user_sessions
  SET last_used_at = now(),
      updated_by = p_username,
      updated_at = now()
  WHERE id = p_session_id
    AND is_revoked = false
    AND expires_at > now()
    AND last_used_at >= (now() - INTERVAL '10 minutes');

  IF FOUND THEN
    v_session_valid := true;

    -- Update user last_activity_at
    UPDATE users
    SET last_activity_at = now(),
        updated_by = p_username,
        updated_at = now()
    WHERE username = p_username;
  END IF;

  RETURN v_session_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
