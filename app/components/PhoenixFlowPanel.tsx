/**
 * app/components/PhoenixFlowPanel.tsx — Phoenix Bot V.X × Adimology
 * Copy ke: adimology/app/components/PhoenixFlowPanel.tsx
 *
 * Panel utama yang menampilkan list ticker dari Phoenix Bot V.X:
 * - Filter by arah (ALL / ACCUM / DISTRIB)
 * - Filter by min_score
 * - Auto-refresh setiap 60 detik
 * - Supabase Realtime subscription untuk update intraday live
 */
'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import BandarAccumCard from '@/app/components/BandarAccumCard';
import type { BandarFlow } from '@/lib/bandar-flow.types';
import { supabase } from '@/lib/supabase';

type ArahFilter = 'ALL' | 'ACCUM' | 'DISTRIB';

const TABS: { label: string; value: ArahFilter }[] = [
  { label: 'Semua',      value: 'ALL'     },
  { label: '⬆ Akumulasi', value: 'ACCUM'  },
  { label: '⬇ Distribusi', value: 'DISTRIB' },
];

const MIN_SCORE_OPTIONS = [0, 40, 60, 80];

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export default function PhoenixFlowPanel() {
  const [data,      setData]      = useState<BandarFlow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [arahTab,   setArahTab]   = useState<ArahFilter>('ALL');
  const [minScore,  setMinScore]  = useState(40);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // Ref untuk dedupe realtime updates
  const dataRef = useRef<BandarFlow[]>([]);
  dataRef.current = data;

  // ── Fetch from API ──────────────────────────────────────────────────────── //

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const url = new URL('/api/bandar-flow', window.location.origin);
      url.searchParams.set('date', today());
      url.searchParams.set('min_score', String(minScore));
      url.searchParams.set('limit', '50');

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      setData((json.data ?? []) as BandarFlow[]);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengambil data');
    } finally {
      setLoading(false);
    }
  }, [minScore]);

  // Initial load + refetch when minScore changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // auto-refresh every 60 seconds (silent — no loading spinner)
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Supabase Realtime — UPDATE events ──────────────────────────────────── //

  useEffect(() => {
    const channel = supabase
      .channel('phoenix-bandar-flow')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bandar_flow' },
        (payload) => {
          const updated = payload.new as BandarFlow;
          if (!updated?.ticker) return;

          // Jika bukan hari ini, abaikan
          if (updated.trade_date !== today()) return;

          setData((prev) => {
            const idx = prev.findIndex(
              (r) => r.ticker === updated.ticker && r.trade_date === updated.trade_date,
            );
            if (idx >= 0) {
              // Update existing row
              const next = [...prev];
              next[idx] = updated;
              return next.sort((a, b) => b.combined_score - a.combined_score);
            }
            // New ticker — add to top if meets min_score
            if (updated.combined_score >= minScore) {
              return [updated, ...prev].sort((a, b) => b.combined_score - a.combined_score);
            }
            return prev;
          });
          setLastFetch(new Date());
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [minScore]);

  // ── Client-side filtering ───────────────────────────────────────────────── //

  const filtered = data.filter((r) => {
    if (arahTab !== 'ALL' && r.arah !== arahTab) return false;
    return true;
  });

  const accumCount  = data.filter((r) => r.arah === 'ACCUM').length;
  const distribCount = data.filter((r) => r.arah === 'DISTRIB').length;

  // ── Render ─────────────────────────────────────────────────────────────── //

  return (
    <div className="pf-panel">
      {/* Header */}
      <div className="pf-panel-header">
        <div className="pf-title">
          <div className="pf-live-dot" />
          Phoenix Flow
          <span style={{ fontSize: '0.7rem', fontWeight: 400, opacity: 0.6 }}>
            by Phoenix Bot V.X
          </span>
        </div>

        <div className="pf-controls">
          {/* Arah tabs */}
          <div className="pf-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                className={`pf-tab${arahTab === tab.value ? ' active' : ''}`}
                onClick={() => setArahTab(tab.value)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Min score selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span className="pf-score-label">Min:</span>
            {MIN_SCORE_OPTIONS.map((s) => (
              <button
                key={s}
                className={`pf-tab${minScore === s ? ' active' : ''}`}
                style={{ padding: '0.2rem 0.45rem' }}
                onClick={() => setMinScore(s)}
              >
                {s === 0 ? 'All' : s}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            className="pf-refresh-btn"
            onClick={() => fetchData()}
            title="Refresh data"
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && data.length > 0 && (
        <div className="pf-stats">
          <span className="pf-stat-item">
            Total: <strong>{data.length}</strong>
          </span>
          <span className="pf-stat-item pf-stat-accum">
            ⬆ Akumulasi: <strong>{accumCount}</strong>
          </span>
          <span className="pf-stat-item pf-stat-distrib">
            ⬇ Distribusi: <strong>{distribCount}</strong>
          </span>
          {lastFetch && (
            <span className="pf-stat-item" style={{ marginLeft: 'auto' }}>
              Update:{' '}
              <strong>
                {lastFetch.toLocaleTimeString('id-ID', {
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                  timeZone: 'Asia/Jakarta',
                })}
              </strong>
            </span>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="pf-loading">
          <div className="pf-spinner" />
          <span>Memuat data Phoenix Bot...</span>
        </div>
      ) : error ? (
        <div className="pf-empty">
          <span>⚠ {error}</span>
          <button className="pf-refresh-btn" onClick={() => fetchData()}>
            Coba lagi
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="pf-empty">
          <span>📊 Belum ada data bandar flow hari ini</span>
          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
            Phoenix Bot akan mengisi data saat signal masuk dari Telegram
          </span>
        </div>
      ) : (
        <div className="pf-grid">
          {filtered.map((item) => (
            <BandarAccumCard key={`${item.ticker}-${item.trade_date}`} data={item} />
          ))}
        </div>
      )}
    </div>
  );
}
