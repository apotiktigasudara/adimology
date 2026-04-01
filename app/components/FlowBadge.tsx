/**
 * app/components/FlowBadge.tsx — Phoenix Bot V.X × Adimology
 * Copy ke: adimology/app/components/FlowBadge.tsx
 *
 * Badge kecil yang menampilkan arah (ACCUM/DISTRIB/NEUTRAL)
 * dan opsional signal_strength.
 */
'use client';

import type { BandarFlow } from '@/lib/bandar-flow.types';

interface FlowBadgeProps {
  arah:      BandarFlow['arah'];
  strength?: BandarFlow['signal_strength'];
  score?:    number;
  /** Jika true, tampilkan score angka di dalam badge */
  showScore?: boolean;
}

const ARAH_LABEL: Record<BandarFlow['arah'], string> = {
  ACCUM:   '⬆ Akumulasi',
  DISTRIB: '⬇ Distribusi',
  NEUTRAL: '↔ Netral',
};

const STRENGTH_CLASS: Record<BandarFlow['signal_strength'], string> = {
  KUAT:   'bf-strength-kuat',
  SEDANG: 'bf-strength-sedang',
  LEMAH:  'bf-strength-lemah',
  EARLY:  'bf-strength-early',
};

const BADGE_CLASS: Record<BandarFlow['arah'], string> = {
  ACCUM:   'bf-badge bf-badge-accum',
  DISTRIB: 'bf-badge bf-badge-distrib',
  NEUTRAL: 'bf-badge bf-badge-neutral',
};

export default function FlowBadge({
  arah,
  strength,
  score,
  showScore = false,
}: FlowBadgeProps) {
  return (
    <span className={BADGE_CLASS[arah]}>
      {ARAH_LABEL[arah]}
      {strength && (
        <span className={STRENGTH_CLASS[strength]}>
          &nbsp;{strength}
        </span>
      )}
      {showScore && score !== undefined && (
        <span style={{ opacity: 0.8 }}>&nbsp;{score}</span>
      )}
    </span>
  );
}
