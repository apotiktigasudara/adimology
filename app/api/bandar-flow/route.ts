/**
 * app/api/bandar-flow/route.ts — Phoenix Bot V.X × Adimology
 *
 * Copy ke: adimology/app/api/bandar-flow/route.ts
 *
 * GET /api/bandar-flow
 *   Kembalikan list ticker + bandar_flow untuk satu trading date,
 *   diurutkan combined_score DESC (terkuat di atas).
 *
 * Query params:
 *   date        — ISO date (default: hari ini)
 *   arah        — "ACCUM" | "DISTRIB" | "NEUTRAL" (default: semua)
 *   min_score   — minimum combined_score (default: 0)
 *   strength    — "KUAT" | "SEDANG" | "LEMAH" | "EARLY" (optional filter)
 *   limit       — max jumlah hasil (default: 30, max: 100)
 *   ticker      — filter satu ticker saja (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { BandarFlow } from '@/lib/bandar-flow.types';

// Pakai service key agar tidak diblokir RLS
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const today    = new Date().toISOString().split('T')[0];
    let   date     = searchParams.get('date') || today;
    const arah     = searchParams.get('arah')      || null;
    const strength = searchParams.get('strength')  || null;
    const ticker   = searchParams.get('ticker')    || null;
    const minScore = Math.max(0, parseInt(searchParams.get('min_score') || '0'));
    const limit    = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '30')), 100);

    // Jika tidak ada data untuk tanggal yang diminta, fallback ke tanggal terakhir yang ada data
    const checkEmpty = await sb
      .from('bandar_flow')
      .select('trade_date')
      .eq('trade_date', date)
      .limit(1);

    if (!checkEmpty.data || checkEmpty.data.length === 0) {
      // Ambil tanggal terbaru yang ada data
      const latest = await sb
        .from('bandar_flow')
        .select('trade_date')
        .order('trade_date', { ascending: false })
        .limit(1);
      if (latest.data && latest.data.length > 0) {
        date = latest.data[0].trade_date;
      }
    }

    let query = sb
      .from('bandar_flow')
      .select('*')
      .eq('trade_date', date)
      .gte('combined_score', minScore)
      .order('combined_score', { ascending: false })
      .limit(limit);

    if (arah)     query = query.eq('arah', arah);
    if (strength) query = query.eq('signal_strength', strength);
    if (ticker)   query = query.eq('ticker', ticker.toUpperCase());

    const { data, error } = await query;

    if (error) {
      console.error('[bandar-flow] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Join NBSA (nbsa_daily) dari v4_sm_rolling untuk tanggal yang sama
    const tickers = (data ?? []).map((r: any) => r.ticker);
    let nbsaMap: Record<string, number> = {};
    if (tickers.length > 0) {
      const { data: nbsaRows } = await sb
        .from('v4_sm_rolling')
        .select('ticker, nbsa_daily')
        .eq('trade_date', date)
        .in('ticker', tickers);
      if (nbsaRows) {
        for (const r of nbsaRows) {
          nbsaMap[r.ticker] = r.nbsa_daily ?? 0;
        }
      }
    }

    const enriched = (data ?? []).map((r: any) => ({
      ...r,
      nbsa_daily: nbsaMap[r.ticker] ?? 0,
    }));

    return NextResponse.json({
      date,
      count: enriched.length,
      data:  enriched as BandarFlow[],
    });

  } catch (err) {
    console.error('[bandar-flow] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
