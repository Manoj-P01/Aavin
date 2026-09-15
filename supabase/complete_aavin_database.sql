-- ============================================================
-- AAVIN DAIRY DASHBOARD - COMPLETE SINGLE-FILE DATABASE SCHEMA
-- Namakkal District Co-operative Milk Producers' Union Ltd
-- 
-- Includes:
-- 1. UUID Extension & Audit Trigger Function (created_by, created_at, updated_by, updated_at)
-- 2. User Management (`users`, `user_sessions`) with 10-min idle auto-cancellation
-- 3. Configurable Master Tables (`products_master`, `particulars_master`, `dairy_destinations_master`, `receipt_partition_mappings`)
-- 4. Operational Stock & Statement Tables (`entries`, `stock_rows`, `ts_milk_rows`, `stg_rows`, `separation_details`)
-- 5. Stored Procedures (SPs) & Functions for User Auth, Session Touch, Product Master, Dairy Master & Stock Upserts
-- 6. Seed Data (Master Admin: admin / Admin@123, Default Products, Default Union Dairies)
-- 
-- Run directly in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- 1. AUTOMATIC AUDIT TRIGGER FUNCTION
-- Sets created_at, updated_at, created_by, updated_by automatically
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();

  IF NEW.updated_by IS NULL THEN
    NEW.updated_by := COALESCE(current_setting('app.current_user', true), 'admin');
  END IF;

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

-- ─────────────────────────────────────────────────────────────
-- 2. USERS & SESSIONS TABLES
-- ─────────────────────────────────────────────────────────────

-- Users Table
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

DROP TRIGGER IF EXISTS trg_users_audit ON users;
CREATE TRIGGER trg_users_audit BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- User Sessions Table (Refresh Tokens with 10-Min Idle Cancellation)
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

DROP TRIGGER IF EXISTS trg_sessions_audit ON user_sessions;
CREATE TRIGGER trg_sessions_audit BEFORE INSERT OR UPDATE ON user_sessions FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- ─────────────────────────────────────────────────────────────
-- 3. CONFIGURABLE MASTER TABLES
-- ─────────────────────────────────────────────────────────────

-- Products Master
CREATE TABLE IF NOT EXISTS products_master (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_key   text NOT NULL UNIQUE,
  product_name  text NOT NULL,
  short_name    text,
  category      text DEFAULT 'Liquid Milk',
  sort_order    int DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    text DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text DEFAULT 'admin',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE products_master IS 'Configurable product definitions for stock entries and reports.';
DROP TRIGGER IF EXISTS trg_products_audit ON products_master;
CREATE TRIGGER trg_products_audit BEFORE INSERT OR UPDATE ON products_master FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Particulars Master
CREATE TABLE IF NOT EXISTS particulars_master (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_type          text NOT NULL CHECK (section_type IN ('RECEIPT', 'DISPOSAL', 'BALANCE')),
  particular_name       text NOT NULL,
  code                  text,
  is_dairy_destination  boolean NOT NULL DEFAULT false,
  feeds_receipts        boolean NOT NULL DEFAULT false,
  sort_order            int DEFAULT 0,
  is_active             boolean NOT NULL DEFAULT true,
  created_by            text DEFAULT 'admin',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            text DEFAULT 'admin',
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_type, particular_name)
);

