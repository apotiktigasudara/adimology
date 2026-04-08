import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type    = searchParams.get('type') || 'bandar_alerts'; // bandar_alerts | trade_signals | algo_signals | sm_rolling | oracle | bandar_flow
  const ticker  = searchParams.get('ticker')?.toUpperCase();
  const arah    = searchParams.get('arah');           // ACCUM | DISTRIB
  const trigger = searchParams.get('trigger');        // SM | BIG_SM | MF_PLUS | BIG_MF_PLUS | BAD_MONEY | MF_MINUS | BIG_MF_MINUS | ALGO
  const from    = searchParams.get('from');           // ISO date
  const dedup   = searchParams.get('dedup') === 'true'; // dedup by ticker (show highest score only)
  const limit   = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

  try {
    if (type === 'bandar_alerts') {
      let q = supabase
        .from('bandar_alerts')
        .select('*')
        .order('combined_score', { ascending: false })  // highest score first untuk dedup
        .limit(dedup ? 200 : limit);                    // fetch lebih banyak jika akan dedup
      if (ticker)  q = q.eq('ticker', ticker);
      if (arah)    q = q.eq('arah', arah);
      if (trigger) q = q.eq('trigger_type', trigger);
      if (from)    q = q.gte('created_at', from);
      const { data, error } = await q;
      if (error) throw error;
      // Dedup: satu ticker = satu alert dengan score tertinggi
      let result = data || [];
      if (dedup) {
        const seen = new Set<string>();
        result = result.filter(r => {
          const key = r.ticker;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, limit);
      }
      return NextResponse.json({ success: true, data: result });
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
        .limit(dedup ? 500 : limit);
      if (ticker) q = q.eq('ticker', ticker);
      if (from)   q = q.gte('msg_date', from);
      if (arah) {
        const algoType = arah === 'ACCUM' ? 'positive' : 'negative';
        q = q.eq('algo_type', algoType);
      }
      const { data, error } = await q;
      if (error) throw error;
      // Dedup algo: 1 algo per ticker per 5-menit window (ticker punya 6+ pattern sekaligus)
      let result = data || [];
      if (dedup) {
        const seen = new Set<string>();
        result = result.filter(r => {
          const window = r.msg_date ? r.msg_date.slice(0, 15) : ''; // YYYY-MM-DDTHH:MM → rounded 10m
          const key = `${r.ticker}__${window}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, limit);
      }
      return NextResponse.json({ success: true, data: result });
    }

    if (type === 'sm_rolling') {
      // Cari tanggal terbaru yang ada data (fallback otomatis jika hari ini kosong)
      let targetDate = from;
      if (targetDate && !ticker) {
        const { data: checkToday } = await supabase
          .from('v4_sm_rolling')
          .select('trade_date')
          .eq('trade_date', targetDate)
          .limit(1);
        if (!checkToday || checkToday.length === 0) {
          // Hari ini kosong — cari tanggal terbaru yang ada data
          const { data: latestRow } = await supabase
            .from('v4_sm_rolling')
            .select('trade_date')
            .order('trade_date', { ascending: false })
            .limit(1);
          targetDate = latestRow?.[0]?.trade_date ?? targetDate;
        }
      }
      let q = supabase
        .from('v4_sm_rolling')
        .select('*')
        .order('trade_date', { ascending: false })
        .limit(limit);
      if (ticker)     q = q.eq('ticker', ticker);
      if (targetDate) q = q.gte('trade_date', targetDate);
      const { data, error } = await q;
      if (error) throw error;
      return NextResponse.json({ success: true, data, latest_date: targetDate });
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

    if (type === 'bandar_flow') {
      const tradeDate = searchParams.get('trade_date') || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      let q = supabase
        .from('bandar_flow')
        .select('ticker,trade_date,arah,combined_score,signal_strength,intraday_sm_total,intraday_bm_total,intraday_mf_net,net_lots_10d,updated_at')
        .eq('trade_date', tradeDate)
        .order('updated_at', { ascending: false })
        .limit(limit);
      if (ticker) q = q.eq('ticker', ticker);
      if (arah)   q = q.eq('arah', arah);
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
