import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * SM Analysis API
 * Menghitung akumulasi/distribusi Smart Money per ticker dari data V4 Supabase.
 *
 * GET /api/sm-analysis?days=30
 *   → Ranking semua ticker: siapa yang paling banyak di-akumulasi vs di-buang
 *
 * GET /api/sm-analysis?ticker=BBRI&days=30
 *   → Detail SM flow + MF +/- untuk satu ticker
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker')?.toUpperCase();
  const days   = Math.min(parseInt(searchParams.get('days') || '30'), 90);
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

      // Hitung summary SM vs BM dari alerts
      const accumAlerts = alerts.filter(a => a.arah === 'ACCUM');
      const distribAlerts = alerts.filter(a => a.arah === 'DISTRIB');
      const smTriggers    = alerts.filter(a => ['SM','BIG_SM'].includes(a.trigger_type) && a.arah === 'ACCUM');
      const badMoney      = alerts.filter(a => a.trigger_type === 'BAD_MONEY' || a.arah === 'DISTRIB');
      const mfPlus        = alerts.filter(a => ['MF_PLUS','BIG_MF_PLUS'].includes(a.trigger_type));
      const mfMinus       = alerts.filter(a => ['MF_MINUS','BIG_MF_MINUS'].includes(a.trigger_type));

      // SM rolling totals
      const totalSmDaily  = smRows.reduce((s, r) => s + (r.sm_daily  || 0), 0);
      const totalBmDaily  = smRows.reduce((s, r) => s + (r.bm_daily  || 0), 0);
      const totalMfPlus   = smRows.reduce((s, r) => s + (r.mfp_daily || 0), 0);
      const totalMfMinus  = smRows.reduce((s, r) => s + (r.mfn_daily || 0), 0);
      const latestSm10d   = smRows.length > 0 ? smRows[smRows.length - 1]?.sm_10d  : null;
      const latestSm30d   = smRows.length > 0 ? smRows[smRows.length - 1]?.sm_30d  : null;

      // Net SM flow: positif = akumulasi, negatif = distribusi
      const netSM = totalSmDaily - totalBmDaily;
      const netMF = totalMfPlus  - totalMfMinus;
      const verdict = netSM + netMF > 0 ? 'AKUMULASI' : netSM + netMF < 0 ? 'DISTRIBUSI' : 'NETRAL';

      return NextResponse.json({
        success: true,
        ticker,
        days,
        verdict,
        summary: {
          net_sm:        netSM,
          net_mf:        netMF,
          total_sm_lots: totalSmDaily,
          total_bm_lots: totalBmDaily,
          total_mf_plus: totalMfPlus,
          total_mf_minus: totalMfMinus,
          sm_10d:        latestSm10d,
          sm_30d:        latestSm30d,
          accum_alerts:  accumAlerts.length,
          distrib_alerts: distribAlerts.length,
          sm_triggers:   smTriggers.length,
          bad_money:     badMoney.length,
          mf_plus_hits:  mfPlus.length,
          mf_minus_hits: mfMinus.length,
          latest_score:  oracle[0]?.composite_score || null,
          latest_phase:  oracle[0]?.markup_phase    || null,
        },
        sm_chart: smRows.map(r => ({
          date:     r.trade_date,
          sm_daily: r.sm_daily,
          bm_daily: r.bm_daily,
          net:      (r.sm_daily || 0) - (r.bm_daily || 0),
          mfp:      r.mfp_daily,
          mfn:      r.mfn_daily,
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
      .select('ticker, sm_daily, bm_daily, mfp_daily, mfn_daily, sm_10d, sm_30d, trade_date')
      .gte('trade_date', fromDate.toISOString().split('T')[0])
      .order('trade_date', { ascending: false });

    if (error) throw error;

    // Aggregate per ticker
    const tickerMap: Record<string, {
      ticker: string; net_sm: number; net_mf: number;
      sm_total: number; bm_total: number; mfp_total: number; mfn_total: number;
      sm_10d: number | null; sm_30d: number | null; days_count: number;
    }> = {};

    for (const r of smAll || []) {
      if (!tickerMap[r.ticker]) {
        tickerMap[r.ticker] = {
          ticker: r.ticker, net_sm: 0, net_mf: 0,
          sm_total: 0, bm_total: 0, mfp_total: 0, mfn_total: 0,
          sm_10d: null, sm_30d: null, days_count: 0
        };
      }
      const t = tickerMap[r.ticker];
      t.sm_total  += r.sm_daily  || 0;
      t.bm_total  += r.bm_daily  || 0;
      t.mfp_total += r.mfp_daily || 0;
      t.mfn_total += r.mfn_daily || 0;
      t.days_count++;
      // latest sm_10d/sm_30d (already ordered desc, so first hit = latest)
      if (t.sm_10d === null) { t.sm_10d = r.sm_10d; t.sm_30d = r.sm_30d; }
    }

    const ranking = Object.values(tickerMap).map(t => ({
      ...t,
      net_sm: t.sm_total - t.bm_total,
      net_mf: t.mfp_total - t.mfn_total,
      score:  (t.sm_total - t.bm_total) + (t.mfp_total - t.mfn_total),
      verdict: (t.sm_total - t.bm_total) + (t.mfp_total - t.mfn_total) > 0
               ? 'AKUMULASI' : 'DISTRIBUSI',
    })).sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

    return NextResponse.json({ success: true, days, ranking });

  } catch (error) {
    console.error('[/api/sm-analysis] Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
