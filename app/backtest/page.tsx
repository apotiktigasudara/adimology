'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

// ── Algo Backtest Component ────────────────────────────────────────────────────

interface AlgoSummary {
  algo_name: string;
  total: number;
  wins: number;
  losses: number;
  win_rate: number;
  avg_forward_net: number;
}

interface AlgoSignalRow {
  ticker: string;
  algo_name: string;
  algo_type: string;
  signal_date: string;
  forward_net: number;
  result: 'WIN' | 'LOSS' | 'PENDING';
  forward_days_actual: number;
}

interface AlgoBacktestResponse {
  success: boolean;
  params: { days: number; forward_days: number; algo_type: string };
  overall: { total_signals: number; pending: number; wins: number; win_rate: number };
  summary: AlgoSummary[];
  recent_signals: AlgoSignalRow[];
  generated_at: string;
  error?: string;
}

function AlgoBacktest() {
  const [data, setData]         = useState<AlgoBacktestResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [days, setDays]         = useState(30);
  const [fwdDays, setFwdDays]   = useState(5);
  const [algoType, setAlgoType] = useState('positive');
  const [tab, setTab]           = useState<'summary' | 'signals'>('summary');

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await window.fetch(`/api/backtest/algo?days=${days}&forward_days=${fwdDays}&algo_type=${algoType}`);
      const json: AlgoBacktestResponse = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal');
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setLoading(false); }
  }, [days, fwdDays, algoType]);

  useEffect(() => { fetch(); }, [fetch]);

  const ov = data?.overall;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
          🤖 Algo Backtest
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Win rate per algo name dari chart_saham_bot · Forward SM flow {fwdDays} hari pasca sinyal
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Tipe:</span>
          {(['positive', 'negative', 'all'] as const).map(t => (
            <button key={t} onClick={() => setAlgoType(t)} style={{
              padding: '0.3rem 0.7rem', borderRadius: '8px', border: '1px solid',
              borderColor: algoType === t ? '#a78bfa' : 'var(--border-color)',
              background: algoType === t ? 'rgba(167,139,250,0.15)' : 'var(--bg-card)',
              color: algoType === t ? '#a78bfa' : 'var(--text-secondary)',
              fontSize: '0.78rem', cursor: 'pointer', fontWeight: algoType === t ? 600 : 400,
            }}>{t === 'positive' ? '⬆ Positif' : t === 'negative' ? '⬇ Negatif' : 'Semua'}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Hari data:</span>
          {[14, 30, 60, 90].map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid',
              borderColor: days === d ? '#4ade80' : 'var(--border-color)',
              background: days === d ? 'rgba(74,222,128,0.12)' : 'var(--bg-card)',
              color: days === d ? '#4ade80' : 'var(--text-secondary)',
              fontSize: '0.78rem', cursor: 'pointer', fontWeight: days === d ? 600 : 400,
            }}>{d}H</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Forward:</span>
          {[3, 5, 10, 15].map(d => (
            <button key={d} onClick={() => setFwdDays(d)} style={{
              padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid',
              borderColor: fwdDays === d ? '#fbbf24' : 'var(--border-color)',
              background: fwdDays === d ? 'rgba(251,191,36,0.12)' : 'var(--bg-card)',
              color: fwdDays === d ? '#fbbf24' : 'var(--text-secondary)',
              fontSize: '0.78rem', cursor: 'pointer', fontWeight: fwdDays === d ? 600 : 400,
            }}>{d}H</button>
          ))}
        </div>
        <button onClick={fetch} disabled={loading} style={{
          padding: '0.35rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border-color)',
          background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '0.8rem',
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
        }}>
          {loading ? '⏳ Running...' : '▶ Run'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1rem',
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
          color: '#f87171', fontSize: '0.85rem' }}>Error: {error}</div>
      )}

      {/* Overall stats */}
      {!loading && ov && (
        <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Total Sinyal', value: ov.total_signals, color: 'var(--text-primary)' },
            { label: '✅ WIN',       value: ov.wins,           color: '#4ade80' },
            { label: '❌ LOSS',      value: ov.total_signals - ov.wins, color: '#f87171' },
            { label: 'Win Rate',     value: `${ov.win_rate}%`, color: ov.win_rate >= 60 ? '#4ade80' : ov.win_rate >= 50 ? '#fbbf24' : '#f87171' },
            { label: '⏳ Pending',   value: ov.pending,        color: '#94a3b8' },
          ].map(c => (
            <div key={c.label} style={{ padding: '0.75rem 1rem', borderRadius: '12px',
              background: 'var(--bg-card)', border: '1px solid var(--border-color)', minWidth: '110px' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{c.label}</div>
              <div style={{ fontSize: '1.35rem', fontWeight: 700, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          ⏳ Menganalisa algo signals...
        </div>
      ) : !data?.summary?.length ? (
        <div style={{ padding: '2rem', textAlign: 'center', borderRadius: '14px',
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Tidak ada sinyal algo ditemukan. Coba perbesar rentang hari.
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {[{ key: 'summary', label: '📊 Per Algo Name' }, { key: 'signals', label: '📝 Sinyal Terbaru' }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key as any)} style={{
                padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid',
                borderColor: tab === t.key ? '#a78bfa' : 'var(--border-color)',
                background: tab === t.key ? 'rgba(167,139,250,0.15)' : 'transparent',
                color: tab === t.key ? '#a78bfa' : 'var(--text-secondary)',
                fontSize: '0.82rem', cursor: 'pointer', fontWeight: tab === t.key ? 600 : 400,
              }}>{t.label}</button>
            ))}
          </div>

          {tab === 'summary' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: '14px',
              border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    {['#', 'Algo Name', 'Sinyal', 'WIN', 'LOSS', 'Win Rate', 'Avg Fwd Net'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left',
                        color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.72rem',
                        borderBottom: '1px solid var(--border-color)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.summary.map((row, idx) => (
                    <tr key={row.algo_name} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.65rem 1rem', color: 'var(--text-secondary)', width: '32px' }}>{idx + 1}</td>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: '#a78bfa', maxWidth: '220px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.algo_name}</td>
                      <td style={{ padding: '0.65rem 1rem', color: 'var(--text-secondary)' }}>{row.total}</td>
                      <td style={{ padding: '0.65rem 1rem', color: '#4ade80', fontWeight: 600 }}>{row.wins}</td>
                      <td style={{ padding: '0.65rem 1rem', color: '#f87171', fontWeight: 600 }}>{row.losses}</td>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: 700,
                        color: row.win_rate >= 65 ? '#4ade80' : row.win_rate >= 50 ? '#fbbf24' : '#f87171' }}>
                        {row.win_rate}%
                      </td>
                      <td style={{ padding: '0.65rem 1rem', fontWeight: 600,
                        color: row.avg_forward_net >= 0 ? '#4ade80' : '#f87171' }}>
                        {row.avg_forward_net >= 0 ? '+' : ''}{row.avg_forward_net.toFixed(2)}M
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'signals' && (
            <div style={{ background: 'var(--bg-card)', borderRadius: '14px',
              border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                      {['Tanggal', 'Ticker', 'Algo Name', 'Forward Net', 'Hasil'].map(h => (
                        <th key={h} style={{ padding: '0.7rem 1rem', textAlign: 'left',
                          color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.72rem',
                          borderBottom: '1px solid var(--border-color)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_signals.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '0.6rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{s.signal_date}</td>
                        <td style={{ padding: '0.6rem 1rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{s.ticker}</td>
                        <td style={{ padding: '0.6rem 1rem', color: '#a78bfa', maxWidth: '200px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.algo_name}</td>
                        <td style={{ padding: '0.6rem 1rem', fontWeight: 600,
                          color: s.forward_net >= 0 ? '#4ade80' : '#f87171' }}>
                          {s.forward_net >= 0 ? '+' : ''}{s.forward_net.toFixed(2)}M
                        </td>
                        <td style={{ padding: '0.6rem 1rem' }}>
                          <span style={{ padding: '0.15rem 0.5rem', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 700,
                            color: s.result === 'WIN' ? '#4ade80' : '#f87171',
                            background: s.result === 'WIN' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)' }}>
                            {s.result === 'WIN' ? '✅ WIN' : '❌ LOSS'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface BucketStat {
  label: string;
  total: number;
  wins: number;
  win_rate: number;
  avg_fwd: number;
}

interface TickerStat {
  ticker: string;
  total: number;
  wins: number;
  win_rate: number;
  avg_fwd: number;
}

interface Signal {
  ticker: string;
  entry_date: string;
  entry_score: number;
  forward_net: number;
  result: 'WIN' | 'LOSS';
  forward_days_actual: number;
}

interface Summary {
  total_signals: number;
  wins: number;
  losses: number;
  win_rate: number;
  avg_forward_net: number;
  tickers_scanned: number;
  date_range: string;
}

interface BacktestResponse {
  success: boolean;
  params: { threshold: number; forward_days: number; look_back: number };
  summary: Summary | null;
  by_bucket: BucketStat[];
  by_ticker: TickerStat[];
  recent_signals: Signal[];
  generated_at: string;
  error?: string;
}

const THRESHOLD_OPTIONS = [50, 60, 70, 80];
const FORWARD_OPTIONS   = [5, 10, 15, 20];
const LOOKBACK_OPTIONS  = [30, 60, 90, 180];

function winRateColor(wr: number): string {
  if (wr >= 65) return '#4ade80';
  if (wr >= 50) return '#fbbf24';
  return '#f87171';
}

function fwdColor(v: number): string {
  return v >= 0 ? '#4ade80' : '#f87171';
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: BucketStat }>;
}

function BucketTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: 'var(--bg-card, #0f172a)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '10px', padding: '0.75rem 1rem',
      fontSize: '0.78rem', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
        Score {d.label}
      </div>
      <div style={{ color: winRateColor(d.win_rate) }}>Win Rate: <b>{d.win_rate}%</b></div>
      <div style={{ color: '#94a3b8' }}>Signals: {d.total}</div>
      <div style={{ color: fwdColor(d.avg_fwd) }}>Avg Forward: {d.avg_fwd >= 0 ? '+' : ''}{d.avg_fwd.toFixed(2)}M</div>
    </div>
  );
}

export default function BacktestPage() {
  const [mainTab, setMainTab]     = useState<'confluence' | 'algo'>('confluence');
  const [data, setData]           = useState<BacktestResponse | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [threshold, setThreshold] = useState(60);
  const [fwdDays, setFwdDays]     = useState(10);
  const [lookBack, setLookBack]   = useState(90);
  const [activeTab, setActiveTab] = useState<'overview' | 'tickers' | 'signals'>('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/backtest?threshold=${threshold}&forward_days=${fwdDays}&look_back=${lookBack}`);
      const json: BacktestResponse = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal memuat data');
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [threshold, fwdDays, lookBack]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const s = data?.summary;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Main tab switcher */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem',
        borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        {[
          { key: 'confluence', label: '📈 Confluence Backtest' },
          { key: 'algo',       label: '🤖 Algo Backtest' },
        ].map(t => (
          <button key={t.key} onClick={() => setMainTab(t.key as any)} style={{
            padding: '0.45rem 1.1rem', borderRadius: '8px', border: '1px solid',
            borderColor: mainTab === t.key ? 'var(--accent-primary)' : 'var(--border-color)',
            background: mainTab === t.key ? 'rgba(100,149,237,0.15)' : 'var(--bg-card)',
            color: mainTab === t.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontSize: '0.85rem', cursor: 'pointer', fontWeight: mainTab === t.key ? 600 : 400,
          }}>{t.label}</button>
        ))}
      </div>

      {mainTab === 'algo' && <AlgoBacktest />}
      {mainTab === 'confluence' && <>

      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
          📈 Backtest Mini
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Validasi sinyal confluence vs forward SM flow · WIN = SM terus akumulasi pasca sinyal
          {data?.generated_at && (
            <span style={{ marginLeft: '0.75rem', opacity: 0.6 }}>
              · {new Date(data.generated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
            </span>
          )}
        </p>
        <div style={{
          marginTop: '0.5rem', padding: '0.5rem 0.85rem', borderRadius: '8px',
          background: 'rgba(100,149,237,0.1)', border: '1px solid rgba(100,149,237,0.2)',
          fontSize: '0.75rem', color: '#94a3b8', display: 'inline-block',
        }}>
          💡 Metodologi: entry saat rolling 7H score melewati threshold →
          forward net SM+MF flow {fwdDays} hari berikutnya sebagai proxy return
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Threshold:</span>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Forward:</span>
          {FORWARD_OPTIONS.map(d => (
            <button key={d} onClick={() => setFwdDays(d)} style={{
              padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid',
              borderColor: fwdDays === d ? '#fbbf24' : 'var(--border-color)',
              background: fwdDays === d ? 'rgba(251,191,36,0.12)' : 'var(--bg-card)',
              color: fwdDays === d ? '#fbbf24' : 'var(--text-secondary)',
              fontWeight: fwdDays === d ? 600 : 400, fontSize: '0.8rem', cursor: 'pointer',
            }}>{d}H</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Look-back:</span>
          {LOOKBACK_OPTIONS.map(d => (
            <button key={d} onClick={() => setLookBack(d)} style={{
              padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid',
              borderColor: lookBack === d ? 'var(--accent-primary)' : 'var(--border-color)',
              background: lookBack === d ? 'rgba(100,149,237,0.15)' : 'var(--bg-card)',
              color: lookBack === d ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: lookBack === d ? 600 : 400, fontSize: '0.8rem', cursor: 'pointer',
            }}>{d}H</button>
          ))}
        </div>
        <button onClick={fetchData} disabled={loading} style={{
          padding: '0.35rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border-color)',
          background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '0.8rem',
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
        }}>
          {loading ? '⏳ Running...' : '▶ Run Backtest'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1rem',
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
          color: '#f87171', fontSize: '0.85rem',
        }}>Error: {error}</div>
      )}

      {/* Summary cards */}
      {!loading && s && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.65rem', marginBottom: '1.5rem',
        }}>
          {[
            { label: 'Total Sinyal',    value: s.total_signals,                  color: 'var(--text-primary)' },
            { label: '✅ Win',          value: s.wins,                            color: '#4ade80' },
            { label: '❌ Loss',         value: s.losses,                          color: '#f87171' },
            { label: 'Win Rate',        value: `${s.win_rate}%`,                  color: winRateColor(s.win_rate) },
            { label: 'Avg Forward SM',  value: `${s.avg_forward_net >= 0 ? '+' : ''}${s.avg_forward_net.toFixed(2)}M`, color: fwdColor(s.avg_forward_net) },
            { label: 'Ticker Dipindai', value: s.tickers_scanned,                 color: 'var(--text-secondary)' },
          ].map(card => (
            <div key={card.label} style={{
              padding: '0.85rem 1rem', borderRadius: '12px',
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>{card.label}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{
          height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)', fontSize: '0.9rem',
        }}>
          ⏳ Menjalankan backtest...
        </div>
      ) : !s || s.total_signals === 0 ? (
        <div style={{
          padding: '3rem', textAlign: 'center', borderRadius: '14px',
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)', fontSize: '0.9rem',
        }}>
          Tidak ada sinyal ditemukan untuk parameter ini. Coba turunkan threshold atau perbesar look-back.
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {([
              { key: 'overview', label: '📊 Score Breakdown' },
              { key: 'tickers',  label: '📋 Per Ticker' },
              { key: 'signals',  label: '📝 Sinyal Terbaru' },
            ] as const).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid',
                borderColor: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--border-color)',
                background: activeTab === tab.key ? 'rgba(100,149,237,0.15)' : 'transparent',
                color: activeTab === tab.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontSize: '0.82rem', cursor: 'pointer', fontWeight: activeTab === tab.key ? 600 : 400,
              }}>{tab.label}</button>
            ))}
          </div>

          {/* Tab: Overview — Score Bucket Chart */}
          {activeTab === 'overview' && data?.by_bucket && (
            <div style={{
              background: 'var(--bg-card)', borderRadius: '14px',
              border: '1px solid var(--border-color)', padding: '1.25rem',
            }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                Win Rate per Score Bucket — Forward {fwdDays} Hari
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.by_bucket} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${v}%`} width={38} />
                  <Tooltip content={<BucketTooltip />} />
                  <ReferenceLine y={50} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
                  <Bar dataKey="win_rate" radius={[6, 6, 0, 0]} maxBarSize={60} name="Win Rate">
                    {data.by_bucket.map((entry, idx) => (
                      <Cell key={idx} fill={winRateColor(entry.win_rate)} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      {['Score Bucket', 'Total Sinyal', 'WIN', 'LOSS', 'Win Rate', 'Avg Forward Net'].map(h => (
                        <th key={h} style={{
                          padding: '0.6rem 1rem', textAlign: 'left',
                          color: 'var(--text-secondary)', fontWeight: 600,
                          fontSize: '0.72rem', borderBottom: '1px solid var(--border-color)',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_bucket.filter(b => b.total > 0).map(b => (
                      <tr key={b.label} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{b.label}</td>
                        <td style={{ padding: '0.65rem 1rem', color: 'var(--text-secondary)' }}>{b.total}</td>
                        <td style={{ padding: '0.65rem 1rem', color: '#4ade80', fontWeight: 600 }}>{b.wins}</td>
                        <td style={{ padding: '0.65rem 1rem', color: '#f87171', fontWeight: 600 }}>{b.total - b.wins}</td>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: 700, color: winRateColor(b.win_rate) }}>{b.win_rate}%</td>
                        <td style={{ padding: '0.65rem 1rem', color: fwdColor(b.avg_fwd), fontWeight: 600 }}>
                          {b.avg_fwd >= 0 ? '+' : ''}{b.avg_fwd.toFixed(2)}M
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Interpretation */}
              <div style={{
                marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '10px',
                background: 'rgba(100,149,237,0.07)', border: '1px solid rgba(100,149,237,0.15)',
                fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.6,
              }}>
                <b style={{ color: '#6495ed' }}>Cara baca:</b>
                {' '}Win Rate {'>'}65% = sinyal reliable · 50–65% = moderate ·
                Avg Forward Net {'>'} 0 = SM terus akumulasi pasca sinyal (bullish confirmation)
              </div>
            </div>
          )}

          {/* Tab: Per Ticker */}
          {activeTab === 'tickers' && data?.by_ticker && (
            <div style={{
              background: 'var(--bg-card)', borderRadius: '14px',
              border: '1px solid var(--border-color)', overflow: 'hidden',
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                      {['#', 'Ticker', 'Total Sinyal', 'WIN', 'LOSS', 'Win Rate', 'Avg Forward Net'].map(h => (
                        <th key={h} style={{
                          padding: '0.75rem 1rem', textAlign: 'left',
                          color: 'var(--text-secondary)', fontWeight: 600,
                          fontSize: '0.72rem', letterSpacing: '0.04em',
                          borderBottom: '1px solid var(--border-color)',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_ticker.map((row, idx) => (
                      <tr key={row.ticker} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.7rem 1rem', color: 'var(--text-secondary)', width: '36px' }}>{idx + 1}</td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          <a
                            href={`/confluence?search=${row.ticker}`}
                            style={{ fontWeight: 700, color: 'var(--accent-primary)', textDecoration: 'none', fontSize: '0.9rem' }}
                          >
                            {row.ticker}
                          </a>
                        </td>
                        <td style={{ padding: '0.7rem 1rem', color: 'var(--text-secondary)' }}>{row.total}</td>
                        <td style={{ padding: '0.7rem 1rem', color: '#4ade80', fontWeight: 600 }}>{row.wins}</td>
                        <td style={{ padding: '0.7rem 1rem', color: '#f87171', fontWeight: 600 }}>{row.total - row.wins}</td>
                        <td style={{ padding: '0.7rem 1rem', fontWeight: 700, color: winRateColor(row.win_rate) }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              width: '60px', height: '6px', borderRadius: '3px',
                              background: 'var(--border-color)', overflow: 'hidden',
                            }}>
                              <div style={{
                                width: `${row.win_rate}%`, height: '100%',
                                background: winRateColor(row.win_rate), borderRadius: '3px',
                              }} />
                            </div>
                            {row.win_rate}%
                          </div>
                        </td>
                        <td style={{ padding: '0.7rem 1rem', fontWeight: 600, color: fwdColor(row.avg_fwd) }}>
                          {row.avg_fwd >= 0 ? '+' : ''}{row.avg_fwd.toFixed(2)}M
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab: Recent Signals */}
          {activeTab === 'signals' && data?.recent_signals && (
            <div style={{
              background: 'var(--bg-card)', borderRadius: '14px',
              border: '1px solid var(--border-color)', overflow: 'hidden',
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                      {['Tanggal', 'Ticker', 'Entry Score', 'Forward Net', 'Hari', 'Hasil'].map(h => (
                        <th key={h} style={{
                          padding: '0.75rem 1rem', textAlign: 'left',
                          color: 'var(--text-secondary)', fontWeight: 600,
                          fontSize: '0.72rem', borderBottom: '1px solid var(--border-color)',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_signals.map((sig, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.65rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {sig.entry_date}
                        </td>
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <a
                            href={`/confluence?search=${sig.ticker}`}
                            style={{ fontWeight: 700, color: 'var(--accent-primary)', textDecoration: 'none' }}
                          >
                            {sig.ticker}
                          </a>
                        </td>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: 600,
                          color: sig.entry_score >= 70 ? '#4ade80' : sig.entry_score >= 50 ? '#fbbf24' : '#94a3b8' }}>
                          {sig.entry_score}
                        </td>
                        <td style={{ padding: '0.65rem 1rem', fontWeight: 600, color: fwdColor(sig.forward_net) }}>
                          {sig.forward_net >= 0 ? '+' : ''}{sig.forward_net.toFixed(2)}M
                        </td>
                        <td style={{ padding: '0.65rem 1rem', color: 'var(--text-secondary)' }}>
                          {sig.forward_days_actual}H
                        </td>
                        <td style={{ padding: '0.65rem 1rem' }}>
                          <span style={{
                            padding: '0.15rem 0.55rem', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 700,
                            color: sig.result === 'WIN' ? '#4ade80' : '#f87171',
                            background: sig.result === 'WIN' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                          }}>
                            {sig.result === 'WIN' ? '✅ WIN' : '❌ LOSS'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{
                padding: '0.5rem 1rem', borderTop: '1px solid var(--border-color)',
                fontSize: '0.7rem', color: 'var(--text-secondary)',
              }}>
                Menampilkan {data.recent_signals.length} sinyal terbaru · Threshold {threshold} · Forward {fwdDays}H · Look-back {lookBack}H
              </div>
            </div>
          )}
        </>
      )}
      </>}
    </div>
  );
}
