/**
 * app/components/BandarAccumCard.tsx — Phoenix Bot V.X × Adimology
 * Copy ke: adimology/app/components/BandarAccumCard.tsx
 *
 * Card untuk satu ticker — menampilkan semua data dari BandarFlow:
 * historis SM broker, intraday realtime, top brokers, combined score.
 */
'use client';

import FlowBadge from '@/app/components/FlowBadge';
import type { BandarFlow } from '@/lib/bandar-flow.types';
import { fmtLots, fmtMiliar } from '@/lib/bandar-flow.types';

interface BandarAccumCardProps {
  data: BandarFlow;
  /** Jika diisi, tampilkan tombol "Analisa →" yang memanggil callback ini */
  onAnalyze?: (ticker: string) => void;
}

function velLabel(v: number): string {
  if (v >= 1.5) return 'sangat cepat';
  if (v >= 0.8) return 'cepat';
  if (v >= 0.4) return 'normal';
  if (v > 0)    return 'lambat';
  return 'reversal';
}

function signClass(n: number): string {
  if (n > 0) return 'bf-row-value positive';
  if (n < 0) return 'bf-row-value negative';
  return 'bf-row-value';
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    }) + ' WIB';
  } catch { return iso; }
}

export default function BandarAccumCard({ data, onAnalyze }: BandarAccumCardProps) {
  const brokers = data.top_brokers ?? [];

  return (
    <div className="bf-card" data-arah={data.arah}>
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="bf-card-header">
        <span className="bf-ticker">{data.ticker}</span>
        <div className="bf-header-right">
          <FlowBadge
            arah={data.arah}
            strength={data.signal_strength}
            score={data.combined_score}
            showScore
          />
        </div>
      </div>

      <div className="bf-divider" />

      {/* ── Historis SM Broker ─────────────────────────────── */}
      <div>
        <div className="bf-section-label">Historis SM Broker</div>
        <div className="bf-rows">
          <div className="bf-row">
            <span className="bf-row-label">Net 1D / 10D</span>
            <span className={signClass(data.net_lots_10d)}>
              {fmtLots(data.net_lots_1d)}&nbsp;/&nbsp;{fmtLots(data.net_lots_10d)}
            </span>
          </div>
          <div className="bf-row">
            <span className="bf-row-label">Val 10D (Miliar)</span>
            <span className={signClass(data.net_value_10d)}>
              {fmtMiliar(data.net_value_10d)}
            </span>
          </div>
          <div className="bf-row">
            <span className="bf-row-label">Velocity (3D/10D)</span>
            <span className="bf-row-value">
              {data.lot_velocity.toFixed(2)}x&nbsp;
              <span style={{ opacity: 0.7, fontWeight: 400 }}>
                ({velLabel(data.lot_velocity)})
              </span>
            </span>
          </div>
          <div className="bf-row">
            <span className="bf-row-label">Broker Akum / Dist</span>
            <span className="bf-row-value">
              <span className="bf-strength-kuat">{data.broker_count_accum}</span>
              &nbsp;/&nbsp;
              <span style={{ color: '#f5576c' }}>{data.broker_count_distrib}</span>
            </span>
          </div>
          {data.dominant_broker && (
            <div className="bf-row">
              <span className="bf-row-label">Dominant Broker</span>
              <span className="bf-row-value">
                <strong>{data.dominant_broker}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Intraday (hanya jika ada signal) ───────────────── */}
      {data.signal_count > 0 && (
        <>
          <div className="bf-divider" />
          <div>
            <div className="bf-section-label">
              Intraday Hari Ini ({data.signal_count} signal)
            </div>
            <div className="bf-rows">
              <div className="bf-row">
                <span className="bf-row-label">Smart Money</span>
                <span className={signClass(data.intraday_sm_total)}>
                  {fmtMiliar(data.intraday_sm_total)}
                </span>
              </div>
              <div className="bf-row">
                <span className="bf-row-label">Bad Money</span>
                <span className={signClass(-data.intraday_bm_total)}>
                  {fmtMiliar(-data.intraday_bm_total)}
                </span>
              </div>
              <div className="bf-row">
                <span className="bf-row-label">Net MF</span>
                <span className={signClass(data.intraday_mf_net)}>
                  {fmtMiliar(data.intraday_mf_net)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Algo badge ─────────────────────────────────────── */}
      {data.algo_triggered && (
        <>
          <div className="bf-divider" />
          <div className="bf-row">
            <span className="bf-row-label">Algo Signal</span>
            <span
              className="bf-badge"
              style={{
                background: data.algo_arah === 'bullish'
                  ? 'rgba(56,239,125,0.15)' : 'rgba(245,87,108,0.15)',
                color: data.algo_arah === 'bullish' ? '#38ef7d' : '#f5576c',
                border: `1px solid ${data.algo_arah === 'bullish'
                  ? 'rgba(56,239,125,0.3)' : 'rgba(245,87,108,0.3)'}`,
              }}
            >
              🤖 {data.algo_arah ?? 'triggered'}
            </span>
          </div>
        </>
      )}

      {/* ── Top Brokers ────────────────────────────────────── */}
      {brokers.length > 0 && (
        <>
          <div className="bf-divider" />
          <div>
            <div className="bf-section-label">Top SM Broker (10D)</div>
            <div className="bf-brokers">
              {brokers.slice(0, 4).map((b) => (
                <span key={b.code} className="bf-broker-chip" title={b.name}>
                  {b.code}&nbsp;
                  <span style={{ opacity: 0.7, fontWeight: 400 }}>
                    {b.net_lots >= 0 ? '+' : ''}{(b.net_lots / 1000).toFixed(0)}K
                  </span>
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Footer ─────────────────────────────────────────── */}
      <div className="bf-card-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Updated {fmtTime(data.updated_at)}</span>
        {onAnalyze && (
          <button
            onClick={() => onAnalyze(data.ticker)}
            style={{
              fontSize: '0.65rem', fontWeight: 600,
              padding: '0.2rem 0.6rem', borderRadius: '6px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--text-primary)', cursor: 'pointer',
            }}
          >
            Analisa →
          </button>
        )}
      </div>
    </div>
  );
}
