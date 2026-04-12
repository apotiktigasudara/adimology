/**
 * app/components/FlowSparkline.tsx — Phoenix Bot V.X × Adimology  Task 2.3
 *
 * Mini sparkline chart SM flow 30 hari per ticker.
 * Warna: hijau = net buy, merah = net sell, tooltip saat hover.
 * Klik ticker di BandarAccumCard → sparkline expand.
 *
 * Tidak perlu library chart eksternal — pure SVG.
 */
'use client';

import { useEffect, useState } from 'react';

interface FlowDay {
  date: string;      // YYYY-MM-DD
  sm_net: number;    // dalam miliar IDR (sudah dibagi 1e9)
}

interface FlowSparklineProps {
  ticker:  string;
  height?: number;
  days?:   number;
}

const BAR_GAP  = 2;
const BAR_W    = 8;

export default function FlowSparkline({ ticker, height = 60, days = 30 }: FlowSparklineProps) {
  const [data,    setData]    = useState<FlowDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; day: FlowDay } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/bandar-flow/${ticker}/history?days=${days}`)
      .then(r => r.json())
      .then(j => setData((j.data ?? []) as FlowDay[]))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [ticker, days]);

  if (loading) {
    return <div className="fl-spark-loading">Memuat chart...</div>;
  }
  if (!data.length) {
    return <div className="fl-spark-empty">Belum ada data 30H</div>;
  }

  const maxAbs = Math.max(...data.map(d => Math.abs(d.sm_net)), 0.01);
  const totalW = data.length * (BAR_W + BAR_GAP);
  const midY   = height / 2;

  return (
    <div className="fl-spark-wrap" style={{ position: 'relative' }}>
      <svg
        width={totalW}
        height={height}
        className="fl-spark-svg"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* zero line */}
        <line x1={0} y1={midY} x2={totalW} y2={midY} stroke="#444" strokeWidth={1} />

        {data.map((day, i) => {
          const x     = i * (BAR_W + BAR_GAP);
          const ratio = day.sm_net / maxAbs;
          const barH  = Math.max(2, Math.abs(ratio) * (midY - 4));
          const y     = day.sm_net >= 0 ? midY - barH : midY;
          const fill  = day.sm_net >= 0 ? '#22c55e' : '#ef4444';

          return (
            <rect
              key={day.date}
              x={x}
              y={y}
              width={BAR_W}
              height={barH}
              fill={fill}
              opacity={0.85}
              rx={1}
              onMouseEnter={() => setTooltip({ x, day })}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fl-spark-tooltip"
          style={{
            left:   Math.min(tooltip.x, totalW - 120),
            bottom: height + 4,
          }}
        >
          <div className="fl-spark-tip-date">{tooltip.day.date}</div>
          <div
            className="fl-spark-tip-val"
            style={{ color: tooltip.day.sm_net >= 0 ? '#22c55e' : '#ef4444' }}
          >
            {tooltip.day.sm_net >= 0 ? '+' : ''}{tooltip.day.sm_net.toFixed(2)}M
          </div>
        </div>
      )}
    </div>
  );
}
