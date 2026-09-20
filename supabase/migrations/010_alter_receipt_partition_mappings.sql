-- ─────────────────────────────────────────────────────────────
-- 010_ALTER_RECEIPT_PARTITION_MAPPINGS.SQL
-- Ensure partitions and target_receipt_product_label columns exist
-- ─────────────────────────────────────────────────────────────

ALTER TABLE receipt_partition_mappings ADD COLUMN IF NOT EXISTS target_receipt_product_label text;
ALTER TABLE receipt_partition_mappings ADD COLUMN IF NOT EXISTS partitions jsonb;
