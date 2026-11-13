// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Solid Balance STG Mapping Configuration Page
// Configures mapping rules for Stage 1 (Preparation Charts) ➔ Stage 3 (Solid Balance STG)
// and Stage 2 (Stock Statement Entry) ➔ Stage 3 (Solid Balance STG)
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/layout/Header';
import Link from 'next/link';
import { useConfirm } from '@/context/ConfirmContext';

export interface MappingRule {
  id: string;
  sourceStage: 'STAGE_1' | 'STAGE_2'; // STAGE_1 = Prep Charts, STAGE_2 = Stock Entry
  stockProductKey: string; // Stock product key OR Prep chart master key
  stockProductLabel: string;
  stockSection: 'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB';
  stockParticular: string; // Variant name for STAGE_1, or Particular name for STAGE_2
  sourceVariant?: string;
  sourceField?: string;
  stgBlockKey: string;
  stgBlockLabel: string;
  stgSection: 'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB';
  stgItemName: string;
  stgTargetField: string;
}

const extractRowName = (r: any): string => {
  if (!r) return '';
  if (typeof r === 'string') {
    const s = r.trim();
    return (s === '-' || s.toUpperCase() === 'OB' || s.toUpperCase() === 'CB') ? '' : s;
  }
  const name =
    r.particular_name ||
    r.variant ||
    r.label ||
    r.particular ||
    r.item_name ||
    r.name ||
    r.values?.particular_name ||
    r.values?.variant ||
    r.values?.label ||
    r.values?.particular ||
    r.values?.item_name ||
    r.values?.receipt ||
    r.values?.disposal ||
    (r.values?.ob && String(r.values.ob).trim().toUpperCase() !== 'OB' ? r.values.ob : '') ||
    (r.values?.cb && String(r.values.cb).trim().toUpperCase() !== 'CB' ? r.values.cb : '') ||
    r.receipt ||
    r.disposal ||
    '';
  const s = String(name).trim();
  return (s === '-' || s.toUpperCase() === 'OB' || s.toUpperCase() === 'CB') ? '' : s;
};

