/**
 * app/api/bandar-flow/[ticker]/history/route.ts — Task 2.3
 *
 * GET /api/bandar-flow/BBRI/history?days=30
 * Ringan — hanya kembalikan date + sm_net untuk sparkline chart.
 * Response diurutkan oldest→newest.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface SparkDay {
  date:   string;
  sm_net: number;   // miliar IDR
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase().replace(/[^A-Z]/g, '');
  if (!symbol) {
    return NextResponse.json({ error: 'Invalid ticker' }, { status: 400 });
  }

  const { searchParams } = request.nextUrl;
  const days = Math.min(Math.max(5, parseInt(searchParams.get('days') || '30')), 90);

  const { data, error } = await supabase
    .from('bandar_flow')
    .select('trade_date, sm_net_1d')
    .eq('ticker', symbol)
    .order('trade_date', { ascending: false })
    .limit(days);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Urutkan oldest→newest dan normalisasi ke miliar
  const sorted: SparkDay[] = (data ?? [])
    .reverse()
    .map(r => ({
      date:   r.trade_date as string,
      sm_net: Number(((r.sm_net_1d as number) ?? 0) / 1_000_000_000),
    }));

  return NextResponse.json(
    { ticker: symbol, days: sorted.length, data: sorted },
    { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=30' } },
  );
}
