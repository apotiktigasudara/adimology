'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Calculator from './components/Calculator';
import WatchlistSidebar from './components/WatchlistSidebar';
import HealthBar from './components/HealthBar';

function HomeContent() {
  const searchParams = useSearchParams();
  const symbol = searchParams.get('symbol');
  const [selectedStock, setSelectedStock] = useState<string | null>(null);

  useEffect(() => {
    if (symbol) {
      setSelectedStock(symbol.toUpperCase());
    }
  }, [symbol]);

  return (
    <div className="app-layout">
      <div className="app-main">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
          <HealthBar />
        </div>
        <Calculator selectedStock={selectedStock} />
      </div>
      <div className="app-sidebar">
        <WatchlistSidebar onSelect={setSelectedStock} />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="container p-4">Loading calculator...</div>}>
      <HomeContent />
    </Suspense>
  );
}
