'use client';

import { useState, useEffect } from 'react';
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';

interface ChartRow {
  date: string;
  sm: number | null;
  bm: number | null;
  net_sm: number | null;
  mfp: number | null;
  mfn: number | null;
  net_mf: number | null;
  sm_10d: number | null;
  sm_30d: number | null;
}

interface SmAnalysisResponse {
  success: boolean;
  ticker: string;
  days: number;
  verdict: string;
  summary: {
    net_sm: number;
    net_mf: number;
    total_sm: number;
    total_bm: number;
    total_mfp: number;
    total_mfn: number;
  };
  chart: ChartRow[];
  error?: string;
}

type ViewMode = 'SM' | 'MF' | 'NET';

const COLORS = {
  sm:  '#38bdf8',   // sky blue — Smart Money
  bm:  '#f87171',   // red — Bad Money
  mfp: '#4ade80',   // green — MF+
  mfn: '#fb923c',   // orange — MF-
  net_sm: '#818cf8',  // indigo — net SM line
  net_mf: '#f472b6',  // pink — net MF line
  grid: 'rgba(255,255,255,0.06)',
};

function fmtDate(d: string): string {
  // "2026-04-05" → "05/04"
  const parts = d.split('-');
  return `${parts[2]}/${parts[1]}`;
}

