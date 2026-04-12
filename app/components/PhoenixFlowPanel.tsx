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
import FlowTimelineChart from '@/app/components/FlowTimelineChart';
import type { BandarFlow } from '@/lib/bandar-flow.types';
import { supabase } from '@/lib/supabase';

type ArahFilter = 'ALL' | 'ACCUM' | 'DISTRIB';

interface PhoenixFlowPanelProps {
  onAnalyze?: (ticker: string) => void;
}

const TABS: { label: string; value: ArahFilter }[] = [
  { label: 'Semua',        value: 'ALL'     },
  { label: '⬆ Akumulasi',  value: 'ACCUM'   },
  { label: '⬇ Distribusi', value: 'DISTRIB' },
];

const MIN_SCORE_OPTIONS = [0, 40, 60, 80];

function todayWIB(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

export default function PhoenixFlowPanel({ onAnalyze }: PhoenixFlowPanelProps = {}) {
  const [data,         setData]         = useState<BandarFlow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [arahTab,      setArahTab]      = useState<ArahFilter>('ALL');
  const [minScore,     setMinScore]     = useState(40);
  const [lastFetch,    setLastFetch]    = useState<Date | null>(null);
  const [chartTicker,  setChartTicker]  = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');   // '' = hari ini
  const [dataDate,     setDataDate]     = useState<string>('');   // tanggal actual yang dikembalikan API

  // Whale Tracker state
  const [whaleData,      setWhaleData]      = useState<{
    trade_date: string;
    brokers: { code: string; name: string; ticker_count: number; total_net: number;
               tickers: { ticker: string; net_value: number }[] }[]
  } | null>(null);
  const [expandedWhale, setExpandedWhale] = useState<string | null>(null);

  const today   = todayWIB();
  const isToday = !selectedDate || selectedDate === today;

  // Ref untuk dedupe realtime updates
  const dataRef = useRef<BandarFlow[]>([]);
  dataRef.current = data;

  // ── Fetch from API ──────────────────────────────────────────────────────── //

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const url = new URL('/api/bandar-flow', window.location.origin);
      url.searchParams.set('date', selectedDate || today);
      url.searchParams.set('min_score', String(minScore));
      url.searchParams.set('limit', '100');

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      setData((json.data ?? []) as BandarFlow[]);
      setDataDate(json.date || '');
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengambil data');
    } finally {
      setLoading(false);
    }
  }, [minScore, selectedDate, today]);

  // Initial load + refetch when deps change
  useEffect(() => { fetchData(); }, [fetchData]);

  // Whale Tracker — fetch sekali per load (data EOD, jarang berubah intraday)
  useEffect(() => {
    fetch('/api/whale')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.brokers?.length > 0) setWhaleData(d); })
      .catch(() => {});
  }, []);

  // Auto-refresh 60s — hanya aktif saat lihat data hari ini
  useEffect(() => {
    if (!isToday) return;
    const interval = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(interval);
  }, [fetchData, isToday]);

  // ── Supabase Realtime — hanya aktif saat hari ini ──────────────────────── //

  useEffect(() => {
    if (!isToday) return;
    const channel = supabase
      .channel('phoenix-bandar-flow')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bandar_flow' },
        (payload) => {
          const updated = payload.new as BandarFlow;
          if (!updated?.ticker) return;
          if (updated.trade_date !== today) return;

          setData((prev) => {
            const idx = prev.findIndex(
              (r) => r.ticker === updated.ticker && r.trade_date === updated.trade_date,
            );
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = updated;
              return next.sort((a, b) => b.combined_score - a.combined_score);
            }
            if (updated.combined_score >= minScore) {
              return [updated, ...prev].sort((a, b) => b.combined_score - a.combined_score);
            }
            return prev;
          });
          setLastFetch(new Date());
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [minScore, isToday, today]);

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
          {/* Date picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <input
              type="date"
              value={selectedDate || today}
              max={today}
              onChange={e => setSelectedDate(e.target.value === today ? '' : e.target.value)}
              style={{
                padding: '0.25rem 0.5rem', background: 'var(--bg-card)',
                border: '1px solid var(--border-color)', borderRadius: '8px',
                color: 'var(--text-primary)', fontSize: '0.78rem',
                colorScheme: 'dark', outline: 'none',
              }}
            />
            {!isToday && (
              <button
                className="pf-refresh-btn"
                onClick={() => setSelectedDate('')}
                title="Kembali ke hari ini"
                style={{ color: '#38ef7d', borderColor: 'rgba(56,239,125,0.3)' }}
              >
                ⟳ Hari ini
              </button>
            )}
          </div>

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
          <button className="pf-refresh-btn" onClick={() => fetchData()} title="Refresh data">
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && (
        <div className="pf-stats">
          {/* Date badge */}
          {dataDate && (
            <span className="pf-stat-item" style={{
              background: isToday && dataDate === today
                ? 'rgba(56,239,125,0.12)' : 'rgba(251,191,36,0.12)',
              color: isToday && dataDate === today ? '#38ef7d' : '#fbbf24',
              padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem',
            }}>
              {isToday
                ? dataDate === today
                  ? `📅 ${dataDate}`
                  : `📅 ${dataDate} — hari ini belum ada data`
                : `📅 Historis: ${dataDate}`}
            </span>
          )}
          {data.length > 0 && (<>
            <span className="pf-stat-item">
              Total: <strong>{data.length}</strong>
            </span>
            <span className="pf-stat-item pf-stat-accum">
              ⬆ Akumulasi: <strong>{accumCount}</strong>
            </span>
            <span className="pf-stat-item pf-stat-distrib">
              ⬇ Distribusi: <strong>{distribCount}</strong>
            </span>
          </>)}
          {lastFetch && (
            <span className="pf-stat-item" style={{ marginLeft: 'auto', fontSize: '0.72rem', opacity: 0.7 }}>
              {isToday ? '⚡ realtime · ' : '📂 historis · '}
              {lastFetch.toLocaleTimeString('id-ID', {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                timeZone: 'Asia/Jakarta',
              })}
            </span>
          )}
        </div>
      )}

      {/* ── Whale Activity Banner ───────────────────────────────────────────── */}
      {whaleData && whaleData.brokers.length > 0 && (
        <div style={{
          margin: '0.75rem 0',
          padding: '0.7rem 1rem',
          background: 'rgba(244,196,48,0.06)',
          border: '1px solid rgba(244,196,48,0.2)',
          borderRadius: '10px',
          fontSize: '0.78rem',
        }}>
          <div style={{ fontWeight: 600, color: '#f4c430', marginBottom: '0.4rem' }}>
            🐋 Whale Activity — {whaleData.trade_date}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {whaleData.brokers.map(b => (
                <button
                  key={b.code}
                  onClick={() => setExpandedWhale(expandedWhale === b.code ? null : b.code)}
                  style={{
                    padding: '0.2rem 0.6rem', borderRadius: '6px', cursor: 'pointer',
                    background: expandedWhale === b.code ? 'rgba(244,196,48,0.2)' : 'rgba(244,196,48,0.1)',
                    border: `1px solid ${expandedWhale === b.code ? 'rgba(244,196,48,0.5)' : 'rgba(244,196,48,0.2)'}`,
                    color: '#f4c430', fontSize: '0.78rem',
                  }}
                >
                  <strong>{b.name}</strong>
                  <span style={{ opacity: 0.7 }}> {b.ticker_count} ticker · +{b.total_net.toFixed(1)}M</span>
                  <span style={{ marginLeft: '0.3rem', opacity: 0.5 }}>{expandedWhale === b.code ? '▴' : '▾'}</span>
                </button>
              ))}
            </div>
            {expandedWhale && (() => {
              const broker = whaleData.brokers.find(b => b.code === expandedWhale);
              if (!broker) return null;
              return (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(244,196,48,0.05)',
                  border: '1px solid rgba(244,196,48,0.15)',
                  borderRadius: '8px',
                  display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
                }}>
                  {broker.tickers.map(t => (
                    <button
                      key={t.ticker}
                      onClick={() => onAnalyze?.(t.ticker)}
                      style={{
                        padding: '0.15rem 0.5rem', borderRadius: '5px', cursor: 'pointer',
                        background: 'rgba(244,196,48,0.1)', border: '1px solid rgba(244,196,48,0.2)',
                        color: '#f4c430', fontSize: '0.72rem', fontWeight: 600,
                      }}
                      title={`+${t.net_value.toFixed(1)}M`}
                    >
                      {t.ticker}
                      <span style={{ fontWeight: 400, opacity: 0.65, marginLeft: '0.25rem' }}>
                        +{t.net_value.toFixed(0)}M
                      </span>
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
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
          <span>📊 {isToday ? 'Belum ada data bandar flow hari ini' : `Tidak ada data untuk ${dataDate || selectedDate}`}</span>
          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
            {isToday
              ? 'Phoenix Bot akan mengisi data saat signal masuk dari Telegram'
              : 'Coba pilih tanggal lain atau kembali ke hari ini'}
          </span>
        </div>
      ) : (
        <div className="pf-grid">
          {filtered.map((item) => (
            <BandarAccumCard
              key={`${item.ticker}-${item.trade_date}`}
              data={item}
              onAnalyze={onAnalyze}
              onChart={(t) => setChartTicker(t)}
            />
          ))}
        </div>
      )}
      {/* Flow Timeline Chart Modal */}
      {chartTicker && (
        <div
          onClick={() => setChartTicker(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '760px',
              maxHeight: '90vh', overflowY: 'auto',
              borderRadius: '16px',
            }}
          >
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: '0.5rem', padding: '0 0.25rem',
            }}>
              <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.9rem' }}>
                Flow Timeline — {chartTicker}
              </span>
              <button
                onClick={() => setChartTicker(null)}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px', padding: '0.3rem 0.7rem',
                  color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem',
                }}
              >
                ✕ Tutup
              </button>
            </div>
            <FlowTimelineChart ticker={chartTicker} />
          </div>
        </div>
      )}
    </div>
  );
}
