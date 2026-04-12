/**
 * app/screener/page.tsx — Phoenix Bot V.X × Adimology
 * Route: /screener
 *
 * Dua section:
 *   A1 — Top Oracle+Bandar Combined Picks
 *   B1 — Saham Tidur (pre-markup accumulation detector)
 */
import ScreenerClient from '@/app/components/ScreenerClient';
import '@/styles/bandar-flow.css';

export const metadata = {
  title:       'Phoenix Screener — Daily Picks & Saham Tidur',
  description: 'Top oracle+bandar picks dan pre-markup accumulation detector by Phoenix Bot V.X',
};

export default function ScreenerPage() {
  return (
    <div className="flow-page">
      <div className="flow-page-title">
        🔭 Phoenix Screener
        <span style={{ fontSize: '0.75rem', fontWeight: 400, opacity: 0.6 }}>
          Daily Picks · Saham Tidur
        </span>
      </div>
      <ScreenerClient />
    </div>
  );
}
