'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface HealthSummary {
  ok:          boolean;
  heartbeat:   { last_updated: string | null; lag_min: number | null; status: string };
  last_signal: { ticker: string | null; trade_date: string | null; status: string };
  sm_today:    { count: number; date: string };
}

export default function HealthBar() {
  const [data,    setData]    = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.ok ? r.json() : null)
      .then(j => setData(j))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) return null;

  const status    = data.heartbeat.status;
  const dotColor  = status === 'OK' ? '#22c55e' : status === 'STALE' ? '#f59e0b' : '#6b7280';
  const glowing   = status === 'OK';

  return (
    <Link
      href="/health"
      style={{ textDecoration: 'none' }}
      title="Lihat System Health"
    >
      <div style={{
        display:        'flex',
        alignItems:     'center',
        gap:            '0.6rem',
        padding:        '0.3rem 0.8rem',
        background:     'rgba(255,255,255,0.03)',
        border:         '1px solid rgba(255,255,255,0.07)',
        borderRadius:   8,
        fontSize:       '0.7rem',
        color:          '#888',
        cursor:         'pointer',
        transition:     'border-color 0.2s',
        whiteSpace:     'nowrap',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)')}
      >
        {/* Status dot */}
        <span style={{
          width:     7, height: 7,
          borderRadius: '50%',
          background:   dotColor,
          flexShrink:   0,
          boxShadow:    glowing ? `0 0 5px ${dotColor}` : 'none',
        }} />

        {/* Bot status */}
        <span style={{ color: dotColor, fontWeight: 600 }}>
          {status === 'OK' ? 'Bot OK' : status === 'STALE' ? 'Bot Stale' : 'Bot —'}
        </span>

        <span style={{ color: '#444' }}>|</span>

        {/* Last trade date */}
        <span>
          Data: <strong style={{ color: '#aaa' }}>
            {data.heartbeat.last_updated ?? '—'}
          </strong>
        </span>

        <span style={{ color: '#444' }}>|</span>

        {/* SM count */}
        <span>
          SM: <strong style={{ color: '#60a5fa' }}>{data.sm_today.count}</strong> ticker
        </span>

        <span style={{ color: '#333', fontSize: '0.65rem' }}>↗</span>
      </div>
    </Link>
  );
}
