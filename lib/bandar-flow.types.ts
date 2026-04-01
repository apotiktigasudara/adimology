/**
 * lib/bandar-flow.types.ts — Phoenix Bot V.X × Adimology integration
 *
 * Copy ke: adimology/lib/bandar-flow.types.ts
 *
 * Types untuk data dari tabel bandar_flow dan bandar_alerts
 * yang di-UPSERT oleh Phoenix Bot V.X ke Supabase shared DB.
 */

export interface TopBroker {
  code:      string;   // e.g. "BK"
  name:      string;   // e.g. "JP Morgan"
  tier:      string;   // "SMARTMONEY" | "WHALE"
  net_lots:  number;   // positif = akumulasi, negatif = distribusi
  net_value: number;   // miliar IDR
  days:      number;   // hadir dalam berapa hari (dari 10D window)
}

export interface BandarFlow {
  id:         number;
  ticker:     string;
  trade_date: string;   // ISO date "2026-04-01"

  // Net lot flow SM/WHALE brokers per periode
  net_lots_1d:  number;
  net_lots_3d:  number;
  net_lots_5d:  number;
  net_lots_10d: number;
  net_lots_20d: number;

  // Net value miliar IDR per periode
  net_value_1d:  number;
  net_value_5d:  number;
  net_value_10d: number;

  // Komposisi SM broker (dihitung dari 10D)
  sm_accum_lots:        number;
  sm_distrib_lots:      number;
  broker_count_accum:   number;
  broker_count_distrib: number;
  dominant_broker:      string | null;
  top_brokers:          TopBroker[] | null;   // JSONB

  // Kecepatan akumulasi: net_lots_3d / |net_lots_10d|
  lot_velocity: number;

  // Intraday realtime dari Phoenix Bot listener (miliar IDR)
  intraday_sm_total: number;
  intraday_bm_total: number;
  intraday_mf_net:   number;
  signal_count:      number;

  // Algo chart signal
  algo_triggered: boolean;
  algo_arah:      string | null;   // "bullish" | "bearish" | null

  // Hasil kombinasi
  arah:            'ACCUM' | 'DISTRIB' | 'NEUTRAL';
  combined_score:  number;   // 0–100
  signal_strength: 'KUAT' | 'SEDANG' | 'LEMAH' | 'EARLY';

  updated_at: string;
}

export interface BandarAlert {
  id:              number;
  ticker:          string;
  trade_date:      string;
  arah:            'ACCUM' | 'DISTRIB';
  trigger_type:    'SM' | 'BIG_SM' | 'MF+' | 'ALGO' | 'COMBINED';
  combined_score:  number | null;
  signal_strength: string | null;
  net_lots_10d:    number | null;
  dominant_broker: string | null;
  intraday_sm:     number | null;
  last_price:      number | null;
  created_at:      string;
}

// ── Helpers ──────────────────────────────────────────────────────────────── //

/** Arah label Bahasa Indonesia */
export function arahLabel(arah: BandarFlow['arah']): string {
  return { ACCUM: 'Akumulasi', DISTRIB: 'Distribusi', NEUTRAL: 'Netral' }[arah] ?? arah;
}

/** Warna CSS class berdasarkan arah */
export function arahColor(arah: BandarFlow['arah']): string {
  return { ACCUM: 'text-green-500', DISTRIB: 'text-red-500', NEUTRAL: 'text-gray-400' }[arah] ?? '';
}

/** Format lot count ke K / M string */
export function fmtLots(n: number): string {
  const abs = Math.abs(n);
  const sign = n >= 0 ? '+' : '-';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toLocaleString()}`;
}

/** Format miliar IDR */
export function fmtMiliar(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)} M`;
}
