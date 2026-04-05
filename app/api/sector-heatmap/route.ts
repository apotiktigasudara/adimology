/**
 * GET /api/sector-heatmap?days=14
 *
 * Aggregate net money flow (SM - BM + MF+ - MF-) per sector per trading day.
 * Sector mapping: stock_queries DISTINCT emiten→sector, plus static fallback.
 * Response:
 *   { dates: string[], sectors: SectorRow[], generated_at: string }
 *
 * SectorRow: { name, total_net, days: { [date]: { net, tickers, sm, bm, mfp, mfn } } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Static sector fallback for common IDX tickers (BEI sektor IDX Industry)
const STATIC_SECTOR: Record<string, string> = {
  // FINANCE
  BBCA: 'Finance', BBRI: 'Finance', BMRI: 'Finance', BBNI: 'Finance',
  BRIS: 'Finance', BNGA: 'Finance', MEGA: 'Finance', BTPS: 'Finance',
  PNBN: 'Finance', BJTM: 'Finance', ADMF: 'Finance', MFIN: 'Finance',
  BFIN: 'Finance', BNII: 'Finance', BDMN: 'Finance', BBMD: 'Finance',
  NISP: 'Finance', BMAS: 'Finance', BBYB: 'Finance', AGRO: 'Finance',
  DNAR: 'Finance', AMAR: 'Finance', ARTO: 'Finance', BANK: 'Finance',
  BCIC: 'Finance', MAYA: 'Finance', NOBU: 'Finance', RELI: 'Finance',
  MREI: 'Finance', ABDA: 'Finance', ASDM: 'Finance', LPGI: 'Finance',
  TRIM: 'Finance', PANS: 'Finance', KREN: 'Finance', VINS: 'Finance',
  MLPT: 'Finance', PNLF: 'Finance', SMMA: 'Finance',

  // CONSUMER NON-CYCLICALS
  ICBP: 'Consumer Non-Cyclicals', INDF: 'Consumer Non-Cyclicals',
  UNVR: 'Consumer Non-Cyclicals', MYOR: 'Consumer Non-Cyclicals',
  CPIN: 'Consumer Non-Cyclicals', JPFA: 'Consumer Non-Cyclicals',
  HOKI: 'Consumer Non-Cyclicals', SIDO: 'Consumer Non-Cyclicals',
  ULTJ: 'Consumer Non-Cyclicals', ROTI: 'Consumer Non-Cyclicals',
  CAMP: 'Consumer Non-Cyclicals', DMND: 'Consumer Non-Cyclicals',
  GOOD: 'Consumer Non-Cyclicals', SKBM: 'Consumer Non-Cyclicals',
  MLBI: 'Consumer Non-Cyclicals', PSDN: 'Consumer Non-Cyclicals',
  HMSP: 'Consumer Non-Cyclicals', GGRM: 'Consumer Non-Cyclicals',
  WIIM: 'Consumer Non-Cyclicals', ISSP: 'Consumer Non-Cyclicals',

  // CONSUMER CYCLICALS
  MAPI: 'Consumer Cyclicals', ACES: 'Consumer Cyclicals',
  ERAA: 'Consumer Cyclicals', LPPF: 'Consumer Cyclicals',
  GJTL: 'Consumer Cyclicals', SMSM: 'Consumer Cyclicals',
  RALS: 'Consumer Cyclicals', MPMX: 'Consumer Cyclicals',
  MIDI: 'Consumer Cyclicals', MCAS: 'Consumer Cyclicals',
  CSAP: 'Consumer Cyclicals', HERO: 'Consumer Cyclicals',
  AMRT: 'Consumer Cyclicals', RANC: 'Consumer Cyclicals',

  // BASIC MATERIALS
  TPIA: 'Basic Materials', BRPT: 'Basic Materials',
  MDKA: 'Basic Materials', ANTM: 'Basic Materials',
  INCO: 'Basic Materials', SMGR: 'Basic Materials',
  INTP: 'Basic Materials', SMBR: 'Basic Materials',
  WTON: 'Basic Materials', BAJA: 'Basic Materials',
  KRAS: 'Basic Materials', NIKL: 'Basic Materials',
  DKFT: 'Basic Materials', PSAB: 'Basic Materials',
  MITI: 'Basic Materials', TINS: 'Basic Materials',
  CUAN: 'Basic Materials', NCKL: 'Basic Materials',

  // INDUSTRIALS
  ASII: 'Industrials', AUTO: 'Industrials',
  KBLI: 'Industrials', VKTR: 'Industrials',
  PGAS: 'Industrials', INDS: 'Industrials',
  BUDI: 'Industrials', EKAD: 'Industrials',
  CEKA: 'Industrials', UNIC: 'Industrials',
  DPNS: 'Industrials', ARNA: 'Industrials',
  MULIA: 'Industrials', TOTO: 'Industrials',

  // INFRASTRUCTURE & UTILITIES
  JSMR: 'Infrastructure', TLKM: 'Infrastructure',
  ISAT: 'Infrastructure', EXCL: 'Infrastructure',
  FREN: 'Infrastructure', TOWR: 'Infrastructure',
  MTEL: 'Infrastructure', TBIG: 'Infrastructure',
  SUPR: 'Infrastructure', LINK: 'Infrastructure',
  POWR: 'Infrastructure', PLTM: 'Infrastructure',
  KOPI: 'Infrastructure', META: 'Infrastructure',

  // HEALTHCARE
  KLBF: 'Healthcare', KAEF: 'Healthcare',
  MIKA: 'Healthcare', HEAL: 'Healthcare',
  SILO: 'Healthcare', DVLA: 'Healthcare',
  PYFA: 'Healthcare', TSPC: 'Healthcare',
  MERK: 'Healthcare', INAF: 'Healthcare',
  PRDA: 'Healthcare', OMED: 'Healthcare',

  // PROPERTIES & REAL ESTATE
  CTRA: 'Properties', BSDE: 'Properties',
  SMRA: 'Properties', PWON: 'Properties',
  LPKR: 'Properties', INPP: 'Properties',
  GPRA: 'Properties', DMAS: 'Properties',
  MDLN: 'Properties', ASRI: 'Properties',
  MTLA: 'Properties', JPRT: 'Properties',
  BCIP: 'Properties', NIRO: 'Properties',

  // TECHNOLOGY
  GOTO: 'Technology', BUKA: 'Technology',
  EMTK: 'Technology', MCOM: 'Technology',
  DMMX: 'Technology', AXIO: 'Technology',
  FORE: 'Technology', INET: 'Technology',
  DCII: 'Technology',

  // ENERGY
  ADRO: 'Energy', BUMI: 'Energy',
  PTBA: 'Energy', HRUM: 'Energy',
  ITMG: 'Energy', MBAP: 'Energy',
  INDY: 'Energy', ESSA: 'Energy',
  MEDC: 'Energy', ELSA: 'Energy',
  AKRA: 'Energy', DEWA: 'Energy',
  ADMR: 'Energy', BOSS: 'Energy',
  GEMS: 'Energy', FIRE: 'Energy',
  BSSR: 'Energy', GTBO: 'Energy',
  CITA: 'Energy', TOBA: 'Energy',

  // TRANSPORTATION & LOGISTICS
  BIRD: 'Transportation', GIAA: 'Transportation',
  SMDR: 'Transportation', WEHA: 'Transportation',
  ASSA: 'Transportation', TMAS: 'Transportation',
  NELY: 'Transportation', TRUK: 'Transportation',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days  = Math.min(parseInt(searchParams.get('days') || '14'), 30);
  const mode  = (searchParams.get('mode') || 'COMBINED').toUpperCase(); // SM | MF | COMBINED

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  const fromDateStr = fromDate.toISOString().split('T')[0];

  try {
    // Fetch sm_rolling + sector map in parallel
    const [smRes, sectorRes] = await Promise.all([
      sb
        .from('v4_sm_rolling')
        .select('ticker, trade_date, sm_daily, bm_daily, mfp_daily, mfn_daily')
        .gte('trade_date', fromDateStr)
        .order('trade_date', { ascending: true }),
      sb
        .from('stock_queries')
        .select('emiten, sector')
        .not('sector', 'is', null),
    ]);

    if (smRes.error) throw smRes.error;

    const smRows   = smRes.data   || [];
    const sqRows   = sectorRes.data || [];

    // Build ticker→sector map: DB overrides static
    const sectorMap: Record<string, string> = { ...STATIC_SECTOR };
    for (const r of sqRows) {
      if (r.emiten && r.sector) {
        sectorMap[r.emiten.toUpperCase()] = r.sector;
      }
    }

    // Collect all unique sorted dates
    const dateSet = new Set<string>();
    for (const r of smRows) dateSet.add(r.trade_date);
    const dates = Array.from(dateSet).sort();

    // Aggregate per sector per date
    type DayCell = {
      net: number; sm: number; bm: number; mfp: number; mfn: number;
      tickers: string[];
    };
    const sectorDays: Record<string, Record<string, DayCell>> = {};

    for (const r of smRows) {
      const sector = sectorMap[r.ticker] || 'Lainnya';
      if (!sectorDays[sector]) sectorDays[sector] = {};
      if (!sectorDays[sector][r.trade_date]) {
        sectorDays[sector][r.trade_date] = { net: 0, sm: 0, bm: 0, mfp: 0, mfn: 0, tickers: [] };
      }
      const cell = sectorDays[sector][r.trade_date];
      const sm  = r.sm_daily  || 0;
      const bm  = r.bm_daily  || 0;
      const mfp = r.mfp_daily || 0;
      const mfn = r.mfn_daily || 0;

      let net = 0;
      if (mode === 'SM')         net = sm - bm;
      else if (mode === 'MF')    net = mfp - mfn;
      else                        net = (sm - bm) + (mfp - mfn);

      cell.net += net;
      cell.sm  += sm;
      cell.bm  += bm;
      cell.mfp += mfp;
      cell.mfn += mfn;
      if (!cell.tickers.includes(r.ticker)) cell.tickers.push(r.ticker);
    }

    // Build sector rows sorted by total net desc
    const sectorRows = Object.entries(sectorDays).map(([name, dayMap]) => {
      const totalNet = Object.values(dayMap).reduce((s, c) => s + c.net, 0);
      const tickerSet = new Set<string>();
      Object.values(dayMap).forEach(c => c.tickers.forEach(t => tickerSet.add(t)));

      // Round values for output
      const daysOut: Record<string, {
        net: number; sm: number; bm: number; mfp: number; mfn: number;
        ticker_count: number; tickers: string[];
      }> = {};
      for (const [date, cell] of Object.entries(dayMap)) {
        daysOut[date] = {
          net:    Math.round(cell.net  * 100) / 100,
          sm:     Math.round(cell.sm   * 100) / 100,
          bm:     Math.round(cell.bm   * 100) / 100,
          mfp:    Math.round(cell.mfp  * 100) / 100,
          mfn:    Math.round(cell.mfn  * 100) / 100,
          ticker_count: cell.tickers.length,
          tickers: cell.tickers.sort(),
        };
      }

      return {
        name,
        total_net:    Math.round(totalNet * 100) / 100,
        ticker_count: tickerSet.size,
        days: daysOut,
      };
    }).sort((a, b) => b.total_net - a.total_net);

    return NextResponse.json({
      success:      true,
      days,
      mode,
      dates,
      sectors:      sectorRows,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[/api/sector-heatmap] Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
