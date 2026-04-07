'use client';
import { useState, useEffect, useCallback } from 'react';

interface TradeSignal {
  id: number;
  ticker: string;
  signal_type: string;
  signal_date: string;
  entry_price: number;
  sm_conf: number | null;
  oracle_score: number | null;
  bandar_phase: string | null;
  sl_price: number | null;
  tp1_price: number | null;
  tp2_price: number | null;
  notes: string | null;
  created_at: string;
}

function fmtDate(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'Asia/Jakarta' })
    + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
}

function rp(n: number | null) {
  if (n == null) return '-';
  return 'Rp' + n.toLocaleString('id-ID');
}

function pct(sl: number | null, entry: number | null) {
  if (!sl || !entry) return null;
  return (((sl - entry) / entry) * 100).toFixed(1);
}

export default function TradeSignalPage() {
  const [signals,      setSignals]      = useState<TradeSignal[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [filterType,   setFilterType]   = useState('');
  const [filterTicker, setFilterTicker] = useState('');
  const [filterDays,   setFilterDays]   = useState('30');
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);
  const [countdown,    setCountdown]    = useState(30);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - parseInt(filterDays));
      const params = new URLSearchParams({ type: 'trade_signals', limit: '200', from: from.toISOString() });
      if (filterTicker) params.set('ticker', filterTicker.toUpperCase());
      if (filterType)   params.set('arah', filterType);
      const res  = await fetch(`/api/triggers?${params}`);
      const json = await res.json();
      setSignals(json.data || []);
      setLastUpdated(new Date());
    } finally { setLoading(false); }
  }, [filterTicker, filterType, filterDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh 30s
  useEffect(() => {
    setCountdown(30);
    const iv1 = setInterval(() => { fetchData(); setCountdown(30); }, 30000);
    const iv2 = setInterval(() => setCountdown(p => p <= 1 ? 30 : p - 1), 1000);
    return () => { clearInterval(iv1); clearInterval(iv2); };
  }, [fetchData]);

  const buys  = signals.filter(s => s.signal_type?.includes('BUY') || s.signal_type === 'ORACLE');
  const sells = signals.filter(s => s.signal_type?.includes('SELL'));
  const tickers = [...new Set(signals.map(s => s.ticker))];

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
          🎯 Trade Signals
        </h2>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Oracle + Smart Money signals · Entry, SL, TP dari Phoenix Bot
        </p>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          placeholder="Ticker..."
          value={filterTicker}
          onChange={e => setFilterTicker(e.target.value.toUpperCase())}
          maxLength={6} style={inp}
        />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={inp}>
          <option value="">Semua Tipe</option>
          <option value="ACCUM">⬆ Buy / Oracle</option>
          <option value="DISTRIB">⬇ Sell</option>
        </select>
        <select value={filterDays} onChange={e => setFilterDays(e.target.value)} style={inp}>
          <option value="7">7 hari</option>
          <option value="14">14 hari</option>
          <option value="30">30 hari</option>
          <option value="60">60 hari</option>
        </select>
        <button onClick={fetchData} style={btn}>↻ Refresh</button>
        {loading && <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Loading...</span>}
        {!loading && lastUpdated && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            🔄 {countdown}s · {lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {[
          { label: 'Total Signal', value: signals.length, color: 'var(--text-primary)' },
          { label: '⬆ Buy/Oracle', value: buys.length,   color: '#38ef7d' },
          { label: '⬇ Sell',       value: sells.length,  color: '#f5576c' },
          { label: 'Unique Ticker', value: tickers.length, color: 'var(--accent-primary)' },
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

      {/* Table */}
      {signals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
          Belum ada trade signal untuk filter ini.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                {['Tanggal', 'Ticker', 'Tipe', 'Entry', 'SL', 'TP1', 'TP2', 'Risk%', 'SM Conf', 'Oracle', 'Phase'].map(h => (
                  <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map(t => {
                const isBuy = t.signal_type?.includes('BUY') || t.signal_type === 'ORACLE';
                const riskPct = pct(t.sl_price, t.entry_price);
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={td}>{fmtDate(t.signal_date)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{t.ticker}</td>
                    <td style={{ ...td, color: isBuy ? '#38ef7d' : '#f5576c', fontWeight: 600 }}>
                      {t.signal_type}
                    </td>
                    <td style={td}>{rp(t.entry_price)}</td>
                    <td style={{ ...td, color: '#f5576c' }}>{rp(t.sl_price)}</td>
                    <td style={{ ...td, color: '#38ef7d' }}>{rp(t.tp1_price)}</td>
                    <td style={{ ...td, color: '#4ade80' }}>{rp(t.tp2_price)}</td>
                    <td style={{ ...td, color: riskPct ? (parseFloat(riskPct) < 0 ? '#f5576c' : '#38ef7d') : 'var(--text-secondary)' }}>
                      {riskPct ? `${riskPct}%` : '-'}
                    </td>
                    <td style={td}>{t.sm_conf != null ? `${t.sm_conf}%` : '-'}</td>
                    <td style={{ ...td, color: (t.oracle_score ?? 0) >= 80 ? '#38ef7d' : 'var(--text-primary)' }}>
                      {t.oracle_score ?? '-'}
                    </td>
                    <td style={{ ...td, fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {t.bandar_phase || '-'}
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
