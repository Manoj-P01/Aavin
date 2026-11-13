// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Row JSON Packing & Unpacking Helper
// Converts flat row objects to/from the dynamic row_json DB representation
// at the API boundary for ts_milk_rows and stg_rows.
// ─────────────────────────────────────────────────────────────────────────────

const TS_STRUCTURAL_KEYS = new Set([
  'id',
  'entry_id',
  'section',
  'product',
  'sort_order',
  'created_by',
  'created_at',
  'updated_by',
  'updated_at',
]);

const STG_STRUCTURAL_KEYS = new Set([
  'id',
  'entry_id',
  'product_block',
  'side',
  'section_key',
  'particular_id',
  'item_name',
  'sort_order',
  'created_by',
  'created_at',
  'updated_by',
  'updated_at',
]);

/**
 * Packs a flat row into a DB-compatible record with structural columns
 * and all numeric/variable metrics placed inside row_json.
 */
export function packRow<T extends Record<string, any>>(row: T, type: 'ts' | 'stg'): Record<string, any> {
  const structuralKeys = type === 'ts' ? TS_STRUCTURAL_KEYS : STG_STRUCTURAL_KEYS;
  const dbRecord: Record<string, any> = {};
  const jsonPayload: Record<string, any> = {};

  // First copy existing row_json if present
  if (row.row_json && typeof row.row_json === 'object') {
    Object.assign(jsonPayload, row.row_json);
  }

  for (const [key, value] of Object.entries(row)) {
    if (key === 'row_json') continue;
    if (structuralKeys.has(key)) {
      dbRecord[key] = value;
    } else if (value !== undefined) {
      jsonPayload[key] = value;
    }
  }

  dbRecord.row_json = jsonPayload;
  return dbRecord;
}

/**
 * Packs an array of rows into DB-compatible records with row_json.
 */
export function packRows<T extends Record<string, any>>(rows: T[], type: 'ts' | 'stg'): Record<string, any>[] {
  return rows.map(r => packRow(r, type));
}

/**
 * Unpacks a DB record containing row_json into a flat row object
 * suitable for UI components and calculation libraries.
 */
export function unpackRow<T extends Record<string, any>>(dbRow: T): Record<string, any> {
  if (!dbRow) return dbRow;
  const { row_json, ...rest } = dbRow;
  return {
    ...rest,
    ...(row_json && typeof row_json === 'object' ? row_json : {}),
  };
}

/**
 * Unpacks an array of DB records with row_json into flat row objects.
 */
export function unpackRows<T extends Record<string, any>>(dbRows: T[]): Record<string, any>[] {
  if (!Array.isArray(dbRows)) return [];
  return dbRows.map(unpackRow);
}

