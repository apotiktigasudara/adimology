/**
 * app/api/bandar-flow/[ticker]/route.ts — Phoenix Bot V.X × Adimology
 *
 * Copy ke: adimology/app/api/bandar-flow/[ticker]/route.ts
 *
 * GET /api/bandar-flow/BBRI
 *   Kembalikan data bandar_flow terbaru + history N hari untuk satu ticker.
 *
 * Query params:
 *   days  — berapa hari history (default: 20, max: 60)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { BandarFlow } from '@/lib/bandar-flow.types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const { ticker } = await params;
    const symbol = ticker.toUpperCase();

    const { searchParams } = request.nextUrl;
    const days = Math.min(Math.max(1, parseInt(searchParams.get('days') || '20')), 60);

    const { data, error } = await supabase
      .from('bandar_flow')
      .select('*')
      .eq('ticker', symbol)
      .order('trade_date', { ascending: false })
      .limit(days);

    if (error) {
      console.error(`[bandar-flow/${symbol}] Supabase error:`, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'No bandar flow data found', ticker: symbol },
        { status: 404 },
      );
    }

    const latest  = data[0] as BandarFlow;
    const history = data    as BandarFlow[];   // newest-first

    // Ringkasan trend: bandingkan net_lots_1d vs net_lots_10d dari data terbaru
    const trend =
      latest.net_lots_1d > 0 && latest.net_lots_10d > 0
        ? 'CONTINUING_ACCUM'
        : latest.net_lots_1d < 0 && latest.net_lots_10d < 0
          ? 'CONTINUING_DISTRIB'
          : latest.net_lots_1d > 0 && latest.net_lots_10d < 0
            ? 'REVERSAL_TO_ACCUM'
            : latest.net_lots_1d < 0 && latest.net_lots_10d > 0
              ? 'REVERSAL_TO_DISTRIB'
              : 'NEUTRAL';

    return NextResponse.json({
      ticker: symbol,
      trend,
      latest,
      history,
    });

  } catch (err) {
    console.error('[bandar-flow/[ticker]] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
