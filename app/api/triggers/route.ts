import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type    = searchParams.get('type') || 'bandar_alerts'; // bandar_alerts | trade_signals | algo_signals | sm_rolling | oracle
  const ticker  = searchParams.get('ticker')?.toUpperCase();
  const arah    = searchParams.get('arah');           // ACCUM | DISTRIB
  const trigger = searchParams.get('trigger');        // SM | BIG_SM | MF_PLUS | BIG_MF_PLUS | BAD_MONEY | MF_MINUS | BIG_MF_MINUS | ALGO
  const from    = searchParams.get('from');           // ISO date
  const limit   = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

  try {
    if (type === 'bandar_alerts') {
      let q = supabase
        .from('bandar_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (ticker)  q = q.eq('ticker', ticker);
      if (arah)    q = q.eq('arah', arah);
      if (trigger) q = q.eq('trigger_type', trigger);
      if (from)    q = q.gte('created_at', from);
      const { data, error } = await q;
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (type === 'trade_signals') {
      let q = supabase
        .from('v4_trade_signals')
        .select('*')
        .order('signal_date', { ascending: false })
        .limit(limit);
      if (ticker) q = q.eq('ticker', ticker);
      if (from)   q = q.gte('signal_date', from);
      const { data, error } = await q;
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (type === 'algo_signals') {
      let q = supabase
        .from('v4_algo_signals')
        .select('*')
        .order('msg_date', { ascending: false })
        .limit(limit);
      if (ticker) q = q.eq('ticker', ticker);
      if (from)   q = q.gte('msg_date', from);
      if (arah) {
        const algoType = arah === 'ACCUM' ? 'positive' : 'negative';
        q = q.eq('algo_type', algoType);
      }
      const { data, error } = await q;
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (type === 'sm_rolling') {
      let q = supabase
        .from('v4_sm_rolling')
        .select('*')
        .order('trade_date', { ascending: false })
        .limit(limit);
      if (ticker) q = q.eq('ticker', ticker);
      if (from)   q = q.gte('trade_date', from);
      const { data, error } = await q;
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    if (type === 'oracle') {
      let q = supabase
        .from('v4_oracle_outcomes')
        .select('*')
        .order('alert_at', { ascending: false })
        .limit(limit);
      if (ticker) q = q.eq('ticker', ticker);
      if (from)   q = q.gte('alert_at', from);
      const { data, error } = await q;
      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  } catch (error) {
    console.error('[/api/triggers] Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
