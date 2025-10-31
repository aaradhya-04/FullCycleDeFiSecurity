import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { ethers } from 'ethers'

const SERVER = 'http://localhost:4000'
const HOST_ACCOUNT = '0xc03cC503B53FE35c31aeE396a54d84A67C3CC308'

interface Prediction {
  teamName: string
  currentPrice: number
  predictedPrice: number
  confidence: number
  trend: string
  recommendation: string
  riskLevel: string
  factors: {
    performance: number
    momentum: number
    recentWins: number
  }
}

export default function F1StockMarket({ account }: { account: string | null }) {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [buyAmount, setBuyAmount] = useState('0.1')
  const [sellAmount, setSellAmount] = useState('1')

  useEffect(() => {
    loadPredictions()
  }, [])

  async function loadPredictions() {
    setLoading(true)
    try {
      const { data } = await axios.get(`${SERVER}/f1/predictions`)
      setPredictions(data.predictions || [])
    } catch (e) {
      console.error('Failed to load predictions:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleBuyStock(teamName: string) {
    if (!account) {
      alert('Please connect MetaMask first')
      return
    }

    setLoading(true)
    try {
      const amount = buyAmount || '5'
      
      // Call backend to simulate transfer
      const { data } = await axios.post(`${SERVER}/f1/buy-stock`, {
        userAddress: account,
        teamName,
        amount
      })

      alert(`✅ ${data.message}\n\nTransaction: ${JSON.stringify(data.transaction, null, 2)}`)
      
      // In production, you would interact with the smart contract here
      // const contract = new ethers.Contract(contractAddress, abi, signer)
      // await contract.buyStock(teamName, { value: ethers.parseEther(amount) })
    } catch (e: any) {
      alert(`Error: ${e.message || 'Buy failed'}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleSellStock(teamName: string) {
    if (!account) {
      alert('Please connect MetaMask first')
      return
    }

    setLoading(true)
    try {
      const { data } = await axios.post(`${SERVER}/f1/sell-stock`, {
        userAddress: account,
        teamName,
        amount: sellAmount
      })

      alert(`✅ ${data.message}\n\nTransaction: ${JSON.stringify(data.transaction, null, 2)}`)
    } catch (e: any) {
      alert(`Error: ${e.message || 'Sell failed'}`)
    } finally {
      setLoading(false)
    }
  }

  function getRecommendationColor(recommendation: string) {
    return recommendation === 'BUY' ? '#2ecc40' : '#ff4136'
  }

  function getRiskColor(risk: string) {
    if (risk === 'LOW') return '#2ecc40'
    if (risk === 'MEDIUM') return '#ffdc00'
    return '#ff4136'
  }

  return (
    <div className="f1-stock-market">
      <div className="market-header">
        <h2>🏎️ F1 Team Stock Market</h2>
        <p className="section-desc">AI-Powered Stock Predictions based on Past Race Performance</p>
        <button className="btn-action" onClick={loadPredictions} disabled={loading}>
          🔄 Refresh Predictions
        </button>
      </div>

      <div className="stock-grid">
        {predictions.map((pred) => (
          <div key={pred.teamName} className="stock-card glass-panel">
            <div className="stock-header">
              <h3>{pred.teamName}</h3>
              <span 
                className="recommendation-badge"
                style={{ backgroundColor: getRecommendationColor(pred.recommendation) }}
              >
                {pred.recommendation}
              </span>
            </div>

            <div className="stock-info">
              <div className="price-info">
                <div>
                  <span className="label">Current:</span>
                  <span className="value">{pred.currentPrice.toFixed(4)} ETH</span>
                </div>
                <div>
                  <span className="label">Predicted:</span>
                  <span className="value highlight">{pred.predictedPrice.toFixed(4)} ETH</span>
                </div>
                <div className="trend" style={{ color: pred.trend === 'upward' ? '#2ecc40' : '#ff4136' }}>
                  {pred.trend === 'upward' ? '📈' : '📉'} {pred.trend.toUpperCase()}
                </div>
              </div>

              <div className="prediction-metrics">
                <div className="metric">
                  <span className="metric-label">Confidence</span>
                  <span className="metric-value">{pred.confidence.toFixed(0)}%</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Risk</span>
                  <span 
                    className="metric-value"
                    style={{ color: getRiskColor(pred.riskLevel) }}
                  >
                    {pred.riskLevel}
                  </span>
                </div>
              </div>

              <div className="factors">
                <div>Performance: +{pred.factors.performance.toFixed(1)}%</div>
                <div>Momentum: {pred.factors.momentum > 0 ? '+' : ''}{pred.factors.momentum.toFixed(1)}%</div>
                <div>Recent Wins: {pred.factors.recentWins}</div>
              </div>

              <div className="stock-actions">
                <div className="action-group">
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="ETH amount"
                    className="amount-input"
                  />
                  <button
                    className="btn-buy"
                    onClick={() => handleBuyStock(pred.teamName)}
                    disabled={loading || !account}
                  >
                    💰 Buy Stock
                  </button>
                </div>
                <div className="action-group">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="Stock amount"
                    className="amount-input"
                  />
                  <button
                    className="btn-sell"
                    onClick={() => handleSellStock(pred.teamName)}
                    disabled={loading || !account}
                  >
                    💸 Sell Stock
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="market-footer glass-panel">
        <div className="footer-info">
          <p><strong>Host Account:</strong> {HOST_ACCOUNT}</p>
          <p>When you buy stocks, 5 ETH is transferred to the host account. When you sell, you receive ETH from the host account.</p>
        </div>
      </div>
    </div>
  )
}

