import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * GET /api/confluence?days=30&min_score=0&limit=100
 *
 * Menghitung Confluence Score per ticker berdasarkan:
 * - SM/BM flow dari v4_sm_rolling (0–50 pts)
 * - MF+/MF- flow dari v4_sm_rolling (0–30 pts)
 * - Algo signals positif/negatif dari v4_algo_signals 7 hari (0–20 pts)
 * Total: 0–100. Plus streak berapa hari berturut-turut net positif.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days     = Math.min(parseInt(searchParams.get('days')      || '30'), 90);
  const minScore = parseInt(searchParams.get('min_score') || '0');
  const limit    = Math.min(parseInt(searchParams.get('limit')     || '100'), 500);

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  const algoFrom = new Date();
  algoFrom.setDate(algoFrom.getDate() - 7);
  const algoFromStr = algoFrom.toISOString().split('T')[0];

  try {
    // Fetch SM rolling data + algo signals in parallel
    const [smRes, algoRes] = await Promise.all([
      supabase
        .from('v4_sm_rolling')
        .select('ticker, trade_date, sm_daily, bm_daily, mfp_daily, mfn_daily')
        .gte('trade_date', fromDateStr)
        .order('trade_date', { ascending: true }),
      supabase
        .from('v4_algo_signals')
        .select('ticker, msg_date, algo_type')
        .gte('msg_date', algoFromStr),
    ]);

    if (smRes.error) throw smRes.error;
    if (algoRes.error) throw algoRes.error;

    const smRows   = smRes.data   || [];
    const algoRows = algoRes.data || [];

    // Build algo counts per ticker
    const algoCounts: Record<string, { pos: number; neg: number }> = {};
    for (const a of algoRows) {
      if (!algoCounts[a.ticker]) algoCounts[a.ticker] = { pos: 0, neg: 0 };
      if (a.algo_type === 'positive') algoCounts[a.ticker].pos++;
      else if (a.algo_type === 'negative') algoCounts[a.ticker].neg++;
    }

    // Build per-ticker ordered arrays (ascending by trade_date — already ordered)
    const tickerRows: Record<string, typeof smRows> = {};
    for (const r of smRows) {
      if (!tickerRows[r.ticker]) tickerRows[r.ticker] = [];
      tickerRows[r.ticker].push(r);
    }

    const results = Object.entries(tickerRows).map(([ticker, rows]) => {
      // Aggregate totals
      let sm_total = 0, bm_total = 0, mfp_total = 0, mfn_total = 0;
      for (const r of rows) {
        sm_total  += r.sm_daily  || 0;
        bm_total  += r.bm_daily  || 0;
        mfp_total += r.mfp_daily || 0;
        mfn_total += r.mfn_daily || 0;
      }

      const sm_net = sm_total  - bm_total;
      const mf_net = mfp_total - mfn_total;

      // Component scores
      const sm_score = clamp(
        (sm_net / Math.max(sm_total + bm_total, 0.01)) * 50 + 25,
        0, 50
      );
      const mf_score = clamp(
        (mf_net / Math.max(mfp_total + mfn_total, 0.01)) * 30 + 15,
        0, 30
      );

      const algo_pos   = algoCounts[ticker]?.pos ?? 0;
      const algo_neg   = algoCounts[ticker]?.neg ?? 0;
      const algo_score = clamp((algo_pos - algo_neg) * 4, 0, 20);

      const confluence_score = Math.round(sm_score + mf_score + algo_score);

      // Streak: count consecutive days (newest→oldest) where net SM OR net MF > 0
      let streak = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        const r     = rows[i];
        const netSm = (r.sm_daily || 0) - (r.bm_daily  || 0);
        const netMf = (r.mfp_daily || 0) - (r.mfn_daily || 0);
        if (netSm > 0 || netMf > 0) {
          streak++;
        } else {
          break;
        }
      }

      // Status
      let status: string;
      if (confluence_score >= 70) {
        status = 'AKUMULASI';
      } else if (confluence_score <= 30) {
        status = 'DISTRIBUSI';
      } else if (sm_total > 10 && bm_total > 0.7 * sm_total) {
        status = 'CONTESTED';
      } else {
        status = 'NEUTRAL';
      }

      // Position size
      let position_size: string;
      if (confluence_score >= 70)      position_size = 'FULL';
      else if (confluence_score >= 50) position_size = 'HALF';
      else                              position_size = 'WATCH';

      return {
        ticker,
        confluence_score,
        status,
        position_size,
        streak,
        sm_net:    Math.round(sm_net  * 100) / 100,
        mf_net:    Math.round(mf_net  * 100) / 100,
        sm_total:  Math.round(sm_total  * 100) / 100,
        bm_total:  Math.round(bm_total  * 100) / 100,
        mfp_total: Math.round(mfp_total * 100) / 100,
        mfn_total: Math.round(mfn_total * 100) / 100,
        algo_pos,
        algo_neg,
        sm_score:   Math.round(sm_score   * 10) / 10,
        mf_score:   Math.round(mf_score   * 10) / 10,
        algo_score: Math.round(algo_score * 10) / 10,
        days_data:  rows.length,
      };
    });

    // Filter by min_score, sort desc, limit
    const filtered = results
      .filter(r => r.confluence_score >= minScore)
      .sort((a, b) => b.confluence_score - a.confluence_score)
      .slice(0, limit);

    return NextResponse.json({
      success:      true,
      days,
      generated_at: new Date().toISOString(),
      data:         filtered,
    });

  } catch (error) {
    console.error('[/api/confluence] Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
