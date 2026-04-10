import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * SM/MF Analysis API
 *
 * source=SM  → hanya sm_daily (Trigger SM + Big SM) vs bm_daily (Bad Money)
 * source=MF  → hanya mfp_daily (Live MF+ + Big MF+) vs mfn_daily (Live MF-)
 * source=ALL → gabungan SM + MF (default)
 *
 * GET /api/sm-analysis?source=SM&days=30          → ranking SM vs Bad Money
 * GET /api/sm-analysis?source=MF&days=30          → ranking MF+ vs MF-
 * GET /api/sm-analysis?source=SM&ticker=BBRI      → detail SM ticker
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.toUpperCase();
  const days   = Math.min(parseInt(searchParams.get('days') || '30'), 90);
  const source = (searchParams.get('source') || 'ALL').toUpperCase(); // SM | MF | ALL
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromISO = fromDate.toISOString();

  try {
    if (ticker) {
      // ── Mode detail: satu ticker ──────────────────────────────────────────
      const [alertsRes, smRes, oracleRes] = await Promise.all([
        supabase
          .from('bandar_alerts')
          .select('*')
          .eq('ticker', ticker)
          .gte('created_at', fromISO)
          .order('created_at', { ascending: false }),
        supabase
          .from('v4_sm_rolling')
          .select('*')
          .eq('ticker', ticker)
          .gte('trade_date', fromDate.toISOString().split('T')[0])
          .order('trade_date', { ascending: true }),
        supabase
          .from('v4_oracle_outcomes')
          .select('*')
          .eq('ticker', ticker)
          .gte('alert_at', fromISO)
          .order('alert_at', { ascending: false })
          .limit(10),
      ]);

      const alerts  = alertsRes.data  || [];
      const smRows  = smRes.data      || [];
      const oracle  = oracleRes.data  || [];

      // Alert counts by type
      const smTriggers  = alerts.filter(a => ['SM','BIG_SM'].includes(a.trigger_type) && a.arah === 'ACCUM');
      const badMoney    = alerts.filter(a => a.trigger_type === 'BAD_MONEY');
      const mfPlus      = alerts.filter(a => ['MF_PLUS','BIG_MF_PLUS'].includes(a.trigger_type));
      const mfMinus     = alerts.filter(a => ['MF_MINUS','BIG_MF_MINUS'].includes(a.trigger_type));

      // SM rolling totals
      const totalSmDaily  = smRows.reduce((s, r) => s + (r.sm_daily  || 0), 0);
      const totalBmDaily  = smRows.reduce((s, r) => s + (r.bm_daily  || 0), 0);
      const totalMfPlus   = smRows.reduce((s, r) => s + (r.mfp_daily || 0), 0);
      const totalMfMinus  = smRows.reduce((s, r) => s + (r.mfn_daily || 0), 0);
      const latestSm10d   = smRows.length > 0 ? smRows[smRows.length - 1]?.sm_10d  : null;
      const latestSm30d   = smRows.length > 0 ? smRows[smRows.length - 1]?.sm_30d  : null;

      // Net flow per source
      const netSM = totalSmDaily - totalBmDaily;
      const netMF = totalMfPlus  - totalMfMinus;

      // Verdict tergantung source
      let netScore = 0;
      if (source === 'SM')      netScore = netSM;
      else if (source === 'MF') netScore = netMF;
      else                      netScore = netSM + netMF;
      const verdict = netScore > 0 ? 'AKUMULASI' : netScore < 0 ? 'DISTRIBUSI' : 'NETRAL';

      return NextResponse.json({
        success: true,
        ticker, days, source, verdict,
        summary: {
          net_sm:         netSM,
          net_mf:         netMF,
          net_score:      netScore,
          total_sm:       totalSmDaily,
          total_bm:       totalBmDaily,
          total_mfp:      totalMfPlus,
          total_mfn:      totalMfMinus,
          sm_10d:         latestSm10d,
          sm_30d:         latestSm30d,
          sm_triggers:    smTriggers.length,
          bad_money:      badMoney.length,
          mf_plus_hits:   mfPlus.length,
          mf_minus_hits:  mfMinus.length,
          latest_score:   oracle[0]?.composite_score || null,
          latest_phase:   oracle[0]?.markup_phase    || null,
        },
        chart: smRows.map(r => ({
          date:     r.trade_date,
          // SM source
          sm:       r.sm_daily,
          bm:       r.bm_daily,
          net_sm:   (r.sm_daily || 0) - (r.bm_daily || 0),
          // MF source
          mfp:      r.mfp_daily,
          mfn:      r.mfn_daily,
          net_mf:   (r.mfp_daily || 0) - (r.mfn_daily || 0),
          // Rolling
          sm_10d:   r.sm_10d,
          sm_30d:   r.sm_30d,
        })),
        recent_alerts: alerts.slice(0, 20),
        oracle_history: oracle,
      });
    }

    // ── Mode ranking: semua ticker ──────────────────────────────────────────
    const { data: smAll, error } = await supabase
      .from('v4_sm_rolling')
      .select('ticker, sm_daily, bm_daily, mfp_daily, mfn_daily, sm_10d, sm_30d, nbsa_daily, trade_date')
      .gte('trade_date', fromDate.toISOString().split('T')[0])
      .order('trade_date', { ascending: false });

    if (error) throw error;

    // Aggregate per ticker
    const tickerMap: Record<string, {
      ticker: string; net_sm: number; net_mf: number;
      sm_total: number; bm_total: number; mfp_total: number; mfn_total: number;
      sm_10d: number | null; sm_30d: number | null; nbsa_daily: number | null; days_count: number;
    }> = {};

    for (const r of smAll || []) {
      if (!tickerMap[r.ticker]) {
        tickerMap[r.ticker] = {
          ticker: r.ticker, net_sm: 0, net_mf: 0,
          sm_total: 0, bm_total: 0, mfp_total: 0, mfn_total: 0,
          sm_10d: null, sm_30d: null, nbsa_daily: null, days_count: 0
        };
      }
      const t = tickerMap[r.ticker];
      t.sm_total  += r.sm_daily  || 0;
      t.bm_total  += r.bm_daily  || 0;
      t.mfp_total += r.mfp_daily || 0;
      t.mfn_total += r.mfn_daily || 0;
      t.days_count++;
      // latest values (already ordered desc, so first hit = latest)
      if (t.sm_10d === null) { t.sm_10d = r.sm_10d; t.sm_30d = r.sm_30d; t.nbsa_daily = r.nbsa_daily; }
    }

    const ranking = Object.values(tickerMap).map(t => {
      const net_sm = t.sm_total - t.bm_total;
      const net_mf = t.mfp_total - t.mfn_total;
      let score = 0;
      if (source === 'SM')      score = net_sm;
      else if (source === 'MF') score = net_mf;
      else                      score = net_sm + net_mf;
      return {
        ...t, net_sm, net_mf, score,
        verdict: score > 0 ? 'AKUMULASI' : score < 0 ? 'DISTRIBUSI' : 'NETRAL',
      };
    }).sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

    return NextResponse.json({ success: true, days, source, ranking });

  } catch (error) {
    console.error('[/api/sm-analysis] Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
