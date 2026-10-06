'use client';

import React, { useState, useMemo } from 'react';

export interface MasterDetailLayoutProps<T> {
  items: T[];
  getItemKey: (item: T) => string;
  selectedKey: string | null;
  onSelectKey: (key: string) => void;
  renderListItem: (item: T, isSelected: boolean) => React.ReactNode;
  renderDetail: (item: T | null) => React.ReactNode;
  leftPanelTitle?: string;
  leftPanelWidth?: number;
  searchPlaceholder?: string;
  filterPredicate?: (item: T, searchQuery: string) => boolean;
  emptyListMessage?: string;
  emptyDetailMessage?: string;
  headerExtra?: React.ReactNode;
}

export default function MasterDetailLayout<T>({
  items,
  getItemKey,
  selectedKey,
  onSelectKey,
  renderListItem,
  renderDetail,
  leftPanelTitle = 'Items List',
  leftPanelWidth = 340,
  searchPlaceholder = '🔍 Search items...',
  filterPredicate,
  emptyListMessage = 'No items found',
  emptyDetailMessage = 'Select an item from the list to view details',
  headerExtra,
}: MasterDetailLayoutProps<T>) {
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filtered items based on searchQuery
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim() || !filterPredicate) return items;
    return items.filter(item => filterPredicate(item, searchQuery.trim().toLowerCase()));
  }, [items, searchQuery, filterPredicate]);

  // Selected item object
  const selectedItem = useMemo(() => {
    if (!selectedKey) return null;
    return items.find(item => getItemKey(item) === selectedKey) || null;
  }, [items, selectedKey, getItemKey]);

  return (
    <div
      className="master-detail-layout"
      style={{
        display: 'grid',
        gridTemplateColumns: `minmax(280px, ${leftPanelWidth}px) minmax(0, 1fr)`,
        gap: 20,
        alignItems: 'start',
      }}
    >
      {/* ─── LEFT PANEL: List of Items ────────────────────────────────────────────── */}
      <div
        className="card"
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header & Search Bar */}
        <div
          style={{
            padding: '12px 14px',
            background: '#f8fafc',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{leftPanelTitle}</span>
              <span style={{ fontSize: '0.72rem', background: '#e0f2fe', color: '#0284c7', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                {filteredItems.length}
              </span>
            </div>
            {headerExtra}
          </div>

          {filterPredicate && (
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ fontSize: '0.8rem', padding: '6px 10px', height: 32, borderRadius: 6 }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Item List */}
        <div
          style={{
            maxHeight: 650,
            overflowY: 'auto',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {filteredItems.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              {emptyListMessage}
            </div>
          ) : (
            filteredItems.map(item => {
              const key = getItemKey(item);
              const isSelected = selectedKey === key;

              return (
                <div
                  key={key}
                  onClick={() => onSelectKey(key)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: isSelected ? '#f0f9ff' : '#ffffff',
                    border: isSelected ? '2px solid var(--brand-primary)' : '1px solid var(--border)',
                    boxShadow: isSelected ? '0 4px 12px rgba(14, 165, 233, 0.18)' : '0 1px 3px rgba(0,0,0,0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {renderListItem(item, isSelected)}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── RIGHT PANEL: Details / Dynamic Content ───────────────────────────────── */}
      <div style={{ minWidth: 0 }}>
        {selectedItem ? (
          renderDetail(selectedItem)
        ) : (
          <div
            className="card"
            style={{
              padding: 50,
              textAlign: 'center',
              color: 'var(--text-muted)',
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: 4 }}>
              {emptyDetailMessage}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Click any item from the left panel to load its content directly on the right.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
