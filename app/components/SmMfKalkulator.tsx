'use client';

import { useState, useCallback, useEffect } from 'react';

/**
 * SmMfKalkulator — shared component untuk SM Kalkulator dan MF Kalkulator
 *
 * source="SM" → gunakan sm_daily (Trigger SM + Big SM) vs bm_daily (Trigger Bad Money)
 *   Topics: 192528 (Trigger SM) + 969813 (Trigger Big SM) vs 219042 (Trigger Bad Money)
 *
 * source="MF" → gunakan mfp_daily (Live MF+ + Big MF+) vs mfn_daily (Live MF-)
 *   Topics: 1025256 (Live MF+) + 1000106 (Live Big MF+) vs 1025260 (Live MF-) + 1018817 (Live Big MF-)
 */

interface Props { source: 'SM' | 'MF' }

interface ChartRow {
  date: string; sm: number; bm: number; net_sm: number;
  mfp: number; mfn: number; net_mf: number; sm_10d: number; sm_30d: number;
}
interface Summary {
  net_sm: number; net_mf: number; net_score: number;
  total_sm: number; total_bm: number; total_mfp: number; total_mfn: number;
  sm_10d: number | null; sm_30d: number | null;
  sm_triggers: number; bad_money: number; mf_plus_hits: number; mf_minus_hits: number;
  latest_score: number | null; latest_phase: string | null;
}
interface DetailResult {
  ticker: string; days: number; source: string; verdict: string;
  summary: Summary; chart: ChartRow[]; recent_alerts: unknown[];
}
interface RankingRow {
  ticker: string; score: number; verdict: string;
  net_sm: number; net_mf: number; sm_total: number; bm_total: number;
  mfp_total: number; mfn_total: number; sm_10d: number | null;
  nbsa_daily: number | null; days_count: number;
}
interface RankingResult { days: number; source: string; ranking: RankingRow[] }

function n(v: number | null | undefined, sign = false, dec = 2) {
  if (v == null) return '-';
  const abs = Math.abs(v);
  const p = sign && v > 0 ? '+' : '';
  if (abs >= 1_000_000) return p + (v / 1_000_000).toFixed(dec) + 'M';
  if (abs >= 1_000)     return p + (v / 1_000).toFixed(1) + 'K';
  return p + v.toFixed(0);
}

function verdictColor(v: string) {
  return v === 'AKUMULASI' ? '#38ef7d' : v === 'DISTRIBUSI' ? '#f5576c' : '#fbbf24';
}

