/**
 * app/api/screener/route.ts — Phoenix Bot V.X × Adimology
 *
 * GET /api/screener
 *
 * Dua section:
 *   1. "picks"  — Top oracle+bandar combined score (A1 Morning Screener)
 *   2. "tidur"  — Saham dalam fase akumulasi diam-diam (B1 Saham Tidur)
 *
 * Query params:
 *   top_n     — jumlah hasil per section (default: 5, max: 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TIDUR_PHASES = new Set([
  'EARLY_ACCUMULATION',
  'MID_ACCUMULATION',
  'LATE_ACCUMULATION',
]);

async function getLastDate(table: string): Promise<string | null> {
  const { data } = await sb
    .from(table)
    .select('trade_date')
    .order('trade_date', { ascending: false })
    .limit(1);
  return data?.[0]?.trade_date ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const topN = Math.min(
      Math.max(1, parseInt(request.nextUrl.searchParams.get('top_n') || '5')),
      20
    );

    // ── 1. Last trade_dates ─────────────────────────────────────────────────
    const [smDate, bfDate] = await Promise.all([
      getLastDate('v4_sm_rolling'),
      getLastDate('bandar_flow'),
    ]);

    if (!smDate) {
      return NextResponse.json({ error: 'No data in v4_sm_rolling' }, { status: 503 });
    }

    // ── 2. Fetch v4_sm_rolling (top 200 by oracle_score) ───────────────────
    const { data: smRows, error: smErr } = await sb
      .from('v4_sm_rolling')
      .select('ticker, oracle_score, sm_10d, markup_phase, streak')
      .eq('trade_date', smDate)
      .order('oracle_score', { ascending: false })
      .limit(200);

    if (smErr) throw smErr;

    // ── 3. Fetch bandar_flow for last available date ────────────────────────
    let bfMap: Record<string, number> = {};
    if (bfDate) {
      const { data: bfRows } = await sb
        .from('bandar_flow')
        .select('ticker, net_value_10d')
        .eq('trade_date', bfDate);
      if (bfRows) {
        for (const r of bfRows) bfMap[r.ticker] = Number(r.net_value_10d ?? 0);
      }
    }

    // ── 4. Normalize + combine for "picks" ──────────────────────────────────
    const smScores  = (smRows ?? []).map(r => Number(r.oracle_score ?? 0));
    const maxOracle = Math.max(...smScores, 1);
    const minOracle = Math.min(...smScores, 0);
    const oracleRng = Math.max(maxOracle - minOracle, 1);
    const bfVals    = (smRows ?? []).map(r => Math.max(bfMap[r.ticker] ?? 0, 0));
    const maxBf     = Math.max(...bfVals, 1);

    const picks = (smRows ?? [])
      .map((r, i) => {
        const oNorm   = ((smScores[i] - minOracle) / oracleRng) * 100;
        const bNorm   = (bfVals[i] / maxBf) * 100;
        const combined = 0.6 * oNorm + 0.4 * bNorm;
        return {
          ticker:         r.ticker,
          oracle_score:   Number(r.oracle_score ?? 0),
          sm_10d:         Number(r.sm_10d ?? 0),
          bandar_net_10d: bfVals[i],
          combined_score: Math.round(combined),
          markup_phase:   r.markup_phase ?? null,
          streak:         Number(r.streak ?? 0),
          trade_date:     smDate,
        };
      })
      .sort((a, b) => b.combined_score - a.combined_score)
      .slice(0, topN);

    // ── 5. Filter "saham tidur" ──────────────────────────────────────────────
    const PHASE_WEIGHT: Record<string, number> = {
      'LATE_ACCUMULATION':  3,
      'MID_ACCUMULATION':   2,
      'EARLY_ACCUMULATION': 1,
    };

    const tidur = (smRows ?? [])
      .filter(r => {
        const phase = r.markup_phase ?? '';
        return (
          TIDUR_PHASES.has(phase) &&
          Number(r.oracle_score ?? 0) < 70 &&
          Number(r.sm_10d ?? 0) >= 1.0 &&
          Number(r.streak ?? 0) >= 2
        );
      })
      .map(r => {
        const phase   = r.markup_phase ?? '';
        const pw      = PHASE_WEIGHT[phase] ?? 1;
        const streak  = Number(r.streak ?? 0);
        const sm10d   = Number(r.sm_10d ?? 0);
        const rankScore = pw * 20 + streak * 3 + sm10d * 2;
        return {
          ticker:       r.ticker,
          markup_phase: phase,
          oracle_score: Number(r.oracle_score ?? 0),
          sm_10d:       sm10d,
          streak,
          trade_date:   smDate,
          rank_score:   Math.round(rankScore),
        };
      })
      .sort((a, b) => b.rank_score - a.rank_score)
      .slice(0, topN);

    return NextResponse.json({
      sm_date: smDate,
      bf_date: bfDate,
      picks,
      tidur,
    });

  } catch (err: any) {
    console.error('[screener] Error:', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}
