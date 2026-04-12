'use client';
/**
 * app/components/ScreenerClient.tsx — Phoenix Bot V.X × Adimology
 *
 * Client component untuk /screener page.
 * Dua section:
 *   A1 — Top Oracle+Bandar Combined Picks (combined_score = oracle 60% + bandar 40%)
 *   B1 — Saham Tidur (ACCUMULATION phase, oracle < 70, sm_10d >= 1M, streak >= 2)
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface PickRow {
  ticker:         string;
  sm_score:       number;   // oracle_score jika ada, else sm_10d
  sm_10d:         number;
  bandar_net_10d: number;
  combined_score: number;
  markup_phase:   string | null;
  streak:         number;
  trade_date:     string;
}

interface TidurRow {
  ticker:          string;
  signal_strength: string;
  net_value_10d:   number;
  combined_score:  number;
  markup_phase:    string | null;
  streak:          number;
  trade_date:      string;
  rank_score:      number;
}

interface ScreenerData {
  sm_date: string;
  bf_date: string | null;
  picks:   PickRow[];
  tidur:   TidurRow[];
}

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

const PHASE_EMOJI: Record<string, string> = {
  LATE_ACCUMULATION:  '⚡',
  MID_ACCUMULATION:   '🟡',
  EARLY_ACCUMULATION: '🔵',
  MARKUP_READY:       '🚀',
};

const PHASE_SHORT: Record<string, string> = {
  LATE_ACCUMULATION:  'Late Accum',
  MID_ACCUMULATION:   'Mid Accum',
  EARLY_ACCUMULATION: 'Early Accum',
  MARKUP_READY:       'Markup Ready',
};

function fmt(n: number, sign = true): string {
  const s = sign && n >= 0 ? '+' : '';
  return `${s}${n.toFixed(1)}`;
}

export default function ScreenerClient() {
  const router = useRouter();
  const [data,    setData]    = useState<ScreenerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [topN,    setTopN]    = useState(5);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/screener?top_n=${topN}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal fetch');
    } finally {
      setLoading(false);
    }
  }, [topN]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh 5 menit
  useEffect(() => {
    const t = setInterval(() => fetchData(), 5 * 60_000);
    return () => clearInterval(t);
  }, [fetchData]);

  const handleAnalyze = (ticker: string) => {
    router.push(`/?symbol=${ticker}`);
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }}>
      ⏳ Memuat data screener...
    </div>
  );
  if (error) return (
    <div style={{ color: '#f5576c', padding: '2rem', textAlign: 'center' }}>
      ❌ {error}
      <br />
      <button
        onClick={fetchData}
        style={{ marginTop: '1rem', padding: '0.4rem 1rem', cursor: 'pointer',
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '8px', color: 'var(--text-primary)' }}
      >
        Coba lagi
      </button>
    </div>
  );
  if (!data) return null;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 1rem 4rem' }}>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem',
        marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>
          Data SM: <strong style={{ color: '#38ef7d' }}>{data.sm_date}</strong>
          {data.bf_date && data.bf_date !== data.sm_date &&
            <> &nbsp;| Bandar: <strong style={{ color: '#6495ed' }}>{data.bf_date}</strong></>
          }
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>Top N:</span>
          {[5, 10, 15].map(n => (
            <button
              key={n}
              onClick={() => setTopN(n)}
              style={{
                padding: '0.2rem 0.55rem', fontSize: '0.78rem', cursor: 'pointer',
                borderRadius: '6px',
                background: topN === n ? 'rgba(56,239,125,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${topN === n ? 'rgba(56,239,125,0.35)' : 'rgba(255,255,255,0.1)'}`,
                color: topN === n ? '#38ef7d' : 'var(--text-primary)',
              }}
            >
              {n}
            </button>
          ))}
          <button
            onClick={fetchData}
            style={{ padding: '0.2rem 0.65rem', fontSize: '0.78rem', cursor: 'pointer',
              borderRadius: '6px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)' }}
          >
            ⟳
          </button>
          {lastFetch && (
            <span style={{ fontSize: '0.68rem', opacity: 0.4 }}>
              {lastFetch.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* ─── Section A1: Morning Picks ─────────────────────────────────────── */}
      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🌅 Top Picks Hari Ini
          <span style={{ fontSize: '0.72rem', fontWeight: 400, opacity: 0.5 }}>
            Oracle 60% + Bandar 40%
          </span>
        </h2>

        {data.picks.length === 0 ? (
          <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>Tidak ada data picks hari ini.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {data.picks.map((r, i) => (
              <div
                key={r.ticker}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '0.8rem 1rem',
                  display: 'flex', alignItems: 'center', gap: '0.8rem',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: '1.2rem', minWidth: '1.6rem' }}>{MEDALS[i] ?? `${i+1}.`}</span>
                <button
                  onClick={() => handleAnalyze(r.ticker)}
                  style={{
                    fontWeight: 700, fontSize: '1.05rem', cursor: 'pointer',
                    background: 'none', border: 'none', color: '#38ef7d',
                    padding: 0, textDecoration: 'underline',
                  }}
                >
                  {r.ticker}
                </button>
                {r.markup_phase && (
                  <span style={{
                    fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '5px',
                    background: 'rgba(56,239,125,0.1)', border: '1px solid rgba(56,239,125,0.2)',
                    color: '#38ef7d',
                  }}>
                    {PHASE_EMOJI[r.markup_phase] ?? ''} {PHASE_SHORT[r.markup_phase] ?? r.markup_phase}
                  </span>
                )}
                {r.streak >= 2 && (
                  <span style={{ fontSize: '0.75rem', color: '#f4a261' }}>
                    🔥 {r.streak}d
                  </span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', opacity: 0.5 }}>Score</div>
                    <div style={{ fontWeight: 700, color: '#f4c430' }}>{r.combined_score}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', opacity: 0.5 }}>SM Score</div>
                    <div style={{ fontWeight: 600 }}>{r.sm_score.toFixed(0)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', opacity: 0.5 }}>SM 10D</div>
                    <div style={{ fontWeight: 600, color: r.sm_10d >= 0 ? '#38ef7d' : '#f5576c' }}>
                      {fmt(r.sm_10d)}M
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', opacity: 0.5 }}>Bandar</div>
                    <div style={{ fontWeight: 600, color: r.bandar_net_10d >= 0 ? '#38ef7d' : '#f5576c' }}>
                      {fmt(r.bandar_net_10d)}M
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── Section B1: Saham Tidur ───────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          😴 Saham Tidur
          <span style={{ fontSize: '0.72rem', fontWeight: 400, opacity: 0.5 }}>
            Akumulasi diam-diam — harga belum gerak
          </span>
        </h2>

        {data.tidur.length === 0 ? (
          <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>
            Tidak ada saham dalam fase akumulasi tersembunyi hari ini.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {data.tidur.map((r) => {
              const STRENGTH_EMOJI: Record<string, string> = { SEDANG: '🟡', LEMAH: '🔵', EARLY: '⚙️' };
              const strengthEmoji = STRENGTH_EMOJI[r.signal_strength] ?? '🔵';
              return (
                <div
                  key={r.ticker}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(100,149,237,0.2)',
                    borderRadius: '12px',
                    padding: '0.8rem 1rem',
                    display: 'flex', alignItems: 'center', gap: '0.8rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>{strengthEmoji}</span>
                  <button
                    onClick={() => handleAnalyze(r.ticker)}
                    style={{
                      fontWeight: 700, fontSize: '1.05rem', cursor: 'pointer',
                      background: 'none', border: 'none', color: '#6495ed',
                      padding: 0, textDecoration: 'underline',
                    }}
                  >
                    {r.ticker}
                  </button>
                  <span style={{
                    fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '5px',
                    background: 'rgba(100,149,237,0.1)', border: '1px solid rgba(100,149,237,0.2)',
                    color: '#6495ed',
                  }}>
                    {r.signal_strength}
                  </span>
                  {r.streak >= 2 && (
                    <span style={{ fontSize: '0.75rem', color: '#f4a261' }}>🔥 {r.streak}d</span>
                  )}
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1.2rem', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.68rem', opacity: 0.5 }}>Net 10D</div>
                      <div style={{ fontWeight: 600, color: '#38ef7d' }}>+{r.net_value_10d.toFixed(1)}M</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.68rem', opacity: 0.5 }}>Score</div>
                      <div style={{ fontWeight: 600 }}>{r.combined_score}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ marginTop: '1rem', fontSize: '0.72rem', opacity: 0.4 }}>
          ⚠️ Bukan rekomendasi beli. Pantau breakout volume sebelum entry.
        </p>
      </section>
    </div>
  );
}
