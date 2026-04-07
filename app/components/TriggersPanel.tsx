'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BandarAlert {
  id: number; ticker: string; arah: string; trigger_type: string;
  combined_score: number; signal_strength: string;
  net_lots_10d: number; intraday_sm: number; last_price: number;
  created_at: string; trade_date: string;
}
interface TradeSignal {
  id: number; ticker: string; signal_type: string; signal_date: string;
  entry_price: number; sm_conf: number; oracle_score: number;
  bandar_phase: string; sl_price: number; tp1_price: number;
  tp2_price: number; notes: string;
}
interface AlgoSignal {
  id: number; ticker: string; algo_name: string; algo_type: string;
  msg_date: string; price: string; gain_pct: string;
  value: string; mf: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TRIGGER_META: Record<string, { label: string; color: string; bg: string }> = {
  SM:          { label: '💵 SM',          color: '#38ef7d', bg: 'rgba(56,239,125,0.1)' },
  BIG_SM:      { label: '💰 Big SM',      color: '#00d4ff', bg: 'rgba(0,212,255,0.1)' },
  MF_PLUS:     { label: '📈 MF+',         color: '#38ef7d', bg: 'rgba(56,239,125,0.08)' },
  BIG_MF_PLUS: { label: '🚀 Big MF+',    color: '#7fff00', bg: 'rgba(127,255,0,0.1)' },
  BAD_MONEY:   { label: '💀 Bad Money',   color: '#f5576c', bg: 'rgba(245,87,108,0.1)' },
  MF_MINUS:    { label: '📉 MF-',         color: '#f5576c', bg: 'rgba(245,87,108,0.08)' },
  BIG_MF_MINUS:{ label: '⚠️ Big MF-',    color: '#ff4444', bg: 'rgba(255,68,68,0.1)' },
  ALGO:        { label: '🤖 Algo',        color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  COMBINED:    { label: '📊 Mixed',       color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
};

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'baru';
  if (diff < 60) return `${diff}m`;
  const h = Math.floor(diff / 60);
  return h < 24 ? `${h}j` : `${Math.floor(h / 24)}h`;
}

function fmtDate(iso: string) {
  if (!iso) return '-';
  // Jika tidak ada tz info (naive WIB dari bot lama), anggap WIB (+07:00)
  const normalized = (!iso.includes('Z') && !iso.match(/[+-]\d{2}:?\d{2}$/))
    ? iso + '+07:00'
    : iso;
  const d = new Date(normalized);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'Asia/Jakarta' })
    + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
}

function lots(n: number) {
  if (!n) return '-';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000)     return (n / 1_000).toFixed(0)     + 'K';
  return String(n);
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props { activeTab: string }