export default function STGStatementMappingPage() {
  const [mappings, setMappings] = useState<MappingRule[]>([]);
  const [filterSource, setFilterSource] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [openStatements, setOpenStatements] = useState<Record<string, boolean>>({});

  const toggleStatement = (key: string) => {
    setOpenStatements(prev => ({
      ...prev,
      [key]: prev[key] === false ? true : false,
    }));
  };

  const handleExpandAll = () => {
    const allOpen: Record<string, boolean> = {};
    stgStatements.forEach(s => { allOpen[s.key] = true; });
    allOpen['__other__'] = true;
    setOpenStatements(allOpen);
  };

  const handleCollapseAll = () => {
    const allClosed: Record<string, boolean> = {};
    stgStatements.forEach(s => { allClosed[s.key] = false; });
    allClosed['__other__'] = false;
    setOpenStatements(allClosed);
  };

  const [stockProducts, setStockProducts] = useState<Array<{ key: string; label: string }>>([]);
  const [prepMasters, setPrepMasters] = useState<Array<{ key: string; label: string }>>([]);
  const [rawPrepMasters, setRawPrepMasters] = useState<any[]>([]);
  const [prepTemplates, setPrepTemplates] = useState<Record<string, any>>({});

  const [receiptRows, setReceiptRows] = useState<Array<{ full_name: string; short_name: string }>>([]);
  const [disposalRows, setDisposalRows] = useState<Array<{ full_name: string; short_name: string }>>([]);
  const [stgColumns, setStgColumns] = useState<Array<{ key: string; name: string }>>([]);
  const [stgStatements, setStgStatements] = useState<Array<{
    key: string;
    label: string;
    tables?: any[];
    ob_columns?: any[];
    receipt_columns?: any[];
    disposal_columns?: any[];
    cb_columns?: any[];
    recon_columns?: any[];
    ob_rows?: any[];
    receipt_rows?: any[];
    disposal_rows?: any[];
    reconciliation_rows?: any[];
    default_rows?: any[];
    rows?: any[];
  }>>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // STG Form modal state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [isCustomParticular, setIsCustomParticular] = useState(false);
  const [isCustomStgItem, setIsCustomStgItem] = useState(false);
  const [isCustomPrepVariant, setIsCustomPrepVariant] = useState(false);

  const [formSourceStage, setFormSourceStage] = useState<'STAGE_1' | 'STAGE_2'>('STAGE_1');
  const [formStockProductKey, setFormStockProductKey] = useState<string>('');
  const [formStockSection, setFormStockSection] = useState<'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB'>('RECEIPT');
  const [formStockParticular, setFormStockParticular] = useState<string>('');
  const [formSourceField, setFormSourceField] = useState<string>('qty_lts');
  const [prepColumns, setPrepColumns] = useState<Array<{ key: string; name: string }>>([]);
  const [stgFieldCatalog, setStgFieldCatalog] = useState<Array<{ field_key: string; label: string; data_type: string; is_identifier: boolean }>>([]);
  const [stgParticularsCatalog, setStgParticularsCatalog] = useState<Array<{ id: string; statement_key: string; section_key: string; particular_name: string }>>([]);

  const [formStgBlockKey, setFormStgBlockKey] = useState<string>('');
  const [formStgTargetField, setFormStgTargetField] = useState<string>('');
  const [formStgSection, setFormStgSection] = useState<'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB' | ''>('');
  const [formStgItemName, setFormStgItemName] = useState<string>('');

  const { confirm } = useConfirm();

  // Load configuration on mount
  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      setError('');
      try {
        // 1. Load stock products config from database
        const stockConfigRes = await fetch('/api/stock/config');
        if (stockConfigRes.ok) {
          const stockCfg = await stockConfigRes.json();
          if (Array.isArray(stockCfg.products) && stockCfg.products.length > 0) {
            if (active) {
              setStockProducts(stockCfg.products.map((p: any) => ({
                key: p.key || p.product_key,
                label: p.short_name || p.full_name || p.key,
              })));
            }
          }
          const recList = Array.isArray(stockCfg.receipt_rows) ? stockCfg.receipt_rows : (Array.isArray(stockCfg.receiptRows) ? stockCfg.receiptRows : []);
          const dispList = Array.isArray(stockCfg.disposal_rows) ? stockCfg.disposal_rows : (Array.isArray(stockCfg.disposalRows) ? stockCfg.disposalRows : []);
          if (active && recList.length > 0) {
            setReceiptRows(recList);
          }
          if (active && dispList.length > 0) {
            setDisposalRows(dispList);
          }
        }

        // 2. Load preparation chart masters & templates from DB
        const prepRes = await fetch('/api/stock/preparation-charts');
        if (prepRes.ok) {
          const prepJson = await prepRes.json();
          if (Array.isArray(prepJson.masters) && prepJson.masters.length > 0) {
            if (active) {
              setRawPrepMasters(prepJson.masters);
              setPrepMasters(prepJson.masters.map((m: any) => ({
                key: m.key,
                label: m.name || m.label || m.key,
              })));
            }
          }
          if (prepJson.templates && typeof prepJson.templates === 'object') {
            if (active) setPrepTemplates(prepJson.templates);
          }
          if (Array.isArray(prepJson.columns) && active) {
            setPrepColumns(prepJson.columns.map((c: any) => ({
              key: c.key,
              name: c.name || c.key,
            })));
          }
        }

        // 3. Load STG statement masters strictly from DB table
        let loadedMasters: any[] = [];
        const stgConfigRes = await fetch('/api/ts/masters');
        if (stgConfigRes.ok) {
          const json = await stgConfigRes.json();
          if (Array.isArray(json.masters) && json.masters.length > 0) {
            loadedMasters = json.masters;
            if (active) {
              const mastersList = json.masters.map((m: any) => ({
                key: m.key,
                label: m.label || m.name || m.key,
                tables: Array.isArray(m.tables) ? m.tables : [],
                ob_columns: Array.isArray(m.ob_columns) ? m.ob_columns : [],
                receipt_columns: Array.isArray(m.receipt_columns) ? m.receipt_columns : [],
                disposal_columns: Array.isArray(m.disposal_columns) ? m.disposal_columns : [],
                cb_columns: Array.isArray(m.cb_columns) ? m.cb_columns : [],
                recon_columns: Array.isArray(m.recon_columns) ? m.recon_columns : [],
                ob_rows: Array.isArray(m.ob_rows) && m.ob_rows.length > 0 ? m.ob_rows : (m.rows || m.default_rows || []).filter((r: any) => r.row_type === 'OB'),
                receipt_rows: Array.isArray(m.receipt_rows) && m.receipt_rows.length > 0 ? m.receipt_rows : (m.rows || m.default_rows || []).filter((r: any) => (r.row_type === 'RECEIPT' || r.side === 'RECEIPT') && r.row_type !== 'OB'),
                disposal_rows: Array.isArray(m.disposal_rows) && m.disposal_rows.length > 0 ? m.disposal_rows : (m.rows || m.default_rows || []).filter((r: any) => r.row_type === 'DISPOSAL' || r.side === 'DISPOSAL'),
                reconciliation_rows: Array.isArray(m.reconciliation_rows) ? m.reconciliation_rows : (m.recon_rows || []),
              }));

              setStgStatements(mastersList);
              const allOpen: Record<string, boolean> = {};
              mastersList.forEach((s: any) => { allOpen[s.key] = true; });
              allOpen['__other__'] = true;
              setOpenStatements(allOpen);

              if (mastersList.length > 0) {
                setFormStgBlockKey(prev => {
                  return mastersList.some((s: any) => s.key === prev) ? prev : mastersList[0].key;
                });
              }
            }
          }
        }

        // 4. Load configured STG columns and field catalog from DB
        try {
          const [colsRes, fieldsRes, partsRes] = await Promise.all([
            fetch('/api/ts/columns'),
            fetch('/api/ts/fields'),
            fetch('/api/ts/particulars'),
          ]);
          if (colsRes.ok) {
            const colJson = await colsRes.json();
            if (Array.isArray(colJson.columns) && active) {
              setStgColumns(colJson.columns.map((c: any) => ({
                key: c.key,
                name: c.name || c.label || c.key,
              })));
            }
          }
          if (fieldsRes.ok) {
            const fieldJson = await fieldsRes.json();
            if (Array.isArray(fieldJson.fields) && active) {
              setStgFieldCatalog(fieldJson.fields);
            }
          }
          if (partsRes.ok) {
            const partJson = await partsRes.json();
            if (Array.isArray(partJson.particulars) && active) {
              setStgParticularsCatalog(partJson.particulars);
            }
          }
        } catch { }

        // 5. Load STG Statement Mappings strictly from dedicated /api/mappings endpoint
        try {
          const mapRes = await fetch('/api/mappings');
          if (mapRes.ok) {
            const json = await mapRes.json();
            const rules: any[] = Array.isArray(json.rules) ? json.rules : (Array.isArray(json.data) ? json.data : []);
            if (active) setMappings(rules);
          } else if (active) {
            setMappings([]);
          }
        } catch (mapErr) {
          console.error('Failed reading from /api/mappings:', mapErr);
        }
      } catch (err) {
        console.error('Error loading STG mapping configuration:', err);
        if (active) setError('Failed to load mapping rules from database.');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, []);

  // Dynamically compute available preparation chart columns/fields
  const availablePrepFields = useMemo(() => {
    const map = new Map<string, string>();
    const IGNORED = new Set(['variant', 'id', 'sort_order', 'batch_number', 'batch_name', 'action']);

    if (prepColumns && prepColumns.length > 0) {
      prepColumns.forEach(c => {
        const k = (c?.key || '').trim().toLowerCase();
        if (k && !IGNORED.has(k)) {
          map.set(c.key, c.name || c.key);
        }
      });
    }

    // Populate missing numeric fields from DB field catalog
    if (stgFieldCatalog && stgFieldCatalog.length > 0) {
      stgFieldCatalog.forEach(f => {
        if (!f.is_identifier && !map.has(f.field_key)) {
          map.set(f.field_key, f.label);
        }
      });
    }

    return Array.from(map.entries()).map(([key, name]) => ({ key, name }));
  }, [prepColumns, stgFieldCatalog]);

  // Dynamically compute non-empty available product variants & rows strictly from DB preparation chart masters & templates
  const availablePrepVariants = useMemo(() => {
    const set = new Set<string>();
    const IGNORED_ROW_NAMES = new Set(['new ingredient', 'sample', 'diff', 'difference', 'total']);

    const extractVariantsFromRow = (r: any) => {
      if (!r) return;
      const name = extractRowName(r);
      if (name && !IGNORED_ROW_NAMES.has(name.toLowerCase())) {
        set.add(name);
      }
      const v1 = typeof r.variant === 'string' ? r.variant.trim() : '';
      const v2 = typeof r.values?.variant === 'string' ? r.values.variant.trim() : '';
      [v1, v2].forEach(v => {
        if (v && !IGNORED_ROW_NAMES.has(v.toLowerCase())) {
          set.add(v);
        }
      });
    };

    if (formStockProductKey && formStockProductKey !== '*') {
      const m = rawPrepMasters.find(x => x.key === formStockProductKey);
      if (m) {
        const mv = (m.product_variant || m.name || m.label || '').trim();
        if (mv) set.add(mv);
        if (Array.isArray(m.rows)) {
          m.rows.forEach(extractVariantsFromRow);
        }
        if (Array.isArray(m.default_rows)) {
          m.default_rows.forEach(extractVariantsFromRow);
        }
      }

      const tmpl = prepTemplates[formStockProductKey];
      if (tmpl) {
        if (Array.isArray(tmpl.rows)) {
          tmpl.rows.forEach(extractVariantsFromRow);
        }
        if (Array.isArray(tmpl.batches)) {
          tmpl.batches.forEach((b: any) => {
            if (Array.isArray(b?.rows)) {
              b.rows.forEach(extractVariantsFromRow);
            }
          });
        }
      }
    } else {
      rawPrepMasters.forEach(m => {
        const mv = (m.product_variant || m.name || m.label || '').trim();
        if (mv) set.add(mv);
        if (Array.isArray(m.rows)) {
          m.rows.forEach(extractVariantsFromRow);
        }
        if (Array.isArray(m.default_rows)) {
          m.default_rows.forEach(extractVariantsFromRow);
        }
      });
      Object.values(prepTemplates).forEach((tmpl: any) => {
        if (tmpl) {
          if (Array.isArray(tmpl.rows)) {
            tmpl.rows.forEach(extractVariantsFromRow);
          }
          if (Array.isArray(tmpl.batches)) {
            tmpl.batches.forEach((b: any) => {
              if (Array.isArray(b?.rows)) {
                b.rows.forEach(extractVariantsFromRow);
              }
            });
          }
        }
      });
    }

    return Array.from(set).filter(Boolean);
  }, [formStockProductKey, rawPrepMasters, prepTemplates]);

  // Dynamically compute available stock particulars for selected stock section strictly from DB table rows
  const availableStockParticulars = useMemo(() => {
    if (formStockSection === 'OB') {
      return ['Opening Balance'];
    }
    if (formStockSection === 'CB') {
      return ['Closing Balance'];
    }
    const sourceList = formStockSection === 'RECEIPT' ? receiptRows : disposalRows;
    const labels = sourceList.map(r => (r.full_name || r.short_name || '').trim()).filter(Boolean);
    return Array.from(new Set(labels));
  }, [formStockSection, receiptRows, disposalRows]);

  // Dynamically compute available target columns (fields) strictly from the selected statement block & section
  const availableStgTargetFields = useMemo(() => {
    if (!formStgBlockKey || !formStgSection) return [];

    const map = new Map<string, string>();
    const IGNORED = new Set([
      'variant', 'particular', 'particulars', 'label', 'name', 'item_name', 'id', '#',
      'ob', 'cb', 'receipt', 'disposal', 'recon'
    ]);

    const addCol = (c: any) => {
      if (!c) return;
      if (c.is_active === false || c.hidden === true || c.type === 'text' || c.is_identifier) return;
      const k = (c?.key || '').trim().toLowerCase();
      if (k && !IGNORED.has(k)) {
        if (!map.has(c.key)) {
          map.set(c.key, c.name || c.label || c.key);
        }
      }
    };

    const stmt = stgStatements.find(s => s.key === formStgBlockKey);
    if (stmt) {
      if (formStgSection === 'OB' && Array.isArray(stmt.ob_columns) && stmt.ob_columns.length > 0) {
        stmt.ob_columns.forEach(addCol);
      } else if (formStgSection === 'RECEIPT' && Array.isArray(stmt.receipt_columns) && stmt.receipt_columns.length > 0) {
        stmt.receipt_columns.forEach(addCol);
      } else if (formStgSection === 'DISPOSAL' && Array.isArray(stmt.disposal_columns) && stmt.disposal_columns.length > 0) {
        stmt.disposal_columns.forEach(addCol);
      } else if (formStgSection === 'CB') {
        const cbCols = Array.isArray(stmt.cb_columns) && stmt.cb_columns.length > 0
          ? stmt.cb_columns
          : (Array.isArray(stmt.recon_columns) ? stmt.recon_columns : []);
        cbCols.forEach(addCol);
      }
    }

    // Only if no columns are configured in DB for this block and section, fall back to DB field catalog
    if (map.size === 0 && stgFieldCatalog && stgFieldCatalog.length > 0) {
      stgFieldCatalog.forEach(f => {
        if (!f.is_identifier && f.data_type !== 'text') {
          map.set(f.field_key, f.label);
        }
      });
    }

    return Array.from(map.entries()).map(([key, name]) => ({ key, name }));
  }, [formStgBlockKey, formStgSection, stgStatements, stgFieldCatalog]);

  // Keep target field safely synced to available numeric fields
  useEffect(() => {
    if (formStgSection && availableStgTargetFields.length > 0) {
      const exists = availableStgTargetFields.some(f => f.key === formStgTargetField);
      if (!exists) {
        const hasQtyLts = availableStgTargetFields.find(f => f.key === 'qty_lts');
        setFormStgTargetField(hasQtyLts ? 'qty_lts' : availableStgTargetFields[0].key);
      }
    }
  }, [formStgSection, availableStgTargetFields, formStgTargetField]);

  // Dynamically compute available STG particulars for selected STG statement and section strictly from stg_particular_master and saved statement master rows
  const availableStgItemNames = useMemo<string[]>(() => {
    if (!formStgSection || !formStgBlockKey) return [];
    const set = new Set<string>();

    // 1. Check stg_particular_master catalog
    if (stgParticularsCatalog && stgParticularsCatalog.length > 0) {
      stgParticularsCatalog.forEach(p => {
        if (
          p.statement_key === formStgBlockKey &&
          (p.section_key || '').toLowerCase() === formStgSection.toLowerCase() &&
          p.particular_name
        ) {
          const pName = p.particular_name.trim();
          if (pName && pName.toUpperCase() !== 'OB' && pName.toUpperCase() !== 'CB') {
            set.add(pName);
          }
        }
      });
    }

    // 2. Check statement master rows from stg_masters
    const stmt = stgStatements.find(s => s.key === formStgBlockKey);
    if (stmt) {
      let rows: any[] = [];
      const secLower = formStgSection.toLowerCase();
      if (secLower === 'ob') rows = (stmt as any).ob_rows || (stmt as any).rows?.filter((r: any) => (r.row_type || '').toLowerCase() === 'ob' || (r.side || '').toLowerCase() === 'ob') || [];
      else if (secLower === 'receipt') rows = (stmt as any).receipt_rows || (stmt as any).rows?.filter((r: any) => (r.row_type || '').toLowerCase() === 'receipt' || (r.side || '').toLowerCase() === 'receipt') || [];
      else if (secLower === 'disposal') rows = (stmt as any).disposal_rows || (stmt as any).rows?.filter((r: any) => (r.row_type || '').toLowerCase() === 'disposal' || (r.side || '').toLowerCase() === 'disposal') || [];
      else if (secLower === 'cb') rows = (stmt as any).cb_rows || (stmt as any).reconciliation_rows || (stmt as any).rows?.filter((r: any) => (r.row_type || '').toLowerCase() === 'cb' || (r.side || '').toLowerCase() === 'cb') || [];

      rows.forEach(r => {
        const n = extractRowName(r);
        if (n && n.toUpperCase() !== 'OB' && n.toUpperCase() !== 'CB') set.add(n);
      });
    }

    if (formStgItemName && formStgItemName.trim() && formStgItemName.toUpperCase() !== 'OB' && formStgItemName.toUpperCase() !== 'CB') {
      set.add(formStgItemName.trim());
    }

    return Array.from(set).filter(Boolean);
  }, [formStgBlockKey, formStgSection, stgStatements, stgParticularsCatalog, formStgItemName]);

  // Save STG Mappings strictly to /api/mappings
  const saveStgToApi = async (listToSave: MappingRule[], alertSuccess: boolean = false) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: listToSave }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to save STG statement mapping configuration.');
      }

      const json = await res.json();
      if (Array.isArray(json.rules) && json.rules.length > 0) {
        setMappings(json.rules.map((dbRule: any) => ({
          id: dbRule.id,
          ruleKey: dbRule.rule_key,
          sourceStage: dbRule.source_stage,
          sourceVariant: dbRule.source_variant,
          sourceField: dbRule.source_field,
          stockProductKey: dbRule.stock_product_key,
          stockProductLabel: dbRule.stock_product_label,
          stockSection: dbRule.stock_section,
          stockParticular: dbRule.stock_particular,
          stgBlockKey: dbRule.statement_key || dbRule.stg_block_key,
          stgBlockLabel: dbRule.stg_block_label,
          stgSection: dbRule.stg_section || dbRule.section_key,
          stgItemName: dbRule.stg_item_name,
          stgTargetField: dbRule.target_field || dbRule.stg_target_field,
          enabled: dbRule.enabled,
          sortOrder: dbRule.sort_order,
        })));
      }

      setSuccess('Solid Balance STG Mapping configuration saved successfully!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClearAllMappings = async () => {
    const ok = await confirm({
      title: 'Clear All Mappings',
      message: 'Are you sure you want to clear ALL mapping rules? All Stage 1 ➔ Stage 3 and Stage 2 ➔ Stage 3 mappings will be removed.',
      confirmText: 'Clear All Mappings',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;

    setMappings([]);
    await saveStgToApi([], true);
  };

  const openNewStgForm = (preselectedBlockKey?: string) => {
    setEditingId(null);
    setError('');
    setIsCustomParticular(false);
    setIsCustomStgItem(false);
    setIsCustomPrepVariant(false);

    const isStage1 = formSourceStage === 'STAGE_1';
    const initialKey = isStage1 ? (prepMasters[0]?.key || '') : (stockProducts[0]?.key || '');

    setFormStockProductKey(initialKey);
    setFormStockSection('RECEIPT');
    setFormStockParticular('');
    setFormSourceField('qty_lts');

    const targetKey = (preselectedBlockKey && stgStatements.some(s => s.key === preselectedBlockKey))
      ? preselectedBlockKey
      : ((stgStatements.length > 0 && stgStatements.some(s => s.key === formStgBlockKey))
        ? formStgBlockKey
        : (stgStatements[0]?.key || ''));
    setFormStgBlockKey(targetKey);
    setFormStgTargetField('');
    setFormStgSection('');
    setFormStgItemName('');

    setIsEditing(true);
  };

  const openEditStgForm = (rule: MappingRule) => {
    setEditingId(rule.id);
    setError('');
    setFormSourceStage(rule.sourceStage || 'STAGE_2');
    setFormStockProductKey(rule.stockProductKey || '');
    setFormStockSection(rule.stockSection || 'RECEIPT');
    setFormStockParticular(rule.stockParticular || rule.sourceVariant || '');
    setFormSourceField(rule.sourceField || 'qty_lts');

    setFormStgBlockKey(rule.stgBlockKey || '');
    setFormStgSection((rule.stgSection || '') as any);
    const rawTarget = (rule.stgTargetField || '').trim().toLowerCase();
    const safeTarget = (!rawTarget || ['ob', 'cb', 'receipt', 'disposal', 'variant', 'particular', 'particulars', 'label', 'name', 'item_name'].includes(rawTarget))
      ? 'qty_lts'
      : (rule.stgTargetField || 'qty_lts');
    setFormStgTargetField(safeTarget);

    const chosenItem = (rule.stgItemName || '').trim();
    setFormStgItemName(chosenItem);

    setIsCustomStgItem(false);
    setIsCustomParticular(false);
    setIsCustomPrepVariant(false);
    setIsEditing(true);
  };

  const handleStgFormSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formStockProductKey) {
      setError('Please select a source product/chart.');
      return;
    }
    if (!formStockParticular.trim()) {
      setError('Please select or enter a source particular / variant.');
      return;
    }
    if (!formStgBlockKey) {
      setError('Please select an STG statement master block.');
      return;
    }
    if (!formStgSection) {
      setError('Please select an STG target section (table name).');
      return;
    }
    if (!formStgTargetField) {
      setError('Please select an STG target field (column).');
      return;
    }
    if (!formStgItemName.trim()) {
      setError('Please select or enter an STG item / particular (row value).');
      return;
    }

    const isStage1 = formSourceStage === 'STAGE_1';
    const selectedSourceObj = isStage1
      ? prepMasters.find(p => p.key === formStockProductKey)
      : stockProducts.find(p => p.key === formStockProductKey);

    const sourceLabel = selectedSourceObj ? selectedSourceObj.label : formStockProductKey;
    const selectedStgBlock = stgStatements.find(s => s.key === formStgBlockKey);
    const stgLabel = selectedStgBlock ? selectedStgBlock.label : formStgBlockKey;

    const generateClientUUID = (): string => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    let updated: MappingRule[];
    const ruleObj: MappingRule = {
      id: editingId || generateClientUUID(),
      sourceStage: formSourceStage,
      stockProductKey: formStockProductKey,
      stockProductLabel: sourceLabel,
      stockSection: formStockSection,
      stockParticular: formStockParticular.trim(),
      sourceVariant: isStage1 ? formStockParticular.trim() : undefined,
      sourceField: formSourceField,
      stgBlockKey: formStgBlockKey,
      stgBlockLabel: stgLabel,
      stgSection: formStgSection as 'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB',
      stgItemName: formStgItemName.trim(),
      stgTargetField: formStgTargetField,
    };

    if (editingId) {
      updated = mappings.map(r => (r.id === editingId ? ruleObj : r));
    } else {
      updated = [...mappings, ruleObj];
    }

    setMappings(updated);
    setIsEditing(false);
    saveStgToApi(updated);
  };

  const deleteStgRule = async (id: string) => {
    const ok = await confirm({
      title: 'Delete STG Rule',
      message: 'Are you sure you want to delete this mapping rule?',
      confirmText: 'Delete Rule',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (!ok) return;

    const updated = mappings.filter(r => r.id !== id);
    setMappings(updated);
    saveStgToApi(updated);
  };

  const filteredMappings = mappings.filter(m => {
    if (filterSource === 'STAGE_1' && m.sourceStage !== 'STAGE_1') return false;
    if (filterSource === 'STAGE_2' && m.sourceStage !== 'STAGE_2') return false;
    if (filterSource !== 'ALL' && filterSource !== 'STAGE_1' && filterSource !== 'STAGE_2' && m.stockProductKey !== filterSource && m.stgBlockKey !== filterSource) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matches =
        (m.stockProductLabel || '').toLowerCase().includes(q) ||
        (m.stockParticular || '').toLowerCase().includes(q) ||
        (m.sourceVariant || '').toLowerCase().includes(q) ||
        (m.sourceField || '').toLowerCase().includes(q) ||
        (m.stgBlockKey || '').toLowerCase().includes(q) ||
        (m.stgBlockLabel || '').toLowerCase().includes(q) ||
        (m.stgItemName || '').toLowerCase().includes(q) ||
        (m.stgTargetField || '').toLowerCase().includes(q) ||
        (m.stgSection || '').toLowerCase().includes(q);
      if (!matches) return false;
    }

    return true;
  });

  return (
    <>
      <Header
        title="Solid Balance STG Mapping"
        subtitle="Configure auto-sync mapping rules for Stage 1 (Preparation Charts) ➔ Stage 3 (Solid Balance STG) and Stage 2 (Stock Statement Entry) ➔ Stage 3 (Solid Balance STG)"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleClearAllMappings}
              disabled={loading || saving || mappings.length === 0}
              style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2', fontWeight: 700 }}
              title="Clear all mapping rules from database"
            >
              🗑️ Clear All Mappings
            </button>
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={() => saveStgToApi(mappings, true)}
              disabled={loading || saving}
              title="Save all mapping rules directly to Database"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              💾 Save Mappings to DB
            </button>
            <Link href="/dashboard/stock/preparation-charts/mappings" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff', fontWeight: 700 }}>
              🔀 Stage 1 ➔ Stage 2 Rules
            </Link>
            <Link href="/dashboard/stock/new?step=stg" className="btn btn-primary btn-sm">
              ⚖️ Solid Balance Details (STG)
            </Link>
          </div>
        }
      />

      <div className="page-body animate-fade-in" style={{ maxWidth: 1150 }}>
        {error && <div className="alert alert-error">⚠️ {error}</div>}
        {success && <div className="alert alert-success">✅ {success}</div>}

        {/* Info Banner */}
        <div
          className="card"
          style={{
            marginBottom: 20,
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)',
            borderColor: 'rgba(14, 165, 233, 0.25)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--brand-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🔗 Stage 1 ➔ Stage 3 & Stage 2 ➔ Stage 3 Mapping Engine</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <div>
              • <strong>Stage 1 ➔ Stage 3 (Preparation Charts ➔ Solid Balance STG)</strong>: Maps formulation batch quantities, fat%, snf%, and sp_gr directly from non-empty product variants in Preparation Charts (Stage 1) into Solid Balance Details STG (Stage 3).
            </div>
            <div>
              • <strong>Stage 2 ➔ Stage 3 (Stock Statement Entry ➔ Solid Balance STG)</strong>: Maps daily stock statement row entries into Solid Balance Details STG (Stage 3).
            </div>
          </div>
        </div>

        {/* Controls & Filter */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '0.85rem' }}>
                Filter:
              </label>
              <select
                className="form-select"
                style={{ minWidth: 230, padding: '6px 12px', fontSize: '0.85rem' }}
                value={filterSource}
                onChange={e => setFilterSource(e.target.value)}
              >
                <option value="ALL">All Statements ({mappings.length} rules)</option>
                <option value="STAGE_1">Stage 1 ➔ Stage 3 (Prep Charts)</option>
                <option value="STAGE_2">Stage 2 ➔ Stage 3 (Stock Entry)</option>
                <optgroup label="STG Statement Blocks">
                  {stgStatements.map(s => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
              </select>

              <input
                type="text"
                className="form-input"
                placeholder="🔍 Search rule, variant, column, row..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ minWidth: 240, padding: '6px 12px', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={handleExpandAll}
                title="Expand all statement sections"
                style={{ padding: '6px 12px', fontSize: '0.78rem', fontWeight: 700 }}
              >
                ▲ Expand All
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={handleCollapseAll}
                title="Collapse all statement sections"
                style={{ padding: '6px 12px', fontSize: '0.78rem', fontWeight: 700 }}
              >
                ▼ Collapse All
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => openNewStgForm()}
                disabled={loading || saving}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
              >
                ➕ Add STG Mapping Rule
              </button>
            </div>
          </div>
        </div>

        {/* Inline Add / Edit Form Modal Card */}
        {isEditing && (
          <div
            className="card animate-fade-in"
            style={{
              marginBottom: 24,
              border: '2px solid var(--brand-primary)',
              background: '#f8fafc',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--brand-primary)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{editingId ? '✏️ Edit STG Mapping Rule' : '➕ Add New STG Statement Mapping Rule'}</span>
              <button type="button" onClick={() => setIsEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: '#64748b' }}>✕</button>
            </div>
            <form onSubmit={handleStgFormSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              
              {/* Source Stage Switcher */}
              <div style={{ padding: 14, background: '#ffffff', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 20 }}>
                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--brand-primary)' }}>Source Stage Type:</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: '#0369a1' }}>
                  <input
                    type="radio"
                    name="sourceStage"
                    checked={formSourceStage === 'STAGE_1'}
                    onChange={() => {
                      setFormSourceStage('STAGE_1');
                      setFormStockProductKey(prepMasters[0]?.key || '*');
                      setFormStockParticular('');
                    }}
                  />
                  <span>📋 Stage 1: Preparation Charts</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, color: '#059669' }}>
                  <input
                    type="radio"
                    name="sourceStage"
                    checked={formSourceStage === 'STAGE_2'}
                    onChange={() => {
                      setFormSourceStage('STAGE_2');
                      setFormStockProductKey(stockProducts[0]?.key || '');
                      setFormStockParticular('');
                    }}
                  />
                  <span>📦 Stage 2: Stock Statement Entry</span>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Source Side */}
                <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, color: formSourceStage === 'STAGE_1' ? '#0369a1' : '#0284c7', marginBottom: 12, fontSize: '0.9rem' }}>
                    {formSourceStage === 'STAGE_1' ? '📋 Stage 1 Source (Preparation Charts)' : '📦 Stage 2 Source (Stock Statement Entry)'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {formSourceStage === 'STAGE_1' ? (
                      <>
                        {/* 1. Preparation Chart Master */}
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4, fontWeight: 700 }}>
                            1. Preparation Chart Master *
                          </label>
                          <select
                            className="form-select"
                            value={formStockProductKey}
                            onChange={e => {
                              const key = e.target.value;
                              setFormStockProductKey(key);
                              setIsCustomPrepVariant(false);
                            }}
                            style={{ width: '100%' }}
                            required
                          >
                            <option value="*">⭐ All Preparation Charts (*)</option>
                            {prepMasters.map(m => (
                              <option key={m.key} value={m.key}>{m.label} ({m.key})</option>
                            ))}
                          </select>
                        </div>

                        {/* 2. Source Chart Field (Variant Value) - Column */}
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4, fontWeight: 700 }}>
                            2. Source Chart Field (Variant Value) *
                          </label>
                          <select
                            className="form-select"
                            value={formSourceField}
                            onChange={e => setFormSourceField(e.target.value)}
                            style={{ width: '100%', fontWeight: 600 }}
                            required
                          >
                            {availablePrepFields.map(f => (
                              <option key={f.key} value={f.key}>{f.name} ({f.key})</option>
                            ))}
                          </select>
                        </div>

                        {/* 3. Product Variant (Non-Empty Variant) - Row Value */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', margin: 0, fontWeight: 700 }}>
                              3. Product Variant (Non-Empty Variant) *
                            </label>
                            {availablePrepVariants.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setIsCustomPrepVariant(!isCustomPrepVariant)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#0369a1',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                {isCustomPrepVariant ? '📋 Dropdown' : '✏️ Custom'}
                              </button>
                            )}
                          </div>

                          {!isCustomPrepVariant && availablePrepVariants.length > 0 ? (
                            <select
                              className="form-select"
                              value={formStockParticular}
                              onChange={e => {
                                if (e.target.value === '__custom__') {
                                  setIsCustomPrepVariant(true);
                                } else {
                                  setFormStockParticular(e.target.value);
                                }
                              }}
                              style={{ width: '100%', fontWeight: 700, color: '#0369a1' }}
                              required
                            >
                              <option value="" disabled>-- Select Chart Row / Product Variant --</option>
                              {availablePrepVariants.map(v => (
                                <option key={v} value={v}>{v}</option>
                              ))}
                              {formStockParticular && !availablePrepVariants.includes(formStockParticular) && (
                                <option value={formStockParticular}>{formStockParticular} (Custom / Saved)</option>
                              )}
                              <option value="__custom__">➕ Type Custom Variant...</option>
                            </select>
                          ) : (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input
                                type="text"
                                className="form-input"
                                value={formStockParticular}
                                onChange={e => setFormStockParticular(e.target.value)}
                                placeholder="Type non-empty variant or row name..."
                                style={{ width: '100%', fontWeight: 700 }}
                                required
                                autoFocus={isCustomPrepVariant}
                              />
                              {availablePrepVariants.length > 0 && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => {
                                    setIsCustomPrepVariant(false);
                                    if (!availablePrepVariants.includes(formStockParticular)) {
                                      setFormStockParticular(availablePrepVariants[0] || '');
                                    }
                                  }}
                                  title="Return to predefined dropdown"
                                  style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                                >
                                  Dropdown
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Stock Product Column</label>
                          <select
                            className="form-select"
                            value={formStockProductKey}
                            onChange={e => setFormStockProductKey(e.target.value)}
                            style={{ width: '100%' }}
                            required
                          >
                            <option value="" disabled>-- Select Stock Product --</option>
                            {stockProducts.map(p => (
                              <option key={p.key} value={p.key}>{p.label} ({p.key})</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4 }}>Stock Section</label>
                          <select
                            className="form-select"
                            value={formStockSection}
                            onChange={e => {
                              const sec = e.target.value as 'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB';
                              setFormStockSection(sec);
                              setIsCustomParticular(false);
                              if (sec === 'OB') {
                                setFormStockParticular('Opening Balance');
                              } else if (sec === 'CB') {
                                setFormStockParticular('Closing Balance');
                              } else if (sec === 'RECEIPT') {
                                setFormStockParticular(receiptRows[0]?.full_name || receiptRows[0]?.short_name || '');
                              } else {
                                setFormStockParticular(disposalRows[0]?.full_name || disposalRows[0]?.short_name || '');
                              }
                            }}
                            style={{ width: '100%' }}
                          >
                            <option value="OB">Opening Balance (OB)</option>
                            <option value="RECEIPT">Receipts</option>
                            <option value="DISPOSAL">Disposals</option>
                            <option value="CB">Closing Balance (CB)</option>
                          </select>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', margin: 0 }}>
                              Stock Particular Label *
                            </label>
                            <button
                              type="button"
                              onClick={() => setIsCustomParticular(!isCustomParticular)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#0284c7',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              {isCustomParticular ? '📋 Select from Dropdown' : '✏️ Custom Label'}
                            </button>
                          </div>

                          {!isCustomParticular && availableStockParticulars.length > 0 ? (
                            <select
                              className="form-select"
                              value={formStockParticular}
                              onChange={e => {
                                if (e.target.value === '__custom__') {
                                  setIsCustomParticular(true);
                                } else {
                                  setFormStockParticular(e.target.value);
                                }
                              }}
                              style={{ width: '100%', fontWeight: 700, color: '#0369a1' }}
                              required
                            >
                              <option value="" disabled>-- Select Stock Particular ({formStockSection}) --</option>
                              {availableStockParticulars.map(p => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                              {formStockParticular && !availableStockParticulars.includes(formStockParticular) && (
                                <option value={formStockParticular}>{formStockParticular} (Custom / Saved)</option>
                              )}
                              <option value="__custom__">➕ Type Custom Particular...</option>
                            </select>
                          ) : (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input
                                type="text"
                                className="form-input"
                                value={formStockParticular}
                                onChange={e => setFormStockParticular(e.target.value)}
                                placeholder="Enter stock particular name..."
                                style={{ width: '100%', fontWeight: 700 }}
                                required
                                autoFocus={isCustomParticular}
                              />
                              {availableStockParticulars.length > 0 && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => {
                                    setIsCustomParticular(false);
                                    if (!availableStockParticulars.includes(formStockParticular)) {
                                      setFormStockParticular(availableStockParticulars[0] || '');
                                    }
                                  }}
                                  title="Return to predefined dropdown"
                                  style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                                >
                                  Dropdown
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* STG Target Side */}
                <div style={{ background: '#fff', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, color: '#10b981', marginBottom: 12, fontSize: '0.9rem' }}>
                    ⚖️ Target Solid Balance (STG)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* 1. STG Statement Master Block */}
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4, fontWeight: 700 }}>
                        1. STG Statement Master Block *
                      </label>
                      <select
                        className="form-select"
                        value={formStgBlockKey}
                        onChange={e => {
                          const newKey = e.target.value;
                          setFormStgBlockKey(newKey);
                          setFormStgSection('');
                          setFormStgTargetField('');
                          setFormStgItemName('');
                          setIsCustomStgItem(false);
                        }}
                        style={{ width: '100%' }}
                        required
                      >
                        <option value="" disabled>-- Select Statement Master Block --</option>
                        {stgStatements.map(s => (
                          <option key={s.key} value={s.key}>{s.key} - {s.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* 2. STG Target Section (Table Name) */}
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4, fontWeight: 700 }}>
                        2. STG Target Section (Table Name) *
                      </label>
                      <select
                        className="form-select"
                        value={formStgSection}
                        onChange={e => {
                          const sec = e.target.value as 'OB' | 'RECEIPT' | 'DISPOSAL' | 'CB';
                          setFormStgSection(sec);
                          setFormStgTargetField('');
                          setFormStgItemName('');
                          setIsCustomStgItem(false);
                        }}
                        style={{ width: '100%', fontWeight: 600 }}
                        disabled={!formStgBlockKey}
                        required
                      >
                        <option value="" disabled>-- Select Target Table Name (Section) --</option>
                        <option value="OB">Opening Balance (OB)</option>
                        <option value="RECEIPT">Receipts</option>
                        <option value="DISPOSAL">Disposals</option>
                        <option value="CB">Closing Balance (CB)</option>
                      </select>
                      {!formStgBlockKey && (
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>
                          Please select an STG Statement Master Block above first
                        </div>
                      )}
                    </div>

                    {/* 3. STG Target Field (Column) */}
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: 4, fontWeight: 700 }}>
                        3. STG Target Field (Column) *
                      </label>
                      <select
                        className="form-select"
                        value={formStgTargetField}
                        onChange={e => {
                          setFormStgTargetField(e.target.value);
                        }}
                        style={{ width: '100%', fontWeight: 700, color: '#047857' }}
                        disabled={!formStgSection}
                        required
                      >
                        <option value="" disabled>-- Select STG Target Column (Field) --</option>
                        {availableStgTargetFields.map(col => (
                          <option key={col.key} value={col.key}>{col.name} ({col.key})</option>
                        ))}
                      </select>
                      {!formStgSection && formStgBlockKey && (
                        <div style={{ fontSize: '0.7rem', color: '#d97706', marginTop: 2, fontWeight: 600 }}>
                          ⚠️ Please select STG Target Section (Table Name) above first
                        </div>
                      )}
                    </div>

                    {/* 4. STG Item / Particular * (Row Value) */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', margin: 0, fontWeight: 700 }}>
                          4. STG Item / Particular * (Row Value)
                        </label>
                        {formStgSection && (
                          <button
                            type="button"
                            onClick={() => setIsCustomStgItem(!isCustomStgItem)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#10b981',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            {isCustomStgItem ? '📋 Select from Dropdown' : '✏️ Custom Label'}
                          </button>
                        )}
                      </div>

                      {!formStgSection ? (
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Select STG Target Section (Table Name) above first..."
                          disabled
                          style={{ width: '100%', background: '#f8fafc', color: '#94a3b8' }}
                        />
                      ) : !isCustomStgItem ? (
                        <select
                          className="form-select"
                          value={formStgItemName}
                          onChange={e => {
                            if (e.target.value === '__custom__') {
                              setIsCustomStgItem(true);
                              setFormStgItemName('');
                            } else {
                              setFormStgItemName(e.target.value);
                            }
                          }}
                          style={{ width: '100%', fontWeight: 700, color: '#047857' }}
                          required
                        >
                          <option value="" disabled>-- Select Particular ({formStgSection}) --</option>
                          {availableStgItemNames.length === 0 ? (
                            <option value="" disabled>⚠️ No particulars configured yet (Configure in Masters)</option>
                          ) : (
                            availableStgItemNames.map((item: string) => (
                              <option key={item} value={item}>{item}</option>
                            ))
                          )}
                          <option value="__custom__">➕ Type Custom Item...</option>
                        </select>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="text"
                            className="form-input"
                            value={formStgItemName}
                            onChange={e => setFormStgItemName(e.target.value)}
                            placeholder="Enter STG row value / particular name..."
                            style={{ width: '100%', fontWeight: 700 }}
                            required
                            autoFocus
                          />
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => {
                              setIsCustomStgItem(false);
                              if (!availableStgItemNames.includes(formStgItemName)) {
                                setFormStgItemName(availableStgItemNames[0] || '');
                              }
                            }}
                            title="Return to predefined dropdown"
                            style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                          >
                            Dropdown
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingId ? '💾 Update Rule' : '➕ Add Rule'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Statement Accordions List */}
        {loading ? (
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40 }}>
            <span className="spinner" /> Loading STG statement mapping rules...
          </div>
        ) : stgStatements.length === 0 ? (
          <div className="card empty-state" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔗</div>
            <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 6 }}>
              No STG Statement Master Blocks Found
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Please configure Statement Masters in Manage Statements before adding mappings.
            </div>
            <Link href="/dashboard/ts/manage-statements" className="btn btn-primary btn-sm">
              📊 Go to Statement Masters
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {stgStatements
              .filter(stmt => {
                if (filterSource === 'ALL' || filterSource === 'STAGE_1' || filterSource === 'STAGE_2') {
                  return true;
                }
                return stmt.key === filterSource;
              })
              .map(stmt => {
                const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const sNorm = norm(stmt.key);
                const sLabelNorm = norm(stmt.label);

                const stmtMappings = filteredMappings.filter(m => {
                  const mNorm = norm(m.stgBlockKey);
                  const mLabelNorm = norm(m.stgBlockLabel);
                  return (
                    m.stgBlockKey === stmt.key ||
                    (mNorm && sNorm && mNorm === sNorm) ||
                    (mNorm && sNorm && (mNorm.startsWith(sNorm) || sNorm.startsWith(mNorm))) ||
                    (mLabelNorm && sLabelNorm && (mLabelNorm === sLabelNorm || mLabelNorm.startsWith(sLabelNorm) || sLabelNorm.startsWith(mLabelNorm)))
                  );
                });
                const isOpen = openStatements[stmt.key] !== false;

                return (
                  <div
                    key={stmt.key}
                    className="card"
                    style={{
                      padding: 0,
                      overflow: 'hidden',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    {/* Accordion Header - Matching image style */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 20px',
                        background: isOpen ? '#f8fafc' : '#ffffff',
                        cursor: 'pointer',
                        userSelect: 'none',
                        borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                        transition: 'background-color 0.15s ease',
                      }}
                      onClick={() => toggleStatement(stmt.key)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '1.15rem' }}>📋</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                            {stmt.label}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Statement Key: <code>{stmt.key}</code>
                          </div>
                        </div>
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 12,
                            background: stmtMappings.length > 0 ? '#e0f2fe' : '#f1f5f9',
                            color: stmtMappings.length > 0 ? '#0369a1' : '#64748b',
                          }}
                        >
                          {stmtMappings.length} {stmtMappings.length === 1 ? 'rule' : 'rules'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            openNewStgForm(stmt.key);
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 10px',
                            fontWeight: 700,
                            color: '#0284c7',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                          }}
                        >
                          ➕ Add Rule
                        </button>

                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            color: 'var(--text-secondary)',
                            transition: 'transform 0.2s ease',
                            transform: isOpen ? 'rotate(0deg)' : 'rotate(180deg)',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="18 15 12 9 6 15" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    {/* Accordion Content */}
                    {isOpen && (
                      <div>
                        {stmtMappings.length === 0 ? (
                          <div style={{ padding: '24px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            <div>No mapping rules configured for <strong>{stmt.label}</strong> yet.</div>
                            <div style={{ marginTop: 8 }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-xs"
                                onClick={() => openNewStgForm(stmt.key)}
                                style={{ fontWeight: 700, color: '#0284c7' }}
                              >
                                ➕ Add First Rule for {stmt.label}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table className="data-table" style={{ width: '100%', margin: 0 }}>
                              <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                  <th style={{ width: 40, fontSize: '0.75rem' }}>#</th>
                                  <th style={{ textAlign: 'left', width: 135, fontSize: '0.75rem' }}>Stage Type</th>
                                  <th style={{ textAlign: 'left', minWidth: 260, fontSize: '0.75rem' }}>Source Column / Variant</th>
                                  <th style={{ width: 40, textAlign: 'center', fontSize: '0.75rem' }}>➔</th>
                                  <th style={{ textAlign: 'left', minWidth: 320, fontSize: '0.75rem' }}>Target Solid Balance STG</th>
                                  <th style={{ width: 90, textAlign: 'center', fontSize: '0.75rem' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {stmtMappings.map((m, idx) => {
                                  const isStage1 = m.sourceStage === 'STAGE_1';
                                  return (
                                    <tr key={m.id}>
                                      <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                        {idx + 1}
                                      </td>
                                      <td>
                                        <span
                                          style={{
                                            fontSize: '0.68rem',
                                            fontWeight: 800,
                                            color: '#ffffff',
                                            background: isStage1 ? '#0284c7' : '#059669',
                                            padding: '2px 8px',
                                            borderRadius: 4,
                                          }}
                                        >
                                          {isStage1 ? 'STAGE 1 (PREP)' : 'STAGE 2 (STOCK)'}
                                        </span>
                                      </td>
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                          <span
                                            style={{
                                              fontWeight: 700,
                                              fontSize: '0.82rem',
                                              color: 'var(--text-primary)',
                                              background: '#f1f5f9',
                                              padding: '2px 6px',
                                              borderRadius: 4,
                                              border: '1px solid var(--border)',
                                            }}
                                          >
                                            {m.stockProductLabel}
                                          </span>
                                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isStage1 ? '#0369a1' : 'var(--text-secondary)' }}>
                                            {isStage1 ? 'Variant' : `Section: ${m.stockSection || 'RECEIPT'} | Particular`}: "{m.stockParticular}"
                                          </span>
                                          {m.sourceField && (
                                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '1px 5px', borderRadius: 4 }}>
                                              Field: {m.sourceField}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td style={{ textAlign: 'center', fontSize: '1.1rem', color: 'var(--brand-primary)' }}>
                                        ➔
                                      </td>
                                      <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                          <span style={{ color: '#059669', fontWeight: 700, background: '#d1fae5', padding: '1px 6px', borderRadius: 4 }}>
                                            Column: {m.stgTargetField}
                                          </span>
                                          <span>•</span>
                                          <span>
                                            Table: <strong>{m.stgSection === 'OB' ? 'Opening Balance (OB)' : m.stgSection === 'RECEIPT' ? 'Receipts' : m.stgSection === 'DISPOSAL' ? 'Disposals' : 'Closing Balance (CB)'}</strong>
                                          </span>
                                          <span>•</span>
                                          <span>
                                            Row: <strong>"{m.stgItemName}"</strong>
                                          </span>
                                        </div>
                                      </td>
                                      <td style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                          <button
                                            type="button"
                                            className="btn btn-ghost btn-xs"
                                            style={{ padding: '3px 6px', fontSize: '0.72rem', color: 'var(--brand-primary)' }}
                                            onClick={() => openEditStgForm(m)}
                                          >
                                            ✏️ Edit
                                          </button>
                                          <button
                                            type="button"
                                            className="btn btn-ghost btn-xs"
                                            style={{ padding: '3px 6px', fontSize: '0.72rem', color: '#ef4444' }}
                                            onClick={() => deleteStgRule(m.id)}
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Any unassigned statement mappings */}
            {(() => {
              const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              const unassignedMappings = filteredMappings.filter(m => {
                const mNorm = norm(m.stgBlockKey);
                const mLabelNorm = norm(m.stgBlockLabel);
                return !stgStatements.some(s => {
                  const sNorm = norm(s.key);
                  const sLabelNorm = norm(s.label);
                  return (
                    s.key === m.stgBlockKey ||
                    (sNorm && mNorm && sNorm === mNorm) ||
                    (sNorm && mNorm && (sNorm.startsWith(mNorm) || mNorm.startsWith(sNorm))) ||
                    (sLabelNorm && mLabelNorm && (sLabelNorm === mLabelNorm || sLabelNorm.startsWith(mLabelNorm) || mLabelNorm.startsWith(sLabelNorm)))
                  );
                });
              });
              if (unassignedMappings.length === 0) return null;
              const isOtherOpen = openStatements['__other__'] !== false;

              return (
                <div
                  className="card"
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 20px',
                      background: isOtherOpen ? '#f8fafc' : '#ffffff',
                      cursor: 'pointer',
                      userSelect: 'none',
                      borderBottom: isOtherOpen ? '1px solid var(--border)' : 'none',
                    }}
                    onClick={() => toggleStatement('__other__')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.15rem' }}>📦</span>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        Other / Legacy Statement Rules
                      </div>
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 12,
                          background: '#fef3c7',
                          color: '#b45309',
                        }}
                      >
                        {unassignedMappings.length} rules
                      </span>
                    </div>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 26,
                        height: 26,
                        borderRadius: 4,
                        color: 'var(--text-secondary)',
                        transition: 'transform 0.2s ease',
                        transform: isOtherOpen ? 'rotate(0deg)' : 'rotate(180deg)',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </span>
                  </div>

                  {isOtherOpen && (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ width: '100%', margin: 0 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ width: 40, fontSize: '0.75rem' }}>#</th>
                            <th style={{ textAlign: 'left', width: 135, fontSize: '0.75rem' }}>Stage Type</th>
                            <th style={{ textAlign: 'left', minWidth: 260, fontSize: '0.75rem' }}>Source Column / Variant</th>
                            <th style={{ width: 40, textAlign: 'center', fontSize: '0.75rem' }}>➔</th>
                            <th style={{ textAlign: 'left', minWidth: 320, fontSize: '0.75rem' }}>Target Solid Balance STG</th>
                            <th style={{ width: 90, textAlign: 'center', fontSize: '0.75rem' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unassignedMappings.map((m, idx) => {
                            const isStage1 = m.sourceStage === 'STAGE_1';
                            return (
                              <tr key={m.id}>
                                <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                  {idx + 1}
                                </td>
                                <td>
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      fontWeight: 800,
                                      color: '#ffffff',
                                      background: isStage1 ? '#0284c7' : '#059669',
                                      padding: '2px 8px',
                                      borderRadius: 4,
                                    }}
                                  >
                                    {isStage1 ? 'STAGE 1 (PREP)' : 'STAGE 2 (STOCK)'}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                                      {m.stockProductLabel}
                                    </span>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isStage1 ? '#0369a1' : 'var(--text-secondary)' }}>
                                      {isStage1 ? 'Variant' : `Section: ${m.stockSection || 'RECEIPT'} | Particular`}: "{m.stockParticular}"
                                    </span>
                                    {m.sourceField && (
                                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0369a1', background: '#e0f2fe', padding: '1px 5px', borderRadius: 4 }}>
                                        Field: {m.sourceField}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center', fontSize: '1.1rem', color: 'var(--brand-primary)' }}>
                                  ➔
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                    <span style={{ color: '#059669', fontWeight: 700, background: '#d1fae5', padding: '1px 6px', borderRadius: 4 }}>
                                      Column: {m.stgTargetField}
                                    </span>
                                    <span>•</span>
                                    <span>
                                      Table: <strong>{m.stgSection === 'OB' ? 'Opening Balance (OB)' : m.stgSection === 'RECEIPT' ? 'Receipts' : m.stgSection === 'DISPOSAL' ? 'Disposals' : 'Closing Balance (CB)'}</strong>
                                    </span>
                                    <span>•</span>
                                    <span>
                                      Row: <strong>"{m.stgItemName}"</strong>
                                    </span>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-xs"
                                      style={{ padding: '3px 6px', fontSize: '0.72rem', color: 'var(--brand-primary)' }}
                                      onClick={() => openEditStgForm(m)}
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-xs"
                                      style={{ padding: '3px 6px', fontSize: '0.72rem', color: '#ef4444' }}
                                      onClick={() => deleteStgRule(m.id)}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}
