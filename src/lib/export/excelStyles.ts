// ─────────────────────────────────────────────────────────────
// src/lib/export/excelStyles.ts
// Common cell and style helpers for Excel export modules
// ─────────────────────────────────────────────────────────────

export interface CellOptions {
  isHeader?: boolean;
  isBold?: boolean;
  isNum?: boolean;
  isTitle?: boolean;
  alignment?: string;
  noBorder?: boolean;
  noColor?: boolean;
}

export function cell(value: any, opts?: CellOptions) {
  const isHeader = opts?.isHeader ?? false;
  const isBold = opts?.isBold ?? false;
  const isNum = opts?.isNum ?? false;
  const isTitle = opts?.isTitle ?? false;
  const noBorder = opts?.noBorder ?? false;
  const noColor = opts?.noColor ?? false;

  let type = 's';
  if (typeof value === 'number') {
    type = 'n';
  } else if (typeof value === 'boolean') {
    type = 'b';
  }

  const style: any = {
    font: {
      name: 'Calibri',
      sz: isTitle ? 11 : 10,
      bold: isHeader || isBold || isTitle,
    },
    alignment: {
      vertical: 'center',
      horizontal: opts?.alignment || (isNum ? 'right' : (isHeader || isTitle ? 'center' : 'left')),
    }
  };

  if (!noBorder) {
    style.border = {
      top: { style: 'thin', color: { rgb: 'A0A0A0' } },
      bottom: { style: 'thin', color: { rgb: 'A0A0A0' } },
      left: { style: 'thin', color: { rgb: 'A0A0A0' } },
      right: { style: 'thin', color: { rgb: 'A0A0A0' } }
    };
  }

  if (!noColor) {
    if (isTitle) {
      style.fill = { fgColor: { rgb: 'F1F5F9' } };
    } else if (isHeader) {
      style.fill = { fgColor: { rgb: 'E2E8F0' } };
    }
  }

  return { v: value === null || value === undefined ? '' : value, t: type, s: style };
}

export const val = (v: number | null | undefined, decimals = 3) => {
  if (v === null || v === undefined || isNaN(v)) return 0;
  return Number(v.toFixed(decimals));
};

