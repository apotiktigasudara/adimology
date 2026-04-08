'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface SmRolling {
  id: number;
  ticker: string;
  trade_date: string;
  sm_daily: number;
  bm_daily: number;
  mfp_daily: number;
  mfn_daily: number;
  sm_3d: number;
  sm_10d: number;
  sm_30d: number;
  nbsa_daily: number;
  updated_at: string;
}

const PHASE_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  CLIMAX:       { color: '#38ef7d', bg: 'rgba(56,239,125,0.15)',  label: '🔥 CLIMAX' },
  BUILDING:     { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  label: '📈 BUILDING' },
  INITIAL:      { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', label: '🔵 INITIAL' },
  DISTRIBUTION: { color: '#f5576c', bg: 'rgba(245,87,108,0.12)',  label: '🔴 DISTRIB' },
};

function getPhase(sm3d: number, sm10d: number, bm: number): string {
  if (sm3d <= 0 && bm <= 0) return 'INITIAL';
  if (sm3d > 0 && bm > sm3d * 0.6) return 'DISTRIBUTION';
  if (sm3d === 0 && bm > 0) return 'DISTRIBUTION';
  const accel = sm10d > 0 ? sm3d / (sm10d / 3) : 0;
  if (accel >= 1.5 && sm3d > 0) return 'CLIMAX';
  if (sm10d > 0 && sm3d >= sm10d * 0.1) return 'BUILDING';
  if (sm3d > 0) return 'BUILDING';
  return 'INITIAL';
}

function fmtM(n: number | null) {
  if (n == null || n === 0) return '-';
  const abs = Math.abs(n);
  if (abs >= 1000) return (n / 1000).toFixed(1) + 'T';
  if (abs >= 1)    return n.toFixed(1) + 'B';
  return n.toFixed(2) + 'B';
}

function fmtDate(iso: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: '2-digit', timeZone: 'Asia/Jakarta'
  });
}

