/**
 * app/flow/page.tsx — Phoenix Bot V.X × Adimology
 * Copy ke: adimology/app/flow/page.tsx
 *
 * Route: /flow
 * Halaman dedicated untuk Phoenix Flow — Bandar Monitor.
 * Import CSS di sini supaya hanya dimuat untuk halaman ini.
 */

import PhoenixFlowPanel from '@/app/components/PhoenixFlowPanel';
import '@/styles/bandar-flow.css';

export const metadata = {
  title:       'Phoenix Flow — Bandar Monitor',
  description: 'Realtime Smart Money accumulation & distribution tracker by Phoenix Bot V.X',
};

export default function FlowPage() {
  return (
    <div className="flow-page">
      <div className="flow-page-title">
        🏦 Phoenix Flow
        <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.6 }}>
          Bandar Monitor — Realtime
        </span>
      </div>

      <PhoenixFlowPanel />
    </div>
  );
}
