-- ============================================================================
-- Migration 028: fn_rename_key – Editable keys with cascading updates across schema
-- Supports dry-run analysis and transactional rename for all entity keys:
-- product, prep_chart, prep_chart_column, statement, stg_column, ts_column, rule, dairy.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_rename_key(
  p_scope text,
  p_old text,
  p_new text,
  p_context jsonb DEFAULT '{}'::jsonb,
  p_dry_run boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old text := trim(p_old);
  v_new text := trim(p_new);
  v_counts jsonb := '{}'::jsonb;
  v_c integer := 0;
  v_chart_key text := p_context->>'chart_key';
BEGIN
  -- 1. Common Validation
  IF v_old IS NULL OR v_old = '' THEN
    RAISE EXCEPTION 'Current/old key cannot be empty.';
  END IF;

  IF v_new IS NULL OR v_new = '' THEN
    RAISE EXCEPTION 'New key cannot be empty.';
  END IF;

  IF v_old = v_new THEN
    RAISE EXCEPTION 'Old key and new key cannot be identical ("%").', v_old;
  END IF;

  -- Keys other than dairy destination names must follow snake_case identifier format
  IF p_scope <> 'dairy' AND NOT (v_new ~ '^[a-z][a-z0-9_]*$') THEN
    RAISE EXCEPTION 'Key "%" must start with a lowercase letter and contain only lowercase letters, numbers, and underscores.', v_new;
  END IF;

  -- 2. Scope-specific Cascade Processing
  CASE p_scope

    -- ──────────────────────────────────────────────────────────────────────────
    -- Scope: product (products_master.product_key)
    -- ──────────────────────────────────────────────────────────────────────────
    WHEN 'product' THEN
      SELECT count(*) INTO v_c FROM public.products_master WHERE product_key = v_old;
      IF v_c = 0 THEN
        RAISE EXCEPTION 'Product key "%" not found in products_master.', v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.products_master WHERE product_key = v_new;
      IF v_c > 0 THEN
        RAISE EXCEPTION 'Product key "%" already exists in products_master.', v_new;
      END IF;

      -- products_master
      v_counts := jsonb_set(v_counts, '{products_master}', '1'::jsonb);
      IF NOT p_dry_run THEN
        UPDATE public.products_master SET product_key = v_new WHERE product_key = v_old;
      END IF;

      -- stock_rows
      SELECT count(*) INTO v_c FROM public.stock_rows WHERE entry_json ? v_old;
      v_counts := jsonb_set(v_counts, '{stock_rows}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stock_rows
        SET entry_json = (entry_json - v_old) || jsonb_build_object(v_new, entry_json -> v_old)
        WHERE entry_json ? v_old;
      END IF;

      -- stock_summary_rows
      SELECT count(*) INTO v_c FROM public.stock_summary_rows WHERE summary_data ? v_old;
      v_counts := jsonb_set(v_counts, '{stock_summary_rows}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stock_summary_rows
        SET summary_data = (summary_data - v_old) || jsonb_build_object(v_new, summary_data -> v_old)
        WHERE summary_data ? v_old;
      END IF;

      -- statement_mapping_rules
      SELECT count(*) INTO v_c FROM public.statement_mapping_rules WHERE stock_product_key = v_old;
      v_counts := jsonb_set(v_counts, '{statement_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.statement_mapping_rules SET stock_product_key = v_new WHERE stock_product_key = v_old;
      END IF;

      -- receipt_partition_mappings
      SELECT count(*) INTO v_c FROM public.receipt_partition_mappings
      WHERE target_receipt_product_key = v_old OR partitions::text LIKE '%' || v_old || '%';
      v_counts := jsonb_set(v_counts, '{receipt_partition_mappings}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.receipt_partition_mappings
        SET target_receipt_product_key = CASE WHEN target_receipt_product_key = v_old THEN v_new ELSE target_receipt_product_key END,
            partitions = CASE
              WHEN partitions IS NOT NULL AND jsonb_typeof(partitions) = 'array' THEN
                (SELECT jsonb_agg(
                  CASE
                    WHEN elem->>'targetReceiptProductKey' = v_old THEN jsonb_set(elem, '{targetReceiptProductKey}', to_jsonb(v_new))
                    ELSE elem
                  END
                ) FROM jsonb_array_elements(partitions) elem)
              ELSE partitions
            END
        WHERE target_receipt_product_key = v_old OR partitions::text LIKE '%' || v_old || '%';
      END IF;

      -- prep_to_stock_mapping_rules
      SELECT count(*) INTO v_c FROM public.prep_to_stock_mapping_rules WHERE target_product_key = v_old;
      v_counts := jsonb_set(v_counts, '{prep_to_stock_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.prep_to_stock_mapping_rules SET target_product_key = v_new WHERE target_product_key = v_old;
      END IF;

      -- app_settings (shift_config.products)
      SELECT count(*) INTO v_c FROM public.app_settings
      WHERE key = 'shift_config' AND value::text LIKE '%' || v_old || '%';
      v_counts := jsonb_set(v_counts, '{app_settings}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.app_settings
        SET value = replace(value::text, '"' || v_old || '"', '"' || v_new || '"')::jsonb
        WHERE key = 'shift_config' AND value::text LIKE '%' || v_old || '%';
      END IF;

      -- ts_milk_rows
      SELECT count(*) INTO v_c FROM public.ts_milk_rows WHERE product = v_old;
      v_counts := jsonb_set(v_counts, '{ts_milk_rows}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.ts_milk_rows SET product = v_new WHERE product = v_old;
      END IF;

    -- ──────────────────────────────────────────────────────────────────────────
    -- Scope: prep_chart (chart_key)
    -- ──────────────────────────────────────────────────────────────────────────
    WHEN 'prep_chart' THEN
      SELECT count(*) INTO v_c FROM public.prep_chart_configs
      WHERE config_key = 'masters' AND config_json::text LIKE '%' || v_old || '%';
      IF v_c = 0 THEN
        SELECT count(*) INTO v_c FROM public.prep_chart_entries WHERE chart_key = v_old;
      END IF;
      IF v_c = 0 THEN
        RAISE EXCEPTION 'Preparation chart key "%" not found.', v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.prep_chart_configs
      WHERE config_key = 'masters' AND config_json::text LIKE '%' || v_new || '%';
      IF v_c > 0 THEN
        RAISE EXCEPTION 'Preparation chart key "%" already exists in masters config.', v_new;
      END IF;

      -- prep_chart_configs (masters & templates)
      SELECT count(*) INTO v_c FROM public.prep_chart_configs
      WHERE (config_key = 'masters' OR config_key = 'templates') AND config_json::text LIKE '%' || v_old || '%';
      v_counts := jsonb_set(v_counts, '{prep_chart_configs}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        -- Update masters array
        UPDATE public.prep_chart_configs
        SET config_json = (
          SELECT jsonb_agg(
            CASE
              WHEN elem->>'key' = v_old THEN jsonb_set(elem, '{key}', to_jsonb(v_new))
              ELSE elem
            END
          )
          FROM jsonb_array_elements(config_json) elem
        )
        WHERE config_key = 'masters' AND config_json::text LIKE '%' || v_old || '%';

        -- Update templates object
        UPDATE public.prep_chart_configs
        SET config_json = (config_json - v_old) || jsonb_build_object(v_new, config_json -> v_old)
        WHERE config_key = 'templates' AND config_json ? v_old;
      END IF;

      -- prep_chart_entries
      SELECT count(*) INTO v_c FROM public.prep_chart_entries WHERE chart_key = v_old;
      v_counts := jsonb_set(v_counts, '{prep_chart_entries}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.prep_chart_entries SET chart_key = v_new WHERE chart_key = v_old;
      END IF;

      -- prep_to_stock_mapping_rules
      SELECT count(*) INTO v_c FROM public.prep_to_stock_mapping_rules WHERE source_chart_key = v_old;
      v_counts := jsonb_set(v_counts, '{prep_to_stock_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.prep_to_stock_mapping_rules SET source_chart_key = v_new WHERE source_chart_key = v_old;
      END IF;

    -- ──────────────────────────────────────────────────────────────────────────
    -- Scope: prep_chart_column (column key inside prep chart)
    -- ──────────────────────────────────────────────────────────────────────────
    WHEN 'prep_chart_column' THEN
      -- prep_chart_configs
      SELECT count(*) INTO v_c FROM public.prep_chart_configs
      WHERE config_json::text LIKE '%' || v_old || '%';
      v_counts := jsonb_set(v_counts, '{prep_chart_configs}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        -- update columns list
        UPDATE public.prep_chart_configs
        SET config_json = (
          SELECT jsonb_agg(
            CASE
              WHEN elem->>'key' = v_old THEN jsonb_set(elem, '{key}', to_jsonb(v_new))
              ELSE elem
            END
          )
          FROM jsonb_array_elements(config_json) elem
        )
        WHERE config_key = 'columns' AND config_json::text LIKE '%' || v_old || '%';

        -- update templates JSON
        UPDATE public.prep_chart_configs
        SET config_json = replace(config_json::text, '"' || v_old || '"', '"' || v_new || '"')::jsonb
        WHERE config_key = 'templates' AND config_json::text LIKE '%' || v_old || '%';
      END IF;

      -- prep_chart_entries
      IF v_chart_key IS NOT NULL AND v_chart_key <> '' THEN
        SELECT count(*) INTO v_c FROM public.prep_chart_entries WHERE chart_key = v_chart_key AND entry_json ? v_old;
      ELSE
        SELECT count(*) INTO v_c FROM public.prep_chart_entries WHERE entry_json ? v_old;
      END IF;
      v_counts := jsonb_set(v_counts, '{prep_chart_entries}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        IF v_chart_key IS NOT NULL AND v_chart_key <> '' THEN
          UPDATE public.prep_chart_entries
          SET entry_json = (entry_json - v_old) || jsonb_build_object(v_new, entry_json -> v_old)
          WHERE chart_key = v_chart_key AND entry_json ? v_old;
        ELSE
          UPDATE public.prep_chart_entries
          SET entry_json = (entry_json - v_old) || jsonb_build_object(v_new, entry_json -> v_old)
          WHERE entry_json ? v_old;
        END IF;
      END IF;

      -- prep_to_stock_mapping_rules
      SELECT count(*) INTO v_c FROM public.prep_to_stock_mapping_rules WHERE source_col_key = v_old;
      v_counts := jsonb_set(v_counts, '{prep_to_stock_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.prep_to_stock_mapping_rules SET source_col_key = v_new WHERE source_col_key = v_old;
      END IF;

    -- ──────────────────────────────────────────────────────────────────────────
    -- Scope: statement (stg_masters.key / ts_masters.key)
    -- ──────────────────────────────────────────────────────────────────────────
    WHEN 'statement' THEN
      SELECT count(*) INTO v_c FROM public.stg_masters WHERE key = v_old;
      SELECT count(*) INTO v_c FROM public.ts_masters WHERE key = v_old;
      IF (SELECT count(*) FROM public.stg_masters WHERE key = v_old) = 0
         AND (SELECT count(*) FROM public.ts_masters WHERE key = v_old) = 0 THEN
        RAISE EXCEPTION 'Statement key "%" not found in stg_masters or ts_masters.', v_old;
      END IF;

      IF (SELECT count(*) FROM public.stg_masters WHERE key = v_new) > 0
         OR (SELECT count(*) FROM public.ts_masters WHERE key = v_new) > 0 THEN
        RAISE EXCEPTION 'Statement key "%" already exists.', v_new;
      END IF;

      -- stg_masters
      SELECT count(*) INTO v_c FROM public.stg_masters WHERE key = v_old;
      v_counts := jsonb_set(v_counts, '{stg_masters}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stg_masters SET key = v_new WHERE key = v_old;
      END IF;

      -- ts_masters
      SELECT count(*) INTO v_c FROM public.ts_masters WHERE key = v_old;
      v_counts := jsonb_set(v_counts, '{ts_masters}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.ts_masters SET key = v_new WHERE key = v_old;
      END IF;

      -- stg_reconciliation_entries
      SELECT count(*) INTO v_c FROM public.stg_reconciliation_entries WHERE statement_key = v_old;
      v_counts := jsonb_set(v_counts, '{stg_reconciliation_entries}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stg_reconciliation_entries SET statement_key = v_new WHERE statement_key = v_old;
      END IF;

      -- stg_to_ts_mapping_rules
      SELECT count(*) INTO v_c FROM public.stg_to_ts_mapping_rules WHERE source_statement_key = v_old;
      v_counts := jsonb_set(v_counts, '{stg_to_ts_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stg_to_ts_mapping_rules SET source_statement_key = v_new WHERE source_statement_key = v_old;
      END IF;

      -- statement_mapping_rules
      SELECT count(*) INTO v_c FROM public.statement_mapping_rules WHERE stg_block_key = v_old;
      v_counts := jsonb_set(v_counts, '{statement_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.statement_mapping_rules SET stg_block_key = v_new WHERE stg_block_key = v_old;
      END IF;

    -- ──────────────────────────────────────────────────────────────────────────
    -- Scope: stg_column / ts_column
    -- ──────────────────────────────────────────────────────────────────────────
    WHEN 'stg_column', 'ts_column' THEN
      -- stg_masters (ob_columns, receipt_columns, disposal_columns, recon_columns)
      SELECT count(*) INTO v_c FROM public.stg_masters
      WHERE ob_columns::text LIKE '%' || v_old || '%'
         OR receipt_columns::text LIKE '%' || v_old || '%'
         OR disposal_columns::text LIKE '%' || v_old || '%'
         OR recon_columns::text LIKE '%' || v_old || '%';
      v_counts := jsonb_set(v_counts, '{stg_masters}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stg_masters
        SET ob_columns = replace(ob_columns::text, '"' || v_old || '"', '"' || v_new || '"')::jsonb,
            receipt_columns = replace(receipt_columns::text, '"' || v_old || '"', '"' || v_new || '"')::jsonb,
            disposal_columns = replace(disposal_columns::text, '"' || v_old || '"', '"' || v_new || '"')::jsonb,
            recon_columns = replace(recon_columns::text, '"' || v_old || '"', '"' || v_new || '"')::jsonb;
      END IF;

      -- ts_masters (columns)
      SELECT count(*) INTO v_c FROM public.ts_masters WHERE columns::text LIKE '%' || v_old || '%';
      v_counts := jsonb_set(v_counts, '{ts_masters}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.ts_masters
        SET columns = replace(columns::text, '"' || v_old || '"', '"' || v_new || '"')::jsonb
        WHERE columns::text LIKE '%' || v_old || '%';
      END IF;

      -- stg_rows (row_json)
      SELECT count(*) INTO v_c FROM public.stg_rows WHERE row_json ? v_old;
      v_counts := jsonb_set(v_counts, '{stg_rows}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stg_rows
        SET row_json = (row_json - v_old) || jsonb_build_object(v_new, row_json -> v_old)
        WHERE row_json ? v_old;
      END IF;

      -- ts_milk_rows (row_json)
      SELECT count(*) INTO v_c FROM public.ts_milk_rows WHERE row_json ? v_old;
      v_counts := jsonb_set(v_counts, '{ts_milk_rows}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.ts_milk_rows
        SET row_json = (row_json - v_old) || jsonb_build_object(v_new, row_json -> v_old)
        WHERE row_json ? v_old;
      END IF;

      -- stg_reconciliation_entries (summary_json)
      SELECT count(*) INTO v_c FROM public.stg_reconciliation_entries WHERE summary_json ? v_old;
      v_counts := jsonb_set(v_counts, '{stg_reconciliation_entries}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stg_reconciliation_entries
        SET summary_json = (summary_json - v_old) || jsonb_build_object(v_new, summary_json -> v_old)
        WHERE summary_json ? v_old;
      END IF;

      -- statement_mapping_rules (stg_target_field)
      SELECT count(*) INTO v_c FROM public.statement_mapping_rules WHERE stg_target_field = v_old;
      v_counts := jsonb_set(v_counts, '{statement_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.statement_mapping_rules SET stg_target_field = v_new WHERE stg_target_field = v_old;
      END IF;

      -- stg_to_ts_mapping_rules (source_field & target_field)
      SELECT count(*) INTO v_c FROM public.stg_to_ts_mapping_rules WHERE source_field = v_old OR target_field = v_old;
      v_counts := jsonb_set(v_counts, '{stg_to_ts_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stg_to_ts_mapping_rules
        SET source_field = CASE WHEN source_field = v_old THEN v_new ELSE source_field END,
            target_field = CASE WHEN target_field = v_old THEN v_new ELSE target_field END
        WHERE source_field = v_old OR target_field = v_old;
      END IF;

    -- ──────────────────────────────────────────────────────────────────────────
    -- Scope: rule (rule_key)
    -- ──────────────────────────────────────────────────────────────────────────
    WHEN 'rule' THEN
      -- statement_mapping_rules
      SELECT count(*) INTO v_c FROM public.statement_mapping_rules WHERE rule_key = v_old;
      v_counts := jsonb_set(v_counts, '{statement_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.statement_mapping_rules SET rule_key = v_new WHERE rule_key = v_old;
      END IF;

      -- prep_to_stock_mapping_rules
      SELECT count(*) INTO v_c FROM public.prep_to_stock_mapping_rules WHERE rule_key = v_old;
      v_counts := jsonb_set(v_counts, '{prep_to_stock_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.prep_to_stock_mapping_rules SET rule_key = v_new WHERE rule_key = v_old;
      END IF;

      -- stg_to_ts_mapping_rules
      SELECT count(*) INTO v_c FROM public.stg_to_ts_mapping_rules WHERE rule_key = v_old;
      v_counts := jsonb_set(v_counts, '{stg_to_ts_mapping_rules}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stg_to_ts_mapping_rules SET rule_key = v_new WHERE rule_key = v_old;
      END IF;

    -- ──────────────────────────────────────────────────────────────────────────
    -- Scope: dairy (dairy_destinations_master.dairy_name)
    -- ──────────────────────────────────────────────────────────────────────────
    WHEN 'dairy' THEN
      SELECT count(*) INTO v_c FROM public.dairy_destinations_master WHERE dairy_name = v_old;
      IF v_c = 0 THEN
        RAISE EXCEPTION 'Dairy destination "%" not found in dairy_destinations_master.', v_old;
      END IF;

      SELECT count(*) INTO v_c FROM public.dairy_destinations_master WHERE dairy_name = v_new;
      IF v_c > 0 THEN
        RAISE EXCEPTION 'Dairy destination "%" already exists in dairy_destinations_master.', v_new;
      END IF;

      -- dairy_destinations_master
      v_counts := jsonb_set(v_counts, '{dairy_destinations_master}', '1'::jsonb);
      IF NOT p_dry_run THEN
        UPDATE public.dairy_destinations_master SET dairy_name = v_new WHERE dairy_name = v_old;
      END IF;

      -- receipt_partition_mappings
      SELECT count(*) INTO v_c FROM public.receipt_partition_mappings WHERE partitions::text LIKE '%' || v_old || '%';
      v_counts := jsonb_set(v_counts, '{receipt_partition_mappings}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.receipt_partition_mappings
        SET partitions = replace(partitions::text, '"' || v_old || '"', '"' || v_new || '"')::jsonb
        WHERE partitions::text LIKE '%' || v_old || '%';
      END IF;

      -- stock_rows
      SELECT count(*) INTO v_c FROM public.stock_rows WHERE entry_json ? v_old;
      v_counts := jsonb_set(v_counts, '{stock_rows}', to_jsonb(v_c));
      IF NOT p_dry_run AND v_c > 0 THEN
        UPDATE public.stock_rows
        SET entry_json = (entry_json - v_old) || jsonb_build_object(v_new, entry_json -> v_old)
        WHERE entry_json ? v_old;
      END IF;

    ELSE
      RAISE EXCEPTION 'Unknown key rename scope "%". Valid scopes: product, prep_chart, prep_chart_column, statement, stg_column, ts_column, rule, dairy.', p_scope;
  END CASE;

  RETURN v_counts;
END;
$$;

