// ─────────────────────────────────────────────────────────────────────────────
// Aavin Dashboard – NKL Solid Balance Details (STG) Entry Form
// Supports dynamic statements, dropdown switching, and sidebar statement management
// ─────────────────────────────────────────────────────────────────────────────

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { fmtNum } from '@/lib/calculations';
import { CALC_CONFIG } from '@/lib/config';
import type { Shift } from '@/lib/types';

type STGProductBlock = string;

interface STGItemInput {
  item_name: string;
  qty_lts: string;
  qty_kg: string;
  fat_pct: string;
  snf_pct: string;
  sp_gr: string;
  kg_fat: string;
  kg_snf: string;
  linked_block?: string;
}

interface STGBlockState {
  opening_balance: STGItemInput;
  receipts: STGItemInput[];
  disposals: STGItemInput[];
  physical_count: STGItemInput;
}

const DEFAULT_ITEMS_RECEIPT: Record<string, string[]> = {
  WM: [],
  SSM: [],
  CREAM: [],
  SMP: [],
};

const DEFAULT_ITEMS_DISPOSAL: Record<string, string[]> = {
  WM: [],
  SSM: [],
  CREAM: [],
  SMP: [],
};

function makeInitialItem(name = '', linked_block = ''): STGItemInput {
  return {
    item_name: name,
    qty_lts: '',
    qty_kg: '',
    fat_pct: '',
    snf_pct: '',
    sp_gr: '',
    kg_fat: '',
    kg_snf: '',
    linked_block,
  };
}

function makeInitialBlockState(blockKey: string): STGBlockState {
  const receipts = (DEFAULT_ITEMS_RECEIPT[blockKey] || []).map(name => makeInitialItem(name));
  const disposals = (DEFAULT_ITEMS_DISPOSAL[blockKey] || []).map(name => makeInitialItem(name));

  return {
    opening_balance: makeInitialItem('OB'),
    receipts: receipts.length > 0 ? receipts : [makeInitialItem()],
    disposals: disposals.length > 0 ? disposals : [makeInitialItem()],
    physical_count: makeInitialItem('CB'),
  };
}

function hasAnySTGCellValue(item: STGItemInput) {
  return [
    item.item_name,
    item.qty_lts,
    item.qty_kg,
    item.fat_pct,
    item.snf_pct,
    item.sp_gr,
    item.kg_fat,
    item.kg_snf,
  ].some(value => value.trim() !== '');
}

