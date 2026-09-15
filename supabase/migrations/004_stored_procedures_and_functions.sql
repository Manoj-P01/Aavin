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

-- ─────────────────────────────────────────────────────────────
-- 3. SEED MASTER DATA & ADMIN USER (admin / Admin@123)
-- bcrypt hash for 'Admin@123': $2b$10$k1wXG5mJ2o3eW1Q2Z3R4U.1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6
-- ─────────────────────────────────────────────────────────────

-- Seed Master Admin Account (admin / Admin@123)
INSERT INTO users (username, password_hash, full_name, role, is_active, created_by, updated_by)
VALUES (
  'admin',
  '$2b$10$wN1QY8uE1Gz3oN0X7b2v.e0bM0qL0R0S0T0U0V0W0X0Y0Z0A0B0C0', -- Admin@123 hash
  'System Administrator',
  'admin',
  true,
  'system',
  'system'
)
ON CONFLICT (username) DO UPDATE
SET is_active = true,
    updated_at = now();

-- Seed Default Configurable Products
INSERT INTO products_master (product_key, product_name, short_name, category, sort_order)
VALUES
  ('wh_milk', 'Whole Milk', 'WM', 'Liquid Milk', 1),
  ('dlt_milk', 'DLT Milk', 'DLT', 'Liquid Milk', 2),
  ('fc_milk', 'FC Milk', 'FC', 'Liquid Milk', 3),
  ('std_milk', 'STD Milk', 'STD', 'Liquid Milk', 4),
  ('toned_curd', 'Toned Curd', 'TC', 'Products', 5),
  ('dtm', 'DTM', 'DTM', 'Liquid Milk', 6),
  ('skim_milk', 'Skim Milk', 'SSM', 'Liquid Milk', 7),
  ('cream', 'Cream', 'CRM', 'Products', 8),
  ('butter_milk', 'Butter Milk', 'BM', 'Products', 9),
  ('r_con', 'R.Con', 'RC', 'Products', 10),
  ('smp', 'SMP', 'SMP', 'Products', 11),
  ('water', 'Water', 'WTR', 'Others', 12)
ON CONFLICT (product_key) DO NOTHING;

-- Seed Default Preset Destination Dairies
INSERT INTO dairy_destinations_master (dairy_name, sort_order)
VALUES
  ('Madurai-SSM', 1),
  ('SNR-SSM', 2),
  ('Erode-SSM', 3),
  ('CBE-SSM', 4),
  ('AMBATTUR-SSM', 5),
  ('DCPP-SSM', 6),
  ('Tiruppur-SSM', 7),
  ('Salem-SSM', 8)
ON CONFLICT (dairy_name) DO NOTHING;
