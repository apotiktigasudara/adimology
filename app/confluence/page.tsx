'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ConfluenceRow {
  ticker: string;
  confluence_score: number;
  status: string;
  position_size: string;
  streak: number;
  sm_net: number;
  mf_net: number;
  sm_total: number;
  bm_total: number;
  mfp_total: number;
  mfn_total: number;
  algo_pos: number;
  algo_neg: number;
  sm_score: number;
  mf_score: number;
  algo_score: number;
  days_data: number;
}

interface ApiResponse {
  success: boolean;
  days: number;
  generated_at: string;
  data: ConfluenceRow[];
  error?: string;
}

function getScoreColor(score: number): string {
  if (score >= 70) return '#38ef7d';
  if (score >= 50) return '#fbbf24';
  if (score <= 30) return '#f5576c';
  return '#94a3b8';
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'AKUMULASI': return '#38ef7d';
    case 'DISTRIBUSI': return '#f5576c';
    case 'CONTESTED': return '#fb923c';
    default: return '#94a3b8';
  }
}

function getStatusBg(status: string): string {
  switch (status) {
    case 'AKUMULASI': return 'rgba(56,239,125,0.12)';
    case 'DISTRIBUSI': return 'rgba(245,87,108,0.12)';
    case 'CONTESTED': return 'rgba(251,146,60,0.12)';
    default: return 'rgba(148,163,184,0.10)';
  }
}

function getPositionBg(pos: string): string {
  switch (pos) {
    case 'FULL': return 'rgba(56,239,125,0.15)';
    case 'HALF': return 'rgba(251,191,36,0.15)';
    default: return 'rgba(148,163,184,0.10)';
  }
}

function getPositionColor(pos: string): string {
  switch (pos) {
    case 'FULL': return '#38ef7d';
    case 'HALF': return '#fbbf24';
    default: return '#94a3b8';
  }
}

function ScoreBar({ score }: { score: number }) {
  const color = getScoreColor(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '120px' }}>
      <div style={{
        flex: 1, height: '8px', borderRadius: '4px',
        background: 'var(--border-color)', overflow: 'hidden',
      }}>
        <div style={{
          width: `${score}%`, height: '100%',
          background: `linear-gradient(90deg, ${color}88, ${color})`,
          borderRadius: '4px',
          transition: 'width 0.6s ease',
        }} />
      </div>
      <span style={{
        fontSize: '0.85rem', fontWeight: 700,
        color, minWidth: '28px', textAlign: 'right',
      }}>
        {score}
      </span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i} style={{ padding: '0.75rem 1rem' }}>
          <div style={{
            height: '14px', borderRadius: '4px',
            background: 'var(--border-color)',
            opacity: 0.5,
            width: i === 0 ? '30px' : i === 1 ? '60px' : '80px',
            animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        </td>
      ))}
    </tr>
  );
}

const DAYS_OPTIONS = [7, 14, 30, 60];