export default function STGEntryForm({
  onRegisterActions,
  saveButtonRef,
}: {
  onRegisterActions?: (actions: { handleSave: () => void; saving: boolean }) => void;
  saveButtonRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramDate = searchParams.get('date');
  const paramShift = searchParams.get('shift');

  const [entryDate, setEntryDate] = useState(paramDate || new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<Shift>((paramShift === 'D' || paramShift === 'N') ? paramShift : 'D');
  const [shiftConfigs, setShiftConfigs] = useState<any[]>([
    { key: 'D', label: 'Day Shift', start: '06:00', end: '18:00' },
    { key: 'N', label: 'Night Shift', start: '18:00', end: '06:00' },
  ]);
  const [notes, setNotes] = useState('');
  const [statements, setStatements] = useState<Array<{ key: string; label: string }>>([]);
  const [enabledBlockKeys, setEnabledBlockKeys] = useState<string[]>([]);
  const [activeBlock, setActiveBlock] = useState<STGProductBlock>('');
  const [blocks, setBlocks] = useState<Record<string, STGBlockState>>({});
  const [saving, setSaving] = useState(false);
  const [savingBlock, setSavingBlock] = useState<string | null>(null);
  const [savedBlock, setSavedBlock] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [obLocked, setObLocked] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [shareModal, setShareModal] = useState<{
    blockKey: string;
    side: 'RECEIPT' | 'DISPOSAL';
    idx: number;
    itemName: string;
    targetBlockKey: string;
    qtyLts: string;
    fatPct: string;
    snfPct: string;
  } | null>(null);

  // Load shifts config on mount
  useEffect(() => {
    async function loadShiftConfig() {
      try {
        const res = await fetch('/api/entries?report_type=STOCK&date=1970-01-01');
        if (res.ok) {
          const json = await res.json();
          const configEntry = json.data?.[0];
          if (configEntry && configEntry.notes) {
            const parsed = JSON.parse(configEntry.notes);
            if (Array.isArray(parsed) && parsed.length === 2) {
              setShiftConfigs(parsed);
              
              if (!paramShift) {
                // Auto-detect current shift based on local time
                const now = new Date();
                const currentHours = now.getHours();
                const currentMinutes = now.getMinutes();
                const currentTimeVal = currentHours * 60 + currentMinutes;

                let detectedShift: Shift = 'D';
                for (const s of parsed) {
                  const [startH, startM] = s.start.split(':').map(Number);
                  const [endH, endM] = s.end.split(':').map(Number);
                  const startVal = startH * 60 + startM;
                  const endVal = endH * 60 + endM;

                  if (startVal < endVal) {
                    if (currentTimeVal >= startVal && currentTimeVal < endVal) {
                      detectedShift = s.key;
                      break;
                    }
                  } else {
                    if (currentTimeVal >= startVal || currentTimeVal < endVal) {
                      detectedShift = s.key;
                      break;
                    }
                  }
                }
                setShift(detectedShift);
              }
            }
          }
        }
      } catch (err) {
        console.error('Error loading shift configuration:', err);
      }
    }
    loadShiftConfig();
  }, [paramShift]);

  useEffect(() => {
    if (!entryDate || !shift) return;
    let active = true;

    async function loadData() {
      try {
        // 1. Fetch the global statements template configuration first
        const configRes = await fetch('/api/entries?report_type=TS&date=1970-01-01');
        let globalStatements: any[] = [];
        if (configRes.ok) {
          const configJson = await configRes.json();
          const configEntry = configJson.data?.[0];
          if (configEntry && configEntry.notes) {
            try {
              const list = JSON.parse(configEntry.notes);
              if (Array.isArray(list) && list.length > 0) {
                const stmtMap = new Map<string, { key: string; label: string }>();
                list.forEach((s: any) => {
                  if (s && s.key) {
                    stmtMap.set(s.key, s);
                  }
                });
                globalStatements = Array.from(stmtMap.values());
              }
            } catch (e) {
              console.error('Failed to parse global config notes:', e);
            }
          }
        }

        // 2. Query yesterday's CB to check lock status and carry forward
        let prevDateStr = entryDate;
        let prevShift: Shift = 'D';

        if (shift === 'N') {
          prevDateStr = entryDate;
          prevShift = 'D';
        } else {
          const prevDate = new Date(entryDate);
          prevDate.setDate(prevDate.getDate() - 1);
          prevDateStr = prevDate.toISOString().split('T')[0];
          prevShift = 'N';
        }

        const prevRes = await fetch(`/api/ts?date=${prevDateStr}&shift=${prevShift}`);
        let yesterdayCBs: any[] = [];
        if (prevRes.ok) {
          const prevData = await prevRes.json();
          if (prevData.data && prevData.data.stg_rows) {
            yesterdayCBs = prevData.data.stg_rows.filter((r: any) => r.item_name === 'CB');
          }
        }

        const locks: Record<string, boolean> = {};
        yesterdayCBs.forEach((row: any) => {
          locks[row.product_block] = true;
        });
        if (active) setObLocked(locks);

        // 3. Query today's entry
        const res = await fetch(`/api/ts?date=${entryDate}&shift=${shift}`);
        if (res.ok) {
          const data = await res.json();
          if (active && data.data) {
            // Read today's saved custom statements
            let todayCustomStatements: any[] = [];
            let customBlocksState: Record<string, any> = {};
            let cleanNotes = data.data.notes || '';
            let savedEnabledKeys: string[] | null = null;

            const notesParts = (data.data.notes || '').split('\n');
            notesParts.forEach((part: string) => {
              if (part.includes('__METADATA__:') || part.includes('__METADATA__::')) {
                const [, metaJson] = part.split('__METADATA__:');
                try {
                  const meta = JSON.parse(metaJson);
                  if (meta.custom_statements) {
                    todayCustomStatements = meta.custom_statements;
                  }
                  if (meta.custom_blocks) {
                    customBlocksState = meta.custom_blocks;
                  }
                  if (meta.enabled_blocks) {
                    savedEnabledKeys = meta.enabled_blocks;
                  }
                } catch (e) {
                  console.error('Failed to parse STG metadata:', e);
                }
                cleanNotes = cleanNotes.replace(part, '').trim();
              }
            });

            // Combine global template statements with today's saved statements.
            // Use a Map keyed by statement key to guarantee uniqueness.
            const stmtMap = new Map<string, { key: string; label: string }>();
            globalStatements.forEach((s: { key: string; label: string }) => stmtMap.set(s.key, s));
            todayCustomStatements.forEach((s: { key: string; label: string }) => {
              if (!stmtMap.has(s.key)) stmtMap.set(s.key, s);
            });
            const combinedStatements = Array.from(stmtMap.values());

            setStatements(combinedStatements);
            if (savedEnabledKeys) {
              setEnabledBlockKeys(savedEnabledKeys);
            } else {
              setEnabledBlockKeys(combinedStatements.map(s => s.key));
            }
            if (combinedStatements.length > 0) {
              setActiveBlock(combinedStatements[0].key);
            }
            setNotes(cleanNotes);

            const newBlocks: Record<string, any> = {};
            combinedStatements.forEach(s => {
              newBlocks[s.key] = makeInitialBlockState(s.key);
              newBlocks[s.key].receipts = [];
              newBlocks[s.key].disposals = [];
            });

            // Map data rows
            data.data.stg_rows.forEach((row: any) => {
              const b = row.product_block;
              if (!newBlocks[b]) return;

              const matchedStatement = combinedStatements.find(s => 
                s.label.toLowerCase().trim() === (row.item_name || '').toLowerCase().trim() ||
                s.key.toLowerCase().trim() === (row.item_name || '').toLowerCase().trim()
              );
              const item = {
                item_name: row.item_name || '',
                qty_lts: row.qty_lts ? String(row.qty_lts) : '',
                qty_kg: row.qty_kg ? String(row.qty_kg) : '',
                fat_pct: row.fat_pct ? String(row.fat_pct) : '',
                snf_pct: row.snf_pct ? String(row.snf_pct) : '',
                sp_gr: row.sp_gr ? String(row.sp_gr) : '',
                kg_fat: row.kg_fat ? String(row.kg_fat) : '',
                kg_snf: row.kg_snf ? String(row.kg_snf) : '',
                linked_block: matchedStatement ? matchedStatement.key : '',
              };

              if (row.item_name === 'OB') {
                newBlocks[b].opening_balance = item;
              } else if (row.item_name === 'CB') {
                newBlocks[b].physical_count = item;
              } else {
                if (row.side === 'RECEIPT') {
                  newBlocks[b].receipts.push(item);
                } else {
                  newBlocks[b].disposals.push(item);
                }
              }
            });

            // Merge parsed custom blocks state
            Object.entries(customBlocksState).forEach(([key, state]) => {
              if (newBlocks[key]) {
                newBlocks[key] = state;
              }
            });

            setBlocks(newBlocks);
            return;
          }
        }

        // 4. Otherwise it's a new entry. Set template and carry forward yesterday's CB.
        if (active) {
          setStatements(globalStatements);
          setEnabledBlockKeys(globalStatements.map(s => s.key));
          if (globalStatements.length > 0) {
            setActiveBlock(globalStatements[0].key);
          }

          const initialBlocks: Record<string, STGBlockState> = {};
          globalStatements.forEach(s => {
            initialBlocks[s.key] = makeInitialBlockState(s.key);
          });

          yesterdayCBs.forEach((row: any) => {
            const b = row.product_block;
            if (initialBlocks[b]) {
              initialBlocks[b].opening_balance = {
                item_name: 'OB',
                qty_lts: row.qty_lts ? String(row.qty_lts) : '',
                qty_kg: row.qty_kg ? String(row.qty_kg) : '',
                fat_pct: row.fat_pct ? String(row.fat_pct) : '',
                snf_pct: row.snf_pct ? String(row.snf_pct) : '',
                sp_gr: row.sp_gr ? String(row.sp_gr) : '',
                kg_fat: row.kg_fat ? String(row.kg_fat) : '',
                kg_snf: row.kg_snf ? String(row.kg_snf) : '',
              };
            }
          });

          setBlocks(initialBlocks);
        }
      } catch (err) {
        console.error('Error loading OB data:', err);
      }
    }

    loadData();
    return () => { active = false; };
  }, [entryDate, shift]);

  function calculateSTGRowValues<T extends { qty_lts: string; qty_kg: string; fat_pct: string; snf_pct: string; sp_gr: string; kg_fat: string; kg_snf: string }>(
    item: T,
    changedField: string,
    newVal: string
  ): T {
    const temp = { ...item, [changedField]: newVal };

    // 1. If fat_pct or snf_pct changed, recalculate sp_gr
    if (changedField === 'fat_pct' || changedField === 'snf_pct') {
      const fat = parseFloat(temp.fat_pct) || 0;
      const snf = parseFloat(temp.snf_pct) || 0;
      if (fat && snf) {
        const rawSpg = CALC_CONFIG.SP_GR.BASE + (snf - (fat * CALC_CONFIG.SP_GR.FAT_FACTOR + CALC_CONFIG.SP_GR.OFFSET)) / CALC_CONFIG.SP_GR.DIVISOR;
        temp.sp_gr = rawSpg.toFixed(CALC_CONFIG.SP_GR.DECIMALS);
      } else if (!fat && !snf) {
        temp.sp_gr = '';
      }
    }

    // 2. Recalculate Qty (Kg) only if Qty (Lts) or Sp. Gr changed
    if (changedField === 'qty_lts' || changedField === 'sp_gr' || changedField === 'fat_pct' || changedField === 'snf_pct') {
      const lts = parseFloat(temp.qty_lts) || 0;
      const spg = parseFloat(temp.sp_gr) || 0;
      if (lts && spg) {
        temp.qty_kg = (lts * spg).toFixed(CALC_CONFIG.QTY_KG.DECIMALS);
      } else {
        temp.qty_kg = '';
      }
    }

    // 3. Recalculate Kg Fat only if dependent values changed
    if (changedField === 'qty_lts' || changedField === 'sp_gr' || changedField === 'fat_pct' || changedField === 'snf_pct') {
      const lts = parseFloat(temp.qty_lts) || 0;
      const spg = parseFloat(temp.sp_gr) || 0;
      const fat = parseFloat(temp.fat_pct) || 0;
      if (lts && spg && fat) {
        const kgFat = (spg * fat * lts) / CALC_CONFIG.KG_FAT.DIVISOR;
        temp.kg_fat = kgFat.toFixed(CALC_CONFIG.KG_FAT.DECIMALS);
      } else {
        temp.kg_fat = '';
      }
    }

    // 4. Recalculate Kg SNF only if dependent values changed
    if (changedField === 'qty_lts' || changedField === 'sp_gr' || changedField === 'snf_pct' || changedField === 'fat_pct') {
      const lts = parseFloat(temp.qty_lts) || 0;
      const spg = parseFloat(temp.sp_gr) || 0;
      const snf = parseFloat(temp.snf_pct) || 0;
      if (lts && spg && snf) {
        const kgSnf = (spg * snf * lts) / CALC_CONFIG.KG_SNF.DIVISOR;
        temp.kg_snf = kgSnf.toFixed(CALC_CONFIG.KG_SNF.DECIMALS);
      } else {
        temp.kg_snf = '';
      }
    }

    return temp;
  }

  const recalculateCB = (bState: any, bKey: string) => {
    const obLts = parseFloat(bState.opening_balance.qty_lts) || 0;
    const obKg = parseFloat(bState.opening_balance.qty_kg) || 0;
    const obFat = parseFloat(bState.opening_balance.kg_fat) || 0;
    const obSnf = parseFloat(bState.opening_balance.kg_snf) || 0;

    const receiptsLts = bState.receipts.reduce((sum: number, r: any) => sum + (parseFloat(r.qty_lts) || 0), 0);
    const receiptsKg = bState.receipts.reduce((sum: number, r: any) => sum + (parseFloat(r.qty_kg) || 0), 0);
    const receiptsFat = bState.receipts.reduce((sum: number, r: any) => sum + (parseFloat(r.kg_fat) || 0), 0);
    const receiptsSnf = bState.receipts.reduce((sum: number, r: any) => sum + (parseFloat(r.kg_snf) || 0), 0);

    const disposalsLts = bState.disposals.reduce((sum: number, d: any) => sum + (parseFloat(d.qty_lts) || 0), 0);
    const disposalsKg = bState.disposals.reduce((sum: number, d: any) => sum + (parseFloat(d.qty_kg) || 0), 0);
    const disposalsFat = bState.disposals.reduce((sum: number, d: any) => sum + (parseFloat(d.kg_fat) || 0), 0);
    const disposalsSnf = bState.disposals.reduce((sum: number, d: any) => sum + (parseFloat(d.kg_snf) || 0), 0);

    const calculatedLtsVal = obLts + receiptsLts - disposalsLts;
    const calculatedKgVal = obKg + receiptsKg - disposalsKg;
    const calculatedFatVal = obFat + receiptsFat - disposalsFat;
    const calculatedSnfVal = obSnf + receiptsSnf - disposalsSnf;

    const calculatedCBLtsStr = calculatedLtsVal > 0 ? calculatedLtsVal.toFixed(0) : '';
    const calculatedCBKgStr = calculatedKgVal > 0 ? calculatedKgVal.toFixed(3) : '';
    const calculatedCBFatStr = calculatedFatVal > 0 ? calculatedFatVal.toFixed(3) : '';
    const calculatedCBSnfStr = calculatedSnfVal > 0 ? calculatedSnfVal.toFixed(3) : '';

    let calculatedSpGrStr = '';
    let calculatedFatPctStr = '';
    let calculatedSnfPctStr = '';

    if (calculatedLtsVal > 0 && calculatedKgVal > 0) {
      calculatedSpGrStr = (calculatedKgVal / calculatedLtsVal).toFixed(4);
      if (calculatedFatVal > 0) {
        calculatedFatPctStr = ((calculatedFatVal / calculatedKgVal) * 100).toFixed(2);
      }
      if (calculatedSnfVal > 0) {
        calculatedSnfPctStr = ((calculatedSnfVal / calculatedKgVal) * 100).toFixed(2);
      }
    }

    bState.physical_count = {
      item_name: 'CB',
      qty_lts: calculatedCBLtsStr,
      qty_kg: calculatedCBKgStr,
      kg_fat: calculatedCBFatStr,
      kg_snf: calculatedCBSnfStr,
      sp_gr: calculatedSpGrStr,
      fat_pct: calculatedFatPctStr,
      snf_pct: calculatedSnfPctStr,
    };
  };

  const syncLinkedRowsDirect = (
    nextBlocks: Record<string, STGBlockState>,
    changedBlock: string,
    changedSide: 'RECEIPT' | 'DISPOSAL',
    changedIdx: number
  ) => {
    const blockState = nextBlocks[changedBlock];
    if (!blockState) return;

    const row = changedSide === 'RECEIPT' 
      ? blockState.receipts[changedIdx] 
      : blockState.disposals[changedIdx];
    if (!row || !row.linked_block) return;

    const targetBlockKey = row.linked_block;
    if (targetBlockKey === changedBlock) return; // prevent self-links

    if (!nextBlocks[targetBlockKey]) {
      nextBlocks[targetBlockKey] = makeInitialBlockState(targetBlockKey);
    }
    const targetBlockState = { ...nextBlocks[targetBlockKey] };

    // Mirrored side is the opposite side
    const targetSide = changedSide === 'RECEIPT' ? 'DISPOSAL' : 'RECEIPT';
    const targetList = targetSide === 'RECEIPT' 
      ? [...targetBlockState.receipts] 
      : [...targetBlockState.disposals];

    // Mirror label matches current block's label/key
    const currentStatement = statements.find(s => s.key === changedBlock);
    const expectedMirrorName = currentStatement ? currentStatement.label : changedBlock;

    // Find mirror row idx
    let targetIdx = targetList.findIndex(r => r.linked_block === changedBlock);

    const mirroredRow = {
      item_name: expectedMirrorName,
      qty_lts: row.qty_lts,
      qty_kg: row.qty_kg,
      fat_pct: row.fat_pct,
      snf_pct: row.snf_pct,
      sp_gr: row.sp_gr,
      kg_fat: row.kg_fat,
      kg_snf: row.kg_snf,
      linked_block: changedBlock,
    };

    if (targetIdx === -1) {
      targetList.push(mirroredRow);
    } else {
      targetList[targetIdx] = mirroredRow;
    }

    if (targetSide === 'RECEIPT') {
      targetBlockState.receipts = targetList;
    } else {
      targetBlockState.disposals = targetList;
    }

    recalculateCB(targetBlockState, targetBlockKey);
    nextBlocks[targetBlockKey] = targetBlockState;
  };

  const syncDeletedRow = (
    nextBlocks: Record<string, STGBlockState>,
    changedBlock: string,
    changedSide: 'RECEIPT' | 'DISPOSAL',
    targetBlockKey: string
  ) => {
    if (!targetBlockKey) return;

    const targetBlockState = nextBlocks[targetBlockKey];
    if (!targetBlockState) return;

    const targetSide = changedSide === 'RECEIPT' ? 'DISPOSAL' : 'RECEIPT';
    const targetList = targetSide === 'RECEIPT' 
      ? [...targetBlockState.receipts] 
      : [...targetBlockState.disposals];

    const targetIdx = targetList.findIndex(r => r.linked_block === changedBlock);

    if (targetIdx !== -1) {
      targetList.splice(targetIdx, 1);
      const updatedBlockState = { ...targetBlockState };
      if (targetSide === 'RECEIPT') {
        updatedBlockState.receipts = targetList;
      } else {
        updatedBlockState.disposals = targetList;
      }
      recalculateCB(updatedBlockState, targetBlockKey);
      nextBlocks[targetBlockKey] = updatedBlockState;
    }
  };

  const handleLinkChange = (
    block: STGProductBlock,
    side: 'RECEIPT' | 'DISPOSAL',
    idx: number,
    targetBlockKey: string
  ) => {
    setBlocks(prev => {
      const next = { ...prev };
      const blockState = { ...next[block] };
      const list = side === 'RECEIPT' ? [...blockState.receipts] : [...blockState.disposals];
      const row = { ...list[idx] };

      const oldLinkedBlock = row.linked_block;
      row.linked_block = targetBlockKey;

      if (targetBlockKey) {
        const targetStatement = statements.find(s => s.key === targetBlockKey);
        if (targetStatement) {
          row.item_name = targetStatement.label;
        }
      } else {
        row.item_name = ''; // clear when link is removed
      }

      list[idx] = row;
      if (side === 'RECEIPT') blockState.receipts = list;
      else blockState.disposals = list;

      recalculateCB(blockState, block);
      next[block] = blockState;

      if (oldLinkedBlock && oldLinkedBlock !== targetBlockKey) {
        // Remove mirrored row in old target
        syncDeletedRow(next, block, side, oldLinkedBlock);
      }

      if (targetBlockKey) {
        // Sync to new target
        syncLinkedRowsDirect(next, block, side, idx);
      }

      return next;
    });
  };

  const updateVal = (
    block: STGProductBlock,
    section: 'OB' | 'PHYSICAL' | 'RECEIPT' | 'DISPOSAL',
    idx: number,
    field: keyof STGItemInput,
    val: string
  ) => {
    const finalVal = field === 'item_name' ? val.toUpperCase() : val;
    setBlocks(prev => {
      const next = { ...prev };
      const blockState = { ...next[block] };

      if (section === 'OB') {
        const current = { ...blockState.opening_balance };
        blockState.opening_balance = calculateSTGRowValues(current, field, finalVal);
      } else if (section === 'PHYSICAL') {
        const current = { ...blockState.physical_count };
        blockState.physical_count = calculateSTGRowValues(current, field, finalVal);
      } else {
        const list = section === 'RECEIPT' ? [...blockState.receipts] : [...blockState.disposals];
        const current = { ...list[idx] };
        list[idx] = calculateSTGRowValues(current, field, finalVal);

        if (section === 'RECEIPT') blockState.receipts = list;
        else blockState.disposals = list;
      }

      // Keep manual CB edits intact; other sections still refresh the calculated CB.
      if (section !== 'PHYSICAL') {
        recalculateCB(blockState, block);
      }
      next[block] = blockState;

      return next;
    });
  };

  const addRowAfter = (block: STGProductBlock, side: 'RECEIPT' | 'DISPOSAL', originalIdx: number) => {
    setBlocks(prev => {
      const next = { ...prev };
      const blockState = { ...next[block] };
      const list = side === 'RECEIPT' ? [...blockState.receipts] : [...blockState.disposals];

      const item = makeInitialItem();
      if (originalIdx === -1) {
        list.push(item);
      } else {
        list.splice(originalIdx + 1, 0, item);
      }

      if (side === 'RECEIPT') blockState.receipts = list;
      else blockState.disposals = list;

      next[block] = blockState;
      return next;
    });
  };

  const deleteRow = (block: STGProductBlock, side: 'RECEIPT' | 'DISPOSAL', idx: number) => {
    setBlocks(prev => {
      const next = { ...prev };
      const blockState = { ...next[block] };
      const list = side === 'RECEIPT' ? [...blockState.receipts] : [...blockState.disposals];

      const item = list[idx];
      if (!item) return prev;

      const hasContent = (
        item.item_name.trim() !== '' ||
        item.qty_lts.trim() !== '' ||
        item.qty_kg.trim() !== '' ||
        item.fat_pct.trim() !== '' ||
        item.snf_pct.trim() !== '' ||
        item.sp_gr.trim() !== '' ||
        item.kg_fat.trim() !== '' ||
        item.kg_snf.trim() !== ''
      );

      if (hasContent) {
        const ok = window.confirm("Are you sure you want to remove this row containing data?");
        if (!ok) return prev;
      }

      const deletedLinkedBlock = item.linked_block;
      list.splice(idx, 1);

      if (side === 'RECEIPT') blockState.receipts = list;
      else blockState.disposals = list;

      recalculateCB(blockState, block);
      next[block] = blockState;

      // Sync deletion to mirrored row
      if (side === 'RECEIPT' || side === 'DISPOSAL') {
        if (deletedLinkedBlock) {
          syncDeletedRow(next, block, side, deletedLinkedBlock);
        }
      }

      return next;
    });
  };

  const handleShareSubmit = () => {
    if (!shareModal) return;
    const { blockKey, side, idx, itemName, targetBlockKey, qtyLts, fatPct, snfPct } = shareModal;

    setBlocks(prev => {
      const next = { ...prev };

      const sourceBlockState = { ...next[blockKey] };
      const sourceList = side === 'RECEIPT' ? [...sourceBlockState.receipts] : [...sourceBlockState.disposals];
      const sourceRow = { ...sourceList[idx] };
      const oldTargetBlockKey = sourceRow.linked_block;

      sourceRow.linked_block = targetBlockKey || undefined;
      sourceList[idx] = sourceRow;
      if (side === 'RECEIPT') sourceBlockState.receipts = sourceList;
      else sourceBlockState.disposals = sourceList;
      recalculateCB(sourceBlockState, blockKey);
      next[blockKey] = sourceBlockState;

      // Remove mirrored row in old target
      if (oldTargetBlockKey) {
        syncDeletedRow(next, blockKey, side, oldTargetBlockKey);
      }

      // Add mirror row in new target if selected
      if (targetBlockKey) {
        if (!next[targetBlockKey]) {
          next[targetBlockKey] = makeInitialBlockState(targetBlockKey);
        }
        const targetBlockState = { ...next[targetBlockKey] };
        const targetSide = side === 'RECEIPT' ? 'DISPOSAL' : 'RECEIPT';
        const targetList = targetSide === 'RECEIPT' ? [...targetBlockState.receipts] : [...targetBlockState.disposals];

        let targetIdx = targetList.findIndex(r => r.linked_block === blockKey);

        let mirroredRow = makeInitialItem(itemName, blockKey);
        mirroredRow.qty_lts = qtyLts;
        mirroredRow.fat_pct = fatPct;
        mirroredRow.snf_pct = snfPct;
        mirroredRow = calculateSTGRowValues(mirroredRow, 'qty_lts', qtyLts);
        mirroredRow = calculateSTGRowValues(mirroredRow, 'fat_pct', fatPct);
        mirroredRow = calculateSTGRowValues(mirroredRow, 'snf_pct', snfPct);

        if (targetIdx === -1) {
          const firstIsEmpty = targetList.length === 1 &&
            targetList[0].item_name === '' &&
            targetList[0].qty_lts === '';
          if (firstIsEmpty) {
            targetList[0] = mirroredRow;
          } else {
            targetList.push(mirroredRow);
          }
        } else {
          targetList[targetIdx] = mirroredRow;
        }

        if (targetSide === 'RECEIPT') targetBlockState.receipts = targetList;
        else targetBlockState.disposals = targetList;
        recalculateCB(targetBlockState, targetBlockKey);
        next[targetBlockKey] = targetBlockState;
      }

      return next;
    });

    setShareModal(null);
  };

  const addStatement = () => {
    const name = window.prompt("Enter new statement name:");
    if (!name || name.trim() === '') return;

    const label = name.trim();
    const newKey = 'custom_stg_' + Date.now();

    setStatements(prev => [...prev, { key: newKey, label }]);
    setBlocks(prev => ({
      ...prev,
      [newKey]: makeInitialBlockState(newKey)
    }));
    setActiveBlock(newKey);
    setObLocked(prev => ({ ...prev, [newKey]: false }));
  };

  const removeStatement = (key: string) => {
    if (['WM', 'SSM', 'CREAM', 'SMP'].includes(key)) {
      alert("Standard statements (WM, SSM, CREAM, SMP) cannot be deleted.");
      return;
    }

    const blockState = blocks[key];
    const hasData = blockState && (
      parseFloat(blockState.opening_balance.qty_lts) > 0 ||
      blockState.receipts.some(r => parseFloat(r.qty_lts) > 0) ||
      blockState.disposals.some(d => parseFloat(d.qty_lts) > 0) ||
      parseFloat(blockState.physical_count.qty_lts) > 0
    );

    if (hasData) {
      const ok = window.confirm("Are you sure you want to remove this statement and all its entered data?");
      if (!ok) return;
    }

    setStatements(prev => {
      const next = prev.filter(s => s.key !== key);
      if (activeBlock === key) {
        setActiveBlock(next[0]?.key || 'WM');
      }
      return next;
    });

    setBlocks(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const getSummary = (block: STGProductBlock) => {
    const b = blocks[block];
    if (!b) return {
      recSum: { lts: 0, kg: 0, fat: 0, snf: 0 },
      dispSum: { lts: 0, kg: 0, fat: 0, snf: 0 },
      ob: { lts: 0, kg: 0, fat: 0, snf: 0 },
      physical: { lts: 0, kg: 0, fat: 0, snf: 0 },
      cb: { lts: 0, kg: 0, fat: 0, snf: 0 },
      diff: { lts: 0, kg: 0, fat: 0, snf: 0 }
    };

    const recSum = {
      lts: b.receipts.reduce((a, r) => a + (parseFloat(r.qty_lts) || 0), 0),
      kg: b.receipts.reduce((a, r) => a + (parseFloat(r.qty_kg) || 0), 0),
      fat: b.receipts.reduce((a, r) => a + (parseFloat(r.kg_fat) || 0), 0),
      snf: b.receipts.reduce((a, r) => a + (parseFloat(r.kg_snf) || 0), 0),
    };
    const dispSum = {
      lts: b.disposals.reduce((a, r) => a + (parseFloat(r.qty_lts) || 0), 0),
      kg: b.disposals.reduce((a, r) => a + (parseFloat(r.qty_kg) || 0), 0),
      fat: b.disposals.reduce((a, r) => a + (parseFloat(r.kg_fat) || 0), 0),
      snf: b.disposals.reduce((a, r) => a + (parseFloat(r.kg_snf) || 0), 0),
    };

    const ob = {
      lts: parseFloat(b.opening_balance.qty_lts) || 0,
      kg: parseFloat(b.opening_balance.qty_kg) || 0,
      fat: parseFloat(b.opening_balance.kg_fat) || 0,
      snf: parseFloat(b.opening_balance.kg_snf) || 0,
    };

    const physical = {
      lts: parseFloat(b.physical_count.qty_lts) || 0,
      kg: parseFloat(b.physical_count.qty_kg) || 0,
      fat: parseFloat(b.physical_count.kg_fat) || 0,
      snf: parseFloat(b.physical_count.kg_snf) || 0,
    };

    const cb = {
      lts: ob.lts + recSum.lts - dispSum.lts,
      kg: ob.kg + recSum.kg - dispSum.kg,
      fat: ob.fat + recSum.fat - dispSum.fat,
      snf: ob.snf + recSum.snf - dispSum.snf,
    };

    const diff = {
      lts: physical.lts - cb.lts,
      kg: physical.kg - cb.kg,
      fat: physical.fat - cb.fat,
      snf: physical.snf - cb.snf,
    };

    return { recSum, dispSum, ob, cb, physical, diff };
  };

  const triggerBackgroundSave = async () => {
    setError('');
    try {
      // 1. Serialize statements list and custom blocks into notes metadata
      const customBlocks: Record<string, any> = {};
      Object.keys(blocks).forEach(k => {
        if (!['WM', 'SSM', 'CREAM', 'SMP'].includes(k) && enabledBlockKeys.includes(k)) {
          customBlocks[k] = blocks[k];
        }
      });

      const metadata = {
        custom_statements: statements.filter(s => enabledBlockKeys.includes(s.key)),
        custom_blocks: customBlocks,
        enabled_blocks: enabledBlockKeys,
      };
      const finalNotes = notes.trim() + "\n__METADATA__:" + JSON.stringify(metadata);

      const entryRes = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_date: entryDate, report_type: 'TS', shift, notes: finalNotes }),
      });
      const entryData = await entryRes.json();
      if (!entryRes.ok && entryRes.status !== 409) {
        throw new Error(entryData.error || 'Failed to initialize entry');
      }

      let entry_id = entryData.data?.id;
      if (!entry_id && entryRes.status === 409) {
        const getRes = await fetch(`/api/entries?report_type=TS&date=${entryDate}&shift=${shift}`);
        const getData = await getRes.json();
        entry_id = getData.data?.[0]?.id;
      }

      if (!entry_id) throw new Error('Could not retrieve entry ID');

      // Compile stg_rows for standard blocks only (due to DB constraint)
      const stg_rows: any[] = [];
      const ts_rows: any[] = [];

      Object.entries(blocks).forEach(([pBlock, blockState]) => {
        if (!enabledBlockKeys.includes(pBlock)) return;
        if (!['WM', 'SSM', 'CREAM', 'SMP'].includes(pBlock)) return;

        const { item_name: obName, ...obRest } = blockState.opening_balance;
        stg_rows.push({
          product_block: pBlock,
          side: 'RECEIPT',
          item_name: 'OB',
          ...obRest,
        });

        blockState.receipts.forEach(r => {
          if (hasAnySTGCellValue(r)) {
            stg_rows.push({ product_block: pBlock, side: 'RECEIPT', ...r });
          }
        });

        blockState.disposals.forEach(d => {
          if (hasAnySTGCellValue(d)) {
            stg_rows.push({ product_block: pBlock, side: 'DISPOSAL', ...d });
          }
        });

        const { item_name: cbName, ...cbRest } = blockState.physical_count;
        stg_rows.push({
          product_block: pBlock,
          side: 'DISPOSAL',
          item_name: 'CB',
          ...cbRest,
        });
      });

      // Compile TS report rows
      const addTSOB = (product: string, blockKey: STGProductBlock) => {
        const sum = getSummary(blockKey);
        ts_rows.push({
          section: 'OB', product,
          qty_lts: sum.ob.lts, qty_kg: sum.ob.kg,
          fat_pct: blocks[blockKey]?.opening_balance.fat_pct || 0,
          snf_pct: blocks[blockKey]?.opening_balance.snf_pct || 0,
          sp_gr: blocks[blockKey]?.opening_balance.sp_gr || 0,
          kg_fat: sum.ob.fat, kg_snf: sum.ob.snf,
        });
      };
      if (blocks.WM && enabledBlockKeys.includes('WM')) addTSOB('WM', 'WM');
      if (blocks.SSM && enabledBlockKeys.includes('SSM')) addTSOB('SSM', 'SSM');
      if (blocks.CREAM && enabledBlockKeys.includes('CREAM')) addTSOB('CREAM', 'CREAM');

      if (blocks.WM && enabledBlockKeys.includes('WM')) {
        blocks.WM.receipts.forEach(r => {
          if (parseFloat(r.qty_lts) > 0) {
            ts_rows.push({
              section: 'RECEIPT', product: r.item_name,
              qty_lts: r.qty_lts, qty_kg: r.qty_kg,
              fat_pct: r.fat_pct, snf_pct: r.snf_pct, sp_gr: r.sp_gr,
              kg_fat: r.kg_fat, kg_snf: r.kg_snf,
            });
          }
        });
      }

      if (blocks.SSM && enabledBlockKeys.includes('SSM')) {
        blocks.SSM.disposals.forEach(d => {
          if (d.item_name.includes('SSM') && parseFloat(d.qty_lts) > 0) {
            ts_rows.push({
              section: 'DISPOSAL_DESPATCH', product: d.item_name,
              qty_lts: d.qty_lts, qty_kg: d.qty_kg,
              fat_pct: d.fat_pct, snf_pct: d.snf_pct, sp_gr: d.sp_gr,
              kg_fat: d.kg_fat, kg_snf: d.kg_snf,
            });
          }
        });
      }

      if (blocks.WM && enabledBlockKeys.includes('WM')) {
        ['DLT MILK', 'FC.MILK', 'STD.Milk'].forEach(prod => {
          const item = blocks.WM.disposals.find(d => d.item_name.toUpperCase().startsWith(prod.substring(0, 3)));
          if (item && parseFloat(item.qty_lts) > 0) {
            ts_rows.push({
              section: 'LOCAL_SALE', product: prod,
              qty_lts: item.qty_lts, qty_kg: item.qty_kg,
              fat_pct: item.fat_pct, snf_pct: item.snf_pct, sp_gr: item.sp_gr,
              kg_fat: item.kg_fat, kg_snf: item.kg_snf,
            });
          }
        });
      }

      const addTSCB = (product: string, blockKey: STGProductBlock) => {
        const sum = getSummary(blockKey);
        ts_rows.push({
          section: 'CB', product,
          qty_lts: sum.physical.lts, qty_kg: sum.physical.kg,
          fat_pct: blocks[blockKey]?.physical_count.fat_pct || 0,
          snf_pct: blocks[blockKey]?.physical_count.snf_pct || 0,
          sp_gr: blocks[blockKey]?.physical_count.sp_gr || 1.027,
          kg_fat: sum.physical.fat, kg_snf: sum.physical.snf,
        });
      };
      if (blocks.WM && enabledBlockKeys.includes('WM')) addTSCB('WM', 'WM');
      if (blocks.SSM && enabledBlockKeys.includes('SSM')) addTSCB('SSM', 'SSM');
      if (blocks.CREAM && enabledBlockKeys.includes('CREAM')) addTSCB('CREAM', 'CREAM');

      const tsRes = await fetch('/api/ts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_id, ts_rows, stg_rows }),
      });

      if (!tsRes.ok) {
        const d = await tsRes.json();
        throw new Error(d.error || 'Failed to save TS/STG data');
      }

      // Auto-compile Stock Statement
      const stockEntryRes = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entry_date: entryDate, report_type: 'STOCK', shift, notes: finalNotes }),
      });
      const stockEntryData = await stockEntryRes.json();
      if (stockEntryRes.ok || stockEntryRes.status === 409) {
        let stock_entry_id = stockEntryData.data?.id;
        if (!stock_entry_id && stockEntryRes.status === 409) {
          const getStockRes = await fetch(`/api/entries?report_type=STOCK&date=${entryDate}&shift=${shift}`);
          const getStockData = await getStockRes.json();
          stock_entry_id = getStockData.data?.[0]?.id;
        }

        if (stock_entry_id) {
          const stock_rows: any[] = [];
          const findQty = (list: any[], term: string) => {
            const found = list.find(r => r.item_name.toLowerCase().includes(term.toLowerCase()));
            return parseFloat(found?.qty_lts || '0') || 0;
          };

          stock_rows.push({
            row_type: 'OB',
            row_label: 'Opening Balance',
            wh_milk: blocks.WM ? parseFloat(blocks.WM.opening_balance.qty_lts) || 0 : 0,
            dlt_milk: blocks.SMP ? parseFloat(blocks.SMP.opening_balance.qty_lts) || 0 : 0,
            fc_milk: 0, std_milk: 0, toned_curd: 0, dtm: 0,
            skim_milk: blocks.SSM ? parseFloat(blocks.SSM.opening_balance.qty_lts) || 0 : 0,
            cream: blocks.CREAM ? parseFloat(blocks.CREAM.opening_balance.qty_lts) || 0 : 0,
            butter_milk: 0, r_con: 0,
            smp: blocks.SMP ? parseFloat(blocks.SMP.opening_balance.qty_kg) || 0 : 0,
            water: 0,
          });

          stock_rows.push({
            row_type: 'RECEIPT', row_label: "BMC's",
            wh_milk: blocks.WM ? findQty(blocks.WM.receipts, "BMC") : 0,
            dlt_milk: 0, fc_milk: 0, std_milk: 0, toned_curd: 0, dtm: 0, skim_milk: 0, cream: 0, butter_milk: 0, r_con: 0, smp: 0, water: 0
          });
          stock_rows.push({
            row_type: 'RECEIPT', row_label: 'P.VELUR CC',
            wh_milk: blocks.WM ? findQty(blocks.WM.receipts, "VELUR") : 0,
            dlt_milk: 0, fc_milk: 0, std_milk: 0, toned_curd: 0, dtm: 0, skim_milk: 0, cream: 0, butter_milk: 0, r_con: 0, smp: 0, water: 0
          });
          stock_rows.push({
            row_type: 'RECEIPT', row_label: 'Separation',
            wh_milk: 0, dlt_milk: 0, fc_milk: 0, std_milk: 0, toned_curd: 0, dtm: 0,
            skim_milk: blocks.SSM ? findQty(blocks.SSM.receipts, "RECEIPT") : 0,
            cream: blocks.CREAM ? findQty(blocks.CREAM.receipts, "RECEIPT") : 0,
            butter_milk: 0, r_con: 0, smp: 0, water: 0
          });

          stock_rows.push({
            row_type: 'DISPOSAL', row_label: 'Separation',
            wh_milk: blocks.WM ? (findQty(blocks.WM.disposals, "SEPERATION") || findQty(blocks.WM.disposals, "SEPARATION")) : 0,
            dlt_milk: 0, fc_milk: 0, std_milk: 0, toned_curd: 0, dtm: 0, skim_milk: 0, cream: 0, butter_milk: 0, r_con: 0, smp: 0, water: 0
          });
          stock_rows.push({
            row_type: 'DISPOSAL', row_label: 'Sachet Filling',
            wh_milk: 0,
            dlt_milk: blocks.WM ? findQty(blocks.WM.disposals, "DLT") : 0,
            fc_milk: blocks.WM ? findQty(blocks.WM.disposals, "FC") : 0,
            std_milk: blocks.WM ? findQty(blocks.WM.disposals, "STD") : 0,
            toned_curd: 0, dtm: 0, skim_milk: 0, cream: 0, butter_milk: 0, r_con: 0, smp: 0, water: 0
          });

          stock_rows.push({
            row_type: 'PHYSICAL', row_label: 'physical',
            wh_milk: blocks.WM ? parseFloat(blocks.WM.physical_count.qty_lts) || 0 : 0,
            dlt_milk: 0, fc_milk: 0, std_milk: 0, toned_curd: 0, dtm: 0,
            skim_milk: blocks.SSM ? parseFloat(blocks.SSM.physical_count.qty_lts) || 0 : 0,
            cream: blocks.CREAM ? parseFloat(blocks.CREAM.physical_count.qty_lts) || 0 : 0,
            butter_milk: 0, r_con: 0,
            smp: blocks.SMP ? parseFloat(blocks.SMP.physical_count.qty_kg) || 0 : 0,
            water: 0,
          });

          await fetch('/api/stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entry_id: stock_entry_id, stock_rows, separation_details: null }),
          });
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const handleSave = async () => {
    if (!entryDate) { setError('Please select a date.'); return; }
    setSaving(true);
    await triggerBackgroundSave();
    setSaving(false);
    if (!error) {
      router.push(`/dashboard/ts/${entryDate}?tab=STG&shift=${shift}`);
    }
  };

  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  });

  useEffect(() => {
    if (onRegisterActions) {
      onRegisterActions({
        handleSave: () => {
          handleSaveRef.current();
        },
        saving,
      });
    }
  }, [saving, onRegisterActions]);

  const renderStatementBlock = (s: { key: string; label: string }) => {
    const blockKey = s.key;
    const blockState = blocks[blockKey];
    if (!blockState) return null;

    const blockSummary = getSummary(blockKey);

    const receiptsSideGrandTotal = {
      lts: blockSummary.recSum.lts + blockSummary.ob.lts,
      kg: blockSummary.recSum.kg + blockSummary.ob.kg,
      fat: blockSummary.recSum.fat + blockSummary.ob.fat,
      snf: blockSummary.recSum.snf + blockSummary.ob.snf,
    };

    const closingBalance = blockSummary.physical;

    const disposalsSideGrandTotal = {
      lts: blockSummary.dispSum.lts + closingBalance.lts,
      kg: blockSummary.dispSum.kg + closingBalance.kg,
      fat: blockSummary.dispSum.fat + closingBalance.fat,
      snf: blockSummary.dispSum.snf + closingBalance.snf,
    };

    const canAddReceipt = blockState.receipts.length === 0 || blockState.receipts.some(r =>
      r.item_name.trim() !== '' || r.qty_lts.trim() !== '' || r.qty_kg.trim() !== '' || r.fat_pct.trim() !== '' || r.snf_pct.trim() !== ''
    );

    const canAddDisposal = blockState.disposals.length === 0 || blockState.disposals.some(d =>
      d.item_name.trim() !== '' || d.qty_lts.trim() !== '' || d.qty_kg.trim() !== '' || d.fat_pct.trim() !== '' || d.snf_pct.trim() !== ''
    );

    return (
      <div className="card animate-fade-in" style={{ marginBottom: 32 }}>
        {/* Title & Delete button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={{ margin: 0, color: 'var(--brand-primary)', textTransform: 'uppercase', letterSpacing: '0.02em', fontSize: '0.95rem', fontWeight: 700 }}>
            {s.label.toUpperCase()} - RECEIPT AND DISPOSAL STATEMENT
          </h3>
          <button
            type="button"
            className="btn btn-danger btn-sm no-print"
            onClick={() => {
              const ok = window.confirm(`Are you sure you want to remove "${s.label}" from this shift? All current values for this shift will be cleared.`);
              if (ok) {
                setEnabledBlockKeys(prev => prev.filter(k => k !== blockKey));
              }
            }}
            style={{ fontSize: '0.75rem', padding: '4px 8px' }}
          >
            ❌ Remove Block
          </button>
        </div>

        {/* Opening Balance inputs */}
        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 20, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>☀️ Opening Balance (OB)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {obLocked[blockKey] ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 8px', fontSize: '0.75rem', height: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => setObLocked(prev => ({ ...prev, [blockKey]: false }))}
                >
                  ✏️ Edit OB
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '2px 8px', fontSize: '0.75rem', height: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={async () => {
                    setObLocked(prev => ({ ...prev, [blockKey]: true }));
                    await triggerBackgroundSave();
                  }}
                >
                  💾 Save OB
                </button>
              )}
            </div>
          </div>
          <div className="form-row" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Qty (Lts)</label>
              <input
                type="number" className="form-input" value={blockState.opening_balance.qty_lts}
                onChange={e => updateVal(blockKey, 'OB', 0, 'qty_lts', e.target.value)}
                disabled={obLocked[blockKey]}
                style={obLocked[blockKey] ? { background: '#f1f5f9', cursor: 'not-allowed' } : undefined}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Qty (Kg)</label>
              <input
                type="number" className="form-input" value={blockState.opening_balance.qty_kg}
                onChange={e => updateVal(blockKey, 'OB', 0, 'qty_kg', e.target.value)}
                disabled={obLocked[blockKey]}
                style={obLocked[blockKey] ? { background: '#f1f5f9', cursor: 'not-allowed' } : undefined}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Fat %</label>
              <input
                type="number" className="form-input" value={blockState.opening_balance.fat_pct}
                onChange={e => updateVal(blockKey, 'OB', 0, 'fat_pct', e.target.value)}
                disabled={obLocked[blockKey]}
                style={obLocked[blockKey] ? { background: '#f1f5f9', cursor: 'not-allowed' } : undefined}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">SNF %</label>
              <input
                type="number" className="form-input" value={blockState.opening_balance.snf_pct}
                onChange={e => updateVal(blockKey, 'OB', 0, 'snf_pct', e.target.value)}
                disabled={obLocked[blockKey]}
                style={obLocked[blockKey] ? { background: '#f1f5f9', cursor: 'not-allowed' } : undefined}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Sp. Gr</label>
              <input
                type="number" className="form-input" value={blockState.opening_balance.sp_gr}
                onChange={e => updateVal(blockKey, 'OB', 0, 'sp_gr', e.target.value)}
                disabled={obLocked[blockKey]}
                style={obLocked[blockKey] ? { background: '#f1f5f9', cursor: 'not-allowed' } : undefined}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Kg Fat</label>
              <input
                type="number" className="form-input" value={blockState.opening_balance.kg_fat}
                onChange={e => updateVal(blockKey, 'OB', 0, 'kg_fat', e.target.value)}
                disabled={obLocked[blockKey]}
                style={obLocked[blockKey] ? { background: '#f1f5f9', cursor: 'not-allowed' } : undefined}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Kg SNF</label>
              <input
                type="number" className="form-input" value={blockState.opening_balance.kg_snf}
                onChange={e => updateVal(blockKey, 'OB', 0, 'kg_snf', e.target.value)}
                disabled={obLocked[blockKey]}
                style={obLocked[blockKey] ? { background: '#f1f5f9', cursor: 'not-allowed' } : undefined}
              />
            </div>
          </div>
        </div>

        {/* Receipts Section */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Receipts
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="inline-table" style={{ width: '100%', minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: '5%', textAlign: 'center' }}>S.No</th>
                  <th style={{ width: '25%' }}>Receipt</th>
                  <th className="num">Qty (Lts)</th>
                  <th className="num" title="Formula: Qty (Lts) × Sp. Gr">Qty (Kg)</th>
                  <th className="num">Fat %</th>
                  <th className="num">SNF %</th>
                  <th className="num" title="=ROUND(1+(SNF %-(Fat %*0.2+0.36))/250,4)">Sp. Gr</th>
                  <th className="num" title="=ROUND(Sp. Gr*Fat %*Qty (Lts)/100,3)">Kg.Fat</th>
                  <th className="num" title="=ROUND(Sp. Gr*SNF %*Qty (Lts)/100,3)">Kg.SNF</th>
                  <th className="no-print" style={{ width: 100, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {blockState.receipts.map((r, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                    <td>
                      <input
                        type="text" placeholder="e.g. BMC Name" value={r.item_name}
                        onChange={e => updateVal(blockKey, 'RECEIPT', idx, 'item_name', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number" placeholder="0" value={r.qty_lts}
                        onChange={e => updateVal(blockKey, 'RECEIPT', idx, 'qty_lts', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number" placeholder="0" value={r.qty_kg}
                        onChange={e => updateVal(blockKey, 'RECEIPT', idx, 'qty_kg', e.target.value)}
                        title="Formula: Qty (Lts) × Sp. Gr"
                      />
                    </td>
                    <td>
                      <input
                        type="number" placeholder="0" value={r.fat_pct}
                        onChange={e => updateVal(blockKey, 'RECEIPT', idx, 'fat_pct', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number" placeholder="0" value={r.snf_pct}
                        onChange={e => updateVal(blockKey, 'RECEIPT', idx, 'snf_pct', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number" placeholder="0" value={r.sp_gr}
                        onChange={e => updateVal(blockKey, 'RECEIPT', idx, 'sp_gr', e.target.value)}
                        title="=ROUND(1+(SNF %-(Fat %*0.2+0.36))/250,4)"
                      />
                    </td>
                    <td>
                      <input
                        type="number" placeholder="0" value={r.kg_fat}
                        onChange={e => updateVal(blockKey, 'RECEIPT', idx, 'kg_fat', e.target.value)}
                        title="=ROUND(Sp. Gr*Fat %*Qty (Lts)/100,3)"
                      />
                    </td>
                    <td>
                      <input
                        type="number" placeholder="0" value={r.kg_snf}
                        onChange={e => updateVal(blockKey, 'RECEIPT', idx, 'kg_snf', e.target.value)}
                        title="=ROUND(Sp. Gr*SNF %*Qty (Lts)/100,3)"
                      />
                    </td>
                    <td className="no-print">
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                          title="Add row below"
                          onClick={() => addRowAfter(blockKey, 'RECEIPT', idx)}
                        >
                          ➕
                        </button>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                          title="Delete row"
                          onClick={() => deleteRow(blockKey, 'RECEIPT', idx)}
                        >
                          ❌
                        </button>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.05rem', padding: 0, opacity: r.linked_block ? 1 : 0.6 }}
                          title={r.linked_block ? `Shared to ${statements.find(s => s.key === r.linked_block)?.label || r.linked_block}` : "Share to statement"}
                          onClick={() => setShareModal({
                            blockKey,
                            side: 'RECEIPT',
                            idx,
                            itemName: r.item_name,
                            targetBlockKey: r.linked_block || '',
                            qtyLts: r.qty_lts,
                            fatPct: r.fat_pct,
                            snfPct: r.snf_pct,
                          })}
                        >
                          {r.linked_block ? '🔗' : '📤'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr 
                  className="no-print" 
                  style={{ 
                    cursor: canAddReceipt ? 'pointer' : 'not-allowed', 
                    background: '#f8fafc',
                    opacity: canAddReceipt ? 1 : 0.5 
                  }} 
                  onClick={() => {
                    if (canAddReceipt) addRowAfter(blockKey, 'RECEIPT', blockState.receipts.length - 1);
                  }}
                >
                  <td colSpan={10} style={{ textAlign: 'center', color: 'var(--brand-primary)', fontWeight: 600, padding: 8 }}>
                    ➕ Add Row
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Disposals Section */}
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Disposals
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="inline-table" style={{ width: '100%', minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ width: '5%', textAlign: 'center' }}>S.No</th>
                  <th style={{ width: '25%' }}>Disposal</th>
                  <th className="num">Qty (Lts)</th>
                  <th className="num" title="Formula: Qty (Lts) × Sp. Gr">Qty (Kg)</th>
                  <th className="num">Fat %</th>
                  <th className="num">SNF %</th>
                  <th className="num" title="=ROUND(1+(SNF %-(Fat %*0.2+0.36))/250,4)">Sp. Gr</th>
                  <th className="num" title="=ROUND(Sp. Gr*Fat %*Qty (Lts)/100,3)">Kg.Fat</th>
                  <th className="num" title="=ROUND(Sp. Gr*SNF %*Qty (Lts)/100,3)">Kg.SNF</th>
                  <th className="no-print" style={{ width: 100, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {blockState.disposals.map((d, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{idx + 1}</td>
                    <td>
                      <input
                        type="text" placeholder="e.g. Sachet Name" value={d.item_name}
                        onChange={e => updateVal(blockKey, 'DISPOSAL', idx, 'item_name', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number" placeholder="0" value={d.qty_lts}
                        onChange={e => updateVal(blockKey, 'DISPOSAL', idx, 'qty_lts', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number" placeholder="0" value={d.qty_kg}
                        onChange={e => updateVal(blockKey, 'DISPOSAL', idx, 'qty_kg', e.target.value)}
                        title="Formula: Qty (Lts) × Sp. Gr"
                      />
                    </td>
                    <td>
                      <input
                        type="number" placeholder="0" value={d.fat_pct}
                        onChange={e => updateVal(blockKey, 'DISPOSAL', idx, 'fat_pct', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number" placeholder="0" value={d.snf_pct}
                        onChange={e => updateVal(blockKey, 'DISPOSAL', idx, 'snf_pct', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number" placeholder="0" value={d.sp_gr}
                        onChange={e => updateVal(blockKey, 'DISPOSAL', idx, 'sp_gr', e.target.value)}
                        title="=ROUND(1+(SNF %-(Fat %*0.2+0.36))/250,4)"
                      />
                    </td>
                    <td>
                      <input
                        type="number" placeholder="0" value={d.kg_fat}
                        onChange={e => updateVal(blockKey, 'DISPOSAL', idx, 'kg_fat', e.target.value)}
                        title="=ROUND(Sp. Gr*Fat %*Qty (Lts)/100,3)"
                      />
                    </td>
                    <td>
                      <input
                        type="number" placeholder="0" value={d.kg_snf}
                        onChange={e => updateVal(blockKey, 'DISPOSAL', idx, 'kg_snf', e.target.value)}
                        title="=ROUND(Sp. Gr*SNF %*Qty (Lts)/100,3)"
                      />
                    </td>
                    <td className="no-print">
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                          title="Add row below"
                          onClick={() => addRowAfter(blockKey, 'DISPOSAL', idx)}
                        >
                          ➕
                        </button>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
                          title="Delete row"
                          onClick={() => deleteRow(blockKey, 'DISPOSAL', idx)}
                        >
                          ❌
                        </button>
                        <button
                          type="button"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.05rem', padding: 0, opacity: d.linked_block ? 1 : 0.6 }}
                          title={d.linked_block ? `Shared to ${statements.find(s => s.key === d.linked_block)?.label || d.linked_block}` : "Share to statement"}
                          onClick={() => setShareModal({
                            blockKey,
                            side: 'DISPOSAL',
                            idx,
                            itemName: d.item_name,
                            targetBlockKey: d.linked_block || '',
                            qtyLts: d.qty_lts,
                            fatPct: d.fat_pct,
                            snfPct: d.snf_pct,
                          })}
                        >
                          {d.linked_block ? '🔗' : '📤'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr 
                  className="no-print" 
                  style={{ 
                    cursor: canAddDisposal ? 'pointer' : 'not-allowed', 
                    background: '#f8fafc',
                    opacity: canAddDisposal ? 1 : 0.5 
                  }} 
                  onClick={() => {
                    if (canAddDisposal) addRowAfter(blockKey, 'DISPOSAL', blockState.disposals.length - 1);
                  }}
                >
                  <td colSpan={10} style={{ textAlign: 'center', color: 'var(--brand-primary)', fontWeight: 600, padding: 8 }}>
                    ➕ Add Row
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>



        {/* Calculations summary balance block */}
        <div style={{ marginTop: 28, padding: '18px 22px', background: 'rgba(2, 132, 199, 0.02)', borderTop: '3px solid var(--brand-primary)', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ margin: 0, color: 'var(--brand-primary)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📊 Excel-Style Summary & Balance Calculations
            </h4>
            <button
              type="button"
              className="btn btn-secondary btn-sm no-print"
              style={{ padding: '4px 10px', fontSize: '0.75rem', height: 'auto', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              onClick={() => {
                setBlocks(prev => {
                  const next = { ...prev };
                  Object.keys(next).forEach(k => {
                    recalculateCB(next[k], k);
                  });
                  return next;
                });
              }}
              title="Recalculate summary and grand totals manually"
            >
              🔄 Refresh Calculations
            </button>
          </div>
          <div className="table-wrapper" style={{ overflowX: 'auto', border: '1px solid var(--border)' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.8125rem', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th colSpan={5} style={{ textAlign: 'center', borderRight: '2px solid var(--border)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-primary)' }}>RECEIPTS SIDE</th>
                  <th colSpan={5} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-accent)' }}>DISPOSALS SIDE</th>
                </tr>
                <tr style={{ background: '#f1f5f9' }}>
                  <th>Category</th>
                  <th className="num">Qty (Lts)</th>
                  <th className="num">Qty (Kg)</th>
                  <th className="num">Kg Fat</th>
                  <th className="num" style={{ borderRight: '2px solid var(--border)' }}>Kg SNF</th>
                  
                  <th>Category</th>
                  <th className="num">Qty (Lts)</th>
                  <th className="num">Qty (Kg)</th>
                  <th className="num">Kg Fat</th>
                  <th className="num">Kg SNF</th>
                </tr>
              </thead>
              <tbody>
                {/* Total Receipts / Total Disposals */}
                <tr style={{ cursor: 'help' }}>
                  <td style={{ fontWeight: 600 }} title="Total Receipts = Sum of all receipt rows">Total Receipts</td>
                  <td className="num" title="Total Receipts = Sum of all receipt rows">{fmtNum(blockSummary.recSum.lts)}</td>
                  <td className="num" title="Total Receipts = Sum of all receipt rows">{fmtNum(blockSummary.recSum.kg)}</td>
                  <td className="num" title="Total Receipts = Sum of all receipt rows">{fmtNum(blockSummary.recSum.fat, 3)}</td>
                  <td className="num" style={{ borderRight: '2px solid var(--border)' }} title="Total Receipts = Sum of all receipt rows">{fmtNum(blockSummary.recSum.snf, 3)}</td>
                  
                  <td style={{ fontWeight: 600 }} title="Total Disposals = Sum of all disposal rows">Total Disposals</td>
                  <td className="num" title="Total Disposals = Sum of all disposal rows">{fmtNum(blockSummary.dispSum.lts)}</td>
                  <td className="num" title="Total Disposals = Sum of all disposal rows">{fmtNum(blockSummary.dispSum.kg)}</td>
                  <td className="num" title="Total Disposals = Sum of all disposal rows">{fmtNum(blockSummary.dispSum.fat, 3)}</td>
                  <td className="num" title="Total Disposals = Sum of all disposal rows">{fmtNum(blockSummary.dispSum.snf, 3)}</td>
                </tr>

                {/* Opening Balance (OB) / Closing Balance (CB Physical) */}
                <tr style={{ background: 'rgba(2,132,199,0.02)', cursor: 'help' }}>
                  <td style={{ fontWeight: 600 }} title="Opening Balance (OB) = Opening Balance from input field">Opening Balance (OB)</td>
                  <td className="num" title="Opening Balance (OB) = Opening Balance from input field">{fmtNum(blockSummary.ob.lts)}</td>
                  <td className="num" title="Opening Balance (OB) = Opening Balance from input field">{fmtNum(blockSummary.ob.kg)}</td>
                  <td className="num" title="Opening Balance (OB) = Opening Balance from input field">{fmtNum(blockSummary.ob.fat, 3)}</td>
                  <td className="num" style={{ borderRight: '2px solid var(--border)' }} title="Opening Balance (OB) = Opening Balance from input field">{fmtNum(blockSummary.ob.snf, 3)}</td>
                  
                  <td style={{ fontWeight: 600 }} title="Closing Balance (CB) = Editable CB value from the balance section">Closing Balance (CB)</td>
                  <td className="num" title="Closing Balance (CB) = Editable CB value from the balance section">{fmtNum(closingBalance.lts)}</td>
                  <td className="num" title="Closing Balance (CB) = Editable CB value from the balance section">{fmtNum(closingBalance.kg)}</td>
                  <td className="num" title="Closing Balance (CB) = Editable CB value from the balance section">{fmtNum(closingBalance.fat, 3)}</td>
                  <td className="num" title="Closing Balance (CB) = Editable CB value from the balance section">{fmtNum(closingBalance.snf, 3)}</td>
                </tr>

                {/* Grand Total Receipts / Grand Total Disposals */}
                <tr style={{ fontWeight: 700, background: 'rgba(16,185,129,0.06)', cursor: 'help' }}>
                  <td title="Grand Total (RECEIPTS SIDE) = Opening Balance + Total Receipts">Grand Total (Receipts)</td>
                  <td className="num" title="Grand Total (RECEIPTS SIDE) = Opening Balance + Total Receipts">{fmtNum(receiptsSideGrandTotal.lts)}</td>
                  <td className="num" title="Grand Total (RECEIPTS SIDE) = Opening Balance + Total Receipts">{fmtNum(receiptsSideGrandTotal.kg)}</td>
                  <td className="num" title="Grand Total (RECEIPTS SIDE) = Opening Balance + Total Receipts">{fmtNum(receiptsSideGrandTotal.fat, 3)}</td>
                  <td className="num" style={{ borderRight: '2px solid var(--border)' }} title="Grand Total (RECEIPTS SIDE) = Opening Balance + Total Receipts">{fmtNum(receiptsSideGrandTotal.snf, 3)}</td>
                  
                  <td title="Grand Total (DISPOSALS SIDE) = Total Disposals + Closing Balance (CB)">Grand Total (Disposals)</td>
                  <td className="num" title="Grand Total (DISPOSALS SIDE) = Total Disposals + Closing Balance (CB)">{fmtNum(disposalsSideGrandTotal.lts)}</td>
                  <td className="num" title="Grand Total (DISPOSALS SIDE) = Total Disposals + Closing Balance (CB)">{fmtNum(disposalsSideGrandTotal.kg)}</td>
                  <td className="num" title="Grand Total (DISPOSALS SIDE) = Total Disposals + Closing Balance (CB)">{fmtNum(disposalsSideGrandTotal.fat, 3)}</td>
                  <td className="num" title="Grand Total (DISPOSALS SIDE) = Total Disposals + Closing Balance (CB)">{fmtNum(disposalsSideGrandTotal.snf, 3)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Per-statement Save / Cancel */}
        <div className="no-print" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px dashed var(--border)' }}>
          {savedBlock === blockKey && (
            <span style={{ fontSize: '0.82rem', color: 'var(--brand-success)', fontWeight: 600 }}>✅ Saved!</span>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => router.back()}
            disabled={savingBlock === blockKey}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={savingBlock === blockKey}
            onClick={async () => {
              setSavingBlock(blockKey);
              setSavedBlock(null);
              await triggerBackgroundSave();
              setSavingBlock(null);
              setSavedBlock(blockKey);
              setTimeout(() => setSavedBlock(null), 2500);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {savingBlock === blockKey ? (
              <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Saving...</>
            ) : (
              <>💾 Save {s.label}</>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Top action buttons */}
      <div ref={saveButtonRef} className="no-print" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 20 }}>
        {error && <span style={{ fontSize: '0.82rem', color: 'var(--brand-danger)', fontWeight: 600 }}>⚠️ {error}</span>}
        <button className="btn btn-secondary" onClick={() => router.back()} disabled={saving}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          style={{ padding: '10px 28px', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {saving
            ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Compiling Registry Statements...</>
            : '💾 Save & Compile STG Statement'
          }
        </button>
      </div>

      {/* Date & Details */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-title" style={{ marginBottom: 16 }}>Register Date & Details</div>
        <div className="form-row form-row-3">
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input
              type="date"
              className="form-input"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Shift *</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {(['D', 'N'] as Shift[]).map(s => {
                const cfg = shiftConfigs.find(c => c.key === s) || {
                  label: s === 'D' ? 'Day Shift' : 'Night Shift',
                  start: s === 'D' ? '06:00' : '18:00',
                  end: s === 'D' ? '18:00' : '06:00'
                };
                return (
                  <button
                    key={s}
                    id={`shift-${s}`}
                    type="button"
                    className={`btn ${shift === s ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setShift(s)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px' }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      {s === 'D' ? '☀️' : '🌙'} {cfg.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <input
              type="text"
              className="form-input"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Enter remarks or details..."
            />
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {/* Excluded Statements Display */}
      {statements.some(s => !enabledBlockKeys.includes(s.key)) && (
        <div className="card-glass" style={{ padding: '16px 20px', marginTop: 20, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(8px)', border: '1px dashed var(--border)', borderRadius: 8 }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>💡 Excluded statements for this shift:</span>
          {statements.filter(s => !enabledBlockKeys.includes(s.key)).map(s => (
            <button
              key={s.key}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEnabledBlockKeys(prev => [...prev, s.key])}
              style={{ fontSize: '0.8rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              ➕ Add {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Enabled Statements Rendered Sequentially */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 32 }}>
        {statements.filter(s => enabledBlockKeys.includes(s.key)).map(s => (
          <React.Fragment key={s.key}>{renderStatementBlock(s)}</React.Fragment>
        ))}
        
        {enabledBlockKeys.length === 0 && (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            ⚠️ All statements have been excluded for this shift. Please add at least one statement block above.
          </div>
        )}
      </div>
      {mounted && shareModal && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div className="card animate-fade-in" style={{
            width: '100%',
            maxWidth: 500,
            background: 'var(--bg-surface)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border)',
            padding: 24,
            borderRadius: 12,
          }}>
            <h3 style={{ margin: 0, marginBottom: 12, color: 'var(--brand-primary)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📤</span> Share Statement Row
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Share <strong>{shareModal.itemName || 'Unnamed Item'}</strong> as a Disposal/Receipt to another statement.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Target Statement *</label>
                <select
                  className="form-input"
                  value={shareModal.targetBlockKey}
                  onChange={e => setShareModal(prev => prev ? { ...prev, targetBlockKey: e.target.value } : null)}
                  style={{ display: 'block', width: '100%', padding: '8px 12px', fontSize: '0.9rem' }}
                >
                  <option value="">No Share (Unlink)</option>
                  {statements.filter(s => s.key !== shareModal.blockKey).map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-row form-row-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Qty (Lts)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={shareModal.qtyLts}
                    onChange={e => setShareModal(prev => prev ? { ...prev, qtyLts: e.target.value } : null)}
                    placeholder="0"
                    style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Fat %</label>
                  <input
                    type="number"
                    className="form-input"
                    value={shareModal.fatPct}
                    onChange={e => setShareModal(prev => prev ? { ...prev, fatPct: e.target.value } : null)}
                    placeholder="0"
                    style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>SNF %</label>
                  <input
                    type="number"
                    className="form-input"
                    value={shareModal.snfPct}
                    onChange={e => setShareModal(prev => prev ? { ...prev, snfPct: e.target.value } : null)}
                    placeholder="0"
                    style={{ padding: '8px 12px', fontSize: '0.9rem' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShareModal(null)}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleShareSubmit}
                style={{ padding: '8px 18px', fontSize: '0.85rem', fontWeight: 600 }}
              >
                💾 Apply Share
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
