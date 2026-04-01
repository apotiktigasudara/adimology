'use client';

/**
 * BandarFlowSection.tsx — Phoenix Bot V.X × Adimology
 *
 * Menampilkan data bandar_flow untuk satu ticker di dalam Calculator.
 * Jika belum ada data (404), komponen ini tidak render apapun (silent).
 * Auto-update via Supabase Realtime saat Phoenix Bot push data baru.
 */

import { useEffect, useState } from 'react';
import BandarAccumCard from './BandarAccumCard';
import type { BandarFlow } from '@/lib/bandar-flow.types';
import { supabase } from '@/lib/supabase';

interface BandarFlowSectionProps {
  ticker: string;
}

export default function BandarFlowSection({ ticker }: BandarFlowSectionProps) {
  const [data, setData] = useState<BandarFlow | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch on ticker change
  useEffect(() => {
    if (!ticker) return;
    setData(null);
    setLoading(true);

    fetch(`/api/bandar-flow/${ticker.toUpperCase()}`)
      .then(r => (r.ok ? r.json() : null))
      .then(json => { if (json?.latest) setData(json.latest as BandarFlow); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [ticker]);

  // Realtime: update card tanpa re-fetch
  useEffect(() => {
    if (!ticker) return;
    const sym = ticker.toUpperCase();
    const channel = supabase
      .channel(`pf-section-${sym}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bandar_flow', filter: `ticker=eq.${sym}` },
        (payload) => {
          const updated = payload.new as BandarFlow;
          if (updated?.ticker) setData(updated);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ticker]);

  if (loading || !data) return null;

  return (
    <div style={{ gridColumn: '1 / -1', width: '100%' }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem',
      }}>
        <span style={{
          fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '1px', color: 'var(--text-secondary)',
        }}>
          🔥 Phoenix Flow — {ticker.toUpperCase()}
        </span>
        <span style={{
          fontSize: '0.6rem', padding: '0.1rem 0.45rem',
          background: 'rgba(56,239,125,0.1)', color: '#38ef7d',
          borderRadius: '4px', border: '1px solid rgba(56,239,125,0.2)',
          fontWeight: 600, letterSpacing: '0.5px',
        }}>
          LIVE
        </span>
        {data.algo_triggered && (
          <span style={{
            fontSize: '0.6rem', padding: '0.1rem 0.45rem',
            background: 'rgba(255,200,50,0.12)', color: '#ffc832',
            borderRadius: '4px', border: '1px solid rgba(255,200,50,0.2)',
            fontWeight: 600,
          }}>
            🤖 ALGO
          </span>
        )}
      </div>

      <BandarAccumCard data={data} />
    </div>
  );
}
