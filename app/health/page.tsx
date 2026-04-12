/**
 * app/health/page.tsx — Task 3.1
 *
 * Route: /health
 * Dashboard status sistem Phoenix Bot — refresh setiap 60 detik.
 */
'use client';

import { useEffect, useState, useCallback } from 'react';

interface HealthData {
  ok:          boolean;
  ts:          string;
  heartbeat:   { last_updated: string | null; lag_min: number | null; status: string };
  last_signal: { ticker: string | null; trade_date: string | null; status: string };
  sm_today:    { count: number; date: string };
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'OK' || status === 'TODAY'    ? '#22c55e' :
    status === 'STALE' || status === 'OLD'   ? '#f59e0b' :
    '#6b7280';
  return (
    <span
      style={{
        display:      'inline-block',
        width:        10, height: 10,
        borderRadius: '50%',
        background:   color,
        marginRight:  6,
        boxShadow:    status === 'OK' || status === 'TODAY'
          ? `0 0 6px ${color}` : 'none',
      }}
    />
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background:   'rgba(255,255,255,0.04)',
      border:       '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding:      '1rem 1.25rem',
      minWidth:     220,
    }}>
      <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: 6,
                    textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export default function HealthPage() {
  const [data,    setData]    = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
    finally {
      setLoading(false);
      setCheckedAt(new Date());
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);
  useEffect(() => {
    const t = setInterval(fetch_, 60_000);
    return () => clearInterval(t);
  }, [fetch_]);

  function fmt(iso: string | null): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta', hour12: false,
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }) + ' WIB';
    } catch { return iso; }
  }

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#888' }}>Memuat data sistem...</div>
    );
  }

  const d = data;

  return (
    <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.3rem' }}>
        Phoenix Bot — System Health
      </h1>
      <p style={{ fontSize: '0.72rem', color: '#666', marginBottom: '1.5rem' }}>
        Auto-refresh 60s | Cek terakhir: {checkedAt ? fmt(checkedAt.toISOString()) : '—'}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>

        {/* Heartbeat */}
        <Panel label="Bot Heartbeat">
          {d ? (
            <>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                <StatusDot status={d.heartbeat.status} />
                {d.heartbeat.status}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: 4 }}>
                Last update: {fmt(d.heartbeat.last_updated)}
              </div>
              {d.heartbeat.lag_min !== null && (
                <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 2 }}>
                  Lag: {d.heartbeat.lag_min} menit
                </div>
              )}
            </>
          ) : <span style={{ color: '#666' }}>Tidak ada data</span>}
        </Panel>

        {/* Last Signal */}
        <Panel label="Sinyal SM Terakhir">
          {d ? (
            <>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                <StatusDot status={d.last_signal.status} />
                {d.last_signal.ticker ?? '—'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#aaa', marginTop: 4 }}>
                Trade date: {d.last_signal.trade_date ?? '—'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 2 }}>
                {d.last_signal.status === 'TODAY' ? 'Hari ini ✓' : 'Bukan hari ini'}
              </div>
            </>
          ) : <span style={{ color: '#666' }}>Tidak ada data</span>}
        </Panel>

        {/* SM Count Today */}
        <Panel label={`SM Masuk (${d?.sm_today.date ?? '—'})`}>
          {d ? (
            <>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#60a5fa' }}>
                {d.sm_today.count}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 4 }}>
                ticker aktif hari ini
              </div>
            </>
          ) : <span style={{ color: '#666' }}>Tidak ada data</span>}
        </Panel>

        {/* Stockbit API */}
        <Panel label="Stockbit API">
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            <StatusDot status="UNKNOWN" />
            <span style={{ color: '#666' }}>VPS endpoint</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#555', marginTop: 4 }}>
            Circuit breaker status dari VPS (coming soon)
          </div>
        </Panel>

      </div>

      <p style={{ fontSize: '0.65rem', color: '#444', marginTop: '2rem' }}>
        Phoenix Bot V.X — Health Dashboard /health
      </p>
    </div>
  );
}
