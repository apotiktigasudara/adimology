/**
 * GET /api/backtest/algo?days=30&forward_days=5
 *
 * Backtest per Algo Name: win rate setiap algo dari chart_saham_bot
 * berdasarkan forward SM flow (v4_sm_rolling) setelah sinyal masuk.
 *
 * Logic:
 *  1. Fetch semua algo signals (v4_algo_signals) dalam N hari
 *  2. Per sinyal, ambil forward SM net D+1 s/d D+forward_days dari v4_sm_rolling
 *  3. WIN = forward_sm_net > 0, LOSS = forward_sm_net <= 0
 *  4. Agregasi per algo_name → win_rate, avg_forward, total
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days        = Math.min(Math.max(parseInt(searchParams.get('days')         || '30'), 7), 180);
  const forwardDays = Math.min(Math.max(parseInt(searchParams.get('forward_days') || '5'),  3), 20);
  const algoType    = searchParams.get('algo_type') || 'positive'; // positive | negative | all

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days - forwardDays);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  try {
    // 1. Fetch algo signals
    let algoQ = sb
      .from('v4_algo_signals')
      .select('ticker, algo_name, algo_type, msg_date')
      .gte('msg_date', fromDateStr)
      .order('msg_date', { ascending: true });
    if (algoType !== 'all') algoQ = algoQ.eq('algo_type', algoType);

    const { data: algoRows, error: algoErr } = await algoQ;
    if (algoErr) throw algoErr;
    if (!algoRows || algoRows.length === 0) {
      return NextResponse.json({ success: true, summary: [], signals: [], params: { days, forwardDays, algoType } });
    }

    // 2. Ambil distinct trading dates dari SM rolling (efisien, tanpa limit 1000)
    const { data: dateRows, error: dateErr } = await sb
      .from('v4_sm_rolling')
      .select('trade_date')
      .gte('trade_date', fromDateStr)
      .order('trade_date', { ascending: true })
      .limit(5000);
    if (dateErr) throw dateErr;

    const allDates = [...new Set((dateRows || []).map((r: any) => r.trade_date))].sort();

    // Hanya fetch SM data untuk ticker yang ada di algo signals (hemat quota)
    const relevantTickers = [...new Set(algoRows.map(r => r.ticker))];
    const smMap: Record<string, Record<string, any>> = {};

    if (relevantTickers.length > 0) {
      const { data: smRows, error: smErr } = await sb
        .from('v4_sm_rolling')
        .select('ticker, trade_date, sm_daily, bm_daily, mfp_daily, mfn_daily')
        .gte('trade_date', fromDateStr)
        .in('ticker', relevantTickers)
        .limit(10000);
      if (smErr) throw smErr;

      for (const r of (smRows || [])) {
        if (!smMap[r.ticker]) smMap[r.ticker] = {};
        smMap[r.ticker][r.trade_date] = r;
      }
    }

    // 3. Per signal: compute forward net
    type Signal = {
      ticker: string;
      algo_name: string;
      algo_type: string;
      signal_date: string;
      forward_net: number;
      result: 'WIN' | 'LOSS' | 'PENDING';
      forward_days_actual: number;
    };

    const signals: Signal[] = [];

    for (const sig of algoRows) {
      const signalDate = sig.msg_date.split('T')[0];
      const entryIdx   = allDates.indexOf(signalDate);

      // Jika tanggal sinyal tidak ada di SM rolling → skip (no data)
      if (entryIdx < 0) {
        signals.push({
          ticker: sig.ticker, algo_name: sig.algo_name, algo_type: sig.algo_type,
          signal_date: signalDate, forward_net: 0, result: 'PENDING', forward_days_actual: 0,
        });
        continue;
      }

      const fwdDates = allDates.slice(entryIdx + 1, entryIdx + 1 + forwardDays);

      // Butuh minimal 3 hari forward data, kalau kurang → PENDING (data belum cukup)
      if (fwdDates.length < Math.min(3, forwardDays)) {
        signals.push({
          ticker: sig.ticker, algo_name: sig.algo_name, algo_type: sig.algo_type,
          signal_date: signalDate, forward_net: 0, result: 'PENDING', forward_days_actual: fwdDates.length,
        });
        continue;
      }
      let fwdNet = 0;
      for (const d of fwdDates) {
        const r = smMap[sig.ticker]?.[d];
        if (r) {
          fwdNet += ((r.sm_daily || 0) - (r.bm_daily || 0))
                  + ((r.mfp_daily || 0) - (r.mfn_daily || 0));
        }
      }

      signals.push({
        ticker: sig.ticker, algo_name: sig.algo_name, algo_type: sig.algo_type,
        signal_date: signalDate,
        forward_net: Math.round(fwdNet * 100) / 100,
        result: fwdNet > 0 ? 'WIN' : 'LOSS',
        forward_days_actual: fwdDates.length,
      });
    }

    // 4. Aggregate per algo_name
    const byAlgo: Record<string, { total: number; wins: number; losses: number; fwd_sum: number }> = {};
    for (const s of signals) {
      if (s.result === 'PENDING') continue;
      if (!byAlgo[s.algo_name]) byAlgo[s.algo_name] = { total: 0, wins: 0, losses: 0, fwd_sum: 0 };
      byAlgo[s.algo_name].total++;
      if (s.result === 'WIN') byAlgo[s.algo_name].wins++;
      else byAlgo[s.algo_name].losses++;
      byAlgo[s.algo_name].fwd_sum += s.forward_net;
    }

    const summary = Object.entries(byAlgo)
      .map(([algo_name, st]) => ({
        algo_name,
        total:    st.total,
        wins:     st.wins,
        losses:   st.losses,
        win_rate: st.total > 0 ? Math.round((st.wins / st.total) * 100) : 0,
        avg_forward_net: st.total > 0 ? Math.round((st.fwd_sum / st.total) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Overall stats
    const completedSignals = signals.filter(s => s.result !== 'PENDING');
    const totalWins   = completedSignals.filter(s => s.result === 'WIN').length;
    const overall = {
      total_signals: completedSignals.length,
      pending:       signals.filter(s => s.result === 'PENDING').length,
      wins:          totalWins,
      win_rate:      completedSignals.length > 0 ? Math.round((totalWins / completedSignals.length) * 100) : 0,
    };

    // Recent 30 signals
    const recentSignals = [...signals]
      .filter(s => s.result !== 'PENDING')
      .sort((a, b) => b.signal_date.localeCompare(a.signal_date))
      .slice(0, 30);

    return NextResponse.json({
      success: true,
      params: { days, forward_days: forwardDays, algo_type: algoType },
      overall,
      summary,
      recent_signals: recentSignals,
      generated_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[/api/backtest/algo] Error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