export default function SmRollingPage() {
  const [data,         setData]         = useState<SmRolling[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [filterTicker, setFilterTicker] = useState('');
  const [filterPhase,  setFilterPhase]  = useState('');
  const [sortBy,       setSortBy]       = useState<'sm_3d' | 'sm_10d' | 'sm_30d' | 'nbsa_daily'>('sm_3d');
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);
  const [countdown,    setCountdown]    = useState(30);
  const [dataDate,     setDataDate]     = useState<string>('');

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: 'sm_rolling', limit: '200', from: today,
      });
      if (filterTicker) params.set('ticker', filterTicker.toUpperCase());
      const res  = await fetch(`/api/triggers?${params}`);
      const json = await res.json();
      setData(json.data || []);
      setLastUpdated(new Date());
      // Tampilkan tanggal data yang sebenarnya (fallback ke kemarin jika hari ini kosong)
      if (json.latest_date) setDataDate(json.latest_date);
      else if (json.data?.[0]?.trade_date) setDataDate(json.data[0].trade_date);
    } finally { setLoading(false); }
  }, [filterTicker, today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh 30s
  useEffect(() => {
    setCountdown(30);
    const iv1 = setInterval(() => { fetchData(); setCountdown(30); }, 30000);
    const iv2 = setInterval(() => setCountdown(p => p <= 1 ? 30 : p - 1), 1000);
    return () => { clearInterval(iv1); clearInterval(iv2); };
  }, [fetchData]);

  // Supabase Realtime — update saat backfill/EOD sync
  useEffect(() => {
    const ch = supabase
      .channel('smrolling-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'v4_sm_rolling' }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData]);

  // Sort + filter client-side
  const enriched = data.map(r => ({
    ...r,
    phase: getPhase(r.sm_3d ?? 0, r.sm_10d ?? 0, r.bm_daily ?? 0),
    sm_net: (r.sm_daily ?? 0) - (r.bm_daily ?? 0),
    accel:  r.sm_10d > 0 ? ((r.sm_3d ?? 0) / (r.sm_10d / 3)) : 0,
  }));

  const filtered = enriched
    .filter(r => !filterPhase || r.phase === filterPhase)
    .sort((a, b) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0));

  const stats = {
    climax:  enriched.filter(r => r.phase === 'CLIMAX').length,
    building:enriched.filter(r => r.phase === 'BUILDING').length,
    distrib: enriched.filter(r => r.phase === 'DISTRIBUTION').length,
    nbsaPos: enriched.filter(r => (r.nbsa_daily ?? 0) > 0).length,
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          📊 SM Rolling Windows
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Akumulasi Smart Money multi-hari · CLIMAX / BUILDING / DISTRIBUTION
          {' '}· Update saat /backfill atau EOD sync (16:30 WIB)
        </p>
        {dataDate && (
          <p style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
            <span style={{
              background: dataDate === today ? 'rgba(56,239,125,0.15)' : 'rgba(251,191,36,0.15)',
              color: dataDate === today ? '#38ef7d' : '#fbbf24',
              padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.72rem',
            }}>
              {dataDate === today ? `Data hari ini (${dataDate})` : `Data terakhir: ${dataDate} — hari ini belum ada (EOD belum jalan)`}
            </span>
          </p>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Ticker', value: enriched.length,  color: 'var(--text-primary)' },
          { label: '🔥 CLIMAX',    value: stats.climax,     color: '#38ef7d' },
          { label: '📈 BUILDING',  value: stats.building,   color: '#60a5fa' },
          { label: '🔴 DISTRIBUSI',value: stats.distrib,    color: '#f5576c' },
          { label: '🌍 NBSA+',     value: stats.nbsaPos,    color: '#fbbf24' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '0.65rem 0.75rem', background: 'var(--bg-card)',
            border: '1px solid var(--border-color)', borderRadius: '10px',
          }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>{s.label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          placeholder="Ticker..."
          value={filterTicker}
          onChange={e => setFilterTicker(e.target.value.toUpperCase())}
          maxLength={6} style={inp}
        />
        <select value={filterPhase} onChange={e => setFilterPhase(e.target.value)} style={inp}>
          <option value="">Semua Phase</option>
          <option value="CLIMAX">🔥 CLIMAX</option>
          <option value="BUILDING">📈 BUILDING</option>
          <option value="INITIAL">🔵 INITIAL</option>
          <option value="DISTRIBUTION">🔴 DISTRIBUTION</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} style={inp}>
          <option value="sm_3d">Sort: SM 3D</option>
          <option value="sm_10d">Sort: SM 10D</option>
          <option value="sm_30d">Sort: SM 30D</option>
          <option value="nbsa_daily">Sort: NBSA</option>
        </select>
        <button onClick={fetchData} style={btn}>↻ Refresh</button>
        {loading && <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Loading...</span>}
        {!loading && lastUpdated && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            ⚡ realtime · 🔄 {countdown}s · {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          Belum ada data SM Rolling untuk hari ini. Coba /backfill di bot.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.79rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.71rem' }}>
                {['Ticker','Phase','SM Today','BM Today','Net','Accel','SM 3D','SM 10D','SM 30D','NBSA','Tanggal'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const ph = PHASE_COLORS[r.phase] || PHASE_COLORS.INITIAL;
                const netColor = r.sm_net > 0 ? '#38ef7d' : r.sm_net < 0 ? '#f5576c' : 'var(--text-secondary)';
                const accelColor = r.accel >= 1.5 ? '#38ef7d' : r.accel >= 1.0 ? '#fbbf24' : 'var(--text-secondary)';
                return (
                  <tr key={r.id} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: r.phase === 'DISTRIBUTION' ? 'rgba(245,87,108,0.03)' : undefined,
                  }}>
                    <td style={{ ...td, fontWeight: 700 }}>{r.ticker}</td>
                    <td style={td}>
                      <span style={{
                        padding: '0.15rem 0.45rem', borderRadius: '6px',
                        background: ph.bg, color: ph.color,
                        fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap',
                      }}>
                        {ph.label}
                      </span>
                    </td>
                    <td style={{ ...td, color: '#38ef7d' }}>{fmtM(r.sm_daily)}</td>
                    <td style={{ ...td, color: '#f5576c' }}>{fmtM(r.bm_daily)}</td>
                    <td style={{ ...td, color: netColor, fontWeight: 600 }}>{fmtM(r.sm_net)}</td>
                    <td style={{ ...td, color: accelColor, fontWeight: 600 }}>
                      {r.accel > 0 ? r.accel.toFixed(2) + 'x' : '-'}
                    </td>
                    <td style={{ ...td, color: (r.sm_3d ?? 0) > 0 ? '#38ef7d' : '#f5576c' }}>
                      {fmtM(r.sm_3d)}
                    </td>
                    <td style={{ ...td, color: (r.sm_10d ?? 0) > 0 ? '#38ef7d' : 'var(--text-secondary)' }}>
                      {fmtM(r.sm_10d)}
                    </td>
                    <td style={{ ...td, color: 'var(--text-secondary)' }}>{fmtM(r.sm_30d)}</td>
                    <td style={{ ...td, color: (r.nbsa_daily ?? 0) > 0 ? '#fbbf24' : (r.nbsa_daily ?? 0) < 0 ? '#94a3b8' : 'var(--text-secondary)' }}>
                      {fmtM(r.nbsa_daily)}
                    </td>
                    <td style={{ ...td, color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                      {fmtDate(r.trade_date)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: '0.35rem 0.65rem', background: 'var(--bg-card)',
  border: '1px solid var(--border-color)', borderRadius: '8px',
  color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none',
};
const btn: React.CSSProperties = {
  padding: '0.35rem 0.8rem', background: 'var(--bg-card)',
  border: '1px solid var(--border-color)', borderRadius: '8px',
  color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer',
};
const td: React.CSSProperties = { padding: '0.45rem 0.6rem', color: 'var(--text-primary)' };
