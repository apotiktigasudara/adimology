/**
 * app/api/bandar-alerts/route.ts — Phoenix Bot V.X × Adimology
 *
 * Copy ke: adimology/app/api/bandar-alerts/route.ts
 *
 * GET /api/bandar-alerts
 *   Kembalikan history alert dari tabel bandar_alerts,
 *   diurutkan created_at DESC (terbaru di atas).
 *   Dipakai oleh AlertFeed component di Adimology dashboard.
 *
 * Query params:
 *   limit       — max hasil (default: 20, max: 100)
 *   arah        — "ACCUM" | "DISTRIB" (optional)
 *   ticker      — filter satu ticker (optional)
 *   trigger     — "SM" | "BIG_SM" | "MF+" | "ALGO" | "COMBINED" (optional)
 *   from_date   — ISO date minimum trade_date (optional)
 *   min_score   — minimum combined_score (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { BandarAlert } from '@/lib/bandar-flow.types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const limit    = Math.min(Math.max(1, parseInt(searchParams.get('limit')     || '20')), 100);
    const minScore = Math.max(0,           parseInt(searchParams.get('min_score') || '0'));
    const arah     = searchParams.get('arah')       || null;
    const ticker   = searchParams.get('ticker')     || null;
    const trigger  = searchParams.get('trigger')    || null;
    const fromDate = searchParams.get('from_date')  || null;

    let query = supabase
      .from('bandar_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (arah)          query = query.eq('arah', arah);
    if (ticker)        query = query.eq('ticker', ticker.toUpperCase());
    if (trigger)       query = query.eq('trigger_type', trigger);
    if (fromDate)      query = query.gte('trade_date', fromDate);
    if (minScore > 0)  query = query.gte('combined_score', minScore);

    const { data, error } = await query;

    if (error) {
      console.error('[bandar-alerts] Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      count: data?.length ?? 0,
      data:  (data ?? []) as BandarAlert[],
    });

  } catch (err) {
    console.error('[bandar-alerts] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