export default function TriggersPanel({ activeTab }: Props) {
  const [alerts,  setAlerts]  = useState<BandarAlert[]>([]);
  const [trades,  setTrades]  = useState<TradeSignal[]>([]);
  const [algos,   setAlgos]   = useState<AlgoSignal[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown,   setCountdown]   = useState(30);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filters
  const [filterArah,    setFilterArah]    = useState('');
  const [filterTrigger, setFilterTrigger] = useState('');
  const [filterTicker,  setFilterTicker]  = useState('');
  const [filterDays,    setFilterDays]    = useState('7');

  const fetchData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const d = new Date();
      d.setDate(d.getDate() - parseInt(filterDays || '7'));
      const fromISO = d.toISOString();

      const params = new URLSearchParams({ limit: '100', from: fromISO });
      if (filterTicker) params.set('ticker', filterTicker.toUpperCase());
      if (filterArah)   params.set('arah', filterArah);

      if (activeTab === 'signals') {
        if (filterTrigger) params.set('trigger', filterTrigger);
        params.set('type', 'bandar_alerts');
        const res  = await fetch(`/api/triggers?${params}`);
        const json = await res.json();
        setAlerts(json.data || []);
      } else if (activeTab === 'trade') {
        params.set('type', 'trade_signals');
        const res  = await fetch(`/api/triggers?${params}`);
        const json = await res.json();
        setTrades(json.data || []);
      } else if (activeTab === 'algo') {
        params.set('type', 'algo_signals');
        const res  = await fetch(`/api/triggers?${params}`);
        const json = await res.json();
        setAlgos(json.data || []);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, [activeTab, filterTicker, filterArah, filterTrigger, filterDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime subscription via Supabase postgres_changes (semua tab)
  useEffect(() => {
    const tableMap: Record<string, string> = {
      signals: 'bandar_alerts',
      trade:   'v4_trade_signals',
      algo:    'v4_algo_signals',
    };
    const table = tableMap[activeTab];
    if (!table) return;
    const ch = supabase
      .channel(`triggers-realtime-${activeTab}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeTab, fetchData]);

  // Auto-refresh 30 detik untuk SEMUA tab (fallback jika realtime blocked by RLS)
  useEffect(() => {
    setCountdown(30);
    const interval = setInterval(() => { fetchData(); setCountdown(30); }, 30000);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => {
      clearInterval(interval);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [activeTab, fetchData]);

  // ── Render ─────────────────────────────────────────────────────────────── #

  return (
    <div>
      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
        marginBottom: '1rem', alignItems: 'center',
      }}>
        <input
          placeholder="Ticker..."
          value={filterTicker}
          onChange={e => setFilterTicker(e.target.value.toUpperCase())}
          style={inputStyle}
          maxLength={6}
        />
        <select value={filterDays} onChange={e => setFilterDays(e.target.value)} style={inputStyle}>
          <option value="1">1 hari</option>
          <option value="3">3 hari</option>
          <option value="7">7 hari</option>
          <option value="14">14 hari</option>
          <option value="30">30 hari</option>
        </select>

        {activeTab === 'signals' && (
          <>
            <select value={filterArah} onChange={e => setFilterArah(e.target.value)} style={inputStyle}>
              <option value="">Semua Arah</option>
              <option value="ACCUM">⬆ Akumulasi</option>
              <option value="DISTRIB">⬇ Distribusi</option>
            </select>
            <select value={filterTrigger} onChange={e => setFilterTrigger(e.target.value)} style={inputStyle}>
              <option value="">Semua Trigger</option>
              <option value="SM">💵 Trigger SM</option>
              <option value="BIG_SM">💰 Trigger Big SM</option>
              <option value="MF_PLUS">📈 Live MF+</option>
              <option value="BIG_MF_PLUS">🚀 Live Big MF+</option>
              <option value="BAD_MONEY">💀 Trigger Bad Money</option>
              <option value="MF_MINUS">📉 Live MF-</option>
              <option value="BIG_MF_MINUS">⚠️ Live Big MF-</option>
              <option value="ALGO">🤖 Algo</option>
            </select>
          </>
        )}
        {activeTab === 'algo' && (
          <select value={filterArah} onChange={e => setFilterArah(e.target.value)} style={inputStyle}>
            <option value="">Semua</option>
            <option value="ACCUM">⬆ Positif</option>
            <option value="DISTRIB">⬇ Negatif</option>
          </select>
        )}
        <button onClick={fetchData} style={btnStyle}>↻ Refresh</button>
        {loading && <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Loading...</span>}
        {!loading && lastUpdated && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>
            ⚡ realtime · 🔄 {countdown}s
            {` · ${lastUpdated.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
          </span>
        )}
      </div>

      {error && (
        <div style={{ color: '#f5576c', fontSize: '0.82rem', marginBottom: '1rem' }}>⚠ {error}</div>
      )}

      {/* Signal Feed */}
      {activeTab === 'signals' && (
        <AlertsTable alerts={alerts} />
      )}

      {/* Trade Signals */}
      {activeTab === 'trade' && (
        <TradeTable trades={trades} />
      )}

      {/* Algo Signals */}
      {activeTab === 'algo' && (
        <AlgoTable algos={algos} />
      )}
    </div>
  );
}

// ── Sub-tables ────────────────────────────────────────────────────────────────

function AlertsTable({ alerts }: { alerts: BandarAlert[] }) {
  if (alerts.length === 0) return <EmptyState msg="Belum ada signal. Bot berjalan sejak 2 Apr 2026." />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {alerts.map(a => {
          const meta = TRIGGER_META[a.trigger_type] || TRIGGER_META.COMBINED;
          const isAccum = a.arah === 'ACCUM';
          return (
            <div key={a.id} style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 1fr 1fr 1fr 60px 70px',
              alignItems: 'center', gap: '0.5rem',
              padding: '0.55rem 0.75rem',
              background: 'var(--bg-card)',
              border: `1px solid ${isAccum ? 'rgba(56,239,125,0.15)' : 'rgba(245,87,108,0.15)'}`,
              borderRadius: '10px', fontSize: '0.8rem',
            }}>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {a.ticker}
                <span style={{ marginLeft: '4px', color: isAccum ? '#38ef7d' : '#f5576c' }}>
                  {isAccum ? '⬆' : '⬇'}
                </span>
              </span>
              <span style={{
                padding: '0.15rem 0.5rem', borderRadius: '6px',
                background: meta.bg, color: meta.color,
                fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap',
              }}>
                {meta.label}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                Score: <b style={{ color: 'var(--text-primary)' }}>{a.combined_score}</b>
                {' '}· {a.signal_strength}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                Net 10d: <b style={{ color: (a.net_lots_10d || 0) > 0 ? '#38ef7d' : '#f5576c' }}>
                  {lots(a.net_lots_10d)}
                </b>
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                Intra SM: <b>{a.intraday_sm?.toFixed(0) || '-'}</b>
                {a.last_price ? ` · Rp${a.last_price?.toLocaleString('id-ID')}` : ''}
              </span>
              <span style={{
                fontSize: '0.72rem', fontWeight: 600,
                color: isAccum ? '#38ef7d' : '#f5576c',
              }}>
                {a.arah}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                {timeAgo(a.created_at)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TradeTable({ trades }: { trades: TradeSignal[] }) {
  if (trades.length === 0) return <EmptyState msg="Belum ada trade signal tersimpan." />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
            {['Tanggal','Ticker','Tipe','Entry','SL','TP1','TP2','SM Conf','Oracle','Phase'].map(h => (
              <th key={h} style={{ padding: '0.5rem 0.6rem', textAlign: 'left', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map(t => (
            <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={tdStyle}>{fmtDate(t.signal_date)}</td>
              <td style={{ ...tdStyle, fontWeight: 700 }}>{t.ticker}</td>
              <td style={{ ...tdStyle, color: t.signal_type?.includes('BUY') ? '#38ef7d' : '#f5576c', fontWeight: 600 }}>
                {t.signal_type}
              </td>
              <td style={tdStyle}>{t.entry_price ? `Rp${t.entry_price.toLocaleString('id-ID')}` : '-'}</td>
              <td style={{ ...tdStyle, color: '#f5576c' }}>{t.sl_price  ? `Rp${t.sl_price.toLocaleString('id-ID')}` : '-'}</td>
              <td style={{ ...tdStyle, color: '#38ef7d' }}>{t.tp1_price ? `Rp${t.tp1_price.toLocaleString('id-ID')}` : '-'}</td>
              <td style={{ ...tdStyle, color: '#38ef7d' }}>{t.tp2_price ? `Rp${t.tp2_price.toLocaleString('id-ID')}` : '-'}</td>
              <td style={tdStyle}>{t.sm_conf != null ? `${t.sm_conf}%` : '-'}</td>
              <td style={tdStyle}>{t.oracle_score ?? '-'}</td>
              <td style={{ ...tdStyle, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{t.bandar_phase || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlgoTable({ algos }: { algos: AlgoSignal[] }) {
  if (algos.length === 0) return <EmptyState msg="Belum ada algo signal tersimpan." />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {algos.map(a => {
          const isPos = a.algo_type === 'positive';
          return (
            <div key={a.id} style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 80px 70px 70px 90px',
              alignItems: 'center', gap: '0.5rem',
              padding: '0.55rem 0.75rem',
              background: 'var(--bg-card)',
              border: `1px solid ${isPos ? 'rgba(167,139,250,0.2)' : 'rgba(245,87,108,0.15)'}`,
              borderRadius: '10px', fontSize: '0.8rem',
            }}>
              <span style={{ fontWeight: 700 }}>{a.ticker}</span>
              <span style={{
                fontSize: '0.75rem', color: isPos ? '#a78bfa' : '#f5576c',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {a.algo_name}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                {a.price ? `Rp${a.price}` : '-'}
              </span>
              <span style={{ color: isPos ? '#38ef7d' : '#f5576c', fontWeight: 600, fontSize: '0.75rem' }}>
                {a.gain_pct ? `${a.gain_pct}%` : '-'}
              </span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                {a.mf || '-'}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                {fmtDate(a.msg_date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '3rem',
      color: 'var(--text-secondary)', fontSize: '0.85rem',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
      {msg}
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  padding: '0.35rem 0.65rem',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px', color: 'var(--text-primary)',
  fontSize: '0.8rem', outline: 'none',
};

const btnStyle: React.CSSProperties = {
  padding: '0.35rem 0.8rem',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px', color: 'var(--text-primary)',
  fontSize: '0.8rem', cursor: 'pointer',
};

const tdStyle: React.CSSProperties = {
  padding: '0.45rem 0.6rem', color: 'var(--text-primary)',
};
