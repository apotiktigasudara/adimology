/**
 * POST /api/analyze-story-background?emiten=BBCA&id=123
 *
 * Vercel replacement for the Netlify background function.
 * Runs Gemini AI analysis and updates agent_stories table.
 * maxDuration: 60s (Vercel Hobby limit).
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  updateAgentStory,
  createBackgroundJobLog,
  appendBackgroundJobLogEntry,
  updateBackgroundJobLog,
} from '@/lib/supabase';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export const maxDuration = 60;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let jobLogId: number | null = null;
  const { searchParams } = new URL(request.url);
  const emiten = searchParams.get('emiten')?.toUpperCase();
  const storyId = searchParams.get('id');

  console.log('[Agent Story] Starting background analysis with Gemini...');

  try {
    if (!emiten || !storyId) {
      return NextResponse.json({ error: 'Missing emiten or id' }, { status: 400 });
    }

    try {
      const jobLog = await createBackgroundJobLog('analyze-story', 1);
      jobLogId = jobLog.id;
      if (jobLogId) {
        await appendBackgroundJobLogEntry(jobLogId, { level: 'info', message: 'Starting AI Story Analysis', emiten });
      }
    } catch (_) {}

    let keyStatsData = null;
    try {
      const body = await request.json();
      keyStatsData = body.keyStats;
    } catch (_) {}

    if (!GEMINI_API_KEY) {
      const errMsg = 'GEMINI_API_KEY not configured';
      await updateAgentStory(parseInt(storyId), { status: 'error', error_message: errMsg });
      if (jobLogId) await updateBackgroundJobLog(jobLogId, { status: 'failed', error_message: errMsg });
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    await updateAgentStory(parseInt(storyId), { status: 'processing' });

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const model = 'gemini-2.5-flash-preview-04-17';

    let keyStatsContext = '';
    if (keyStatsData) {
      keyStatsContext = `\nDATA KEY STATISTICS UNTUK ${emiten}:\n` + JSON.stringify(keyStatsData, null, 2) + '\n';
    }

    const systemPrompt = 'Kamu adalah seorang analis saham profesional Indonesia yang ahli dalam menganalisa story dan katalis pergerakan harga saham.';
    const userPrompt = `Hari ini adalah ${today}.
Cari dan analisa berita-berita TERBARU (bulan ini/minggu ini) tentang emiten saham Indonesia dengan kode ${emiten} dari internet menggunakan Google Search.
${keyStatsContext}
FOKUS ANALISA:
1. Fokus sepenuhnya pada STORY BISNIS, AKSI KORPORASI, dan KATALIS fundamental/sentimen.
2. ABAIKAN data harga saham (price action) karena data harga dari internet seringkali tidak akurat atau delay. Jangan menyebutkan angka harga saham spesifik dalam analisis.
3. Hubungkan berita yang ditemukan dengan logika pasar: mengapa berita ini bagus atau buruk untuk masa depan perusahaan?
4. Sebutkan tanggal rilis berita yang kamu gunakan sebagai referensi di dalam deskripsi katalis.
5. Terjemahkan data Key Statistics (pahami data di atas jika tersedia) ke dalam bahasa yang mudah dipahami tapi detail untuk investasi. Berikan kesimpulan apakah data tersebut memberikan signal 'Positif/Sehat', 'Neutral', atau 'Negatif/Hati-hati' untuk investasi jangka pendek dan panjang.

Berikan analisis dalam format JSON dengan struktur berikut (PASTIKAN HANYA OUTPUT JSON, tanpa markdown code block agar mudah di-parse):
{
  "matriks_story": [
    {
      "kategori_story": "Transformasi Bisnis | Aksi Korporasi | Pemulihan Fundamental | Kondisi Makro",
      "deskripsi_katalis": "deskripsi singkat katalis",
      "logika_ekonomi_pasar": "penjelasan logika ekonomi/pasar",
      "potensi_dampak_harga": "dampak terhadap harga saham negatif/netral/positif dan alasan"
    }
  ],
  "swot_analysis": {
    "strengths": ["kekuatan perusahaan"],
    "weaknesses": ["kelemahan perusahaan"],
    "opportunities": ["peluang pasar"],
    "threats": ["ancaman/risiko"]
  },
  "checklist_katalis": [
    {
      "item": "katalis yang perlu dipantau",
      "dampak_instan": "dampak jika terjadi"
    }
  ],
  "strategi_trading": {
    "tipe_saham": "jenis saham (growth/value/turnaround/dll)",
    "target_entry": "area entry yang disarankan",
    "exit_strategy": {
      "take_profit": "target take profit",
      "stop_loss": "level stop loss"
    }
  },
  "keystat_signal": "analisis data key statistics dalam bahasa awam dengan indikasi signal investasi",
  "kesimpulan": "kesimpulan analisis dalam 2-3 kalimat"
}`;

    const contents = [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }];
    const tools = [{ googleSearch: {} }] as any;

    const responseStream = await (ai.models as any).generateContentStream({
      model,
      config: { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } },
      contents,
      tools,
    });

    let fullText = '';
    for await (const chunk of responseStream) {
      if (chunk.text) fullText += chunk.text;
    }

    let analysisResult;
    try {
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');
      analysisResult = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      const errMsg = 'Failed to parse AI response';
      await updateAgentStory(parseInt(storyId), { status: 'error', error_message: errMsg });
      if (jobLogId) await updateBackgroundJobLog(jobLogId, { status: 'failed', error_message: errMsg });
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    await updateAgentStory(parseInt(storyId), {
      status: 'completed',
      matriks_story:     analysisResult.matriks_story     || [],
      swot_analysis:     analysisResult.swot_analysis     || {},
      checklist_katalis: analysisResult.checklist_katalis || [],
      keystat_signal:    analysisResult.keystat_signal    || '',
      strategi_trading:  analysisResult.strategi_trading  || {},
      kesimpulan:        analysisResult.kesimpulan        || '',
    });

    const duration = (Date.now() - startTime) / 1000;
    if (jobLogId) await updateBackgroundJobLog(jobLogId, { status: 'completed', success_count: 1, metadata: { duration_seconds: duration } });

    return NextResponse.json({ success: true, emiten, duration });

  } catch (error) {
    const errMsg = String(error);
    console.error('[Agent Story] Critical error:', error);
    if (storyId) await updateAgentStory(parseInt(storyId), { status: 'error', error_message: errMsg });
    if (jobLogId) await updateBackgroundJobLog(jobLogId, { status: 'failed', error_message: errMsg });
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
