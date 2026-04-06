'use client';

import { useState, useEffect } from 'react';
import { exportHistoryToPDF, exportHistoryByEmitenToPDF } from '@/lib/pdfExport';

interface AgentStory {
  id: number;
  emiten: string;
  status: string;
  kesimpulan?: string;
  matriks_story?: any[];
  swot_analysis?: any;
  checklist_katalis?: any[];
  strategi_trading?: any;
  keystat_signal?: string;
  created_at: string;
}

function AIStoryHistory() {
  const [stories, setStories] = useState<AgentStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/analyze-story?all=true')
      .then(r => r.json())
      .then(j => { setStories(j.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadDetail = (id: number) => {
    setExpanded(prev => prev === id ? null : id);
  };

  const filtered = filter ? stories.filter(s => s.emiten.includes(filter.toUpperCase())) : stories;

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })
      + ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input placeholder="Filter emiten..." value={filter}
          onChange={e => setFilter(e.target.value.toUpperCase())}
          style={{ padding: '0.35rem 0.65rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none' }}
          maxLength={6} />
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{filtered.length} analisa</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
          Belum ada riwayat AI Analisa
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {filtered.map(s => (
            <div key={s.id}>
              {/* Row */}
              <div onClick={() => loadDetail(s.id)} style={{
                padding: '0.75rem 1rem', background: 'var(--bg-card)', cursor: 'pointer',
                border: `1px solid ${expanded === s.id ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                borderRadius: expanded === s.id ? '10px 10px 0 0' : '10px',
                display: 'grid', gridTemplateColumns: '80px 130px 1fr 24px', gap: '0.75rem', alignItems: 'center',
                transition: 'border-color 0.2s',
              }}>
                <span style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '0.9rem' }}>{s.emiten}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{fmtDate(s.created_at)}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.kesimpulan || '—'}
                </span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{expanded === s.id ? '▲' : '▼'}</span>
              </div>

              {/* Expanded detail */}
              {expanded === s.id && (
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--accent-primary)', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.82rem' }}>
                    {/* Kesimpulan */}
                    {s.kesimpulan && (
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '0.25rem' }}>Kesimpulan</div>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.kesimpulan}</div>
                      </div>
                    )}
                    {/* Keystat signal */}
                    {s.keystat_signal && (
                      <div>
                        <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '0.25rem' }}>Key Statistics Signal</div>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.keystat_signal}</div>
                      </div>
                    )}
                    {/* SWOT */}
                    {s.swot_analysis && (
                      <div>
                        <div style={{ fontWeight: 700, color: '#38ef7d', marginBottom: '0.4rem' }}>SWOT Analysis</div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          {(['strengths','weaknesses','opportunities','threats'] as const).map(k => (
                            <div key={k} style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: k === 'strengths' || k === 'opportunities' ? '#38ef7d' : '#f5576c', marginBottom: '0.25rem', textTransform: 'uppercase' }}>{k}</div>
                              {(s.swot_analysis[k] || []).map((item: string, i: number) => (
                                <div key={i} style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginBottom: '0.2rem' }}>• {item}</div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Strategi */}
                    {s.strategi_trading && (
                      <div>
                        <div style={{ fontWeight: 700, color: '#a78bfa', marginBottom: '0.25rem' }}>Strategi Trading</div>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          {s.strategi_trading.tipe_saham && <div>Tipe: <b>{s.strategi_trading.tipe_saham}</b></div>}
                          {s.strategi_trading.target_entry && <div>Entry: <b>{s.strategi_trading.target_entry}</b></div>}
                          {s.strategi_trading.exit_strategy?.take_profit && <div style={{ color: '#38ef7d' }}>TP: {s.strategi_trading.exit_strategy.take_profit}</div>}
                          {s.strategi_trading.exit_strategy?.stop_loss && <div style={{ color: '#f5576c' }}>SL: {s.strategi_trading.exit_strategy.stop_loss}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AnalysisRecord {
  id: number;
  from_date: string;
  emiten: string;
  sector?: string;
  bandar?: string;
  barang_bandar?: number;
  rata_rata_bandar?: number;
  harga?: number;
  ara?: number;       // maps to offer_teratas
  arb?: number;       // maps to bid_terbawah
  target_realistis?: number;
  target_max?: number;
  real_harga?: number;
  max_harga?: number;
  status: string;
  error_message?: string;
}

export default function WatchlistHistoryTable() {
  const [activeTab, setActiveTab] = useState<'kalkulasi' | 'ai'>('kalkulasi');
  const [data, setData] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    emiten: '',
    sector: 'all',
    fromDate: '',
    toDate: '',
    status: 'all'
  });
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState({ column: 'from_date', direction: 'desc' });
  const [sectors, setSectors] = useState<string[]>([]);
  const [recordsPerEmiten, setRecordsPerEmiten] = useState(10);
  const pageSize = 50;

  useEffect(() => {
    fetchSectors();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [filters, page, sort]);

  const fetchSectors = async () => {
    try {
      const response = await fetch('/api/sectors');
      const json = await response.json();
      if (json.success) {
        setSectors(json.data || []);
      }
    } catch (error) {
      console.error('Error fetching sectors:', error);
    }
  };

  // Debounced fetch for text inputs could be added, but manual trigger or loose effect is fine for now

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: (page * pageSize).toString(),
      });

      if (filters.emiten) params.append('emiten', filters.emiten);
      if (filters.sector !== 'all') params.append('sector', filters.sector);
      if (filters.fromDate) params.append('fromDate', filters.fromDate);
      if (filters.toDate) params.append('toDate', filters.toDate);
      if (filters.status !== 'all') params.append('status', filters.status);
      params.append('sortBy', sort.column);
      params.append('sortOrder', sort.direction);

      const response = await fetch(`/api/watchlist-history?${params}`);
      const json = await response.json();

      if (json.success) {
        setData(json.data || []);
        setTotalCount(json.count || 0);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num?: number) => num?.toLocaleString() ?? '-';
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    // Handle YYYY-MM-DD format
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }).replace(' ', '-');
  };

  const calculateGain = (price: number | undefined, target: number | undefined) => {
    if (!price || !target || price === 0) return null;
    const gain = ((target - price) / price) * 100;
    return `${gain >= 0 ? '+' : ''}${gain.toFixed(1)}%`;
  };

  return (
    <div className="glass-card-static">
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        {([['kalkulasi', '📊 Riwayat Kalkulasi'], ['ai', '🤖 Riwayat AI Analisa']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid',
            borderColor: activeTab === key ? 'var(--accent-primary)' : 'var(--border-color)',
            background: activeTab === key ? 'rgba(100,149,237,0.15)' : 'var(--bg-card)',
            color: activeTab === key ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: activeTab === key ? 600 : 400, fontSize: '0.82rem', cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>

      {activeTab === 'ai' && <AIStoryHistory />}
      {activeTab === 'kalkulasi' && <>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>📊 Watchlist Analysis History</h2>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button
            className="solid-btn"
            onClick={fetchHistory}
            style={{ 
              padding: '0 1.25rem', 
              fontSize: '0.8rem',
              fontWeight: '700',
              borderRadius: '8px',
              background: '#4b5563', // Solid Gray 600
              color: 'white',
              border: '1px solid #4b5563',
              cursor: 'pointer',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(75, 85, 99, 0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Refresh
          </button>
          
          <button
            className="solid-btn"
            onClick={() => exportHistoryToPDF(data, filters)}
            style={{
              padding: '0 1.25rem',
              fontSize: '0.8rem',
              fontWeight: '700',
              borderRadius: '8px',
              background: '#059669', // Emerald 600
              color: 'white',
              border: '1px solid #059669',
              boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap',
              height: '38px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
            disabled={data.length === 0}
          >
            📄 Filtered PDF
          </button>

          <div style={{ 
            display: 'flex', 
            gap: '0', 
            alignItems: 'center', 
            background: 'var(--bg-secondary)', 
            padding: '2px', 
            borderRadius: '10px', 
            border: '1px solid var(--border-color)',
            height: '38px',
            boxSizing: 'border-box'
          }}>
            <select
              className="input-field compact-input"
              value={recordsPerEmiten}
              onChange={(e) => setRecordsPerEmiten(Number(e.target.value))}
              style={{
                padding: '0 0.6rem',
                fontSize: '0.85rem',
                fontWeight: '700',
                minWidth: '55px',
                marginBottom: 0,
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                height: '100%'
              }}
            >
              <option value={5} style={{ background: '#1a1a2e', color: 'white' }}>5</option>
              <option value={10} style={{ background: '#1a1a2e', color: 'white' }}>10</option>
              <option value={20} style={{ background: '#1a1a2e', color: 'white' }}>20</option>
            </select>
            <div style={{ width: '1px', height: '18px', background: 'var(--border-color)', margin: '0 4px' }}></div>
            <button
              className="solid-btn"
              onClick={() => exportHistoryByEmitenToPDF(data, filters, recordsPerEmiten)}
              style={{
                padding: '0 1rem',
                fontSize: '0.8rem',
                fontWeight: '700',
                background: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                height: '32px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginRight: '2px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
              disabled={data.length === 0}
            >
              <span>📄 All Per Emiten PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="input-group" style={{ flex: '1 1 150px', marginBottom: 0 }}>
          <label className="input-label compact-label">Emiten</label>
          <input
            type="text"
            className="input-field compact-input"
            placeholder="e.g., BBCA"
            value={filters.emiten}
            onChange={(e) => {
              setFilters({ ...filters, emiten: e.target.value.toUpperCase() });
              setPage(0); // Reset page on filter change
            }}
          />
        </div>

        <div className="input-group" style={{ flex: '1 1 150px', marginBottom: 0 }}>
          <label className="input-label compact-label">From Date</label>
          <input
            type="date"
            className="input-field compact-input"
            value={filters.fromDate}
            onChange={(e) => {
              setFilters({ ...filters, fromDate: e.target.value });
              setPage(0);
            }}
            onClick={(e) => e.currentTarget.showPicker()}
          />
        </div>

        <div className="input-group" style={{ flex: '1 1 150px', marginBottom: 0 }}>
          <label className="input-label compact-label">To Date</label>
          <input
            type="date"
            className="input-field compact-input"
            value={filters.toDate}
            onChange={(e) => {
              setFilters({ ...filters, toDate: e.target.value });
              setPage(0);
            }}
            onClick={(e) => e.currentTarget.showPicker()}
          />
        </div>

        <div className="input-group" style={{ flex: '1 1 120px', marginBottom: 0 }}>
          <label className="input-label compact-label">Status</label>
          <select
            className="input-field compact-input"
            value={filters.status}
            onChange={(e) => {
              setFilters({ ...filters, status: e.target.value });
              setPage(0);
            }}
          >
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div className="input-group" style={{ flex: '1 1 150px', marginBottom: 0 }}>
          <label className="input-label compact-label">Sector</label>
          <select
            className="input-field compact-input"
            value={filters.sector}
            onChange={(e) => {
              setFilters({ ...filters, sector: e.target.value });
              setPage(0);
            }}
          >
            <option value="all">All Sectors</option>
            {sectors.map(sector => (
              <option key={sector} value={sector}>{sector}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto' }}></div>
        </div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: '12px' }}>
          No data found matching your filters
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead style={{ background: 'var(--bg-secondary)' }}>
                <tr>
                  <th
                    style={{ whiteSpace: 'nowrap', padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => {
                      const direction = sort.column === 'from_date' && sort.direction === 'desc' ? 'asc' : 'desc';
                      setSort({ column: 'from_date', direction });
                    }}
                  >
                    Date {sort.column === 'from_date' ? (sort.direction === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th
                    style={{ whiteSpace: 'nowrap', padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => {
                      const direction = sort.column === 'emiten' && sort.direction === 'asc' ? 'desc' : 'asc';
                      setSort({ column: 'emiten', direction });
                    }}
                  >
                    Emiten {sort.column === 'emiten' ? (sort.direction === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Harga</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Target R1</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Target Max</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Max Harga</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Close Harga</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Bandar</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Vol Bandar</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Avg Bandar</th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((record, index) => (
                  <tr
                    key={record.id}
                    style={{
                      borderBottom: index < data.length - 1 ? '1px solid var(--border-color)' : 'none',
                      background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'
                    }}
                  >
                    <td style={{ padding: '0.75rem 1rem' }}>{formatDate(record.from_date)}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{record.emiten}</div>
                      {record.sector && (
                        <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '2px' }}>
                          {record.sector}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '0.95rem' }}>
                      {formatNumber(record.harga)}
                    </td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '0.95rem', color: 'var(--accent-success)' }}>
                        {formatNumber(record.target_realistis)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {calculateGain(record.harga, record.target_realistis)}
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '0.95rem', color: 'var(--accent-warning)' }}>
                        {formatNumber(record.target_max)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {calculateGain(record.harga, record.target_max)}
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                      {record.max_harga ? (
                        <>
                          <div style={{
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: '0.95rem',
                            color: record.target_max && record.max_harga >= record.target_max
                              ? 'var(--accent-warning)'
                              : (record.target_realistis && record.max_harga >= record.target_realistis
                                ? 'var(--accent-success)'
                                : (record.harga && record.max_harga > record.harga
                                  ? '#F59E0B'
                                  : 'var(--text-primary)'))
                          }}>
                            {formatNumber(record.max_harga)}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {calculateGain(record.harga, record.max_harga)}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                      {record.real_harga ? (
                        <>
                          <div style={{
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: '0.95rem',
                            color: record.target_max && record.real_harga >= record.target_max
                              ? 'var(--accent-warning)'
                              : (record.target_realistis && record.real_harga >= record.target_realistis
                                ? 'var(--accent-success)'
                                : (record.harga && record.real_harga > record.harga
                                  ? '#F59E0B'
                                  : 'var(--text-primary)'))
                          }}>
                            {formatNumber(record.real_harga)}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {calculateGain(record.harga, record.real_harga)}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>{record.bandar || '-'}</td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.9rem' }}>
                      {formatNumber(record.barang_bandar)}
                    </td>
                    <td style={{ padding: '0.5rem 1rem', textAlign: 'right', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: '0.95rem' }}>
                        {formatNumber(record.rata_rata_bandar)}
                      </div>
                      {record.rata_rata_bandar && record.harga && record.rata_rata_bandar < record.harga && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {calculateGain(record.rata_rata_bandar, record.harga)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      {record.status === 'success' ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'rgba(56, 239, 125, 0.1)',
                          color: 'var(--accent-success)'
                        }}>
                          ✓
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: 'rgba(245, 87, 108, 0.1)',
                            color: 'var(--accent-warning)',
                            cursor: 'pointer'
                          }}
                          title={record.error_message}
                        >
                          ✕
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} records
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: page === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                  padding: '0.5rem 1rem'
                }}
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <button
                className="btn"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: (page + 1) * pageSize >= totalCount ? 'var(--text-muted)' : 'var(--text-primary)',
                  padding: '0.5rem 1rem'
                }}
                disabled={(page + 1) * pageSize >= totalCount}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
      </>}
    </div>
  );
}
