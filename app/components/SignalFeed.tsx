'use client';

/**
 * SignalFeed.tsx — Phoenix Bot V.X × Adimology
 *
 * Mini feed sinyal terbaru dari bandar_alerts.
 * Dipasang di atas WatchlistSidebar.
 * Klik ticker → load Calculator untuk ticker itu.
 */

import { useEffect, useState } from 'react';
import type { BandarAlert } from '@/lib/bandar-flow.types';
import { supabase } from '@/lib/supabase';

interface SignalFeedProps {
  onSelect?: (ticker: string) => void;
}

const TRIGGER_LABEL: Record<string, string> = {
  ALGO:     '🤖 Algo',
  BIG_SM:   '💰 Big SM',
  SM:       '💵 SM',
  COMBINED: '📊 Mixed',
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1)  return 'baru';
  if (diff < 60) return `${diff}m`;
  const h = Math.floor(diff / 60);
  return h < 24 ? `${h}j` : `${Math.floor(h / 24)}h`;
}

export default function SignalFeed({ onSelect }: SignalFeedProps) {
  const [alerts, setAlerts] = useState<BandarAlert[]>([]);

  const load = async () => {
    try {
      const res = await fetch('/api/bandar-alerts?limit=5&min_score=40');
      if (!res.ok) return;
      const json = await res.json();
      setAlerts(json.data ?? []);
    } catch {}
  };

  useEffect(() => {
    load();
    // Supabase realtime: refresh saat ada INSERT baru di bandar_alerts
    const ch = supabase
      .channel('signal-feed-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bandar_alerts' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div style={{ marginBottom: '1rem' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        marginBottom: '0.45rem',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#38ef7d', boxShadow: '0 0 6px #38ef7d',
          display: 'inline-block', flexShrink: 0,
        }} />
        <span style={{
          fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '1px', color: 'var(--text-secondary)',
        }}>
          Signal Terbaru
        </span>
      </div>

      {/* Alert rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {alerts.map(a => (
          <button
            key={a.id}
            onClick={() => onSelect?.(a.ticker)}
            title={`${a.ticker} — ${a.arah} (score ${a.combined_score})`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.3rem 0.55rem',
              background: a.arah === 'ACCUM'
                ? 'rgba(56,239,125,0.07)' : 'rgba(245,87,108,0.07)',
              border: `1px solid ${a.arah === 'ACCUM'
                ? 'rgba(56,239,125,0.15)' : 'rgba(245,87,108,0.15)'}`,
              borderRadius: '8px', cursor: 'pointer',
              width: '100%', textAlign: 'left', outline: 'none',
            }}
          >
            {/* Ticker + arah arrow */}
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{
                fontSize: '0.75rem', fontWeight: 700,
                color: 'var(--text-primary)',
              }}>
                {a.ticker}
              </span>
              <span style={{
                fontSize: '0.65rem',
                color: a.arah === 'ACCUM' ? '#38ef7d' : '#f5576c',
              }}>
                {a.arah === 'ACCUM' ? '⬆' : '⬇'}
              </span>
            </span>

            {/* Trigger + score + time */}
            <span style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.62rem', color: 'var(--text-secondary)',
            }}>
              <span>{TRIGGER_LABEL[a.trigger_type] ?? a.trigger_type}</span>
              <span style={{
                padding: '0.05rem 0.28rem', borderRadius: '4px',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-primary)', fontWeight: 600,
              }}>
                {a.combined_score}
              </span>
              <span style={{ opacity: 0.5 }}>{timeAgo(a.created_at)}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