export default function SmMfKalkulator({ source }: Props) {
  const isSM = source === 'SM';

  const title     = isSM ? '💰 SM Kalkulator' : '📊 MF Kalkulator';
  const subtitle  = isSM
    ? 'Smart Money (Trigger SM + Big SM) vs Bad Money · Topics: 192528 · 969813 · 219042'
    : 'Money Flow Positif vs Negatif · Topics: 1025256 (MF+) · 1000106 (Big MF+) · 1025260 (MF-) · 1018817 (Big MF-)';
  const colA      = isSM ? 'SM Masuk'    : 'MF+';
  const colB      = isSM ? 'Bad Money'   : 'MF-';
  const netLabel  = isSM ? 'Net SM'      : 'Net MF';
  const rollLabel = isSM ? 'SM 10D'      : 'MF 10D';

  const [mode,    setMode]    = useState<'ranking' | 'detail'>('ranking');
  const [ticker,  setTicker]  = useState('');
  const [days,    setDays]    = useState('30');
  const [loading, setLoading] = useState(false);
  const [detail,  setDetail]  = useState<DetailResult | null>(null);
  const [ranking, setRanking] = useState<RankingResult | null>(null);
  const [error,   setError]   = useState('');

  const analyze = useCallback(async () => {
    setLoading(true); setError(''); setDetail(null); setRanking(null);
    try {
      const params = new URLSearchParams({ days, source });
      if (mode === 'detail' && ticker) params.set('ticker', ticker.toUpperCase());
      const res  = await fetch(`/api/sm-analysis?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      if (json.ranking) setRanking(json);
      else              setDetail(json);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, [ticker, days, mode, source]);

  // Auto-load ranking on mount
  useEffect(() => { analyze(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          {title}
        </h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{subtitle}</p>
      </div>

      {/* Control bar */}
      <div style={{
        display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap',
        marginBottom: '1.5rem', padding: '0.85rem 1rem',
        background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px',
      }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {(['ranking', 'detail'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '0.35rem 0.8rem', borderRadius: '8px', border: '1px solid', cursor: 'pointer',
              borderColor: mode === m ? 'var(--accent-primary)' : 'var(--border-color)',
              background: mode === m ? 'rgba(100,149,237,0.15)' : 'transparent',
              color: mode === m ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '0.8rem', fontWeight: mode === m ? 600 : 400,
            }}>
              {m === 'ranking' ? '🏆 Ranking' : '🔍 Detail'}
            </button>
          ))}
        </div>

        {mode === 'detail' && (
          <input placeholder="Ticker (cth: BBRI)" value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())} maxLength={6}
            style={{
              padding: '0.35rem 0.65rem', background: 'var(--bg-card)',
              border: '1px solid var(--border-color)', borderRadius: '8px',
              color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', width: '140px',
            }} />
        )}

        <select value={days} onChange={e => setDays(e.target.value)} style={{
          padding: '0.35rem 0.65rem', background: 'var(--bg-card)',
          border: '1px solid var(--border-color)', borderRadius: '8px',
          color: 'var(--text-primary)', fontSize: '0.8rem',
        }}>
          {['3','7','14','30','60'].map(d => <option key={d} value={d}>{d} hari</option>)}
        </select>

        <button onClick={analyze} disabled={loading} style={{
          padding: '0.4rem 1.2rem', borderRadius: '8px', border: 'none',
          background: 'var(--accent-primary)', color: '#fff',
          fontWeight: 600, fontSize: '0.85rem', cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}>
          {loading ? 'Kalkulasi...' : '🧮 Hitung'}
        </button>
      </div>

      {error && <div style={{ color: '#f5576c', fontSize: '0.82rem', marginBottom: '1rem' }}>⚠ {error}</div>}

      {/* ── RANKING ── */}
      {ranking && (
        <div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            {ranking.ranking.length} ticker · {ranking.days} hari · sumber: <b>{source === 'SM' ? 'Trigger SM + Big SM vs Bad Money' : 'Live MF+ + Big MF+ vs MF- + Big MF-'}</b>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  {['#','Ticker','Verdict', netLabel, colA, colB, rollLabel, 'NBSA', 'Hari'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranking.ranking.map((r, i) => {
                  const mainNet  = isSM ? r.net_sm  : r.net_mf;
                  const mainA    = isSM ? r.sm_total : r.mfp_total;
                  const mainB    = isSM ? r.bm_total : r.mfn_total;
                  return (
                    <tr key={r.ticker} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={td}>{i + 1}</td>
                      <td style={td}>
                        <button onClick={() => { setMode('detail'); setTicker(r.ticker); }}
                          style={{ background:'none',border:'none',cursor:'pointer',color:'var(--accent-primary)',fontWeight:700,fontSize:'0.8rem' }}>
                          {r.ticker}
                        </button>
                      </td>
                      <td style={{ ...td, color: verdictColor(r.verdict), fontWeight: 600 }}>
                        {r.verdict === 'AKUMULASI' ? '⬆' : '⬇'} {r.verdict}
                      </td>
                      <td style={{ ...td, color: mainNet > 0 ? '#38ef7d' : '#f5576c', fontWeight: 600 }}>{n(mainNet, true)}</td>
                      <td style={{ ...td, color: '#38ef7d' }}>{n(mainA)}</td>
                      <td style={{ ...td, color: '#f5576c' }}>{n(mainB)}</td>
                      <td style={{ ...td, color: 'var(--accent-primary)' }}>{n(r.sm_10d)}</td>
                      <td style={{ ...td, color: r.nbsa_daily == null ? 'var(--text-secondary)' : r.nbsa_daily > 0 ? '#38ef7d' : '#f5576c', fontWeight: r.nbsa_daily != null ? 600 : 400 }}>
                        {r.nbsa_daily != null ? n(r.nbsa_daily, true, 1) : '-'}
                      </td>
                      <td style={{ ...td, color: 'var(--text-secondary)' }}>{r.days_count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DETAIL ── */}
      {detail && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Verdict */}
          <div style={{
            padding: '1.25rem', borderRadius: '12px',
            border: `1px solid ${verdictColor(detail.verdict)}40`,
            background: `${verdictColor(detail.verdict)}10`,
            display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                {detail.ticker} · {detail.days} hari · {source === 'SM' ? 'SM vs Bad Money' : 'MF+ vs MF-'}
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: verdictColor(detail.verdict) }}>
                {detail.verdict === 'AKUMULASI' ? '⬆' : detail.verdict === 'DISTRIBUSI' ? '⬇' : '➡'} {detail.verdict}
              </div>
            </div>
            {detail.summary.latest_phase && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Phase: <b style={{ color: 'var(--text-primary)' }}>{detail.summary.latest_phase}</b>
                {detail.summary.latest_score != null && (
                  <> · Oracle: <b style={{ color: 'var(--accent-primary)' }}>{detail.summary.latest_score}</b></>
                )}
              </div>
            )}
          </div>

          {/* Stats grid */}
          {(() => {
            const s = detail.summary;
            const stats = isSM ? [
              { label: 'Net SM',        value: n(s.net_sm, true),  color: s.net_sm > 0 ? '#38ef7d' : '#f5576c' },
              { label: 'SM Masuk',      value: n(s.total_sm),      color: '#38ef7d' },
              { label: 'Bad Money',     value: n(s.total_bm),      color: '#f5576c' },
              { label: 'SM Triggers',   value: String(s.sm_triggers), color: '#00d4ff' },
              { label: 'Bad Money Hit', value: String(s.bad_money),   color: '#f5576c' },
              { label: 'SM 10D Roll',   value: n(s.sm_10d),        color: 'var(--accent-primary)' },
              { label: 'SM 30D Roll',   value: n(s.sm_30d),        color: 'var(--accent-primary)' },
            ] : [
              { label: 'Net MF',        value: n(s.net_mf, true),  color: s.net_mf > 0 ? '#38ef7d' : '#f5576c' },
              { label: 'MF+',           value: n(s.total_mfp),     color: '#38ef7d' },
              { label: 'MF-',           value: n(s.total_mfn),     color: '#f5576c' },
              { label: 'MF+ Hits',      value: String(s.mf_plus_hits),  color: '#38ef7d' },
              { label: 'MF- Hits',      value: String(s.mf_minus_hits), color: '#f5576c' },
            ];
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.6rem' }}>
                {stats.map(s => (
                  <div key={s.label} style={{ padding: '0.65rem 0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>{s.label}</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Chart table */}
          {detail.chart.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                📊 {isSM ? 'SM vs Bad Money Daily' : 'MF+ vs MF- Daily'}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.77rem' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                      {isSM
                        ? ['Tanggal','SM Masuk','Bad Money','Net SM','SM 10D','SM 30D'].map(h =>
                            <th key={h} style={{ padding: '0.3rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{h}</th>)
                        : ['Tanggal','MF+','MF-','Net MF'].map(h =>
                            <th key={h} style={{ padding: '0.3rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{h}</th>)
                      }
                    </tr>
                  </thead>
                  <tbody>
                    {detail.chart.slice().reverse().map(r => (
                      <tr key={r.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '0.3rem 0.5rem', color: 'var(--text-secondary)' }}>{r.date}</td>
                        {isSM ? <>
                          <td style={{ padding:'0.3rem 0.5rem', textAlign:'right', color:'#38ef7d' }}>{n(r.sm)}</td>
                          <td style={{ padding:'0.3rem 0.5rem', textAlign:'right', color:'#f5576c' }}>{n(r.bm)}</td>
                          <td style={{ padding:'0.3rem 0.5rem', textAlign:'right', color: r.net_sm > 0 ? '#38ef7d' : '#f5576c', fontWeight:600 }}>{n(r.net_sm, true)}</td>
                          <td style={{ padding:'0.3rem 0.5rem', textAlign:'right', color:'var(--accent-primary)' }}>{n(r.sm_10d)}</td>
                          <td style={{ padding:'0.3rem 0.5rem', textAlign:'right', color:'var(--accent-primary)' }}>{n(r.sm_30d)}</td>
                        </> : <>
                          <td style={{ padding:'0.3rem 0.5rem', textAlign:'right', color:'#38ef7d' }}>{n(r.mfp)}</td>
                          <td style={{ padding:'0.3rem 0.5rem', textAlign:'right', color:'#f5576c' }}>{n(r.mfn)}</td>
                          <td style={{ padding:'0.3rem 0.5rem', textAlign:'right', color: r.net_mf > 0 ? '#38ef7d' : '#f5576c', fontWeight:600 }}>{n(r.net_mf, true)}</td>
                        </>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!detail && !ranking && !loading && (
        <div style={{ textAlign:'center', padding:'4rem', color:'var(--text-secondary)', fontSize:'0.85rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>🧮</div>
          <div style={{ fontWeight:600, marginBottom:'0.25rem' }}>{title}</div>
          <div>Pilih <b>Ranking</b> untuk semua saham, atau <b>Detail</b> untuk satu ticker.</div>
        </div>
      )}
    </div>
  );
}

const td: React.CSSProperties = { padding: '0.45rem 0.6rem', color: 'var(--text-primary)' };