function fmtMiliar(v: number | undefined): string {
  if (v === undefined || v === null) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}M`;
}

interface TooltipPayload {
  dataKey: string;
  value: number;
  color: string;
  name: string;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{
      background: 'var(--bg-card, #1a1a2e)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '10px',
      padding: '0.75rem 1rem',
      fontSize: '0.78rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      minWidth: '160px',
    }}>
      <div style={{ color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.5rem', fontWeight: 600 }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.2rem' }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ color: 'var(--text-primary, #f1f5f9)', fontWeight: 600 }}>
            {p.value != null ? `${p.value >= 0 ? '+' : ''}${Number(p.value).toFixed(2)}M` : '—'}
          </span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  ticker: string;
  days?: number;
}

export default function FlowTimelineChart({ ticker, days = 30 }: Props) {
  const [data, setData]       = useState<ChartRow[]>([]);
  const [summary, setSummary] = useState<SmAnalysisResponse['summary'] | null>(null);
  const [verdict, setVerdict] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [mode, setMode]       = useState<ViewMode>('SM');
  const [daysState, setDaysState] = useState(days);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/sm-analysis?ticker=${ticker}&days=${daysState}`)
      .then(r => r.json())
      .then((json: SmAnalysisResponse) => {
        if (cancelled) return;
        if (!json.success) throw new Error(json.error || 'Gagal fetch data');
        setData(json.chart || []);
        setSummary(json.summary || null);
        setVerdict(json.verdict || '');
        setLoading(false);
      })
      .catch(e => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [ticker, daysState]);

  const chartData = data.map(r => ({ ...r, date_fmt: fmtDate(r.date) }));

  const verdictColor =
    verdict === 'AKUMULASI' ? '#4ade80' :
    verdict === 'DISTRIBUSI' ? '#f87171' : '#94a3b8';

  return (
    <div style={{
      background: 'var(--bg-card, #0f172a)',
      border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
      borderRadius: '14px',
      padding: '1.25rem',
      marginTop: '0.5rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap',
        gap: '0.75rem', marginBottom: '1rem',
      }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent-primary, #6495ed)' }}>
            {ticker}
          </span>
          <span style={{
            marginLeft: '0.5rem', fontSize: '0.72rem', fontWeight: 700,
            padding: '0.15rem 0.5rem', borderRadius: '5px',
            color: verdictColor,
            background: `${verdictColor}18`,
            border: `1px solid ${verdictColor}44`,
          }}>
            {verdict}
          </span>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto' }}>
          {(['SM', 'MF', 'NET'] as ViewMode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '0.3rem 0.7rem', borderRadius: '7px', border: '1px solid',
                borderColor: mode === m ? 'var(--accent-primary, #6495ed)' : 'var(--border-color, rgba(255,255,255,0.1))',
                background: mode === m ? 'rgba(100,149,237,0.15)' : 'transparent',
                color: mode === m ? 'var(--accent-primary, #6495ed)' : 'var(--text-secondary, #94a3b8)',
                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {m === 'SM' ? 'SM/BM' : m === 'MF' ? 'MF+/MF-' : 'NET'}
            </button>
          ))}
        </div>

        {/* Days selector */}
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {[14, 30, 60].map(d => (
            <button
              key={d}
              onClick={() => setDaysState(d)}
              style={{
                padding: '0.3rem 0.6rem', borderRadius: '7px', border: '1px solid',
                borderColor: daysState === d ? '#fbbf24' : 'var(--border-color, rgba(255,255,255,0.1))',
                background: daysState === d ? 'rgba(251,191,36,0.12)' : 'transparent',
                color: daysState === d ? '#fbbf24' : 'var(--text-secondary, #94a3b8)',
                fontSize: '0.72rem', cursor: 'pointer',
              }}
            >
              {d}H
            </button>
          ))}
        </div>
      </div>

      {/* Summary chips */}
      {summary && !loading && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem',
        }}>
          {[
            { label: 'SM',   value: summary.total_sm,   color: COLORS.sm },
            { label: 'BM',   value: summary.total_bm,   color: COLORS.bm },
            { label: 'Net SM', value: summary.net_sm,   color: summary.net_sm >= 0 ? '#4ade80' : '#f87171' },
            { label: 'MF+',  value: summary.total_mfp,  color: COLORS.mfp },
            { label: 'MF-',  value: summary.total_mfn,  color: COLORS.mfn },
            { label: 'Net MF', value: summary.net_mf,   color: summary.net_mf >= 0 ? '#4ade80' : '#f87171' },
          ].map(chip => (
            <div key={chip.label} style={{
              padding: '0.25rem 0.65rem', borderRadius: '7px',
              background: `${chip.color}12`,
              border: `1px solid ${chip.color}33`,
              fontSize: '0.72rem',
            }}>
              <span style={{ color: 'var(--text-secondary, #94a3b8)' }}>{chip.label}: </span>
              <span style={{ color: chip.color, fontWeight: 700 }}>
                {chip.value >= 0 ? '+' : ''}{chip.value.toFixed(2)}M
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {loading && (
        <div style={{
          height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem',
        }}>
          ⏳ Loading chart {ticker}...
        </div>
      )}

      {error && (
        <div style={{
          height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#f87171', fontSize: '0.85rem',
        }}>
          Error: {error}
        </div>
      )}

      {!loading && !error && chartData.length === 0 && (
        <div style={{
          height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary, #94a3b8)', fontSize: '0.85rem',
        }}>
          Belum ada data flow untuk {ticker} dalam {daysState} hari terakhir.
        </div>
      )}

      {!loading && !error && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis
              dataKey="date_fmt"
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
              width={42}
              tickFormatter={v => `${v > 0 ? '+' : ''}${Number(v).toFixed(0)}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: '0.72rem', paddingTop: '0.5rem' }}
              iconType="circle"
              iconSize={8}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

            {/* SM/BM mode */}
            {mode === 'SM' && (
              <>
                <Bar dataKey="sm"  name="SM"  fill={COLORS.sm}  radius={[3,3,0,0]} maxBarSize={18} />
                <Bar dataKey="bm"  name="BM"  fill={COLORS.bm}  radius={[3,3,0,0]} maxBarSize={18} />
                <Line
                  dataKey="net_sm" name="Net SM"
                  stroke={COLORS.net_sm} strokeWidth={2}
                  dot={false} type="monotone"
                />
              </>
            )}

            {/* MF mode */}
            {mode === 'MF' && (
              <>
                <Bar dataKey="mfp" name="MF+" fill={COLORS.mfp} radius={[3,3,0,0]} maxBarSize={18} />
                <Bar dataKey="mfn" name="MF-" fill={COLORS.mfn} radius={[3,3,0,0]} maxBarSize={18} />
                <Line
                  dataKey="net_mf" name="Net MF"
                  stroke={COLORS.net_mf} strokeWidth={2}
                  dot={false} type="monotone"
                />
              </>
            )}

            {/* NET combined mode */}
            {mode === 'NET' && (
              <>
                <Bar dataKey="net_sm" name="Net SM" fill={COLORS.net_sm} radius={[3,3,0,0]} maxBarSize={14} />
                <Bar dataKey="net_mf" name="Net MF" fill={COLORS.net_mf} radius={[3,3,0,0]} maxBarSize={14} />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {!loading && !error && chartData.length > 0 && (
        <div style={{
          fontSize: '0.68rem', color: 'var(--text-secondary, #64748b)',
          marginTop: '0.5rem', textAlign: 'center',
        }}>
          Nilai dalam Miliar IDR · {chartData.length} hari data · Klik mode untuk ganti tampilan
        </div>
      )}
    </div>
  );
}
