// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – Calculation Constants & Formulas Configuration
// In the future, if you need to change any formula multipliers, dividers, or 
// rounding precision, simply update the values below.
// ─────────────────────────────────────────────────────────────────────────────

export const CALC_CONFIG = {
  // ─── SPECIFIC GRAVITY (Sp. Gr) PARAMETERS ───────────────────────────────────
  // Formula: Sp.Gr = Base + (SNF% - (Fat% * FatFactor + Offset)) / Divisor
  SP_GR: {
    BASE: 1,
    FAT_FACTOR: 0.2,
    OFFSET: 0.36,
    DIVISOR: 250,
    DECIMALS: 4, // Number of decimal places to round specific gravity to (e.g. 1.0272)
  },

  // ─── QUANTITY KG (Qty Kg) PARAMETERS ───────────────────────────────────────
  // Formula: Qty(Kg) = Qty(Lts) * Sp.Gr
  QTY_KG: {
    DECIMALS: 3, // Number of decimal places to round Qty(Kg) to
  },

  // ─── KG FAT PARAMETERS ─────────────────────────────────────────────────────
  // Formula: Kg Fat = (Sp.Gr * Fat% * Qty(Lts)) / Divisor  (STG receipts/disposals)
  // Or: Kg Fat = (Qty(Kg) * Fat%) / Divisor (TS statements)
  KG_FAT: {
    DIVISOR: 100,
    DECIMALS: 3, // Decimals for STG receipts/disposals
    TS_DECIMALS: 4, // Decimals for TS summaries & totals
  },

  // ─── KG SNF PARAMETERS ─────────────────────────────────────────────────────
  // Formula: Kg SNF = (Sp.Gr * SNF% * Qty(Lts)) / Divisor  (STG receipts/disposals)
  // Or: Kg SNF = (Qty(Kg) * SNF%) / Divisor (TS statements)
  KG_SNF: {
    DIVISOR: 100,
    DECIMALS: 3, // Decimals for STG receipts/disposals
    TS_DECIMALS: 4, // Decimals for TS summaries & totals
  },

  // ─── TS SUMMARY REPORT ROUNDING PARAMETERS ──────────────────────────────────
  TS_REPORT: {
    QTY_LTS_DECIMALS: 3,
    QTY_KG_DECIMALS: 3,
    LOSS_PERCENTAGE_DECIMALS: 4,
    CMPDD_NORM_PCT: 0.5, // Dairy standard loss norms percentage
  },
};
