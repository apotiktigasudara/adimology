'use client';

import { useState, useCallback } from 'react';

interface SmSummary {
  net_sm: number; net_mf: number;
  total_sm_lots: number; total_bm_lots: number;
  total_mf_plus: number; total_mf_minus: number;
  sm_10d: number | null; sm_30d: number | null;
  accum_alerts: number; distrib_alerts: number;
  sm_triggers: number; bad_money: number;
  mf_plus_hits: number; mf_minus_hits: number;
  latest_score: number | null; latest_phase: string | null;
}

interface SmChartRow {
  date: string; sm_daily: number; bm_daily: number;
  net: number; mfp: number; mfn: number;
  sm_10d: number; sm_30d: number;
}

interface RankingRow {
  ticker: string; score: number; verdict: string;
  net_sm: number; net_mf: number;
  sm_total: number; bm_total: number;
  sm_10d: number | null; days_count: number;
}

interface DetailResult {
  ticker: string; days: number; verdict: string;
  summary: SmSummary; sm_chart: SmChartRow[];
  recent_alerts: unknown[];
}

interface RankingResult {
  days: number; ranking: RankingRow[];
}

function lots(n: number | null | undefined, sign = false) {
  if (n == null) return '-';
  const abs = Math.abs(n);
  const prefix = sign && n > 0 ? '+' : '';
  if (abs >= 1_000_000) return prefix + (n / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000)     return prefix + (n / 1_000).toFixed(1)     + 'K';
  return prefix + n.toFixed(0);
}

