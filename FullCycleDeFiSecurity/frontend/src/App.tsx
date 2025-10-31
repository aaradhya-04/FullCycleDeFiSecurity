import React, { useEffect, useMemo, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { ethers } from 'ethers'
import Home from './pages/Home'
import SecurityAudit from './pages/SecurityAudit'
import StockMarket from './pages/StockMarket'
import './styles.css'

export default function App() {
  // Use BASE_URL from Vite config (automatically set based on base in vite.config.ts)
  // For local dev it will be '/', for GitHub Pages it will be '/FullCycleDeFiSecurity/'
  const basePath = import.meta.env.BASE_URL || '/'
  
  return (
    <Router basename={basePath} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent />
    </Router>
  )
}

function AppContent() {
  const [account, setAccount] = useState<string | null>(null)
  const location = useLocation()
  const connectedShort = useMemo(() =>
    account ? `${account.slice(0, 6)}...${account.slice(-4)}` : '', [account])

  useEffect(() => {
    if (!window.ethereum) return
    ;(async () => {
      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const accounts = await provider.listAccounts()
      if (accounts.length) setAccount(accounts[0].address)
    })()
  }, [])

  async function connect() {
    const provider = new ethers.BrowserProvider(window.ethereum as any)
    const accounts = await provider.send('eth_requestAccounts', [])
    setAccount(accounts[0])
  }

  const isHomePage = location.pathname === '/'

  return (
    <div className="app-container">
      <div className="video-background">
        <video 
          className="background-video" 
          autoPlay 
          loop 
          muted 
          playsInline
        >
          <source src={`${import.meta.env.BASE_URL}Formula_1.mp4`} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="video-fallback"></div>
        <div className="video-overlay"></div>
        <div className="video-brightness"></div>
      </div>

      <div className={isHomePage ? "wrap home-wrap" : "wrap"}>
        {!isHomePage && (
          <header className="glass-panel">
            <div className="header-content">
              <h1>🏎️ F1 DeFi Security Dashboard</h1>
              <p className="subtitle">Full-Cycle MEV Defense Ecosystem for Formula-1</p>
            </div>
            <button className="btn-primary" onClick={connect} disabled={!!account}>
              {account ? `🔗 Connected ${connectedShort}` : '🔌 Connect MetaMask'}
            </button>
          </header>
        )}

        {location.pathname !== '/' && (
          <nav className="main-nav glass-panel">
            <Link 
              to="/" 
              className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
            >
              🏠 Home
            </Link>
            <Link 
              to="/audit" 
              className={`nav-link ${location.pathname === '/audit' ? 'active' : ''}`}
            >
              🔒 Security Audit
            </Link>
            <Link 
              to="/stocks" 
              className={`nav-link ${location.pathname === '/stocks' ? 'active' : ''}`}
            >
              📈 Stock Market
            </Link>
          </nav>
        )}

        <main>
          <Routes>
            <Route index element={<Home />} />
            <Route path="/" element={<Home />} />
            <Route path="/audit" element={<SecurityAudit account={account} />} />
            <Route path="/stocks" element={<StockMarket account={account} />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

declare global {
  interface Window { ethereum?: any }
}