export default function ConfluencePage() {
  const [data, setData]           = useState<ConfluenceRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [days, setDays]           = useState(30);
  const [minScore, setMinScore]   = useState(0);
  const [search, setSearch]       = useState('');
  const [generatedAt, setGeneratedAt] = useState<string>('');
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/confluence?days=${days}&min_score=${minScore}&limit=200`);
      const json: ApiResponse = await res.json();
      if (!json.success) throw new Error(json.error || 'Gagal memuat data');
      setData(json.data);
      setGeneratedAt(json.generated_at);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [days, minScore]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = data.filter(r =>
    search.trim() === '' || r.ticker.includes(search.toUpperCase().trim())
  );

  // Summary counts
  const totalTicker  = filtered.length;
  const akumCount    = filtered.filter(r => r.status === 'AKUMULASI').length;
  const distCount    = filtered.filter(r => r.status === 'DISTRIBUSI').length;
  const conCount     = filtered.filter(r => r.status === 'CONTESTED').length;
  const avgScore     = totalTicker > 0
    ? Math.round(filtered.reduce((s, r) => s + r.confluence_score, 0) / totalTicker)
    : 0;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Inline keyframe for skeleton pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .conf-row-highlight { background: rgba(100,149,237,0.08) !important; }
        .conf-row:hover { background: var(--bg-hover, rgba(255,255,255,0.03)) !important; cursor: pointer; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{
          fontSize: '1.4rem', fontWeight: 700,
          color: 'var(--text-primary)', marginBottom: '0.25rem',
        }}>
          🎯 Confluence Score
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Ranking Smart Money + Money Flow + Algo Signals · Sorted by total score
          {generatedAt && (
            <span style={{ marginLeft: '0.75rem', opacity: 0.6 }}>
              · {new Date(generatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
            </span>
          )}
        </p>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
        marginBottom: '1.25rem', alignItems: 'center',
      }}>
        {/* Days selector */}
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {DAYS_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1px solid',
                borderColor: days === d ? 'var(--accent-primary)' : 'var(--border-color)',
                background: days === d ? 'rgba(100,149,237,0.15)' : 'var(--bg-card)',
                color: days === d ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: days === d ? 600 : 400,
                fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              {d}H
            </button>
          ))}
        </div>

        {/* Min score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Min Score:
          </span>
          <input
            type="number" min={0} max={100}
            value={minScore}
            onChange={e => setMinScore(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
            style={{
              width: '60px', padding: '0.35rem 0.6rem',
              borderRadius: '8px', border: '1px solid var(--border-color)',
              background: 'var(--bg-card)', color: 'var(--text-primary)',
              fontSize: '0.82rem', textAlign: 'center',
            }}
          />
        </div>

        {/* Search ticker */}
        <input
          type="text"
          placeholder="Cari ticker..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '0.4rem 0.85rem', borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)', color: 'var(--text-primary)',
            fontSize: '0.82rem', outline: 'none', minWidth: '140px',
          }}
        />

        {/* Refresh */}
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            padding: '0.4rem 1rem', borderRadius: '8px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)', color: 'var(--text-secondary)',
            fontSize: '0.8rem', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1, transition: 'all 0.2s',
          }}
        >
          {loading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Summary cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '0.75rem', marginBottom: '1.5rem',
      }}>
        {[
          { label: 'Total Ticker', value: totalTicker, color: 'var(--text-primary)' },
          { label: 'Akumulasi',    value: akumCount,   color: '#38ef7d' },
          { label: 'Distribusi',   value: distCount,   color: '#f5576c' },
          { label: 'Contested',    value: conCount,    color: '#fb923c' },
          { label: 'Avg Score',    value: avgScore,    color: '#fbbf24' },
        ].map(card => (
          <div key={card.label} style={{
            padding: '1rem', borderRadius: '12px',
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              {card.label}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: card.color }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div style={{
          padding: '1rem 1.25rem', borderRadius: '10px',
          background: 'rgba(245,87,108,0.1)', border: '1px solid rgba(245,87,108,0.3)',
          color: '#f5576c', fontSize: '0.85rem', marginBottom: '1rem',
        }}>
          Error: {error}
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: '12px',
        border: '1px solid var(--border-color)', overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse',
            fontSize: '0.82rem',
          }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                {['#', 'Ticker', 'Score', 'Status', 'Streak', 'SM Net', 'MF Net', 'Algo', 'Position', 'Hari'].map(h => (
                  <th key={h} style={{
                    padding: '0.75rem 1rem', textAlign: 'left',
                    color: 'var(--text-secondary)', fontWeight: 600,
                    fontSize: '0.75rem', letterSpacing: '0.04em',
                    borderBottom: '1px solid var(--border-color)',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10} style={{
                    padding: '3rem', textAlign: 'center',
                    color: 'var(--text-secondary)', fontSize: '0.9rem',
                  }}>
                    {search ? `Tidak ada ticker "${search.toUpperCase()}"` : 'Tidak ada data untuk filter ini.'}
                  </td>
                </tr>
              )}

              {!loading && filtered.map((row, idx) => {
                const isHighlighted = highlighted === row.ticker;
                return (
                  <tr
                    key={row.ticker}
                    className={`conf-row${isHighlighted ? ' conf-row-highlight' : ''}`}
                    onClick={() => setHighlighted(isHighlighted ? null : row.ticker)}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* # */}
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', width: '40px' }}>
                      {idx + 1}
                    </td>

                    {/* Ticker */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <Link
                        href={`/summary?ticker=${row.ticker}`}
                        onClick={e => e.stopPropagation()}
                        style={{
                          fontWeight: 700, color: 'var(--accent-primary)',
                          textDecoration: 'none', fontSize: '0.9rem',
                        }}
                      >
                        {row.ticker}
                      </Link>
                    </td>

                    {/* Score bar */}
                    <td style={{ padding: '0.75rem 1rem', minWidth: '140px' }}>
                      <ScoreBar score={row.confluence_score} />
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem', borderRadius: '6px',
                        fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.03em',
                        color: getStatusColor(row.status),
                        background: getStatusBg(row.status),
                        border: `1px solid ${getStatusColor(row.status)}44`,
                      }}>
                        {row.status}
                      </span>
                    </td>

                    {/* Streak */}
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {row.streak > 0 ? (
                        <span style={{ color: '#38ef7d' }}>🔥 {row.streak}d</span>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>—</span>
                      )}
                    </td>

                    {/* SM Net */}
                    <td style={{
                      padding: '0.75rem 1rem', fontWeight: 500,
                      color: row.sm_net >= 0 ? '#38ef7d' : '#f5576c',
                    }}>
                      {row.sm_net >= 0 ? '+' : ''}{row.sm_net.toFixed(1)}
                    </td>

                    {/* MF Net */}
                    <td style={{
                      padding: '0.75rem 1rem', fontWeight: 500,
                      color: row.mf_net >= 0 ? '#38ef7d' : '#f5576c',
                    }}>
                      {row.mf_net >= 0 ? '+' : ''}{row.mf_net.toFixed(1)}
                    </td>

                    {/* Algo */}
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      {row.algo_pos > 0 && (
                        <span style={{ color: '#38ef7d', fontWeight: 600 }}>+{row.algo_pos}</span>
                      )}
                      {row.algo_pos > 0 && row.algo_neg > 0 && (
                        <span style={{ color: 'var(--text-secondary)', margin: '0 2px' }}>/</span>
                      )}
                      {row.algo_neg > 0 && (
                        <span style={{ color: '#f5576c', fontWeight: 600 }}>-{row.algo_neg}</span>
                      )}
                      {row.algo_pos === 0 && row.algo_neg === 0 && (
                        <span style={{ color: 'var(--text-secondary)' }}>—</span>
                      )}
                    </td>

                    {/* Position size */}
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{
                        padding: '0.2rem 0.55rem', borderRadius: '6px',
                        fontSize: '0.72rem', fontWeight: 700,
                        color: getPositionColor(row.position_size),
                        background: getPositionBg(row.position_size),
                      }}>
                        {row.position_size}
                      </span>
                    </td>

                    {/* Days data */}
                    <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                      {row.days_data}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div style={{
            padding: '0.6rem 1rem', borderTop: '1px solid var(--border-color)',
            fontSize: '0.72rem', color: 'var(--text-secondary)',
            display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
          }}>
            <span>Menampilkan {filtered.length} ticker · Periode {days} hari</span>
            <span>SM Score 0–50 · MF Score 0–30 · Algo Score 0–20</span>
          </div>
        )}
      </div>
    </div>
  );
}
