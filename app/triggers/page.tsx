'use client';

import { useState } from 'react';
import TriggersPanel from '../components/TriggersPanel';
import SmCalculator from '../components/SmCalculator';

const TABS = [
  { key: 'signals',  label: '📡 Signal Feed' },
  { key: 'trade',    label: '🎯 Trade Signals' },
  { key: 'algo',     label: '🤖 Algo Signals' },
  { key: 'sm_calc',  label: '📊 SM Kalkulator' },
];

export default function TriggersPage() {
  const [activeTab, setActiveTab] = useState('signals');

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{
          fontSize: '1.4rem', fontWeight: 700,
          color: 'var(--text-primary)', marginBottom: '0.25rem'
        }}>
          📡 Phoenix Triggers
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Real-time signal dari Telegram · Smart Money · Money Flow · Trade Signals
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: '0.5rem', marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem',
        flexWrap: 'wrap',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--border-color)',
              background: activeTab === tab.key
                ? 'rgba(100, 149, 237, 0.15)' : 'var(--bg-card)',
              color: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.key ? 600 : 400,
              fontSize: '0.82rem', cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab !== 'sm_calc' && (
        <TriggersPanel activeTab={activeTab} />
      )}
      {activeTab === 'sm_calc' && (
        <SmCalculator />
      )}
    </div>
  );
}