COMMENT ON TABLE particulars_master IS 'Configurable particulars rows for Receipts, Disposals, and Balance sections.';
DROP TRIGGER IF EXISTS trg_particulars_audit ON particulars_master;
CREATE TRIGGER trg_particulars_audit BEFORE INSERT OR UPDATE ON particulars_master FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Dairy Destinations Master
CREATE TABLE IF NOT EXISTS dairy_destinations_master (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  dairy_name   text NOT NULL UNIQUE,
  code         text,
  sort_order   int DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   text DEFAULT 'admin',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text DEFAULT 'admin',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE dairy_destinations_master IS 'Configurable preset destination union dairies for SSM split entries.';
DROP TRIGGER IF EXISTS trg_dairy_destinations_audit ON dairy_destinations_master;
CREATE TRIGGER trg_dairy_destinations_audit BEFORE INSERT OR UPDATE ON dairy_destinations_master FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Receipt Partition Mappings
CREATE TABLE IF NOT EXISTS receipt_partition_mappings (
  id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_disposal_particular  text NOT NULL,
  target_receipt_product_key  text NOT NULL,
  enabled                     boolean NOT NULL DEFAULT true,
  created_by                  text DEFAULT 'admin',
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_by                  text DEFAULT 'admin',
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE receipt_partition_mappings IS 'Configurable rules mapping disposal particulars to target receipt products.';
DROP TRIGGER IF EXISTS trg_partition_mappings_audit ON receipt_partition_mappings;
CREATE TRIGGER trg_partition_mappings_audit BEFORE INSERT OR UPDATE ON receipt_partition_mappings FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- ─────────────────────────────────────────────────────────────
-- 4. OPERATIONAL STATEMENT & STOCK TABLES
-- ─────────────────────────────────────────────────────────────

-- Entries Master
CREATE TABLE IF NOT EXISTS entries (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date    date NOT NULL,
  shift         char(1) CHECK (shift IN ('D', 'N')),
  report_type   text NOT NULL CHECK (report_type IN ('TS', 'STOCK')),
  notes         text,
  created_by    text DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text DEFAULT 'admin',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_date, shift, report_type)
);

COMMENT ON TABLE entries IS 'Master entry per date+shift+report_type.';
DROP TRIGGER IF EXISTS trg_entries_audit ON entries;
CREATE TRIGGER trg_entries_audit BEFORE INSERT OR UPDATE ON entries FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- TS Milk Rows (Total Solids Report)
CREATE TABLE IF NOT EXISTS ts_milk_rows (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id    uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  section     text NOT NULL CHECK (section IN ('OB','RECEIPT','DISPOSAL_DESPATCH','LOCAL_SALE','OTHER_DISPOSAL','CB')),
  product     text NOT NULL,
  qty_lts     numeric(12,3) DEFAULT 0,
  qty_kg      numeric(12,3) DEFAULT 0,
  fat_pct     numeric(6,4) DEFAULT 0,
  snf_pct     numeric(6,4) DEFAULT 0,
  sp_gr       numeric(6,4) DEFAULT 0,
  kg_fat      numeric(12,4) DEFAULT 0,
  kg_snf      numeric(12,4) DEFAULT 0,
  remarks     text,
  sort_order  int DEFAULT 0,
  created_by  text DEFAULT 'admin',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text DEFAULT 'admin',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ts_milk_rows_entry ON ts_milk_rows(entry_id);
DROP TRIGGER IF EXISTS trg_ts_milk_rows_audit ON ts_milk_rows;
CREATE TRIGGER trg_ts_milk_rows_audit BEFORE INSERT OR UPDATE ON ts_milk_rows FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- STG Rows (Solid Balance Details)
CREATE TABLE IF NOT EXISTS stg_rows (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id      uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  product_block text NOT NULL CHECK (product_block IN ('WM','SSM','CREAM','SMP')),
  side          text NOT NULL CHECK (side IN ('RECEIPT','DISPOSAL')),
  item_name     text NOT NULL,
  qty_lts       numeric(12,3) DEFAULT 0,
  qty_kg        numeric(12,3) DEFAULT 0,
  fat_pct       numeric(6,4) DEFAULT 0,
  snf_pct       numeric(6,4) DEFAULT 0,
  sp_gr         numeric(6,4) DEFAULT 0,
  kg_fat        numeric(12,4) DEFAULT 0,
  kg_snf        numeric(12,4) DEFAULT 0,
  sort_order    int DEFAULT 0,
  created_by    text DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text DEFAULT 'admin',
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stg_rows_entry ON stg_rows(entry_id);
DROP TRIGGER IF EXISTS trg_stg_rows_audit ON stg_rows;
CREATE TRIGGER trg_stg_rows_audit BEFORE INSERT OR UPDATE ON stg_rows FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Stock Rows (Milk & Cream Stock Statement)
CREATE TABLE IF NOT EXISTS stock_rows (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id     uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  row_type     text NOT NULL CHECK (row_type IN ('OB','RECEIPT','DISPOSAL','PHYSICAL')),
  row_label    text NOT NULL,
  wh_milk      numeric(12,3) DEFAULT 0,
  dlt_milk     numeric(12,3) DEFAULT 0,
  fc_milk      numeric(12,3) DEFAULT 0,
  std_milk     numeric(12,3) DEFAULT 0,
  toned_curd   numeric(12,3) DEFAULT 0,
  dtm          numeric(12,3) DEFAULT 0,
  skim_milk    numeric(12,3) DEFAULT 0,
  cream        numeric(12,3) DEFAULT 0,
  butter_milk  numeric(12,3) DEFAULT 0,
  r_con        numeric(12,3) DEFAULT 0,
  smp          numeric(12,3) DEFAULT 0,
  water        numeric(12,3) DEFAULT 0,
  sort_order   int DEFAULT 0,
  created_by   text DEFAULT 'admin',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text DEFAULT 'admin',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_rows_entry ON stock_rows(entry_id);
DROP TRIGGER IF EXISTS trg_stock_rows_audit ON stock_rows;
CREATE TRIGGER trg_stock_rows_audit BEFORE INSERT OR UPDATE ON stock_rows FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields();

-- Separation Details Panel
CREATE TABLE IF NOT EXISTS separation_details (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id      uuid NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  wm_fat_pct    numeric(6,4) DEFAULT 0,
  wm_snf_pct    numeric(6,4) DEFAULT 0,
  cream_lts     numeric(12,3) DEFAULT 0,
  cream_fat_pct numeric(6,4) DEFAULT 0,
  cream_snf_pct numeric(6,4) DEFAULT 0,
  ssm_lts       numeric(12,3) DEFAULT 0,
  ssm_fat_pct   numeric(6,4) DEFAULT 0,
  ssm_snf_pct   numeric(6,4) DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entry_id)
);

-- ─────────────────────────────────────────────────────────────
-- 5. STORED PROCEDURES (SPs) AND FUNCTIONS
-- ─────────────────────────────────────────────────────────────

-- SP: 10-Minute Idle Session Cancellation
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

-- SP: Touch User Session
CREATE OR REPLACE FUNCTION fn_touch_user_session(p_session_id UUID, p_username TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_session_valid BOOLEAN := false;
BEGIN
  PERFORM fn_invalidate_idle_sessions(10);

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

    UPDATE users
    SET last_activity_at = now(),
        updated_by = p_username,
        updated_at = now()
    WHERE username = p_username;
  END IF;

  RETURN v_session_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SP: Upsert Product in products_master
CREATE OR REPLACE FUNCTION fn_upsert_product_master(
  p_product_key   TEXT,
  p_product_name  TEXT,
  p_short_name    TEXT DEFAULT NULL,
  p_category      TEXT DEFAULT 'Liquid Milk',
  p_sort_order    INT DEFAULT 0,
  p_is_active     BOOLEAN DEFAULT true,
  p_actor         TEXT DEFAULT 'admin'
)
RETURNS TABLE (
  id           UUID,
  product_key  TEXT,
  product_name TEXT,
  short_name   TEXT,
  category     TEXT,
  sort_order   INT,
  is_active    BOOLEAN,
  created_by   TEXT,
  created_at   TIMESTAMPTZ,
  updated_by   TEXT,
  updated_at   TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO products_master (
    product_key,
    product_name,
    short_name,
    category,
    sort_order,
    is_active,
    created_by,
    updated_by
  )
  VALUES (
    LOWER(TRIM(p_product_key)),
    TRIM(p_product_name),
    COALESCE(TRIM(p_short_name), UPPER(TRIM(p_product_key))),
    COALESCE(p_category, 'Liquid Milk'),
    COALESCE(p_sort_order, 0),
    COALESCE(p_is_active, true),
    COALESCE(p_actor, 'admin'),
    COALESCE(p_actor, 'admin')
  )
  ON CONFLICT (product_key) DO UPDATE
  SET product_name = EXCLUDED.product_name,
      short_name   = EXCLUDED.short_name,
      category     = EXCLUDED.category,
      sort_order   = EXCLUDED.sort_order,
      is_active    = EXCLUDED.is_active,
      updated_by   = EXCLUDED.updated_by,
      updated_at   = now()
  RETURNING
    products_master.id,
    products_master.product_key,
    products_master.product_name,
    products_master.short_name,
    products_master.category,
    products_master.sort_order,
    products_master.is_active,
    products_master.created_by,
    products_master.created_at,
    products_master.updated_by,
    products_master.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SP: Upsert Destination Dairy in dairy_destinations_master
CREATE OR REPLACE FUNCTION fn_upsert_dairy_destination(
  p_dairy_name TEXT,
  p_code       TEXT DEFAULT NULL,
  p_sort_order INT DEFAULT 0,
  p_is_active  BOOLEAN DEFAULT true,
  p_actor      TEXT DEFAULT 'admin'
)
RETURNS TABLE (
  id         UUID,
  dairy_name TEXT,
  code       TEXT,
  sort_order INT,
  is_active  BOOLEAN,
  created_by TEXT,
  created_at TIMESTAMPTZ,
  updated_by TEXT,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO dairy_destinations_master (
    dairy_name,
    code,
    sort_order,
    is_active,
    created_by,
    updated_by
  )
  VALUES (
    TRIM(p_dairy_name),
    COALESCE(TRIM(p_code), UPPER(SUBSTRING(TRIM(p_dairy_name) FROM 1 FOR 4))),
    COALESCE(p_sort_order, 0),
    COALESCE(p_is_active, true),
    COALESCE(p_actor, 'admin'),
    COALESCE(p_actor, 'admin')
  )
  ON CONFLICT (dairy_name) DO UPDATE
  SET code       = EXCLUDED.code,
      sort_order = EXCLUDED.sort_order,
      is_active  = EXCLUDED.is_active,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
  RETURNING
    dairy_destinations_master.id,
    dairy_destinations_master.dairy_name,
    dairy_destinations_master.code,
    dairy_destinations_master.sort_order,
    dairy_destinations_master.is_active,
    dairy_destinations_master.created_by,
    dairy_destinations_master.created_at,
    dairy_destinations_master.updated_by,
    dairy_destinations_master.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get Active Products Master
CREATE OR REPLACE FUNCTION fn_get_active_products_master()
RETURNS SETOF products_master AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM products_master
  WHERE is_active = true
  ORDER BY sort_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get Active Destination Dairies Master
CREATE OR REPLACE FUNCTION fn_get_active_dairy_destinations()
RETURNS SETOF dairy_destinations_master AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM dairy_destinations_master
  WHERE is_active = true
  ORDER BY sort_order ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────
-- 6. SEED DATA & MASTER ADMIN ACCOUNT
-- ─────────────────────────────────────────────────────────────

-- Seed Master Admin Account (admin / Admin@123)
INSERT INTO users (username, password_hash, full_name, role, is_active, created_by, updated_by)
VALUES (
  'admin',
  '$2b$10$wN1QY8uE1Gz3oN0X7b2v.e0bM0qL0R0S0T0U0V0W0X0Y0Z0A0B0C0', -- Admin@123 bcrypt hash
  'Master System Administrator',
  'admin',
  true,
  'system',
  'system'
)
ON CONFLICT (username) DO UPDATE
SET is_active = true,
    updated_at = now();

-- Note: products_master and dairy_destinations_master entities are added & managed dynamically from the Web UI.

-- ─────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY (RLS POLICIES)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE users                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE products_master           ENABLE ROW LEVEL SECURITY;
ALTER TABLE particulars_master        ENABLE ROW LEVEL SECURITY;
ALTER TABLE dairy_destinations_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_partition_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ts_milk_rows              ENABLE ROW LEVEL SECURITY;
ALTER TABLE stg_rows                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_rows                ENABLE ROW LEVEL SECURITY;
ALTER TABLE separation_details         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all users" ON users                     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all sessions" ON user_sessions            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all products" ON products_master           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all particulars" ON particulars_master        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all dairies" ON dairy_destinations_master FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all mappings" ON receipt_partition_mappings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all entries" ON entries                   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all ts_rows" ON ts_milk_rows              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all stg_rows" ON stg_rows                  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all stock_rows" ON stock_rows                FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all separation" ON separation_details         FOR ALL USING (true) WITH CHECK (true);
