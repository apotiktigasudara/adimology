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
import { supabase } from '@/lib/supabase';
import type { BandarFlow } from '@/lib/bandar-flow.types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const today    = new Date().toISOString().split('T')[0];
    const date     = searchParams.get('date')      || today;
    const arah     = searchParams.get('arah')      || null;
    const strength = searchParams.get('strength')  || null;
    const ticker   = searchParams.get('ticker')    || null;
    const minScore = Math.max(0, parseInt(searchParams.get('min_score') || '0'));
    const limit    = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '30')), 100);

    let query = supabase
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

    return NextResponse.json({
      date,
      count: data?.length ?? 0,
      data:  (data ?? []) as BandarFlow[],
    });

  } catch (err) {
    console.error('[bandar-flow] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
