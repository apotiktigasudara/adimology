'use client';

import { useState, useEffect, useCallback } from 'react';

interface DayCell {
  net: number;
  sm: number;
  bm: number;
  mfp: number;
  mfn: number;
  ticker_count: number;
  tickers: string[];
}

interface SectorRow {
  name: string;
  total_net: number;
  ticker_count: number;
  days: Record<string, DayCell>;
}

interface HeatmapResponse {
  success: boolean;
  days: number;
  mode: string;
  dates: string[];
  sectors: SectorRow[];
  generated_at: string;
  error?: string;
}

type Mode = 'COMBINED' | 'SM' | 'MF';

const DAYS_OPTIONS = [7, 14, 21, 30];
const MODE_OPTIONS: { label: string; value: Mode }[] = [
  { label: 'SM + MF', value: 'COMBINED' },
  { label: 'SM/BM', value: 'SM' },
  { label: 'MF+/MF-', value: 'MF' },
];

function fmtDate(d: string): string {
  const parts = d.split('-');
  return `${parts[2]}/${parts[1]}`;
}

function fmtMiliar(v: number): string {
  const abs = Math.abs(v);
  if (abs === 0) return '0';
  if (abs >= 1000) return `${(v / 1000).toFixed(1)}T`;
  if (abs >= 100)  return `${v.toFixed(0)}M`;
  return `${v.toFixed(1)}M`;
}

// Color scale: negative red → neutral grey → positive green
function netColor(net: number, maxAbs: number): string {
  if (maxAbs === 0) return 'rgba(148,163,184,0.12)';
  const ratio = Math.min(Math.abs(net) / maxAbs, 1);
  const alpha = 0.15 + ratio * 0.65;
  if (net > 0) return `rgba(74,222,128,${alpha})`;  // green
  if (net < 0) return `rgba(248,113,113,${alpha})`;  // red
  return 'rgba(148,163,184,0.10)';
}

function netTextColor(net: number): string {
  if (net > 0) return '#4ade80';
  if (net < 0) return '#f87171';
  return '#64748b';
}

interface Tooltip {
  sector: string;
  date: string;
  cell: DayCell;
  x: number;
  y: number;
}

