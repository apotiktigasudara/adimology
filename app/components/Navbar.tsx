'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TokenStatusIndicator from './TokenStatusIndicator';
import JobStatusIndicator from './JobStatusIndicator';
import StockbitFetchingIndicator from './StockbitFetchingIndicator';
import ThemeToggle from './ThemeToggle';
import PasswordSettingModal from './PasswordSettingModal';
import { Github, Menu, X, Shield } from 'lucide-react';

const Navbar = () => {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isAnalitikOpen, setIsAnalitikOpen] = useState(false);
  const [isTriggersOpen, setIsTriggersOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const closeAllDropdowns = () => { setIsAnalitikOpen(false); setIsTriggersOpen(false); };

  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        closeAllDropdowns();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <nav className="navbar" ref={navRef}>
      <div className="navbar-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="navbar-logo-icon" style={{ background: 'transparent', display: 'flex', alignItems: 'center' }}>
            <img src="/phoenix-logo.png" alt="PheonixOfIDX" width={42} height={42} style={{ objectFit: 'contain', borderRadius: '6px' }} />
          </div>
          <div className="navbar-content">
            <h1 className="navbar-title">PheonixOfIDX</h1>
            <p className="navbar-subtitle">Analyze stock targets based on broker summary</p>
          </div>
        </div>

        {/* Desktop View */}
        <div className="nav-desktop-actions">
          <div className="nav-links">
            <Link 
              href="/" 
              style={{
                textDecoration: 'none',
                color: pathname === '/' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname === '/' ? 600 : 400,
                fontSize: '0.9rem',
                borderBottom: pathname === '/' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                paddingBottom: '2px',
                transition: 'all 0.2s'
              }}
            >
              Calculator
            </Link>
            <Link 
              href="/history" 
              style={{
                textDecoration: 'none',
                color: pathname === '/history' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname === '/history' ? 600 : 400,
                fontSize: '0.9rem',
                borderBottom: pathname === '/history' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                paddingBottom: '2px',
                transition: 'all 0.2s'
              }}
            >
              History
            </Link>
            <Link
              href="/summary"
              style={{
                textDecoration: 'none',
                color: pathname === '/summary' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname === '/summary' ? 600 : 400,
                fontSize: '0.9rem',
                borderBottom: pathname === '/summary' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                paddingBottom: '2px',
                transition: 'all 0.2s'
              }}
            >
              Summary
            </Link>
            <Link
              href="/flow"
              style={{
                textDecoration: 'none',
                color: pathname === '/flow' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname === '/flow' ? 600 : 400,
                fontSize: '0.9rem',
                borderBottom: pathname === '/flow' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                paddingBottom: '2px',
                transition: 'all 0.2s'
              }}
            >
              Flow
            </Link>
            <Link
              href="/screener"
              style={{
                textDecoration: 'none',
                color: pathname === '/screener' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname === '/screener' ? 600 : 400,
                fontSize: '0.9rem',
                borderBottom: pathname === '/screener' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                paddingBottom: '2px',
                transition: 'all 0.2s'
              }}
            >
              Screener
            </Link>
            <div style={{ position: 'relative', display: 'inline-block' }} className="nav-dropdown-wrapper">
              <button
                onClick={() => { setIsAnalitikOpen(v => !v); setIsTriggersOpen(false); }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: ['/confluence','/heatmap','/alerts','/backtest'].some(p => pathname === p)
                    ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: ['/confluence','/heatmap','/alerts','/backtest'].some(p => pathname === p) ? 600 : 400,
                  fontSize: '0.9rem',
                  borderBottom: ['/confluence','/heatmap','/alerts','/backtest'].some(p => pathname === p)
                    ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  paddingBottom: '2px',
                }}
              >
                Analitik {isAnalitikOpen ? '▴' : '▾'}
              </button>
              {isAnalitikOpen && (
                <div className="nav-dropdown" style={{ display: 'flex' }}>
                  <Link href="/confluence"  className="nav-dropdown-item" onClick={closeAllDropdowns}>🎯 Confluence</Link>
                  <Link href="/heatmap"     className="nav-dropdown-item" onClick={closeAllDropdowns}>🔥 Sector Heatmap</Link>
                  <Link href="/alerts"      className="nav-dropdown-item" onClick={closeAllDropdowns}>🚨 Alert Center</Link>
                  <Link href="/backtest"    className="nav-dropdown-item" onClick={closeAllDropdowns}>📈 Backtest Mini</Link>
                </div>
              )}
            </div>
            <div style={{ position: 'relative', display: 'inline-block' }} className="nav-dropdown-wrapper">
              <button
                onClick={() => { setIsTriggersOpen(v => !v); setIsAnalitikOpen(false); }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: pathname.startsWith('/triggers') ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: pathname.startsWith('/triggers') ? 600 : 400,
                  fontSize: '0.9rem',
                  borderBottom: pathname.startsWith('/triggers') ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  paddingBottom: '2px',
                }}
              >
                Triggers {isTriggersOpen ? '▴' : '▾'}
              </button>
              {isTriggersOpen && (
                <div className="nav-dropdown" style={{ display: 'flex' }}>
                  <Link href="/triggers" className="nav-dropdown-item" onClick={closeAllDropdowns}>📡 Signal Feed</Link>
                  <Link href="/triggers/smkalkulator" className="nav-dropdown-item" onClick={closeAllDropdowns}>💰 SM Kalkulator</Link>
                  <Link href="/triggers/mfkalkulator" className="nav-dropdown-item" onClick={closeAllDropdowns}>📊 MF Kalkulator</Link>
                  <Link href="/triggers/algo" className="nav-dropdown-item" onClick={closeAllDropdowns}>🤖 Algo Signals</Link>
                  <Link href="/triggers/smrolling" className="nav-dropdown-item" onClick={closeAllDropdowns}>📊 SM Rolling</Link>
                </div>
              )}
            </div>
            <a
              href="https://github.com/apotiktigasudara/Pheonix" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                color: 'var(--text-secondary)',
                transition: 'color 0.2s',
                paddingBottom: '2px',
              }}
              className="github-link"
              title="View on GitHub"
            >
              <Github size={20} />
            </a>
          </div>
          <div className="nav-status-group">
            <StockbitFetchingIndicator />
            <JobStatusIndicator />
            <TokenStatusIndicator />
            <ThemeToggle />
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="theme-toggle-btn"
              title="Password Protection"
              style={{ 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border-color)', 
                color: 'var(--text-primary)', 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '12px', 
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Shield size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Mobile Toggle Button */}
        <button className="nav-mobile-toggle" onClick={toggleMenu} aria-label="Toggle menu">
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Mobile Menu */}
        <div className={`nav-mobile-menu ${isMenuOpen ? 'open' : ''}`}>
          <div className="nav-links">
            <Link 
              href="/" 
              onClick={() => setIsMenuOpen(false)}
              style={{
                textDecoration: 'none',
                color: pathname === '/' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname === '/' ? 600 : 400,
                fontSize: '1rem',
                padding: '0.5rem 0',
                transition: 'all 0.2s'
              }}
            >
              Calculator
            </Link>
            <Link 
              href="/history" 
              onClick={() => setIsMenuOpen(false)}
              style={{
                textDecoration: 'none',
                color: pathname === '/history' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname === '/history' ? 600 : 400,
                fontSize: '1rem',
                padding: '0.5rem 0',
                transition: 'all 0.2s'
              }}
            >
              History
            </Link>
            <Link 
              href="/summary" 
              onClick={() => setIsMenuOpen(false)}
              style={{
                textDecoration: 'none',
                color: pathname === '/summary' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname === '/summary' ? 600 : 400,
                fontSize: '1rem',
                padding: '0.5rem 0',
                transition: 'all 0.2s'
              }}
            >
              Summary
            </Link>
            <Link
              href="/flow"
              onClick={() => setIsMenuOpen(false)}
              style={{
                textDecoration: 'none',
                color: pathname === '/flow' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname === '/flow' ? 600 : 400,
                fontSize: '1rem',
                padding: '0.5rem 0',
                transition: 'all 0.2s'
              }}
            >
              Flow
            </Link>
            <Link
              href="/screener"
              onClick={() => setIsMenuOpen(false)}
              style={{
                textDecoration: 'none',
                color: pathname === '/screener' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname === '/screener' ? 600 : 400,
                fontSize: '1rem',
                padding: '0.5rem 0',
                transition: 'all 0.2s'
              }}
            >
              🔭 Screener
            </Link>
            <Link
              href="/triggers"
              onClick={() => setIsMenuOpen(false)}
              style={{
                textDecoration: 'none',
                color: pathname === '/triggers' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname === '/triggers' ? 600 : 400,
                fontSize: '1rem',
                padding: '0.5rem 0',
                transition: 'all 0.2s'
              }}
            >
              Triggers
            </Link>
            <Link
              href="/confluence"
              onClick={() => setIsMenuOpen(false)}
              style={{
                textDecoration: 'none',
                color: pathname === '/confluence' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname === '/confluence' ? 600 : 400,
                fontSize: '1rem',
                padding: '0.5rem 0',
                transition: 'all 0.2s'
              }}
            >
              🎯 Confluence
            </Link>
            <Link
              href="/heatmap"
              onClick={() => setIsMenuOpen(false)}
              style={{
                textDecoration: 'none',
                color: pathname === '/heatmap' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname === '/heatmap' ? 600 : 400,
                fontSize: '1rem',
                padding: '0.5rem 0',
                transition: 'all 0.2s'
              }}
            >
              🔥 Heatmap
            </Link>
            <Link
              href="/alerts"
              onClick={() => setIsMenuOpen(false)}
              style={{
                textDecoration: 'none',
                color: pathname === '/alerts' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname === '/alerts' ? 600 : 400,
                fontSize: '1rem',
                padding: '0.5rem 0',
                transition: 'all 0.2s'
              }}
            >
              🚨 Alerts
            </Link>
            <Link
              href="/backtest"
              onClick={() => setIsMenuOpen(false)}
              style={{
                textDecoration: 'none',
                color: pathname === '/backtest' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: pathname === '/backtest' ? 600 : 400,
                fontSize: '1rem',
                padding: '0.5rem 0',
                transition: 'all 0.2s'
              }}
            >
              📈 Backtest
            </Link>
            <a
              href="https://github.com/apotiktigasudara/Pheonix"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: 'var(--text-secondary)',
                fontSize: '1rem',
                padding: '0.5rem 0',
              }}
            >
              <Github size={20} /> View on GitHub
            </a>
          </div>
          <div className="nav-status-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Job Status</span>
              <JobStatusIndicator />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Stockbit Token</span>
              <TokenStatusIndicator />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Theme</span>
              <ThemeToggle />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Password</span>
              <button
                onClick={() => { setIsPasswordModalOpen(true); setIsMenuOpen(false); }}
                style={{ 
                  background: 'var(--bg-card)', 
                  border: '1px solid var(--border-color)', 
                  color: 'var(--text-primary)', 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px'
                }}
              >
                <Shield size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <PasswordSettingModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />
    </nav>
  );
};

export default Navbar;