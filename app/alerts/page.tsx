'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

type AlertType = 'KUAT' | 'SPIKE' | 'BULLISH_CROSS' | 'BEARISH_CROSS';

interface AlertItem {
  ticker: string;
  alert_type: AlertType;
  confluence_score: number;
  net_today: number;
  net_avg5d: number;
  spike_ratio: number | null;
  sm_today: number;
  bm_today: number;
  mfp_today: number;
  mfn_today: number;
  description: string;
}

interface AlertResponse {
  success: boolean;
  threshold: number;
  days: number;
  latest_date: string;
  total: number;
  alerts: AlertItem[];
  generated_at: string;
  error?: string;
}

const ALERT_CONFIG: Record<AlertType, { label: string; emoji: string; color: string; bg: string }> = {
  KUAT:         { label: 'Confluence Kuat',  emoji: '🔥', color: '#4ade80', bg: 'rgba(74,222,128,0.12)'  },
  SPIKE:        { label: 'Spike Alert',      emoji: '⚡', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)'  },
  BULLISH_CROSS:{ label: 'Bullish Reversal', emoji: '🟢', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)'  },
  BEARISH_CROSS:{ label: 'Bearish Reversal', emoji: '🔴', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

const THRESHOLD_OPTIONS = [50, 60, 70, 80];
const DAYS_OPTIONS = [3, 5, 7, 14];

function fmt(v: number, decimals = 2): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(decimals)}`;
}

function AlertBadge({ type }: { type: AlertType }) {
  const cfg = ALERT_CONFIG[type];
  return (
    <span style={{
      padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.7rem',
      fontWeight: 700, letterSpacing: '0.03em',
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}44`,
      whiteSpace: 'nowrap',
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      padding: '0.85rem 1rem', borderRadius: '12px',
      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

export default function AlertsPage() {
  const [data, setData]             = useState<AlertResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [threshold, setThreshold]   = useState(60);
  const [days, setDays]             = useState(7);
  const [filterType, setFilterType] = useState<AlertType | 'ALL'>('ALL');
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/alert-center?threshold=${threshold}&days=${days}`);
      const json: AlertResponse = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal memuat data');
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [threshold, days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh setiap 5 menit jika diaktifkan
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchData(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const filtered = (data?.alerts ?? []).filter(a =>
    filterType === 'ALL' || a.alert_type === filterType
  );

  const counts = {
    KUAT:          data?.alerts.filter(a => a.alert_type === 'KUAT').length          ?? 0,
    SPIKE:         data?.alerts.filter(a => a.alert_type === 'SPIKE').length         ?? 0,
    BULLISH_CROSS: data?.alerts.filter(a => a.alert_type === 'BULLISH_CROSS').length ?? 0,
    BEARISH_CROSS: data?.alerts.filter(a => a.alert_type === 'BEARISH_CROSS').length ?? 0,
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        .alert-row:hover { background: rgba(255,255,255,0.03) !important; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
          🚨 Alert Center
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Deteksi otomatis: Confluence Kuat · Spike Inflow · Reversal Signal
          {data?.generated_at && (
            <span style={{ marginLeft: '0.75rem', opacity: 0.6 }}>
              · Update: {new Date(data.generated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
            </span>
          )}
          {data?.latest_date && (
            <span style={{ marginLeft: '0.5rem', opacity: 0.6 }}>
              · Data terakhir: {data.latest_date}
            </span>
          )}
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        {/* Threshold */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Min Score:</span>
          {THRESHOLD_OPTIONS.map(t => (
            <button key={t} onClick={() => setThreshold(t)} style={{
              padding: '0.35rem 0.7rem', borderRadius: '8px', border: '1px solid',
              borderColor: threshold === t ? '#4ade80' : 'var(--border-color)',
              background: threshold === t ? 'rgba(74,222,128,0.12)' : 'var(--bg-card)',
              color: threshold === t ? '#4ade80' : 'var(--text-secondary)',
              fontWeight: threshold === t ? 700 : 400, fontSize: '0.8rem', cursor: 'pointer',
            }}>{t}</button>
          ))}
        </div>

        {/* Days */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Rolling:</span>
          {DAYS_OPTIONS.map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid',
              borderColor: days === d ? 'var(--accent-primary)' : 'var(--border-color)',
              background: days === d ? 'rgba(100,149,237,0.15)' : 'var(--bg-card)',
              color: days === d ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: days === d ? 600 : 400, fontSize: '0.8rem', cursor: 'pointer',
            }}>{d}H</button>
          ))}
        </div>

        {/* Auto refresh toggle */}
        <button
          onClick={() => setAutoRefresh(v => !v)}
          style={{
            padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid',
            borderColor: autoRefresh ? '#fbbf24' : 'var(--border-color)',
            background: autoRefresh ? 'rgba(251,191,36,0.1)' : 'var(--bg-card)',
            color: autoRefresh ? '#fbbf24' : 'var(--text-secondary)',
            fontSize: '0.78rem', cursor: 'pointer',
          }}
        >
          {autoRefresh ? '⏱ Auto ON' : '⏱ Auto OFF'}
        </button>

        <button onClick={fetchData} disabled={loading} style={{
          padding: '0.35rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border-color)',
          background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '0.8rem',
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
        }}>
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Summary cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '0.65rem', marginBottom: '1.25rem',
      }}>
        <SummaryCard label="Total Alert" value={data?.total ?? 0} color="var(--text-primary)" />
        <SummaryCard label="🔥 Confluence Kuat"  value={counts.KUAT}          color="#4ade80" />
        <SummaryCard label="⚡ Spike Inflow"     value={counts.SPIKE}         color="#fbbf24" />
        <SummaryCard label="🟢 Bullish Reversal" value={counts.BULLISH_CROSS} color="#38bdf8" />
        <SummaryCard label="🔴 Bearish Reversal" value={counts.BEARISH_CROSS} color="#f87171" />
      </div>

      {error && (
        <div style={{
          padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1rem',
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
          color: '#f87171', fontSize: '0.85rem',
        }}>
          Error: {error}
        </div>
      )}

      {/* Type filter tabs */}
      {!loading && data && data.alerts.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {(['ALL', 'KUAT', 'SPIKE', 'BULLISH_CROSS', 'BEARISH_CROSS'] as const).map(t => {
            const cfg = t === 'ALL' ? null : ALERT_CONFIG[t];
            const count = t === 'ALL' ? data.alerts.length : counts[t];
            return (
              <button key={t} onClick={() => setFilterType(t)} style={{
                padding: '0.3rem 0.75rem', borderRadius: '8px', border: '1px solid',
                borderColor: filterType === t ? (cfg?.color ?? 'var(--accent-primary)') : 'var(--border-color)',
                background: filterType === t ? `${cfg?.color ?? '#6495ed'}18` : 'transparent',
                color: filterType === t ? (cfg?.color ?? 'var(--accent-primary)') : 'var(--text-secondary)',
                fontSize: '0.78rem', cursor: 'pointer', fontWeight: filterType === t ? 600 : 400,
              }}>
                {t === 'ALL' ? `Semua (${count})` : `${cfg?.emoji} ${cfg?.label} (${count})`}
              </button>
            );
          })}
        </div>
      )}

      {/* Alert table */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: '14px',
        border: '1px solid var(--border-color)', overflow: 'hidden',
      }}>
        {loading ? (
          <div style={{
            padding: '3rem', textAlign: 'center',
            color: 'var(--text-secondary)', fontSize: '0.9rem',
          }}>
            ⏳ Mendeteksi alerts...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: '3rem', textAlign: 'center',
            color: 'var(--text-secondary)', fontSize: '0.9rem',
          }}>
            {data?.alerts.length === 0
              ? `Tidak ada alert untuk threshold ${threshold} dalam ${days} hari terakhir.`
              : `Tidak ada alert tipe "${filterType}".`}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['#', 'Ticker', 'Tipe Alert', 'Score', 'Net Hari Ini', 'Avg 5H', 'Spike', 'SM/BM', 'MF+/MF-', 'Deskripsi'].map(h => (
                    <th key={h} style={{
                      padding: '0.75rem 1rem', textAlign: 'left',
                      color: 'var(--text-secondary)', fontWeight: 600,
                      fontSize: '0.72rem', letterSpacing: '0.04em',
                      borderBottom: '1px solid var(--border-color)',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((alert, idx) => {
                  const cfg = ALERT_CONFIG[alert.alert_type];
                  return (
                    <tr
                      key={`${alert.ticker}-${alert.alert_type}`}
                      className="alert-row"
                      style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}
                    >
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', width: '36px' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <Link
                          href={`/confluence?search=${alert.ticker}`}
                          style={{ fontWeight: 700, color: 'var(--accent-primary)', textDecoration: 'none', fontSize: '0.9rem' }}
                        >
                          {alert.ticker}
                        </Link>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <AlertBadge type={alert.alert_type} />
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{
                          fontWeight: 700, fontSize: '0.9rem',
                          color: alert.confluence_score >= 70 ? '#4ade80'
                               : alert.confluence_score >= 50 ? '#fbbf24' : 'var(--text-secondary)',
                        }}>
                          {alert.confluence_score}
                        </span>
                      </td>
                      <td style={{
                        padding: '0.75rem 1rem', fontWeight: 600,
                        color: alert.net_today >= 0 ? '#4ade80' : '#f87171',
                      }}>
                        {fmt(alert.net_today)}M
                      </td>
                      <td style={{
                        padding: '0.75rem 1rem',
                        color: alert.net_avg5d >= 0 ? '#4ade8088' : '#f8717188',
                      }}>
                        {fmt(alert.net_avg5d)}M
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#fbbf24', fontWeight: 600 }}>
                        {alert.spike_ratio !== null ? `${alert.spike_ratio >= 0 ? '+' : ''}${alert.spike_ratio}x` : '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                        <span style={{ color: '#38bdf8' }}>+{alert.sm_today.toFixed(1)}</span>
                        {' / '}
                        <span style={{ color: '#f87171' }}>-{alert.bm_today.toFixed(1)}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                        <span style={{ color: '#4ade80' }}>+{alert.mfp_today.toFixed(1)}</span>
                        {' / '}
                        <span style={{ color: '#fb923c' }}>-{alert.mfn_today.toFixed(1)}</span>
                      </td>
                      <td style={{
                        padding: '0.75rem 1rem', color: 'var(--text-secondary)',
                        fontSize: '0.75rem', maxWidth: '280px',
                      }}>
                        {alert.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{
            padding: '0.5rem 1rem', borderTop: '1px solid var(--border-color)',
            fontSize: '0.7rem', color: 'var(--text-secondary)',
            display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
          }}>
            <span>{filtered.length} alert · Threshold {threshold} · Rolling {days} hari</span>
            <span>KUAT ≥{threshold} · SPIKE ≥2.5x avg · CROSS = net balik arah</span>
          </div>
        )}
      </div>
    </div>
  );
}