export default function SmCalculator() {
  const [ticker,  setTicker]  = useState('');
  const [days,    setDays]    = useState('30');
  const [mode,    setMode]    = useState<'ranking' | 'detail'>('ranking');
  const [loading, setLoading] = useState(false);
  const [detail,  setDetail]  = useState<DetailResult | null>(null);
  const [ranking, setRanking] = useState<RankingResult | null>(null);
  const [error,   setError]   = useState('');

  const analyze = useCallback(async () => {
    setLoading(true); setError(''); setDetail(null); setRanking(null);
    try {
      const params = new URLSearchParams({ days });
      if (mode === 'detail' && ticker) params.set('ticker', ticker.toUpperCase());
      const res  = await fetch(`/api/sm-analysis?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      if (json.ranking) setRanking(json);
      else              setDetail(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [ticker, days, mode]);

  const verdictColor = (v: string) =>
    v === 'AKUMULASI' ? '#38ef7d' : v === 'DISTRIBUSI' ? '#f5576c' : '#fbbf24';

  return (
    <div>
      {/* Control bar */}
      <div style={{
        display: 'flex', gap: '0.75rem', alignItems: 'center',
        flexWrap: 'wrap', marginBottom: '1.5rem',
        padding: '1rem', background: 'var(--bg-card)',
        border: '1px solid var(--border-color)', borderRadius: '12px',
      }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {(['ranking', 'detail'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '0.35rem 0.8rem', borderRadius: '8px', border: '1px solid',
              borderColor: mode === m ? 'var(--accent-primary)' : 'var(--border-color)',
              background: mode === m ? 'rgba(100,149,237,0.15)' : 'transparent',
              color: mode === m ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '0.8rem', cursor: 'pointer', fontWeight: mode === m ? 600 : 400,
            }}>
              {m === 'ranking' ? '🏆 Ranking' : '🔍 Detail'}
            </button>
          ))}
        </div>
        {mode === 'detail' && (
          <input
            placeholder="Ticker (cth: BBRI)"
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            maxLength={6}
            style={{
              padding: '0.35rem 0.65rem', background: 'var(--bg-card)',
              border: '1px solid var(--border-color)', borderRadius: '8px',
              color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none', width: '140px',
            }}
          />
        )}
        <select value={days} onChange={e => setDays(e.target.value)} style={{
          padding: '0.35rem 0.65rem', background: 'var(--bg-card)',
          border: '1px solid var(--border-color)', borderRadius: '8px',
          color: 'var(--text-primary)', fontSize: '0.8rem',
        }}>
          <option value="7">7 hari</option>
          <option value="14">14 hari</option>
          <option value="30">30 hari</option>
          <option value="60">60 hari</option>
        </select>
        <button onClick={analyze} disabled={loading} style={{
          padding: '0.4rem 1.2rem', borderRadius: '8px', border: 'none',
          background: 'var(--accent-primary)', color: '#fff',
          fontWeight: 600, fontSize: '0.85rem', cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}>
          {loading ? 'Analisa...' : '🧮 Analisa'}
        </button>
      </div>

      {error && (
        <div style={{ color: '#f5576c', fontSize: '0.82rem', marginBottom: '1rem' }}>⚠ {error}</div>
      )}

      {/* Ranking mode */}
      {ranking && (
        <div>
          <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Ranking {ranking.ranking.length} ticker berdasarkan net SM + MF flow ({days} hari terakhir)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  {['#','Ticker','Verdict','Net SM','Net MF','Score','SM 10d','SM Total','BM Total','Hari'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ranking.ranking.map((r, i) => (
                  <tr key={r.ticker} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={tdS}>{i + 1}</td>
                    <td style={{ ...tdS, fontWeight: 700 }}>
                      <button
                        onClick={() => { setMode('detail'); setTicker(r.ticker); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.8rem' }}
                      >
                        {r.ticker}
                      </button>
                    </td>
                    <td style={{ ...tdS, color: verdictColor(r.verdict), fontWeight: 600 }}>
                      {r.verdict === 'AKUMULASI' ? '⬆' : '⬇'} {r.verdict}
                    </td>
                    <td style={{ ...tdS, color: r.net_sm > 0 ? '#38ef7d' : '#f5576c' }}>{lots(r.net_sm, true)}</td>
                    <td style={{ ...tdS, color: r.net_mf > 0 ? '#38ef7d' : '#f5576c' }}>{lots(r.net_mf, true)}</td>
                    <td style={{ ...tdS, fontWeight: 600, color: verdictColor(r.verdict) }}>{lots(r.score, true)}</td>
                    <td style={tdS}>{lots(r.sm_10d)}</td>
                    <td style={{ ...tdS, color: '#38ef7d' }}>{lots(r.sm_total)}</td>
                    <td style={{ ...tdS, color: '#f5576c' }}>{lots(r.bm_total)}</td>
                    <td style={{ ...tdS, color: 'var(--text-secondary)' }}>{r.days_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail mode */}
      {detail && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Verdict card */}
          <div style={{
            padding: '1.25rem', borderRadius: '12px',
            border: `1px solid ${verdictColor(detail.verdict)}40`,
            background: `${verdictColor(detail.verdict)}10`,
            display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                {detail.ticker} · {detail.days} hari terakhir
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: verdictColor(detail.verdict) }}>
                {detail.verdict === 'AKUMULASI' ? '⬆' : detail.verdict === 'DISTRIBUSI' ? '⬇' : '➡'}{' '}
                {detail.verdict}
              </div>
            </div>
            {detail.summary.latest_phase && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Phase: <b style={{ color: 'var(--text-primary)' }}>{detail.summary.latest_phase}</b>
                {detail.summary.latest_score != null && (
                  <> · Score: <b style={{ color: 'var(--accent-primary)' }}>{detail.summary.latest_score}</b></>
                )}
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.6rem',
          }}>
            {[
              { label: 'Net SM', value: lots(detail.summary.net_sm, true), color: detail.summary.net_sm > 0 ? '#38ef7d' : '#f5576c' },
              { label: 'Net MF', value: lots(detail.summary.net_mf, true), color: detail.summary.net_mf > 0 ? '#38ef7d' : '#f5576c' },
              { label: 'SM Total', value: lots(detail.summary.total_sm_lots), color: '#38ef7d' },
              { label: 'BM (Bad Money)', value: lots(detail.summary.total_bm_lots), color: '#f5576c' },
              { label: 'MF+ Total', value: lots(detail.summary.total_mf_plus), color: '#38ef7d' },
              { label: 'MF- Total', value: lots(detail.summary.total_mf_minus), color: '#f5576c' },
              { label: 'SM 10D', value: lots(detail.summary.sm_10d), color: 'var(--accent-primary)' },
              { label: 'SM 30D', value: lots(detail.summary.sm_30d), color: 'var(--accent-primary)' },
              { label: 'Alert Akumulasi', value: String(detail.summary.accum_alerts), color: '#38ef7d' },
              { label: 'Alert Distribusi', value: String(detail.summary.distrib_alerts), color: '#f5576c' },
              { label: 'SM Triggers', value: String(detail.summary.sm_triggers), color: '#00d4ff' },
              { label: 'Bad Money Hits', value: String(detail.summary.bad_money), color: '#f5576c' },
              { label: 'MF+ Hits', value: String(detail.summary.mf_plus_hits), color: '#38ef7d' },
              { label: 'MF- Hits', value: String(detail.summary.mf_minus_hits), color: '#f5576c' },
            ].map(s => (
              <div key={s.label} style={{
                padding: '0.65rem 0.75rem', background: 'var(--bg-card)',
                border: '1px solid var(--border-color)', borderRadius: '10px',
              }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                  {s.label}
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Daily SM chart */}
          {detail.sm_chart.length > 0 && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: '12px', padding: '1rem',
            }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                📊 SM Daily Flow
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.77rem' }}>
                  <thead>
                    <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                      {['Tanggal','SM Daily','BM Daily','Net SM','MF+','MF-','SM 10D','SM 30D'].map(h => (
                        <th key={h} style={{ padding: '0.3rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.sm_chart.slice().reverse().map(r => (
                      <tr key={r.date} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '0.3rem 0.5rem', color: 'var(--text-secondary)' }}>{r.date}</td>
                        <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', color: '#38ef7d' }}>{lots(r.sm_daily)}</td>
                        <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', color: '#f5576c' }}>{lots(r.bm_daily)}</td>
                        <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', color: r.net > 0 ? '#38ef7d' : '#f5576c', fontWeight: 600 }}>{lots(r.net, true)}</td>
                        <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', color: '#38ef7d' }}>{lots(r.mfp)}</td>
                        <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', color: '#f5576c' }}>{lots(r.mfn)}</td>
                        <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', color: 'var(--accent-primary)' }}>{lots(r.sm_10d)}</td>
                        <td style={{ padding: '0.3rem 0.5rem', textAlign: 'right', color: 'var(--accent-primary)' }}>{lots(r.sm_30d)}</td>
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
        <div style={{
          textAlign: 'center', padding: '4rem',
          color: 'var(--text-secondary)', fontSize: '0.85rem',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧮</div>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>SM Kalkulator</div>
          <div>Pilih mode <b>Ranking</b> untuk lihat semua saham,<br />atau <b>Detail</b> untuk analisa satu ticker.</div>
        </div>
      )}
    </div>
  );
}

const tdS: React.CSSProperties = {
  padding: '0.45rem 0.6rem', color: 'var(--text-primary)',
};
