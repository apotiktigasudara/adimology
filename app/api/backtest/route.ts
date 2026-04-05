/**
 * GET /api/backtest?threshold=60&forward_days=10&look_back=90
 *
 * Backtest mini: simulasi sinyal confluence terhadap forward SM flow.
 *
 * Algoritma:
 *  1. Ambil v4_sm_rolling selama (look_back + 7 + forward_days) hari
 *  2. Per ticker, hitung rolling 7-hari confluence score pada setiap hari
 *  3. Deteksi "entry": score naik melewati threshold (crossing dari bawah)
 *  4. Forward outcome: sum(net SM+MF) untuk next forward_days hari
 *     WIN  = forward net > 0
 *     LOSS = forward net <= 0
 *  5. Agregasi: win_rate, avg_forward_net, breakdown per score bucket
 *
 * Catatan: forward_net adalah proxy return — bukan harga, melainkan
 *          apakah SM terus akumulasi setelah sinyal. Korelasi tinggi
 *          dengan price return (SM flow leading indicator).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

function calcScore(
  smNet: number, smTotal: number,
  mfNet: number, mfTotal: number
): number {
  const sm = clamp((smNet / Math.max(smTotal, 0.01)) * 50 + 25, 0, 50);
  const mf = clamp((mfNet / Math.max(mfTotal, 0.01)) * 30 + 15, 0, 30);
  return Math.round(sm + mf);
}

type SmRow = {
  ticker: string;
  trade_date: string;
  sm_daily: number | null;
  bm_daily: number | null;
  mfp_daily: number | null;
  mfn_daily: number | null;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const threshold   = Math.min(Math.max(parseInt(searchParams.get('threshold')    || '60'), 30), 95);
  const forwardDays = Math.min(Math.max(parseInt(searchParams.get('forward_days') || '10'), 3), 30);
  const lookBack    = Math.min(Math.max(parseInt(searchParams.get('look_back')    || '90'), 30), 180);

  // Need extra days at the start for rolling window + forward calculation
  const totalDays = lookBack + 7 + forwardDays;
  const fromDate  = new Date();
  fromDate.setDate(fromDate.getDate() - totalDays);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  try {
    const { data: smRows, error } = await sb
      .from('v4_sm_rolling')
      .select('ticker, trade_date, sm_daily, bm_daily, mfp_daily, mfn_daily')
      .gte('trade_date', fromDateStr)
      .order('trade_date', { ascending: true });

    if (error) throw error;
    if (!smRows || smRows.length === 0) {
      return NextResponse.json({ success: true, summary: null, signals: [], generated_at: new Date().toISOString() });
    }

    // Group by ticker → sorted arrays
    const byTicker: Record<string, SmRow[]> = {};
    for (const r of smRows) {
      if (!byTicker[r.ticker]) byTicker[r.ticker] = [];
      byTicker[r.ticker].push(r as SmRow);
    }

    // All unique sorted dates (for forward lookup)
    const allDates = [...new Set(smRows.map(r => r.trade_date))].sort();
    const dateIdx: Record<string, number> = {};
    allDates.forEach((d, i) => { dateIdx[d] = i; });

    // ─────────────────────────────────────────────────────────────────────
    // For each ticker, compute rolling 7d score + detect crossings
    // ─────────────────────────────────────────────────────────────────────
    type Signal = {
      ticker: string;
      entry_date: string;
      entry_score: number;
      forward_net: number;
      result: 'WIN' | 'LOSS';
      forward_days_actual: number;
    };

    const signals: Signal[] = [];

    for (const [ticker, rows] of Object.entries(byTicker)) {
      if (rows.length < 8) continue; // need at least 8 days

      // Build date→row map for forward lookup
      const rowByDate: Record<string, SmRow> = {};
      for (const r of rows) rowByDate[r.trade_date] = r;

      let prevScore = -1;

      // Slide 7-day window
      for (let i = 6; i < rows.length; i++) {
        const window = rows.slice(i - 6, i + 1); // 7 rows

        let sm = 0, bm = 0, mfp = 0, mfn = 0;
        for (const r of window) {
          sm  += r.sm_daily  || 0;
          bm  += r.bm_daily  || 0;
          mfp += r.mfp_daily || 0;
          mfn += r.mfn_daily || 0;
        }
        const score = calcScore(sm - bm, sm + bm, mfp - mfn, mfp + mfn);
        const entryDate = rows[i].trade_date;

        // Detect crossing (prevScore < threshold, this score >= threshold)
        if (prevScore < threshold && score >= threshold) {
          // Get forward dates
          const entryIdx = dateIdx[entryDate];
          if (entryIdx === undefined) { prevScore = score; continue; }

          const forwardEnd = Math.min(entryIdx + forwardDays, allDates.length - 1);
          const forwardDatesSlice = allDates.slice(entryIdx + 1, forwardEnd + 1);

          let fwdNet = 0;
          for (const fd of forwardDatesSlice) {
            const fr = rowByDate[fd];
            if (fr) {
              fwdNet += ((fr.sm_daily || 0) - (fr.bm_daily || 0))
                      + ((fr.mfp_daily || 0) - (fr.mfn_daily || 0));
            }
          }

          signals.push({
            ticker,
            entry_date: entryDate,
            entry_score: score,
            forward_net: Math.round(fwdNet * 100) / 100,
            result: fwdNet > 0 ? 'WIN' : 'LOSS',
            forward_days_actual: forwardDatesSlice.length,
          });
        }

        prevScore = score;
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Aggregate summary
    // ─────────────────────────────────────────────────────────────────────
    const wins   = signals.filter(s => s.result === 'WIN').length;
    const losses = signals.filter(s => s.result === 'LOSS').length;
    const total  = signals.length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const avgFwd  = total > 0
      ? Math.round((signals.reduce((s, x) => s + x.forward_net, 0) / total) * 100) / 100
      : 0;

    // By score bucket: [50-60), [60-70), [70-80), [80-100]
    const buckets = [
      { label: '50–59', min: 50, max: 60 },
      { label: '60–69', min: 60, max: 70 },
      { label: '70–79', min: 70, max: 80 },
      { label: '80+',   min: 80, max: 101 },
    ];
    const byBucket = buckets.map(b => {
      const bs = signals.filter(s => s.entry_score >= b.min && s.entry_score < b.max);
      const bw = bs.filter(s => s.result === 'WIN').length;
      const bt = bs.length;
      return {
        label:    b.label,
        total:    bt,
        wins:     bw,
        win_rate: bt > 0 ? Math.round((bw / bt) * 100) : 0,
        avg_fwd:  bt > 0 ? Math.round(bs.reduce((s, x) => s + x.forward_net, 0) / bt * 100) / 100 : 0,
      };
    });

    // Per-ticker breakdown (top 20 by signal count)
    const tickerStats: Record<string, { total: number; wins: number; avg_fwd: number }> = {};
    for (const s of signals) {
      if (!tickerStats[s.ticker]) tickerStats[s.ticker] = { total: 0, wins: 0, avg_fwd: 0 };
      tickerStats[s.ticker].total++;
      if (s.result === 'WIN') tickerStats[s.ticker].wins++;
      tickerStats[s.ticker].avg_fwd += s.forward_net;
    }
    const byTicker20 = Object.entries(tickerStats)
      .map(([ticker, st]) => ({
        ticker,
        total:    st.total,
        wins:     st.wins,
        win_rate: Math.round((st.wins / st.total) * 100),
        avg_fwd:  Math.round((st.avg_fwd / st.total) * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    // Recent 50 signals (newest first)
    const recentSignals = [...signals]
      .sort((a, b) => b.entry_date.localeCompare(a.entry_date))
      .slice(0, 50);

    return NextResponse.json({
      success: true,
      params: { threshold, forward_days: forwardDays, look_back: lookBack },
      summary: {
        total_signals: total,
        wins,
        losses,
        win_rate: winRate,
        avg_forward_net: avgFwd,
        tickers_scanned: Object.keys(byTicker).length,
        date_range: `${fromDateStr} → ${allDates[allDates.length - 1] ?? '?'}`,
      },
      by_bucket: byBucket,
      by_ticker: byTicker20,
      recent_signals: recentSignals,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[/api/backtest] Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
