/**
 * app/api/health/route.ts — Task 3.1
 *
 * GET /api/health
 * Return status panel bot: heartbeat, last signal, sync lag, SM count hari ini.
 */
import { NextResponse } from 'next/server';
import { supabase }     from '@/lib/supabase';

interface HealthPanel {
  ok:             boolean;
  ts:             string;        // ISO check timestamp
  heartbeat: {
    last_updated: string | null; // updated_at terbaru di v4_sm_rolling
    lag_min:      number | null; // selisih dari now (menit)
    status:       'OK' | 'STALE' | 'UNKNOWN';
  };
  last_signal: {
    ticker:       string | null;
    trade_date:   string | null;
    status:       'TODAY' | 'OLD' | 'UNKNOWN';
  };
  sm_today: {
    count:  number;
    date:   string;
  };
  stockbit: {
    circuit_status: 'UNKNOWN';   // filled by VPS health endpoint (future)
  };
}

const STALE_MIN = 90;   // lebih dari 90 menit = STALE

export async function GET() {
  const now    = new Date();
  const today  = now.toISOString().split('T')[0];

  const result: HealthPanel = {
    ok:  true,
    ts:  now.toISOString(),
    heartbeat:   { last_updated: null, lag_min: null, status: 'UNKNOWN' },
    last_signal: { ticker: null, trade_date: null,    status: 'UNKNOWN' },
    sm_today:    { count: 0, date: today },
    stockbit:    { circuit_status: 'UNKNOWN' },
  };

  // 1. Heartbeat — updated_at terbaru dari v4_sm_rolling
  try {
    const { data } = await supabase
      .from('v4_sm_rolling')
      .select('ticker, updated_at, trade_date')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const lastUpdated = new Date(data.updated_at as string);
      const lagMs       = now.getTime() - lastUpdated.getTime();
      const lagMin      = Math.round(lagMs / 60_000);

      result.heartbeat = {
        last_updated: data.updated_at as string,
        lag_min:      lagMin,
        status:       lagMin <= STALE_MIN ? 'OK' : 'STALE',
      };
      result.last_signal = {
        ticker:     data.ticker as string,
        trade_date: data.trade_date as string,
        status:     (data.trade_date as string) === today ? 'TODAY' : 'OLD',
      };
    }
  } catch { /* non-fatal */ }

  // 2. SM count hari ini
  try {
    const { count } = await supabase
      .from('v4_sm_rolling')
      .select('ticker', { count: 'exact', head: true })
      .eq('trade_date', today);

    result.sm_today.count = count ?? 0;
  } catch { /* non-fatal */ }

  // Penentuan overall ok
  result.ok = result.heartbeat.status !== 'STALE';

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