export default function HeatmapPage() {
  const [data, setData]             = useState<HeatmapResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [days, setDays]             = useState(14);
  const [mode, setMode]             = useState<Mode>('COMBINED');
  const [tooltip, setTooltip]       = useState<Tooltip | null>(null);
  const [selected, setSelected]     = useState<{ sector: string; date: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/sector-heatmap?days=${days}&mode=${mode}`);
      const json: HeatmapResponse = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal memuat data');
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [days, mode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Find global max abs net for color scaling
  const maxAbsNet = data ? Math.max(
    ...data.sectors.flatMap(s => Object.values(s.days).map(d => Math.abs(d.net))),
    0.01
  ) : 0.01;

  const selectedCell = selected && data
    ? data.sectors.find(s => s.name === selected.sector)?.days[selected.date] ?? null
    : null;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      <style>{`
        .hm-cell { cursor: pointer; transition: outline 0.1s; }
        .hm-cell:hover { outline: 2px solid rgba(100,149,237,0.7); outline-offset: -2px; z-index: 1; position: relative; }
        .hm-cell.selected { outline: 2px solid #6495ed; outline-offset: -2px; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
          🔥 Sector Heatmap
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Net money flow per sektor per hari · Hijau = akumulasi · Merah = distribusi
          {data?.generated_at && (
            <span style={{ marginLeft: '0.75rem', opacity: 0.6 }}>
              · {new Date(data.generated_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
            </span>
          )}
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        {/* Days */}
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {DAYS_OPTIONS.map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid',
              borderColor: days === d ? 'var(--accent-primary)' : 'var(--border-color)',
              background: days === d ? 'rgba(100,149,237,0.15)' : 'var(--bg-card)',
              color: days === d ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: days === d ? 600 : 400, fontSize: '0.8rem', cursor: 'pointer',
            }}>{d}H</button>
          ))}
        </div>

        {/* Mode */}
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {MODE_OPTIONS.map(m => (
            <button key={m.value} onClick={() => setMode(m.value)} style={{
              padding: '0.35rem 0.75rem', borderRadius: '8px', border: '1px solid',
              borderColor: mode === m.value ? '#fbbf24' : 'var(--border-color)',
              background: mode === m.value ? 'rgba(251,191,36,0.12)' : 'var(--bg-card)',
              color: mode === m.value ? '#fbbf24' : 'var(--text-secondary)',
              fontWeight: mode === m.value ? 600 : 400, fontSize: '0.8rem', cursor: 'pointer',
            }}>{m.label}</button>
          ))}
        </div>

        <button onClick={fetchData} disabled={loading} style={{
          padding: '0.35rem 0.9rem', borderRadius: '8px', border: '1px solid var(--border-color)',
          background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '0.8rem',
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
        }}>
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '1rem 1.25rem', borderRadius: '10px',
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
          color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem',
        }}>
          Error: {error}
        </div>
      )}

      {/* Heatmap grid */}
      {loading ? (
        <div style={{
          height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)', fontSize: '0.85rem',
          background: 'var(--bg-card)', borderRadius: '14px',
          border: '1px solid var(--border-color)',
        }}>
          ⏳ Memuat heatmap...
        </div>
      ) : data && data.sectors.length > 0 ? (
        <div style={{
          background: 'var(--bg-card)', borderRadius: '14px',
          border: '1px solid var(--border-color)', overflow: 'auto',
        }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: '3px', padding: '1rem', minWidth: 'max-content' }}>
            <thead>
              <tr>
                {/* Sector label column */}
                <th style={{
                  textAlign: 'left', padding: '0.4rem 0.75rem',
                  fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600,
                  whiteSpace: 'nowrap', minWidth: '160px',
                }}>
                  Sektor
                </th>
                {/* Total column */}
                <th style={{
                  textAlign: 'center', padding: '0.4rem 0.5rem',
                  fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  Total
                </th>
                {/* Date columns */}
                {data.dates.map(date => (
                  <th key={date} style={{
                    textAlign: 'center', padding: '0.4rem 0.3rem',
                    fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 500,
                    whiteSpace: 'nowrap', minWidth: '48px',
                  }}>
                    {fmtDate(date)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.sectors.map(sector => (
                <tr key={sector.name}>
                  {/* Sector name */}
                  <td style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.78rem', fontWeight: 600,
                    color: 'var(--text-primary)', whiteSpace: 'nowrap',
                  }}>
                    {sector.name}
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.68rem', marginLeft: '0.4rem' }}>
                      ({sector.ticker_count})
                    </span>
                  </td>

                  {/* Total net cell */}
                  <td style={{
                    padding: '0.3rem 0.5rem', textAlign: 'center',
                    borderRadius: '6px',
                    background: netColor(sector.total_net, maxAbsNet * data.dates.length),
                  }}>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700,
                      color: netTextColor(sector.total_net),
                    }}>
                      {sector.total_net >= 0 ? '+' : ''}{fmtMiliar(sector.total_net)}
                    </span>
                  </td>

                  {/* Per-day cells */}
                  {data.dates.map(date => {
                    const cell = sector.days[date];
                    const isSelected = selected?.sector === sector.name && selected?.date === date;
                    if (!cell) {
                      return (
                        <td key={date} style={{
                          width: '48px', height: '36px',
                          borderRadius: '6px',
                          background: 'rgba(148,163,184,0.04)',
                        }} />
                      );
                    }
                    return (
                      <td
                        key={date}
                        className={`hm-cell${isSelected ? ' selected' : ''}`}
                        style={{
                          width: '48px', height: '36px',
                          borderRadius: '6px', textAlign: 'center',
                          background: netColor(cell.net, maxAbsNet),
                          position: 'relative',
                        }}
                        onClick={() => setSelected(
                          isSelected ? null : { sector: sector.name, date }
                        )}
                        onMouseEnter={(e) => {
                          const rect = (e.target as HTMLElement).getBoundingClientRect();
                          setTooltip({ sector: sector.name, date, cell, x: rect.left, y: rect.bottom });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: netTextColor(cell.net), lineHeight: 1.2 }}>
                          {fmtMiliar(cell.net)}
                        </div>
                        <div style={{ fontSize: '0.56rem', color: 'var(--text-secondary)', lineHeight: 1 }}>
                          {cell.ticker_count}tk
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Legend */}
          <div style={{
            padding: '0.5rem 1rem', borderTop: '1px solid var(--border-color)',
            display: 'flex', gap: '1.5rem', alignItems: 'center',
            fontSize: '0.7rem', color: 'var(--text-secondary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ width: '20px', height: '12px', borderRadius: '3px', background: 'rgba(74,222,128,0.7)' }} />
              <span>Akumulasi (SM masuk)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ width: '20px', height: '12px', borderRadius: '3px', background: 'rgba(248,113,113,0.7)' }} />
              <span>Distribusi (SM keluar)</span>
            </div>
            <span style={{ marginLeft: 'auto' }}>Nilai dalam Miliar IDR · Klik cell untuk detail ticker</span>
          </div>
        </div>
      ) : (
        !loading && (
          <div style={{
            padding: '3rem', textAlign: 'center', borderRadius: '14px',
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)', fontSize: '0.9rem',
          }}>
            Belum ada data untuk periode ini.
          </div>
        )
      )}

      {/* Selected cell detail panel */}
      {selected && selectedCell && (
        <div style={{
          marginTop: '1rem', padding: '1.25rem', borderRadius: '14px',
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            marginBottom: '1rem',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                {selected.sector}
                <span style={{
                  marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 400,
                  color: 'var(--text-secondary)',
                }}>
                  — {fmtDate(selected.date)}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                <span style={{ color: netTextColor(selectedCell.net), fontWeight: 700, fontSize: '1.1rem' }}>
                  {selectedCell.net >= 0 ? '+' : ''}{selectedCell.net.toFixed(2)}M
                </span>
                <span style={{ color: 'var(--text-secondary)', marginLeft: '0.75rem', fontSize: '0.75rem' }}>
                  SM {selectedCell.sm.toFixed(1)} · BM {selectedCell.bm.toFixed(1)} ·
                  MF+ {selectedCell.mfp.toFixed(1)} · MF- {selectedCell.mfn.toFixed(1)}
                </span>
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{
                padding: '0.3rem 0.7rem', borderRadius: '8px', fontSize: '0.78rem',
                background: 'transparent', border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              ✕ Tutup
            </button>
          </div>

          {/* Ticker grid */}
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
            Ticker aktif ({selectedCell.tickers.length}):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {selectedCell.tickers.map(t => (
              <a
                key={t}
                href={`/confluence?search=${t}`}
                style={{
                  padding: '0.2rem 0.6rem', borderRadius: '7px',
                  background: 'rgba(100,149,237,0.1)',
                  border: '1px solid rgba(100,149,237,0.25)',
                  color: 'var(--accent-primary)', fontWeight: 600,
                  fontSize: '0.78rem', textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                {t}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Floating tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: Math.min(tooltip.x, (typeof window !== 'undefined' ? window.innerWidth : 1024) - 220),
          top: tooltip.y + 8,
          zIndex: 9999,
          background: 'var(--bg-card)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '10px',
          padding: '0.6rem 0.85rem',
          fontSize: '0.75rem',
          pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          minWidth: '180px',
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            {tooltip.sector} · {fmtDate(tooltip.date)}
          </div>
          <div style={{ color: netTextColor(tooltip.cell.net), fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.35rem' }}>
            Net {tooltip.cell.net >= 0 ? '+' : ''}{tooltip.cell.net.toFixed(2)}M
          </div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <div>SM: <span style={{ color: '#38bdf8' }}>+{tooltip.cell.sm.toFixed(1)}M</span></div>
            <div>BM: <span style={{ color: '#f87171' }}>-{tooltip.cell.bm.toFixed(1)}M</span></div>
            <div>MF+: <span style={{ color: '#4ade80' }}>+{tooltip.cell.mfp.toFixed(1)}M</span></div>
            <div>MF-: <span style={{ color: '#fb923c' }}>-{tooltip.cell.mfn.toFixed(1)}M</span></div>
            <div style={{ marginTop: '0.25rem' }}>
              Ticker: <strong>{tooltip.cell.ticker_count}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
