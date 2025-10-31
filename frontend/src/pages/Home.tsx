import React from 'react'
import { useNavigate } from 'react-router-dom'
import '../styles.css'

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="home-page">
      {/* Hero Section */}
      <div className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <div className="brand-logo">
              <span className="logo-icon">🏎️</span>
              <h1 className="brand-name">
                FULL<span className="accent-red">C</span><span className="accent-yellow">Y</span><span className="accent-green">C</span>LE
                <br />
                <span className="brand-subtitle">DEFI SECURITY</span>
              </h1>
            </div>
            
            <div className="hero-slogan">
              <h2 className="slogan-main">Fix Contracts Faster Than Pitstops</h2>
              <p className="slogan-sub">
                Full-Cycle MEV Defense Ecosystem combining cutting-edge smart contract auditing 
                with real-time attack detection—making DeFi faster, safer, and more transparent.
              </p>
            </div>

            <div className="hero-actions">
              <button 
                className="cta-button primary"
                onClick={() => navigate('/audit')}
              >
                🔒 Security Audit
                <span className="arrow">→</span>
              </button>
              <button 
                className="cta-button secondary"
                onClick={() => navigate('/stocks')}
              >
                📈 Stock Market
                <span className="arrow">→</span>
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <div className="f1-car-silhouette">
              <div className="car-body"></div>
              <div className="racing-lines"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <div className="stat-number">99%+</div>
          <div className="stat-label">Security Score</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">&lt;2s</div>
          <div className="stat-label">Vulnerability Detection</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">0</div>
          <div className="stat-label">MEV Attacks Blocked</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">24/7</div>
          <div className="stat-label">Real-Time Monitoring</div>
        </div>
      </div>

      {/* Features Section */}
      <div className="features-section">
        <div className="feature-card">
          <div className="feature-icon">🛡️</div>
          <h3>Smart Contract Auditing</h3>
          <p>Comprehensive vulnerability scanning with automated fixes and detailed remediation guides</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">⚡</div>
          <h3>MEV Defense</h3>
          <p>Real-time front-running detection and Flashbots integration for protected transactions</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <h3>F1 Stock Market</h3>
          <p>AI-powered predictions and blockchain-based trading for Formula 1 team performance</p>
        </div>
      </div>
    </div>
  )
}

