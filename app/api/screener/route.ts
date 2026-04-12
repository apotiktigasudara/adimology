/**
 * app/api/screener/route.ts — Phoenix Bot V.X × Adimology
 *
 * GET /api/screener
 *
 * Dua section:
 *   1. "picks"  — Top SM+Bandar combined score (A1 Morning Screener)
 *      Menggunakan sm_10d dari v4_sm_rolling + net_value_10d dari bandar_flow.
 *      Jika oracle_score tersedia (setelah DB migration), digunakan secara otomatis.
 *
 *   2. "tidur"  — Saham ACCUM dengan score rendah (B1 Saham Tidur)
 *      Menggunakan bandar_flow: arah=ACCUM + combined_score < 65 + net_value_10d >= 1M
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

    // ── 2. Fetch v4_sm_rolling (top 200 by sm_10d) ─────────────────────────
    // Coba oracle_score dulu (jika migration sudah dijalankan), fallback ke sm_10d
    let smRows: any[] = [];
    let hasOracle = false;

    try {
      const { data, error } = await sb
        .from('v4_sm_rolling')
        .select('ticker, oracle_score, sm_10d, markup_phase, streak')
        .eq('trade_date', smDate)
        .order('oracle_score', { ascending: false })
        .limit(200);
      if (!error && data) { smRows = data; hasOracle = true; }
    } catch {
      hasOracle = false;
    }

    // Fallback: oracle_score kolom tidak ada → pakai sm_10d
    if (!hasOracle || smRows.length === 0) {
      const { data } = await sb
        .from('v4_sm_rolling')
        .select('ticker, sm_10d')
        .eq('trade_date', smDate)
        .order('sm_10d', { ascending: false })
        .limit(200);
      smRows = data ?? [];
    }

    // ── 3. Fetch bandar_flow for picks join ────────────────────────────────
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
    const primaryScores = smRows.map(r =>
      hasOracle ? Number(r.oracle_score ?? 0) : Number(r.sm_10d ?? 0)
    );
    const bfVals    = smRows.map(r => Math.max(bfMap[r.ticker] ?? 0, 0));
    const maxPrimary = Math.max(...primaryScores, 1);
    const minPrimary = Math.min(...primaryScores, 0);
    const primaryRng = Math.max(maxPrimary - minPrimary, 1);
    const maxBf      = Math.max(...bfVals, 1);

    const picks = smRows
      .map((r, i) => {
        const pNorm   = ((primaryScores[i] - minPrimary) / primaryRng) * 100;
        const bNorm   = (bfVals[i] / maxBf) * 100;
        const combined = Math.round(0.6 * pNorm + 0.4 * bNorm);
        return {
          ticker:         r.ticker as string,
          sm_score:       primaryScores[i],
          sm_10d:         Number(r.sm_10d ?? 0),
          bandar_net_10d: bfVals[i],
          combined_score: combined,
          markup_phase:   (r.markup_phase as string | null) ?? null,
          streak:         Number(r.streak ?? 0),
          trade_date:     smDate,
        };
      })
      .sort((a, b) => b.combined_score - a.combined_score)
      .slice(0, topN);

    // ── 5. "Saham Tidur" — dari bandar_flow ────────────────────────────────
    // arah=ACCUM + combined_score < 65 + net_value_10d >= 1M
    const QUIET = new Set(['EARLY', 'LEMAH', 'SEDANG']);
    const STRENGTH_W: Record<string, number> = { SEDANG: 3, LEMAH: 2, EARLY: 1 };

    let tidurRows: any[] = [];
    if (bfDate) {
      const { data } = await sb
        .from('bandar_flow')
        .select('ticker, net_value_10d, combined_score, signal_strength, net_lots_10d')
        .eq('trade_date', bfDate)
        .eq('arah', 'ACCUM')
        .gte('net_value_10d', 1.0)
        .lt('combined_score', 65);
      tidurRows = data ?? [];
    }

    // Opsional: join v4_sm_rolling untuk markup_phase jika oracle sudah ada
    let smPhaseTidurMap: Record<string, { markup_phase: string | null; streak: number }> = {};
    if (hasOracle && tidurRows.length > 0) {
      const tidurTickers = tidurRows.map((r: any) => r.ticker);
      const { data: smPhase } = await sb
        .from('v4_sm_rolling')
        .select('ticker, markup_phase, streak')
        .eq('trade_date', smDate)
        .in('ticker', tidurTickers);
      if (smPhase) {
        for (const r of smPhase) {
          smPhaseTidurMap[r.ticker] = { markup_phase: r.markup_phase ?? null, streak: Number(r.streak ?? 0) };
        }
      }
    }

    const tidur = tidurRows
      .filter((r: any) => QUIET.has(r.signal_strength ?? 'EARLY'))
      .map((r: any) => {
        const strength = r.signal_strength ?? 'EARLY';
        const netVal   = Number(r.net_value_10d ?? 0);
        const score    = Number(r.combined_score ?? 0);
        const sw       = STRENGTH_W[strength] ?? 1;
        const rankScore = sw * 10 + netVal * 2 + score * 0.5;
        const smInfo    = smPhaseTidurMap[r.ticker] ?? {};
        return {
          ticker:          r.ticker as string,
          signal_strength: strength,
          net_value_10d:   netVal,
          combined_score:  score,
          markup_phase:    smInfo.markup_phase ?? null,
          streak:          smInfo.streak ?? 0,
          trade_date:      bfDate!,
          rank_score:      Math.round(rankScore),
        };
      })
      .sort((a: any, b: any) => b.rank_score - a.rank_score)
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
