/**
 * app/api/whale/route.ts — Phoenix Bot V.X × Adimology
 *
 * GET /api/whale
 *
 * Deteksi broker asing besar (DB, UBS, JP Morgan, Macquarie, dll.)
 * yang masuk secara serempak di banyak ticker pada hari yang sama.
 *
 * Query params:
 *   min_tickers    — minimum ticker agar dianggap whale (default: 3)
 *   min_net_miliar — minimum net_value_10d per ticker (default: 0.5)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const WHALE_NAMES: Record<string, string> = {
  DB: 'Deutsche Bank',
  AK: 'UBS',
  BK: 'JP Morgan',
  RX: 'Macquarie',
  ML: 'Merrill Lynch',
  MS: 'Morgan Stanley',
  KZ: 'CLSA',
  GR: 'Credit Suisse',
  CS: 'Citigroup',
  DX: 'CIMB',
};
const WHALE_CODES = new Set(Object.keys(WHALE_NAMES));

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const minTickers    = Math.max(1, parseInt(searchParams.get('min_tickers')    || '3'));
    const minNetMiliar  = Math.max(0, parseFloat(searchParams.get('min_net_miliar') || '0.5'));

    // ── 1. Last trade_date ──────────────────────────────────────────────────
    const { data: lastRow } = await sb
      .from('bandar_flow')
      .select('trade_date')
      .order('trade_date', { ascending: false })
      .limit(1);

    if (!lastRow?.length) {
      return NextResponse.json({ trade_date: null, brokers: [] });
    }
    const tradeDate = lastRow[0].trade_date;

    // ── 2. Query rows with accumulation ────────────────────────────────────
    const { data: rows, error } = await sb
      .from('bandar_flow')
      .select('ticker, dominant_broker, top_brokers, net_value_10d, net_lots_10d')
      .eq('trade_date', tradeDate)
      .gt('net_value_10d', minNetMiliar);

    if (error) throw error;

    // ── 3. Group by whale broker ────────────────────────────────────────────
    const brokerMap: Record<string, { ticker: string; net_value: number; net_lots: number }[]> = {};

    for (const row of rows ?? []) {
      const seen = new Set<string>();

      if (row.dominant_broker && WHALE_CODES.has(row.dominant_broker)) {
        seen.add(row.dominant_broker);
      }
      const topBrokers = Array.isArray(row.top_brokers) ? row.top_brokers : [];
      for (const br of topBrokers) {
        if (br?.code && WHALE_CODES.has(br.code)) seen.add(br.code);
      }

      for (const code of seen) {
        brokerMap[code] ??= [];
        brokerMap[code].push({
          ticker:    row.ticker,
          net_value: Number(row.net_value_10d ?? 0),
          net_lots:  Number(row.net_lots_10d ?? 0),
        });
      }
    }

    // ── 4. Filter + sort ────────────────────────────────────────────────────
    const brokers = Object.entries(brokerMap)
      .filter(([, entries]) => entries.length >= minTickers)
      .map(([code, entries]) => {
        const sorted    = [...entries].sort((a, b) => b.net_value - a.net_value);
        const totalNet  = entries.reduce((s, e) => s + e.net_value, 0);
        return {
          code,
          name:      WHALE_NAMES[code] ?? code,
          ticker_count: entries.length,
          total_net: Math.round(totalNet * 100) / 100,
          tickers:   sorted.slice(0, 10),
        };
      })
      .sort((a, b) => b.total_net - a.total_net);

    return NextResponse.json({ trade_date: tradeDate, brokers });

  } catch (err: any) {
    console.error('[whale] Error:', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}
