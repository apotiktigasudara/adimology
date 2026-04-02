'use client';
import { useState, useEffect, useCallback } from 'react';

interface AlgoSignal {
  id: number; ticker: string; algo_name: string; algo_type: string;
  msg_date: string; price: string; gain_pct: string; value: string; mf: string;
}

function fmtDate(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })
    + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export default function AlgoPage() {
  const [algos,   setAlgos]   = useState<AlgoSignal[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType,   setFilterType]   = useState('');
  const [filterTicker, setFilterTicker] = useState('');
  const [filterDays,   setFilterDays]   = useState('30');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - parseInt(filterDays));
      const params = new URLSearchParams({ type: 'algo_signals', limit: '200', from: from.toISOString() });
      if (filterTicker) params.set('ticker', filterTicker.toUpperCase());
      if (filterType)   params.set('arah', filterType);
      const res  = await fetch(`/api/triggers?${params}`);
      const json = await res.json();
      setAlgos(json.data || []);
    } finally { setLoading(false); }
  }, [filterTicker, filterType, filterDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Group by algo_name
  const byAlgo: Record<string, AlgoSignal[]> = {};
  for (const a of algos) {
    const key = a.algo_name || 'Unknown';
    byAlgo[key] = byAlgo[key] || [];
    byAlgo[key].push(a);
  }

  // Stats
  const positif  = algos.filter(a => a.algo_type === 'positive');
  const negatif  = algos.filter(a => a.algo_type === 'negative');
  const tickers  = [...new Set(algos.map(a => a.ticker))];

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          🤖 Algo Signals
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Dari @algo_chart_saham_bot (ID: 8196934116) · Pattern + Breakout + Technical
        </p>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <input placeholder="Ticker..." value={filterTicker}
          onChange={e => setFilterTicker(e.target.value.toUpperCase())}
          maxLength={6} style={inp} />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={inp}>
          <option value="">Semua</option>
          <option value="ACCUM">⬆ Positif</option>
          <option value="DISTRIB">⬇ Negatif</option>
        </select>
        <select value={filterDays} onChange={e => setFilterDays(e.target.value)} style={inp}>
          <option value="7">7 hari</option>
          <option value="14">14 hari</option>
          <option value="30">30 hari</option>
          <option value="60">60 hari</option>
        </select>
        <button onClick={fetchData} style={btn}>↻ Refresh</button>
        {loading && <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Loading...</span>}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Signal', value: algos.length, color: 'var(--text-primary)' },
          { label: '⬆ Positif', value: positif.length, color: '#38ef7d' },
          { label: '⬇ Negatif', value: negatif.length, color: '#f5576c' },
          { label: 'Unique Ticker', value: tickers.length, color: 'var(--accent-primary)' },
          { label: 'Algo Pattern', value: Object.keys(byAlgo).length, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} style={{ padding: '0.65rem 0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>{s.label}</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Group by algo pattern */}
      {Object.entries(byAlgo).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          Belum ada algo signal. Data tersimpan sejak 3 Mar 2026.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Object.entries(byAlgo).map(([algoName, rows]) => {
            const isPos = rows[0]?.algo_type === 'positive';
            return (
              <div key={algoName} style={{
                background: 'var(--bg-card)', borderRadius: '12px',
                border: `1px solid ${isPos ? 'rgba(167,139,250,0.2)' : 'rgba(245,87,108,0.2)'}`,
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '0.6rem 0.9rem', fontWeight: 700, fontSize: '0.85rem',
                  background: isPos ? 'rgba(167,139,250,0.08)' : 'rgba(245,87,108,0.08)',
                  color: isPos ? '#a78bfa' : '#f5576c',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>{algoName}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-secondary)' }}>
                    {rows.length} signal
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', padding: '0.6rem 0.75rem' }}>
                  {rows.map(r => (
                    <div key={r.id} style={{
                      padding: '0.3rem 0.6rem', borderRadius: '8px', fontSize: '0.77rem',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)',
                      display: 'flex', gap: '0.5rem', alignItems: 'center',
                    }}>
                      <span style={{ fontWeight: 700 }}>{r.ticker}</span>
                      {r.price && <span style={{ color: 'var(--text-secondary)' }}>{r.price}</span>}
                      {r.gain_pct && (
                        <span style={{ color: parseFloat(r.gain_pct) >= 0 ? '#38ef7d' : '#f5576c', fontWeight: 600 }}>
                          {r.gain_pct}%
                        </span>
                      )}
                      {r.mf && <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>{r.mf}</span>}
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>{fmtDate(r.msg_date)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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
