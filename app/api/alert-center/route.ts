/**
 * GET /api/alert-center?threshold=60&days=7
 *
 * Scan v4_sm_rolling untuk mendeteksi 3 jenis alert:
 *   KUAT     — rolling confluence score >= threshold (70+)
 *   SPIKE    — hari ini SM/MF inflow > 2x rata-rata 5 hari
 *   CROSSING — net flow berbalik arah dalam 3 hari terakhir
 *              (negatif → positif = BULLISH REVERSAL)
 *              (positif → negatif = BEARISH REVERSAL)
 *
 * Response: { alerts: AlertItem[], latest_date, generated_at }
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

function calcConfluence(smNet: number, smTotal: number, mfNet: number, mfTotal: number): number {
  const smScore = clamp((smNet / Math.max(smTotal, 0.01)) * 50 + 25, 0, 50);
  const mfScore = clamp((mfNet / Math.max(mfTotal, 0.01)) * 30 + 15, 0, 30);
  return Math.round(smScore + mfScore);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const threshold = Math.min(parseInt(searchParams.get('threshold') || '60'), 100);
  const days      = Math.min(parseInt(searchParams.get('days')      || '7'), 30);

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  try {
    const { data: smRows, error } = await sb
      .from('v4_sm_rolling')
      .select('ticker, trade_date, sm_daily, bm_daily, mfp_daily, mfn_daily')
      .gte('trade_date', fromDateStr)
      .order('trade_date', { ascending: true });

    if (error) throw error;
    if (!smRows || smRows.length === 0) {
      return NextResponse.json({ success: true, alerts: [], latest_date: null, generated_at: new Date().toISOString() });
    }

    // Group by ticker
    const tickerRows: Record<string, typeof smRows> = {};
    for (const r of smRows) {
      if (!tickerRows[r.ticker]) tickerRows[r.ticker] = [];
      tickerRows[r.ticker].push(r);
    }

    // Latest date globally
    const allDates = [...new Set(smRows.map(r => r.trade_date))].sort();
    const latestDate = allDates[allDates.length - 1];
    const prevDate   = allDates.length >= 2 ? allDates[allDates.length - 2] : null;

    type AlertItem = {
      ticker: string;
      alert_type: 'KUAT' | 'SPIKE' | 'BULLISH_CROSS' | 'BEARISH_CROSS';
      confluence_score: number;
      net_today: number;
      net_avg5d: number;
      spike_ratio: number | null;
      sm_today: number;
      bm_today: number;
      mfp_today: number;
      mfn_today: number;
      description: string;
    };

    const alerts: AlertItem[] = [];

    for (const [ticker, rows] of Object.entries(tickerRows)) {
      const todayRow = rows.find(r => r.trade_date === latestDate);
      if (!todayRow) continue;

      const sm  = todayRow.sm_daily  || 0;
      const bm  = todayRow.bm_daily  || 0;
      const mfp = todayRow.mfp_daily || 0;
      const mfn = todayRow.mfn_daily || 0;
      const netToday = (sm - bm) + (mfp - mfn);

      // Rolling totals (all rows = N days)
      let smTot = 0, bmTot = 0, mfpTot = 0, mfnTot = 0;
      for (const r of rows) {
        smTot  += r.sm_daily  || 0;
        bmTot  += r.bm_daily  || 0;
        mfpTot += r.mfp_daily || 0;
        mfnTot += r.mfn_daily || 0;
      }
      const smNetRoll = smTot  - bmTot;
      const mfNetRoll = mfpTot - mfnTot;
      const confScore = calcConfluence(smNetRoll, smTot + bmTot, mfNetRoll, mfpTot + mfnTot);

      // 5-day average net (excluding today)
      const prev5 = rows.filter(r => r.trade_date !== latestDate).slice(-5);
      const avg5Net = prev5.length > 0
        ? prev5.reduce((s, r) => s + ((r.sm_daily || 0) - (r.bm_daily || 0) + (r.mfp_daily || 0) - (r.mfn_daily || 0)), 0) / prev5.length
        : 0;

      const spikeRatio = avg5Net !== 0 ? netToday / Math.abs(avg5Net) : null;

      // --- Alert: KUAT ---
      if (confScore >= threshold) {
        alerts.push({
          ticker,
          alert_type: 'KUAT',
          confluence_score: confScore,
          net_today: Math.round(netToday * 100) / 100,
          net_avg5d: Math.round(avg5Net * 100) / 100,
          spike_ratio: null,
          sm_today: sm, bm_today: bm, mfp_today: mfp, mfn_today: mfn,
          description: `Confluence ${confScore} (threshold ${threshold}) |SM Net ${smNetRoll >= 0 ? '+' : ''}${smNetRoll.toFixed(1)}M |MF Net ${mfNetRoll >= 0 ? '+' : ''}${mfNetRoll.toFixed(1)}M`,
        });
        continue; // Don't double-flag
      }

      // --- Alert: SPIKE (today > 2.5x avg5d absolute) ---
      if (spikeRatio !== null && Math.abs(spikeRatio) >= 2.5 && Math.abs(netToday) >= 1.0) {
        alerts.push({
          ticker,
          alert_type: 'SPIKE',
          confluence_score: confScore,
          net_today: Math.round(netToday * 100) / 100,
          net_avg5d: Math.round(avg5Net * 100) / 100,
          spike_ratio: Math.round(spikeRatio * 10) / 10,
          sm_today: sm, bm_today: bm, mfp_today: mfp, mfn_today: mfn,
          description: `Spike ${spikeRatio >= 0 ? '+' : ''}${spikeRatio.toFixed(1)}x rata-rata 5 hari |Inflow hari ini: ${netToday >= 0 ? '+' : ''}${netToday.toFixed(2)}M`,
        });
        continue;
      }

      // --- Alert: CROSSING (net berbalik dalam 2 hari terakhir) ---
      if (prevDate) {
        const prevRow = rows.find(r => r.trade_date === prevDate);
        if (prevRow) {
          const netPrev = ((prevRow.sm_daily || 0) - (prevRow.bm_daily || 0))
                        + ((prevRow.mfp_daily || 0) - (prevRow.mfn_daily || 0));
          if (netPrev < -0.5 && netToday > 0.5) {
            alerts.push({
              ticker,
              alert_type: 'BULLISH_CROSS',
              confluence_score: confScore,
              net_today: Math.round(netToday * 100) / 100,
              net_avg5d: Math.round(avg5Net * 100) / 100,
              spike_ratio: null,
              sm_today: sm, bm_today: bm, mfp_today: mfp, mfn_today: mfn,
              description: `Net flow berbalik: ${netPrev.toFixed(2)}M → +${netToday.toFixed(2)}M (distribusi→akumulasi)`,
            });
          } else if (netPrev > 0.5 && netToday < -0.5) {
            alerts.push({
              ticker,
              alert_type: 'BEARISH_CROSS',
              confluence_score: confScore,
              net_today: Math.round(netToday * 100) / 100,
              net_avg5d: Math.round(avg5Net * 100) / 100,
              spike_ratio: null,
              sm_today: sm, bm_today: bm, mfp_today: mfp, mfn_today: mfn,
              description: `Net flow berbalik: +${netPrev.toFixed(2)}M → ${netToday.toFixed(2)}M (akumulasi→distribusi)`,
            });
          }
        }
      }
    }

    // Sort: KUAT first by score desc, then SPIKE by ratio desc, then CROSS
    const order = { KUAT: 0, SPIKE: 1, BULLISH_CROSS: 2, BEARISH_CROSS: 3 };
    alerts.sort((a, b) => {
      const ao = order[a.alert_type] ?? 9;
      const bo = order[b.alert_type] ?? 9;
      if (ao !== bo) return ao - bo;
      return b.confluence_score - a.confluence_score;
    });

    return NextResponse.json({
      success:      true,
      threshold,
      days,
      latest_date:  latestDate,
      total:        alerts.length,
      alerts,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[/api/alert-center] Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
