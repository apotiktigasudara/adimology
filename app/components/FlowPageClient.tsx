'use client';

/**
 * FlowPageClient.tsx — wrapper client untuk /flow page.
 *
 * Menggunakan router.push agar tombol "Analisa →" di BandarAccumCard
 * bisa navigasi ke /?symbol=TICKER dan membuka Calculator.
 */

import { useRouter } from 'next/navigation';
import PhoenixFlowPanel from './PhoenixFlowPanel';

export default function FlowPageClient() {
  const router = useRouter();

  const handleAnalyze = (ticker: string) => {
    router.push(`/?symbol=${ticker}`);
  };

  return <PhoenixFlowPanel onAnalyze={handleAnalyze} />;
}
