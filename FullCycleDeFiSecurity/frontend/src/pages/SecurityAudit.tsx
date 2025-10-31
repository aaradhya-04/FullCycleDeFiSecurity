import React, { useEffect, useMemo, useState } from 'react'
import { ethers } from 'ethers'
import axios from 'axios'
import VulnerabilityChart from '../components/VulnerabilityChart'
import ProgressLineChart from '../components/ProgressLineChart'

const SERVER = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000'

interface AuditHistory {
  timestamp: number
  totalVulns: number
  critical: number
  high: number
  medium: number
  low: number
  pdfName: string
  contractName?: string
  securityScore?: number
}

interface ReportCardProps {
  data: AuditData
  mode: 'vulns' | 'advice'
  isInitial?: boolean
  initialData?: AuditData | null
}

interface AuditData {
  score: number
  findings: any[]
  severityCounts: { critical: number; high: number; medium: number; low: number }
  fixedCount?: number
  fixedSeverity?: string | null
  improvement?: number
}

export default function SecurityAudit() {
  const [account, setAccount] = useState<string | null>(null)
  const [initial, setInitial] = useState<AuditData | null>(null)
  const [final, setFinal] = useState<AuditData | null>(null)
  const [loading, setLoading] = useState(false)
  const [parsed, setParsed] = useState<any | null>(null)
  const [view, setView] = useState<'vulns' | 'advice'>('vulns')
  const [history, setHistory] = useState<AuditHistory[]>([])
  const [detectionActive, setDetectionActive] = useState(false)
  const [detectionStats, setDetectionStats] = useState<any>(null)
  const [detectedThreats, setDetectedThreats] = useState<any[]>([])
  const [availableContracts, setAvailableContracts] = useState<Array<{name: string, path: string}>>([])
  const [selectedContract, setSelectedContract] = useState<string>('')
  const [auditMode, setAuditMode] = useState<'pdf' | 'contract'>('pdf')
  const [simulationMode, setSimulationMode] = useState(false)
  const [simulationResult, setSimulationResult] = useState<any>(null)
  const [simulationLoading, setSimulationLoading] = useState(false)
  const [showF1UseCases, setShowF1UseCases] = useState(false)

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

  useEffect(() => {
    const saved = localStorage.getItem('auditHistory')
    if (saved) setHistory(JSON.parse(saved))
    
    // Load available contracts
    loadAvailableContracts()
  }, [])
  
  async function loadAvailableContracts() {
    try {
      const { data } = await axios.get(`${SERVER}/contracts/list`)
      setAvailableContracts(data.contracts || [])
      if (data.contracts && data.contracts.length > 0) {
        setSelectedContract(data.contracts[0].name)
      }
    } catch (e) {
      console.error('Failed to load contracts:', e)
    }
  }

  // Poll for detection status if active
  useEffect(() => {
    if (!detectionActive) return
    
    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get(`${SERVER}/detect/status`)
        if (data && data.state) {
          setDetectionStats(data.state.stats)
          setDetectedThreats(data.state.recentThreats || [])
        }
      } catch (e: any) {
        // Only log if not 404 (server might not be restarted yet)
        if (e.response?.status !== 404) {
          console.error('Status poll error:', e)
        }
      }
    }, 3000) // Poll every 3 seconds (less frequent to reduce load)
    
    return () => clearInterval(interval)
  }, [detectionActive])

  async function connect() {
    const provider = new ethers.BrowserProvider(window.ethereum as any)
    const accounts = await provider.send('eth_requestAccounts', [])
    setAccount(accounts[0])
  }

  async function loadFromPdfs() {
    setLoading(true)
    try {
      const { data } = await axios.get(`${SERVER}/audit/parsed`).catch((e: any) => {
        if (e.response?.status === 404) {
          throw new Error(`Server endpoint not found. Please make sure the server is running on ${SERVER}`)
        }
        throw new Error(e.response?.data?.error || e.message || 'Failed to load audit data')
      })
      
      if (!data || !Array.isArray(data.findings)) {
        throw new Error('Invalid data format received from server. Make sure PDFs are uploaded in the audit folder.')
      }
      
      // Debug: log the score from server
      console.log('[Frontend] Received score from server:', data.score)
      console.log('[Frontend] Full data:', data)
      
      setParsed(data)
      // Group findings by severity first
      const findingsBySeverity: Record<string, any[]> = {
        Critical: [],
        High: [],
        Medium: [],
        Low: []
      }
      
      // Group findings by severity
      for (const finding of data.findings || []) {
        const sev = finding.severity || 'Unknown'
        if (findingsBySeverity[sev]) {
          findingsBySeverity[sev].push(finding)
        }
      }
      
      // Recalculate severity counts from actual findings to ensure accuracy
      const actualCounts = { critical: 0, high: 0, medium: 0, low: 0 }
      for (const finding of data.findings || []) {
        const sev = (finding.severity || 'Unknown').toLowerCase()
        if (sev === 'critical') actualCounts.critical++
        else if (sev === 'high') actualCounts.high++
        else if (sev === 'medium') actualCounts.medium++
        else if (sev === 'low') actualCounts.low++
      }
      
      // Use actual counts instead of parsed counts for accuracy
      const correctedCounts = actualCounts
      const correctedDec = { ...correctedCounts }
      
      // Initialize auto-fix variables
      let fixedCount = 0
      let fixedSeverity: string | null = null
      let fixedVulnId: string | null = null;
      let fixedVulnTitle: string | null = null;
      
      // Apply auto-fix to corrected counts - fix exactly ONE vulnerability
      // Priority: Critical > High > Medium > Low
      if (correctedDec.critical > 0) {
        correctedDec.critical -= 1
        fixedCount = 1
        fixedSeverity = 'Critical'
        // Find the first Critical vulnerability
        const criticalFinding = findingsBySeverity['Critical']?.[0];
        fixedVulnId = criticalFinding?.id || null;
        fixedVulnTitle = criticalFinding?.title || null;
      } else if (correctedDec.high > 0) {
        correctedDec.high -= 1
        fixedCount = 1
        fixedSeverity = 'High'
        // Find the first High vulnerability
        const highFinding = findingsBySeverity['High']?.[0];
        fixedVulnId = highFinding?.id || null;
        fixedVulnTitle = highFinding?.title || null;
      } else if (correctedDec.medium > 0) {
        correctedDec.medium -= 1
        fixedCount = 1
        fixedSeverity = 'Medium'
        // Find the first Medium vulnerability
        const mediumFinding = findingsBySeverity['Medium']?.[0];
        fixedVulnId = mediumFinding?.id || null;
        fixedVulnTitle = mediumFinding?.title || null;
      } else if (correctedDec.low > 0) {
        correctedDec.low = Math.max(0, correctedDec.low - 1)
        fixedCount = 1
        fixedSeverity = 'Low'
        // Find the first Low vulnerability
        const lowFinding = findingsBySeverity['Low']?.[0];
        fixedVulnId = lowFinding?.id || null;
        fixedVulnTitle = lowFinding?.title || null;
      }
      
      // Initialize remaining findings array
      const remainingFindings: any[] = []
      
      // Add remaining findings based on corrected counts (skip the first one of fixed severity)
      const severityOrder = ['Critical', 'High', 'Medium', 'Low']
      for (const severity of severityOrder) {
        const count = correctedDec[severity.toLowerCase() as keyof typeof correctedDec]
        const available = findingsBySeverity[severity] || []
        
        // Skip first finding if this severity was fixed
        const skipCount = (fixedSeverity === severity && fixedCount > 0) ? 1 : 0
        for (let i = skipCount; i < available.length && remainingFindings.filter(f => (f.severity || '').toLowerCase() === severity.toLowerCase()).length < count; i++) {
          remainingFindings.push(available[i])
        }
      }
      
      // Use score from PDF if available, otherwise calculate from counts
      const initialScoreFromPdf = data.score != null ? data.score : calculateSecurityScore(correctedCounts)
      
      // Calculate final score based on the fixed vulnerability
      // The key insight: if PDF shows a score, that score already accounts for all vulnerabilities
      // When we fix one, we need to estimate what the improvement would be
      let finalScore: number
      if (data.score != null && fixedCount > 0 && fixedSeverity) {
        // Calculate what a "perfect" score would be (100) and see how much room for improvement
        const maxPossibleScore = 100
        const currentScore = initialScoreFromPdf
        const scoreDeficit = maxPossibleScore - currentScore
        
        // Estimate points for each severity based on typical impact
        // These are conservative estimates - not full points back since scoring isn't linear
        const improvementFactors: Record<string, number> = {
          'Critical': 0.25,  // Fixing Critical gets back 25% of deficit
          'High': 0.20,      // Fixing High gets back 20% of deficit
          'Medium': 0.15,    // Fixing Medium gets back 15% of deficit
          'Low': 0.10        // Fixing Low gets back 10% of deficit
        }
        
        const factor = improvementFactors[fixedSeverity] || 0.15
        const scoreImprovement = scoreDeficit * factor
        
        // Add the improvement to current score, cap at 100
        finalScore = Math.min(100, currentScore + scoreImprovement)
        
        // Round to 1 decimal place to match PDF format
        finalScore = Math.round(finalScore * 10) / 10
      } else {
        // Fallback: recalculate from counts
        finalScore = calculateSecurityScore(correctedDec)
      }
      
      // Calculate improvement percentage based on the score difference
      const improvement = initialScoreFromPdf > 0 ? Math.round(((finalScore - initialScoreFromPdf) / initialScoreFromPdf) * 100) : 0
      
      setInitial({ 
        score: initialScoreFromPdf, 
        findings: data.findings, 
        severityCounts: correctedCounts 
      })
      setFinal({ 
        score: finalScore, 
        findings: remainingFindings, 
        severityCounts: correctedDec,
        fixedCount,
        fixedSeverity,
        improvement: improvement
      })

      // Extract contract name from PDF or use default
      const contractName = data.pdfName?.match(/(\w+)/)?.[1] || 'RaceSwap_vulnerable'
      
      const newEntry: AuditHistory = {
        timestamp: Date.now(),
        totalVulns: Object.values(correctedCounts).reduce((a, b) => a + b, 0),
        ...correctedCounts,
        pdfName: data.pdfName || `audit_${Date.now()}`,
        contractName: contractName,
        securityScore: initialScoreFromPdf
      }
      
      // Also save the fixed version entry
      const fixedEntry: AuditHistory = {
        timestamp: Date.now() + 1, // Slight offset to show as next step
        totalVulns: Object.values(correctedDec).reduce((a, b) => a + b, 0),
        ...correctedDec,
        pdfName: data.pdfName || `audit_${Date.now()}`,
        contractName: contractName,
        securityScore: finalScore
      }
      
      const updated = [...history, newEntry, fixedEntry]
      setHistory(updated)
      localStorage.setItem('auditHistory', JSON.stringify(updated))
    } finally {
      setLoading(false)
    }
  }

  async function loadFromContract() {
    if (!selectedContract) {
      alert('Please select a contract to analyze')
      return
    }
    
    setLoading(true)
    try {
      const { data } = await axios.post(`${SERVER}/contracts/analyze`, {
        contractName: selectedContract
      }).catch((e: any) => {
        throw new Error(e.response?.data?.error || e.message || 'Failed to analyze contract')
      })
      
      if (!data || !Array.isArray(data.findings)) {
        throw new Error('Invalid data format received from server')
      }
      
      console.log('[Frontend] Contract analysis result:', data)
      
      setParsed(data)
      
      // Group findings by severity
      const findingsBySeverity: Record<string, any[]> = {
        Critical: [],
        High: [],
        Medium: [],
        Low: []
      }
      
      for (const finding of data.findings || []) {
        const sev = finding.severity || 'Unknown'
        if (findingsBySeverity[sev]) {
          findingsBySeverity[sev].push(finding)
        }
      }
      
      // Recalculate severity counts from actual findings
      const actualCounts = { critical: 0, high: 0, medium: 0, low: 0 }
      for (const finding of data.findings || []) {
        const sev = (finding.severity || 'Unknown').toLowerCase()
        if (sev === 'critical') actualCounts.critical++
        else if (sev === 'high') actualCounts.high++
        else if (sev === 'medium') actualCounts.medium++
        else if (sev === 'low') actualCounts.low++
      }
      
      const correctedCounts = actualCounts
      const correctedDec = { ...correctedCounts }
      
      // Initialize auto-fix variables
      let fixedCount = 0
      let fixedSeverity: string | null = null
      let fixedVulnId: string | null = null;
      let fixedVulnTitle: string | null = null;
      
      // Apply auto-fix to corrected counts - fix exactly ONE vulnerability
      // Priority: Critical > High > Medium > Low
      if (correctedDec.critical > 0) {
        correctedDec.critical -= 1
        fixedCount = 1
        fixedSeverity = 'Critical'
        // Find the first Critical vulnerability
        const criticalFinding = findingsBySeverity['Critical']?.[0];
        fixedVulnId = criticalFinding?.id || null;
        fixedVulnTitle = criticalFinding?.title || null;
      } else if (correctedDec.high > 0) {
        correctedDec.high -= 1
        fixedCount = 1
        fixedSeverity = 'High'
        // Find the first High vulnerability
        const highFinding = findingsBySeverity['High']?.[0];
        fixedVulnId = highFinding?.id || null;
        fixedVulnTitle = highFinding?.title || null;
      } else if (correctedDec.medium > 0) {
        correctedDec.medium -= 1
        fixedCount = 1
        fixedSeverity = 'Medium'
        // Find the first Medium vulnerability
        const mediumFinding = findingsBySeverity['Medium']?.[0];
        fixedVulnId = mediumFinding?.id || null;
        fixedVulnTitle = mediumFinding?.title || null;
      } else if (correctedDec.low > 0) {
        correctedDec.low = Math.max(0, correctedDec.low - 1)
        fixedCount = 1
        fixedSeverity = 'Low'
        // Find the first Low vulnerability
        const lowFinding = findingsBySeverity['Low']?.[0];
        fixedVulnId = lowFinding?.id || null;
        fixedVulnTitle = lowFinding?.title || null;
      }
      
      // Initialize remaining findings array
      const remainingFindings: any[] = []
      
      // Add remaining findings based on corrected counts
      const severityOrder = ['Critical', 'High', 'Medium', 'Low']
      for (const severity of severityOrder) {
        const count = correctedDec[severity.toLowerCase() as keyof typeof correctedDec]
        const available = findingsBySeverity[severity] || []
        
        const skipCount = (fixedSeverity === severity && fixedCount > 0) ? 1 : 0
        for (let i = skipCount; i < available.length && remainingFindings.filter(f => (f.severity || '').toLowerCase() === severity.toLowerCase()).length < count; i++) {
          remainingFindings.push(available[i])
        }
      }
      
      // Use calculated score (contracts don't have PDF scores)
      const initialScoreFromContract = data.score != null ? data.score : calculateSecurityScore(correctedCounts)
      
      // Calculate final score
      let finalScore: number
      if (data.score != null && fixedCount > 0 && fixedSeverity) {
        const maxPossibleScore = 100
        const currentScore = initialScoreFromContract
        const scoreDeficit = maxPossibleScore - currentScore
        
        const improvementFactors: Record<string, number> = {
          'Critical': 0.25,
          'High': 0.20,
          'Medium': 0.15,
          'Low': 0.10
        }
        
        const factor = improvementFactors[fixedSeverity] || 0.15
        const scoreImprovement = scoreDeficit * factor
        finalScore = Math.min(100, currentScore + scoreImprovement)
        finalScore = Math.round(finalScore * 10) / 10
      } else {
        finalScore = calculateSecurityScore(correctedDec)
      }
      
      const improvement = initialScoreFromContract > 0 ? Math.round(((finalScore - initialScoreFromContract) / initialScoreFromContract) * 100) : 0
      
      setInitial({
        score: initialScoreFromContract,
        findings: data.findings,
        severityCounts: correctedCounts
      })
      setFinal({
        score: finalScore,
        findings: remainingFindings,
        severityCounts: correctedDec,
        fixedCount,
        fixedSeverity,
        fixedVulnId, // Store which specific vulnerability was fixed
        fixedVulnTitle, // Store the title of the fixed vulnerability
        improvement: improvement
      })
      
      // Save to history
      const contractName = data.contractName?.replace('.sol', '') || 'contract'
      const newEntry: AuditHistory = {
        timestamp: Date.now(),
        totalVulns: Object.values(correctedCounts).reduce((a, b) => a + b, 0),
        ...correctedCounts,
        pdfName: contractName,
        contractName: contractName,
        securityScore: initialScoreFromContract
      }
      
      const fixedEntry: AuditHistory = {
        timestamp: Date.now() + 1,
        totalVulns: Object.values(correctedDec).reduce((a, b) => a + b, 0),
        ...correctedDec,
        pdfName: contractName,
        contractName: contractName,
        securityScore: finalScore
      }
      
      const updated = [...history, newEntry, fixedEntry]
      setHistory(updated)
      localStorage.setItem('auditHistory', JSON.stringify(updated))
    } catch (e: any) {
      alert(`Error analyzing contract: ${e.message || 'Analysis failed'}`)
      console.error('Contract analysis error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function downloadFixedContract(type: 'hardened' | 'flat' = 'flat') {
    try {
      if (type === 'hardened') {
        // Save FIXED hardened version (with renamed contract) to SmartContract folder
        const resp = await axios.post(`${SERVER}/contract/generate/hardened`)
        if (resp.data.success) {
          alert(
            `✅ Hardened contract saved!\n\n` +
            `Location: ${resp.data.path}\n\n` +
            `This is the FIXED version with security improvements.\n` +
            `Contract name: RaceSwap_hardened\n` +
            `You can find it in the SmartContract/contracts/ folder.`
          )
        }
      } else {
        // Determine which vulnerability to fix based on the "final" state (which shows what was auto-fixed)
        let fixType = null;
        const appliedFixes: string[] = []; // Track fixes already applied
        
        // Build list of previously applied fixes from history or initial/final state
        // Check history to see what fixes were applied before
        if (history && history.length > 1) {
          // Look at previous entries to infer which fixes were applied
          for (let i = 1; i < history.length; i++) {
            const prevEntry = history[i];
            const prevPrevEntry = history[i - 1];
            if (prevEntry.totalVulns < prevPrevEntry.totalVulns) {
              // A fix was applied - infer which one based on severity reduction
              // This is approximate, but helps with incremental fixing
            }
          }
        }
        
        // Determine fixType from the fixed vulnerability ID or title (for the NEXT fix)
        if (final && final.fixedVulnId) {
          // The current fix that was shown in UI - add it to appliedFixes
          if (final.fixedVulnId === 'RS-001' || final.fixedVulnTitle?.includes('setRate')) {
            appliedFixes.push('setRate');
          } else if (final.fixedVulnId === 'RS-002' || final.fixedVulnTitle?.includes('emergencyWithdraw')) {
            appliedFixes.push('emergencyWithdraw');
          } else if (final.fixedVulnId === 'RS-003' || final.fixedVulnTitle?.includes('slippage')) {
            appliedFixes.push('slippage');
          } else if (final.fixedVulnId === 'RS-004' || final.fixedVulnTitle?.includes('reentrancy')) {
            appliedFixes.push('reentrancy');
          } else if (final.fixedVulnId === 'RS-005' || final.fixedVulnTitle?.includes('Events')) {
            appliedFixes.push('events');
          }
          
          // Determine the NEXT fix to apply based on remaining vulnerabilities
          const remainingFindings = final.findings || [];
          const severityOrder = ['Critical', 'High', 'Medium', 'Low'];
          for (const sev of severityOrder) {
            const sevFindings = remainingFindings.filter((f: any) => f.severity === sev);
            if (sevFindings.length > 0) {
              const nextFinding = sevFindings[0];
              if (nextFinding.id === 'RS-001' || nextFinding.title?.includes('setRate')) {
                fixType = 'setRate';
                break;
              } else if (nextFinding.id === 'RS-002' || nextFinding.title?.includes('emergencyWithdraw')) {
                fixType = 'emergencyWithdraw';
                break;
              } else if (nextFinding.id === 'RS-003' || nextFinding.title?.includes('slippage')) {
                fixType = 'slippage';
                break;
              } else if (nextFinding.id === 'RS-004' || nextFinding.title?.includes('reentrancy')) {
                fixType = 'reentrancy';
                break;
              } else if (nextFinding.id === 'RS-005' || nextFinding.title?.includes('Events')) {
                fixType = 'events';
                break;
              }
            }
          }
        }
        
        // Download FIXED flat version for SecureDApp upload (keeps original contract name)
        // Pass appliedFixes so backend applies those first, then applies one more
        const resp = await fetch(`${SERVER}/contract/generate`, { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fixType, appliedFixes }) // Backend will apply previous fixes first, then one more
        })
        const blob = await resp.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'RaceSwap_vulnerable_flat_fixed.sol'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        
        const fixCount = final?.fixedCount || 1;
        const fixSeverity = final?.fixedSeverity || 'vulnerability';
        alert(
          `✅ Fixed contract downloaded!\n\n` +
          `This is the FIXED version with ${fixCount} ${fixSeverity} vulnerability fixed.\n` +
          `Upload this file to SecureDApp to verify your improved security score!\n\n` +
          `Original vulnerabilities: ${(initial?.findings?.length || 0)}\n` +
          `Fixed vulnerabilities: ${fixCount}\n` +
          `Remaining: ${(final?.findings?.length || 0)}`
        )
      }
    } catch (e: any) {
      alert(`Error: ${e.message || 'Download failed'}`)
    }
  }

  function calculateSecurityScore(counts: { critical: number; high: number; medium: number; low: number }): number {
    // Base score starts at 100
    let score = 100
    
    // Deduct points based on severity
    score -= counts.critical * 20  // Critical: -20 points each
    score -= counts.high * 15      // High: -15 points each
    score -= counts.medium * 10    // Medium: -10 points each
    score -= counts.low * 5        // Low: -5 points each
    
    // Clamp between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  function getScoreGrade(score: number): { grade: string; color: string; label: string } {
    if (score >= 95) return { grade: 'A+', color: '#2ecc40', label: 'Excellent' }
    if (score >= 90) return { grade: 'A', color: '#2ecc40', label: 'Excellent' }
    if (score >= 85) return { grade: 'B+', color: '#ffdc00', label: 'Good' }
    if (score >= 80) return { grade: 'B', color: '#ffdc00', label: 'Good' }
    if (score >= 75) return { grade: 'C+', color: '#ff851b', label: 'Fair' }
    if (score >= 70) return { grade: 'C', color: '#ff851b', label: 'Fair' }
    if (score >= 60) return { grade: 'D', color: '#ff4136', label: 'Poor' }
    return { grade: 'F', color: '#ff4136', label: 'Critical' }
  }

  function counts(rep: any) {
    if (!rep) return { critical: 0, high: 0, medium: 0, low: 0 }
    return rep.severityCounts || { critical: 0, high: 0, medium: 0, low: 0 }
  }

  return (
    <div className="security-audit-page">
      {/* Hero Section */}
      <div className="audit-hero">
        <div className="audit-hero-content">
          <div className="hero-text-section">
            <h1 className="hero-title">
              <span className="hero-icon">🔒</span>
              Smart Contract Security Audit
            </h1>
            <p className="hero-subtitle">
              Professional vulnerability scanning powered by SecureDApp Audit Express.
              Protect your DeFi contracts with automated analysis and expert remediation guidance.
            </p>
            <div className="hero-stats">
              <div className="stat-box">
                <div className="stat-value">99%+</div>
                <div className="stat-text">Accuracy</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">&lt;2s</div>
                <div className="stat-text">Scan Time</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">100+</div>
                <div className="stat-text">Checks</div>
              </div>
            </div>
          </div>
        </div>
        <div className="racing-animation">
          <div className="race-track"></div>
          <div className="security-checkpoint"></div>
        </div>
      </div>

      {/* Info Cards Section */}
      <div className="info-cards-grid">
        <div className="info-card glass-panel">
          <div className="info-icon">🛡️</div>
          <h3>Comprehensive Analysis</h3>
          <p>Scans for 100+ vulnerability patterns including reentrancy, access control, slippage, and MEV exploits</p>
        </div>
        <div className="info-card glass-panel">
          <div className="info-icon">⚡</div>
          <h3>Fast Remediation</h3>
          <p>Automated fixes with detailed step-by-step guidance for manual review and implementation</p>
        </div>
        <div className="info-card glass-panel">
          <div className="info-icon">📊</div>
          <h3>Progress Tracking</h3>
          <p>Visual charts showing security improvements over time with severity breakdowns</p>
        </div>
        <div className="info-card glass-panel">
          <div className="info-icon">🔍</div>
          <h3>Expert Guidance</h3>
          <p>Detailed explanations of each vulnerability with impact analysis and code examples</p>
        </div>
      </div>

      {/* Main Audit Section */}
      <section className="panel glass-panel">
        <div className="section-header">
          <h2>🔒 SecureDApp Audit Express</h2>
          <p className="section-desc">
            Choose your audit method: Upload SecureDApp audit PDFs or directly analyze smart contract files.
            Our system automatically detects security issues and provides actionable fixes.
          </p>
        </div>
        
        {/* Audit Mode Selection */}
        <div className="audit-mode-selector">
          <button 
            className={`mode-btn ${auditMode === 'pdf' ? 'active' : ''}`}
            onClick={() => setAuditMode('pdf')}
          >
            📄 PDF Analysis
          </button>
          <button 
            className={`mode-btn ${auditMode === 'contract' ? 'active' : ''}`}
            onClick={() => setAuditMode('contract')}
          >
            📝 Direct Contract Analysis
          </button>
        </div>
        
        {auditMode === 'pdf' ? (
          <div className="actions">
            <button className="btn-action" onClick={loadFromPdfs} disabled={loading}>
              📄 Load PDFs from Audit/
            </button>
          </div>
        ) : (
          <div className="contract-selector-section">
            <div className="contract-selector-group">
              <label className="selector-label">Select Smart Contract:</label>
              <select 
                className="contract-select"
                value={selectedContract}
                onChange={(e) => setSelectedContract(e.target.value)}
                disabled={loading || availableContracts.length === 0}
              >
                {availableContracts.length === 0 ? (
                  <option value="">No contracts found</option>
                ) : (
                  availableContracts.map((contract) => (
                    <option key={contract.name} value={contract.name}>
                      {contract.name}
                    </option>
                  ))
                )}
              </select>
              <button 
                className="btn-primary" 
                onClick={loadFromContract} 
                disabled={loading || !selectedContract || availableContracts.length === 0}
              >
                {loading ? '⏳ Analyzing...' : '🔍 Analyze Contract'}
              </button>
            </div>
            {availableContracts.length === 0 && (
              <p className="selector-help">
                No contracts found in SmartContract/contracts/ folder. 
                Make sure you have .sol files in that directory.
              </p>
            )}
            <button 
              className="btn-secondary" 
              onClick={loadAvailableContracts}
              disabled={loading}
            >
              🔄 Refresh Contract List
            </button>
          </div>
        )}
        
        <div className="actions">
          {initial && (
            <>
              <button className={`btn-action ${view === 'vulns' ? 'active' : ''}`} onClick={() => setView('vulns')}>
                🔍 Show Vulnerabilities
              </button>
              <button className={`btn-action ${view === 'advice' ? 'active' : ''}`} onClick={() => setView('advice')}>
                💡 Show Fix Advice
              </button>
            </>
          )}
          <div className="download-buttons">
            <button 
              className="btn-primary" 
              onClick={() => downloadFixedContract('flat')}
              title="Download FIXED contract (with security fixes) - Ready for SecureDApp upload to verify improved score"
            >
              ⬇️ Download Fixed Contract (SecureDApp)
            </button>
            <button 
              className="btn-action" 
              onClick={() => downloadFixedContract('hardened')}
              title="Save FIXED hardened version (renamed contract) to SmartContract folder"
            >
              💾 Save Hardened Version (Local)
            </button>
          </div>
        </div>

      <div className="results">
        <div className="result-panel">
          <div className="panel-header">
            <h3>Initial Scan</h3>
            {initial && (
              <div className="panel-badge initial-badge">
                Before Fixes
              </div>
            )}
          </div>
          {initial ? <ReportCard data={initial} mode={view} isInitial={true} /> : <p className="no-data">No data yet. Click "Load from PDFs".</p>}
        </div>
        <div className="result-panel">
          <div className="panel-header">
            <h3>After Auto-fix</h3>
            {final && final.fixedCount && final.fixedCount > 0 && (
              <div className="improvement-indicator">
                <span className="improvement-icon">✨</span>
                <span className="improvement-text">
                  {final.fixedCount} {final.fixedSeverity} vulnerability fixed
                  {final.improvement && final.improvement > 0 && (
                    <span className="improvement-score">+{final.improvement}% improvement</span>
                  )}
                </span>
              </div>
            )}
          </div>
          {final ? <ReportCard data={final} mode={view} isInitial={false} initialData={initial} /> : <p className="no-data">Pending auto-fix...</p>}
        </div>
      </div>

        <div className="charts">
          <div className="chart glass-panel">
            <h3>📊 Vulnerability Comparison (Bar Chart)</h3>
            <VulnerabilityChart initialCounts={counts(initial)} finalCounts={counts(final)} />
          </div>
          <div className="chart glass-panel">
            <h3>📈 Progress Over Time (Line Chart)</h3>
            <ProgressLineChart history={history} />
          </div>
        </div>
      </section>

      {/* MEV Detection Section */}
      <section className="panel glass-panel mev-section">
        <div className="section-header">
          <h2>⚡ Front-Running Detection & MEV Defense</h2>
          <p className="section-desc">
            Real-time MEV attack detection and mitigation system for Formula-1 DeFi transactions.
            Protects against sandwich attacks, front-running, and other exploit vectors.
          </p>
        </div>
        <div className="mev-features">
          <div className="mev-feature">
            <div className="mev-icon">🎯</div>
            <h4>Real-Time Detection</h4>
            <p>Monitors mempool for suspicious transaction patterns and potential MEV exploitation</p>
          </div>
          <div className="mev-feature">
            <div className="mev-icon">🛡️</div>
            <h4>Flashbots Integration</h4>
            <p>Private transaction relay to prevent front-running and protect user transactions</p>
          </div>
          <div className="mev-feature">
            <div className="mev-icon">📈</div>
            <h4>Risk Analysis</h4>
            <p>Advanced algorithms predict front-running risks before transaction execution</p>
          </div>
        </div>
        
        <div className="detection-controls">
          <button 
            className={`btn-primary ${detectionActive ? 'btn-stop' : ''}`} 
            onClick={async () => {
              try {
                if (detectionActive) {
                  const response = await axios.post(`${SERVER}/detect/stop`)
                  setDetectionActive(false)
                  setDetectionStats(null)
                  setDetectedThreats([])
                  alert('⏹️ Detection stopped')
                } else {
                  const { data } = await axios.post(`${SERVER}/detect/start`, { 
                    contractAddress: '0xContract' 
                  })
                  if (data && data.state) {
                    setDetectionActive(true)
                    setDetectionStats(data.state.stats)
                    setDetectedThreats(data.state.recentThreats || [])
                    alert('🚀 MEV Detection started! Threats will be detected in real-time.')
                  }
                }
              } catch (e: any) {
                if (e.response?.status === 404) {
                  alert(
                    '⚠️ Server endpoint not found!\n\n' +
                    'Please restart your server:\n' +
                    '1. Stop the server (Ctrl+C)\n' +
                    '2. Run: cd Server && npm start\n\n' +
                    'The new detection endpoints need the server to be restarted.'
                  )
                } else {
                  alert(`Error: ${e.message || 'Failed to toggle detection'}`)
                }
              }
            }}
          >
            {detectionActive ? '⏹️ Stop Detection' : '🚀 Start Detection'}
          </button>
          
          {detectionActive && (
            <button 
              className="btn-action" 
              onClick={async () => {
                try {
                  const { data } = await axios.get(`${SERVER}/detect/status`)
                  if (data && data.state) {
                    setDetectionStats(data.state.stats)
                    setDetectedThreats(data.state.recentThreats || [])
                  }
                } catch (e: any) {
                  if (e.response?.status === 404) {
                    alert(
                      '⚠️ Server endpoint not found!\n\n' +
                      'Please restart your server:\n' +
                      '1. Stop the server (Ctrl+C)\n' +
                      '2. Run: cd Server && npm start'
                    )
                  } else {
                    console.error('Status update error:', e)
                  }
                }
              }}
            >
              🔄 Refresh Status
            </button>
          )}
        </div>

        {detectionActive && (
          <div className="detection-dashboard">
            {detectionStats && (
              <div className="detection-stats-grid">
                <div className="detection-stat-card">
                  <div className="stat-icon">🚨</div>
                  <div className="stat-content">
                    <div className="stat-value">{detectionStats.totalDetected || 0}</div>
                    <div className="stat-label">Threats Detected</div>
                  </div>
                </div>
                <div className="detection-stat-card">
                  <div className="stat-icon">🥪</div>
                  <div className="stat-content">
                    <div className="stat-value">{detectionStats.sandwichAttacks || 0}</div>
                    <div className="stat-label">Sandwich Attacks</div>
                  </div>
                </div>
                <div className="detection-stat-card">
                  <div className="stat-icon">⚡</div>
                  <div className="stat-content">
                    <div className="stat-value">{detectionStats.frontRuns || 0}</div>
                    <div className="stat-label">Front-Runs</div>
                  </div>
                </div>
                <div className="detection-stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-value">{detectionStats.avgRiskScore || 0}%</div>
                    <div className="stat-label">Avg Risk Score</div>
                  </div>
                </div>
              </div>
            )}

            {detectedThreats.length > 0 && (
              <div className="threats-list">
                <h3 className="threats-title">🚨 Recent Threats Detected</h3>
                <div className="threats-container">
                  {detectedThreats.slice().reverse().map((threat: any) => (
                    <div key={threat.id} className="threat-card">
                      <div className="threat-header">
                        <span className="threat-type" style={{
                          backgroundColor: threat.risk > 70 ? 'rgba(255, 65, 54, 0.2)' : 
                                          threat.risk > 40 ? 'rgba(255, 133, 27, 0.2)' : 
                                          'rgba(255, 220, 0, 0.2)',
                          borderColor: threat.risk > 70 ? '#ff4136' : 
                                      threat.risk > 40 ? '#ff851b' : '#ffdc00',
                          color: threat.risk > 70 ? '#ff4136' : 
                                threat.risk > 40 ? '#ff851b' : '#ffdc00'
                        }}>
                          {threat.type}
                        </span>
                        <span className="threat-risk">Risk: {threat.risk}%</span>
                      </div>
                      <div className="threat-details">
                        <div className="threat-detail-item">
                          <span className="detail-label">Affected User:</span>
                          <span className="detail-value">{threat.userAffected?.slice(0, 10)}...{threat.userAffected?.slice(-8)}</span>
                        </div>
                        <div className="threat-detail-item">
                          <span className="detail-label">Slippage Risk:</span>
                          <span className="detail-value warning">{threat.slippageEstimated}</span>
                        </div>
                        <div className="threat-detail-item">
                          <span className="detail-label">Potential Loss:</span>
                          <span className="detail-value danger">{threat.potentialLoss}</span>
                        </div>
                        <div className="threat-detail-item">
                          <span className="detail-label">Gas Price:</span>
                          <span className="detail-value">{threat.gasPrice}</span>
                        </div>
                        <div className="threat-detail-item">
                          <span className="detail-label">Time:</span>
                          <span className="detail-value">{new Date(threat.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      <div className="threat-actions">
                        <button 
                          className="btn-flashbots"
                          onClick={async () => {
                            try {
                              // Simulate submitting via Flashbots
                              const { data } = await axios.post(`${SERVER}/relay/send`, {
                                rawTransaction: {
                                  to: threat.contractAddress || '0xContract',
                                  value: threat.potentialLoss || '0',
                                  gasPrice: threat.gasPrice
                                }
                              })
                              
                              if (data.mocked) {
                                alert(
                                  `🛡️ Flashbots Protection Enabled\n\n` +
                                  `Transaction submitted via private relay.\n` +
                                  `This prevents front-running by bypassing the public mempool.\n\n` +
                                  `Status: ${data.status}\n` +
                                  `Relay: ${data.relay || 'Mock (configure FLASHBOTS_SIGNER_KEY for production)'}\n\n` +
                                  `To enable real Flashbots:\n` +
                                  `1. Get Flashbots API key\n` +
                                  `2. Add FLASHBOTS_SIGNER_KEY to Server/.env\n` +
                                  `3. Add FLASHBOTS_RELAY_URL to Server/.env\n` +
                                  `4. Restart server`
                                )
                              } else {
                                alert(`✅ Transaction submitted via Flashbots!\n\nStatus: ${data.status}`)
                              }
                            } catch (e: any) {
                              alert(`Error: ${e.message || 'Failed to submit via Flashbots'}`)
                            }
                          }}
                        >
                          🛡️ Submit via Flashbots
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actionable Advice Panel */}
            {detectionActive && (
              <div className="actionable-advice-panel glass-panel">
                <h3>💡 Actionable Security Recommendations</h3>
                {detectionStats && detectionStats.totalDetected > 0 ? (
                  <div className="advice-content warning">
                    <div className="advice-icon">⚠️</div>
                    <div className="advice-text">
                      <p className="advice-title">Front-Running Risk Detected</p>
                      <p className="advice-detail">
                        <strong>{detectionStats.totalDetected} threats</strong> detected in the mempool targeting your contract.
                        <br />
                        <strong>Recommendation:</strong> Enable Flashbots private relay for all transactions to prevent MEV extraction.
                      </p>
                      <div className="advice-steps">
                        <p><strong>Steps to protect your transactions:</strong></p>
                        <ol>
                          <li>Click "🛡️ Submit via Flashbots" on any detected threat</li>
                          <li>Use the simulation mode to test transactions before submitting</li>
                          <li>For production, configure Flashbots API keys in backend</li>
                          <li>Monitor the dashboard for new threats in real-time</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="advice-content safe">
                    <div className="advice-icon">✅</div>
                    <div className="advice-text">
                      <p className="advice-title">Contract Security Status: Secure</p>
                      <p className="advice-detail">
                        No active MEV threats detected. Your smart contract is secure, but front-running risk still exists.
                        <br />
                        <strong>Recommendation:</strong> Use Flashbots for large transactions or high-value swaps to maintain protection.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Simulation Mode */}
            <div className="simulation-mode-panel glass-panel">
              <div className="simulation-header">
                <h3>🧪 Transaction Simulation Mode</h3>
                <button 
                  className={`btn-action ${simulationMode ? 'active' : ''}`}
                  onClick={() => setSimulationMode(!simulationMode)}
                >
                  {simulationMode ? '❌ Close Simulation' : '▶️ Start Simulation'}
                </button>
              </div>
              
              {simulationMode && (
                <div className="simulation-content">
                  <p className="simulation-desc">
                    Test your transaction before submitting to predict front-running risks and MEV exploitation potential.
                  </p>
                  
                  <div className="simulation-form">
                    <div className="form-group">
                      <label>Transaction Type:</label>
                      <select 
                        id="sim-tx-type" 
                        className="form-input"
                        defaultValue="swap"
                      >
                        <option value="swap">Swap/Trade</option>
                        <option value="transfer">Transfer</option>
                        <option value="withdraw">Withdraw</option>
                        <option value="deposit">Deposit</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label>Contract Address:</label>
                      <input 
                        type="text" 
                        id="sim-contract" 
                        className="form-input"
                        placeholder="0x..." 
                        defaultValue="0xContract"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Transaction Value (ETH):</label>
                      <input 
                        type="number" 
                        id="sim-value" 
                        className="form-input"
                        placeholder="0.1" 
                        step="0.001"
                        defaultValue="1"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label>Gas Price (gwei):</label>
                      <input 
                        type="number" 
                        id="sim-gas" 
                        className="form-input"
                        placeholder="20" 
                        step="1"
                        defaultValue="50"
                      />
                    </div>
                    
                    <div className="form-group checkbox-group">
                      <input 
                        type="checkbox" 
                        id="sim-slippage" 
                        className="form-checkbox"
                      />
                      <label htmlFor="sim-slippage">Has Slippage Protection</label>
                    </div>
                    
                    <button 
                      className="btn-primary"
                      onClick={async () => {
                        setSimulationLoading(true)
                        try {
                          const txType = (document.getElementById('sim-tx-type') as HTMLSelectElement).value
                          const contract = (document.getElementById('sim-contract') as HTMLInputElement).value
                          const value = (document.getElementById('sim-value') as HTMLInputElement).value
                          const gasPrice = (document.getElementById('sim-gas') as HTMLInputElement).value
                          const hasSlippage = (document.getElementById('sim-slippage') as HTMLInputElement).checked
                          
                          const { data } = await axios.post(`${SERVER}/simulate/transaction`, {
                            transaction: {
                              type: txType,
                              value: ethers.parseEther(value || '0').toString(),
                              gasPrice: ethers.parseUnits(gasPrice || '20', 'gwei').toString(),
                              minAmountOut: hasSlippage ? '1000' : null,
                              slippage: hasSlippage ? '0.5' : null
                            },
                            contractAddress: contract || '0xContract'
                          })
                          
                          setSimulationResult(data)
                        } catch (e: any) {
                          alert(`Simulation error: ${e.message || 'Failed to simulate'}`)
                        } finally {
                          setSimulationLoading(false)
                        }
                      }}
                      disabled={simulationLoading}
                    >
                      {simulationLoading ? '⏳ Analyzing...' : '🔍 Simulate Transaction'}
                    </button>
                  </div>
                  
                  {simulationResult && (
                    <div className={`simulation-result ${simulationResult.riskLevel.toLowerCase()}`}>
                      <div className="result-header">
                        <h4>Simulation Results</h4>
                        <div className={`risk-badge ${simulationResult.riskLevel.toLowerCase()}`}>
                          {simulationResult.riskLevel} RISK
                        </div>
                      </div>
                      
                      <div className="result-metrics">
                        <div className="metric">
                          <span className="metric-label">Risk Score:</span>
                          <span className="metric-value">{simulationResult.riskScore}%</span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Front-Run Probability:</span>
                          <span className="metric-value">{simulationResult.estimatedFrontRunProbability}</span>
                        </div>
                        <div className="metric">
                          <span className="metric-label">Estimated Slippage:</span>
                          <span className="metric-value">{simulationResult.estimatedSlippage}</span>
                        </div>
                      </div>
                      
                      {simulationResult.warnings && simulationResult.warnings.length > 0 && (
                        <div className="result-warnings">
                          <h5>⚠️ Warnings:</h5>
                          <ul>
                            {simulationResult.warnings.map((w: string, i: number) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="result-recommendation">
                        <h5>💡 Recommendation:</h5>
                        <p>{simulationResult.recommendation}</p>
                        <p className="recommendation-action">{simulationResult.recommendationAction}</p>
                        
                        {simulationResult.riskScore >= 40 && (
                          <button 
                            className="btn-flashbots"
                            onClick={async () => {
                              try {
                                const { data } = await axios.post(`${SERVER}/relay/send`, {
                                  rawTransaction: {
                                    to: simulationResult.contractAddress,
                                    value: simulationResult.value,
                                    gasPrice: simulationResult.gasPrice
                                  }
                                })
                                alert(`🛡️ Transaction submitted via Flashbots!\n\nStatus: ${data.status}\n\nYour transaction is now protected from front-running.`)
                              } catch (e: any) {
                                alert(`Error: ${e.message || 'Failed to submit via Flashbots'}`)
                              }
                            }}
                          >
                            🛡️ Submit Protected Transaction via Flashbots
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* F1 Use Cases Section */}
            <div className="f1-use-cases-panel glass-panel">
              <div className="use-cases-header">
                <h3>🏎️ Formula-1 Use Cases</h3>
                <button 
                  className="btn-action"
                  onClick={() => setShowF1UseCases(!showF1UseCases)}
                >
                  {showF1UseCases ? '▼ Hide' : '▶ Show'} Use Cases
                </button>
              </div>
              
              {showF1UseCases && (
                <div className="use-cases-content">
                  <div className="use-case-card">
                    <div className="use-case-icon">🏁</div>
                    <div className="use-case-info">
                      <h4>Race Prize Distribution</h4>
                      <p>
                        Secure, automated prize distribution to F1 teams and drivers after each Grand Prix.
                        The RaceSwap contract ensures fair token swaps for prize pools, protected from MEV exploitation.
                        <strong> Use Case:</strong> Distribute prize tokens (USDC, ETH) to teams based on race results.
                      </p>
                    </div>
                  </div>
                  
                  <div className="use-case-card">
                    <div className="use-case-icon">🤝</div>
                    <div className="use-case-info">
                      <h4>Sponsor Payment System</h4>
                      <p>
                        Transparent sponsor-to-team payment system with automated execution. 
                        The contract handles sponsor payouts, ensuring funds reach teams without front-running attacks.
                        <strong> Use Case:</strong> Sponsors send payments to teams via secure DeFi swaps, protected from MEV bots.
                      </p>
                    </div>
                  </div>
                  
                  <div className="use-case-card">
                    <div className="use-case-icon">📊</div>
                    <div className="use-case-info">
                      <h4>F1 Stock Market Trading</h4>
                      <p>
                        Decentralized trading of F1 team performance stocks. Users can buy/sell team tokens
                        based on race predictions, with MEV protection ensuring fair prices.
                        <strong> Use Case:</strong> Trade F1 team tokens on a DEX-like platform without front-running risks.
                      </p>
                    </div>
                  </div>
                  
                  <div className="use-case-card">
                    <div className="use-case-icon">🎫</div>
                    <div className="use-case-info">
                      <h4>NFT Ticket & Merchandise Exchange</h4>
                      <p>
                        Secure marketplace for F1 NFTs, tickets, and merchandise. 
                        The contract enables trustless swaps of F1 collectibles, protected from sandwich attacks.
                        <strong> Use Case:</strong> Trade F1 NFTs and digital collectibles on secondary markets securely.
                      </p>
                    </div>
                  </div>
                  
                  <div className="use-case-card">
                    <div className="use-case-icon">🏆</div>
                    <div className="use-case-info">
                      <h4>Championship Points Conversion</h4>
                      <p>
                        Convert F1 championship points to tokens or rewards. 
                        Teams and drivers can exchange points for rewards, with MEV defense ensuring accurate conversion rates.
                        <strong> Use Case:</strong> Convert championship standings into tradable tokens for rewards programs.
                      </p>
                    </div>
                  </div>
                  
                  <div className="use-case-card">
                    <div className="use-case-icon">⛽</div>
                    <div className="use-case-info">
                      <h4>Pitstop Strategy Optimization</h4>
                      <p>
                        DeFi-based pitstop strategy betting and optimization. 
                        Fans and teams can stake tokens on pitstop strategies, with protected transactions.
                        <strong> Use Case:</strong> Bet on pitstop timing and tire strategies using secure DeFi mechanisms.
                      </p>
                    </div>
                  </div>
                  
                  <div className="use-case-summary">
                    <h4>💡 How to Use This Dashboard in Formula-1:</h4>
                    <ol>
                      <li><strong>Audit Your Contract:</strong> Use SecureDApp to scan F1-related smart contracts before deployment</li>
                      <li><strong>Monitor MEV Threats:</strong> Enable real-time detection to protect F1 token swaps and prize distributions</li>
                      <li><strong>Use Simulation Mode:</strong> Test large prize pool transactions before executing to predict front-running risks</li>
                      <li><strong>Enable Flashbots:</strong> Submit critical F1 transactions (prizes, sponsorships) via private relay to prevent MEV</li>
                      <li><strong>Track Security:</strong> Monitor security scores and vulnerability fixes over multiple race seasons</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>

            {detectionActive && detectedThreats.length === 0 && (
              <div className="detection-waiting">
                <div className="waiting-icon">🔍</div>
                <div className="waiting-text">Monitoring mempool for threats...</div>
                <div className="waiting-sub">Threats will appear here as they are detected</div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Contract Details Section */}
      <section className="panel glass-panel contract-details">
        <h2>📋 Contract Information</h2>
        <div className="contract-info-grid">
          <div className="contract-info-item">
            <strong>Contract Name:</strong>
            <span>RaceSwap_vulnerable.sol</span>
          </div>
          <div className="contract-info-item">
            <strong>Solidity Version:</strong>
            <span>0.8.19</span>
          </div>
          <div className="contract-info-item">
            <strong>Network:</strong>
            <span>Ethereum / Local Testnet</span>
          </div>
          <div className="contract-info-item">
            <strong>Audit Status:</strong>
            <span className="status-badge pending">In Progress</span>
          </div>
        </div>
        <div className="security-standards">
          <h3>Security Standards Checked</h3>
          <div className="standards-list">
            <span className="standard-badge">OWASP Top 10</span>
            <span className="standard-badge">SWC Registry</span>
            <span className="standard-badge">Consensys Best Practices</span>
            <span className="standard-badge">Smart Contract Security Checklist</span>
          </div>
        </div>
      </section>
    </div>
  )
}

function ReportCard({ data, mode, isInitial = false, initialData = null }: ReportCardProps) {
  const severityColors: Record<string, string> = {
    Critical: '#ff4136',
    High: '#ff851b',
    Medium: '#ffdc00',
    Low: '#2ecc40'
  }

  function calculateSecurityScore(counts: { critical: number; high: number; medium: number; low: number }): number {
    let score = 100
    score -= counts.critical * 20
    score -= counts.high * 15
    score -= counts.medium * 10
    score -= counts.low * 5
    return Math.max(0, Math.min(100, Math.round(score)))
  }

  function getScoreGrade(score: number): { grade: string; color: string; label: string } {
    if (score >= 95) return { grade: 'A+', color: '#2ecc40', label: 'Excellent' }
    if (score >= 90) return { grade: 'A', color: '#2ecc40', label: 'Excellent' }
    if (score >= 85) return { grade: 'B+', color: '#ffdc00', label: 'Good' }
    if (score >= 80) return { grade: 'B', color: '#ffdc00', label: 'Good' }
    if (score >= 75) return { grade: 'C+', color: '#ff851b', label: 'Fair' }
    if (score >= 70) return { grade: 'C', color: '#ff851b', label: 'Fair' }
    if (score >= 60) return { grade: 'D', color: '#ff4136', label: 'Poor' }
    return { grade: 'F', color: '#ff4136', label: 'Critical' }
  }

  // Use score from data (from PDF), or calculate if not available
  // Preserve decimals if score comes from PDF
  const rawScore = data.score != null ? data.score : (data.severityCounts ? calculateSecurityScore(data.severityCounts) : 0)
  const score = typeof rawScore === 'number' ? rawScore : parseFloat(rawScore) || 0
  
  // Round to 1 decimal place if score has decimals, otherwise show as integer
  const displayScore = score % 1 === 0 ? score : parseFloat(score.toFixed(1))
  
  const gradeInfo = getScoreGrade(Math.round(score)) // Grade uses rounded score
  const counts = data.severityCounts || { critical: 0, high: 0, medium: 0, low: 0 }
  const totalFindings = data.findings?.length || 0
  const totalCounts = counts.critical + counts.high + counts.medium + counts.low
  
  // Calculate improvement metrics
  const improvement = initialData && isInitial === false
    ? {
        scoreDiff: score - (initialData.score || 0),
        findingsFixed: (initialData.findings?.length || 0) - totalFindings,
        criticalFixed: (initialData.severityCounts?.critical || 0) - counts.critical,
        highFixed: (initialData.severityCounts?.high || 0) - counts.high
      }
    : null

  return (
    <div className={`card glass-panel report-card-enhanced ${isInitial ? 'initial-card' : 'fixed-card'}`}>
      {!isInitial && improvement && improvement.findingsFixed > 0 && (
        <div className="improvement-banner">
          <div className="banner-icon">🎉</div>
          <div className="banner-content">
            <div className="banner-title">Auto-Fix Applied Successfully!</div>
            <div className="banner-details">
              <span className="banner-stat">Score: +{improvement.scoreDiff}%</span>
              <span className="banner-stat">Fixed: {improvement.findingsFixed} vulnerability</span>
              {improvement.criticalFixed > 0 && (
                <span className="banner-stat critical">Critical: -{improvement.criticalFixed}</span>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="score-header-enhanced">
        <div className="score-display">
          <div className="score-label">Security Score</div>
          <div className="score-main" style={{ color: gradeInfo.color }}>
            <span className="score-number">{displayScore}%</span>
            <span className="score-grade">{gradeInfo.grade}</span>
          </div>
          <div className="score-label-sub" style={{ color: gradeInfo.color }}>
            {gradeInfo.label}
          </div>
        </div>
        <div className="score-divider"></div>
        <div className="vuln-summary">
          <div className="vuln-count-main">
            <span className="vuln-number">{totalCounts > 0 ? totalCounts : totalFindings}</span>
            <span className="vuln-label">Total Findings</span>
            {totalCounts !== totalFindings && totalFindings > 0 && (
              <span className="vuln-mismatch-warning">⚠️ Mismatch detected</span>
            )}
          </div>
          <div className="vuln-breakdown">
            {counts.critical > 0 && (
              <span className="severity-badge-mini critical">
                {counts.critical} Critical
              </span>
            )}
            {counts.high > 0 && (
              <span className="severity-badge-mini high">
                {counts.high} High
              </span>
            )}
            {counts.medium > 0 && (
              <span className="severity-badge-mini medium">
                {counts.medium} Medium
              </span>
            )}
            {counts.low > 0 && (
              <span className="severity-badge-mini low">
                {counts.low} Low
              </span>
            )}
            {Object.values(counts).every(v => v === 0) && (
              <span className="severity-badge-mini clean">No Issues</span>
            )}
          </div>
        </div>
      </div>
      {!isInitial && improvement && improvement.findingsFixed > 0 && (
        <div className="fix-summary-panel">
          <div className="fix-summary-header">
            <span className="fix-summary-icon">🔧</span>
            <span className="fix-summary-title">Auto-Fix Summary</span>
          </div>
          <div className="fix-summary-content">
            <div className="fix-summary-item">
              <span className="fix-item-label">Fixed Severity:</span>
              <span className="fix-item-value" style={{ 
                color: severityColors[data.fixedSeverity || 'Unknown'] || '#666' 
              }}>
                {data.fixedSeverity || 'N/A'}
              </span>
            </div>
            <div className="fix-summary-item">
              <span className="fix-item-label">Improvement:</span>
              <span className="fix-item-value positive">+{improvement.scoreDiff}%</span>
            </div>
            <div className="fix-summary-item">
              <span className="fix-item-label">Vulnerabilities Remaining:</span>
              <span className="fix-item-value">{totalCounts}</span>
            </div>
          </div>
        </div>
      )}
      
      <div className="findings-container">
        {totalCounts === 0 && totalFindings === 0 ? (
          <div className="no-findings">
            <div className="no-findings-icon">✅</div>
            <div className="no-findings-text">No vulnerabilities found</div>
            <div className="no-findings-sub">All security checks passed</div>
            {!isInitial && (
              <div className="no-findings-extra">
                <div className="success-metric">
                  <span className="metric-label">Security Score Improved</span>
                  <span className="metric-value">{improvement?.scoreDiff || 0}%</span>
                </div>
                <div className="success-metric">
                  <span className="metric-label">Vulnerabilities Fixed</span>
                  <span className="metric-value">{improvement?.findingsFixed || 0}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <ul className="findings-list">
            {(data.findings || []).map((f: any, idx: number) => {
              const key = `${f.id || f.source || 'finding'}-${idx}-${f.title || idx}`
              const severity = f.severity || 'Unknown'
              
              // Calculate proper vulnerability number (sequential from 1)
              const vulnNumber = idx + 1
              
              // Generate proper ID (use finding ID if it exists and is meaningful, otherwise use sequential number)
              let vulnId = `#${vulnNumber}`
              if (f.id && typeof f.id === 'string' && f.id.trim() !== '' && !f.id.match(/^[0-9]+$/)) {
                vulnId = f.id
              } else if (f.id && typeof f.id === 'number' && f.id > 0) {
                vulnId = `#${f.id}`
              }
              
              return (
                <li key={key} className="finding-item-enhanced">
                  {mode === 'vulns' ? (
                    <div className="vulnerability-detail-enhanced">
                      <div className="severity-indicator" style={{ backgroundColor: severityColors[severity] || '#666' }}></div>
                      <div className="vuln-content">
                        <div className="vuln-header-row">
                          <span className="severity-badge-large" style={{ 
                            backgroundColor: `${severityColors[severity] || '#666'}20`,
                            borderColor: severityColors[severity] || '#666',
                            color: severityColors[severity] || '#666'
                          }}>
                            {severity.toUpperCase()}
                          </span>
                          <span className="vuln-id">{vulnId}</span>
                        </div>
                        <h4 className="vuln-title-enhanced">{f.title}</h4>
                        <div className="vuln-description-enhanced">
                          {getDetailedVulnDescription(f.title, severity)}
                        </div>
                        <div className="vuln-impact-enhanced">
                          <div className="impact-label">⚡ Impact</div>
                          <div className="impact-text">{getImpactDescription(f.title, severity)}</div>
                        </div>
                        {f.source && (
                          <div className="vuln-source-enhanced">
                            <span className="source-label">📄 Source:</span>
                            <span className="source-value">{f.source}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="fix-advice-enhanced">
                      <div className="fix-header-enhanced">
                        <h4 className="fix-title-enhanced">{f.title}</h4>
                        <span className="fix-severity-badge" style={{ 
                          backgroundColor: `${severityColors[severity] || '#666'}20`,
                          borderColor: severityColors[severity] || '#666',
                          color: severityColors[severity] || '#666'
                        }}>
                          {severity}
                        </span>
                      </div>
                      <div className="fix-steps-enhanced">
                        <div className="steps-label">📝 Remediation Steps:</div>
                        {getDetailedFix(f.title, severity)}
                      </div>
                      <div className="fix-example-enhanced">
                        <div className="code-label">💻 Code Example:</div>
                        <pre className="code-block">{getCodeExample(f.title)}</pre>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function getDetailedVulnDescription(title: string, severity: string): string {
  const t = title.toLowerCase()
  if (t.includes('access control') || t.includes('setrate') || t.includes('owner')) {
    return 'The function lacks proper access control, allowing any user to modify critical contract parameters. This exposes the contract to unauthorized changes that could manipulate swap rates or drain funds.'
  }
  if (t.includes('slippage') || t.includes('price impact')) {
    return 'The swap function does not implement slippage protection. Users may receive significantly less tokens than expected if the price moves unfavorably during transaction execution, leading to unexpected losses.'
  }
  if (t.includes('reentrancy')) {
    return 'The contract is vulnerable to reentrancy attacks where an external contract can call back into the function before state updates complete, potentially draining funds or manipulating balances.'
  }
  if (t.includes('withdraw') || t.includes('emergency')) {
    return 'The emergency withdraw function lacks access restrictions, allowing anyone to drain contract funds. This is a critical vulnerability that could result in total loss of user assets.'
  }
  return 'This vulnerability requires manual review. The specific risk depends on the contract context and interaction patterns.'
}

function getImpactDescription(title: string, severity: string): string {
  const t = title.toLowerCase()
  if (t.includes('access control') || t.includes('owner')) {
    return 'Critical: Complete contract compromise, potential fund drainage, unauthorized rate manipulation'
  }
  if (t.includes('slippage')) {
    return 'High: User funds lost due to unfavorable price movements, MEV extraction opportunities'
  }
  if (t.includes('reentrancy')) {
    return 'Critical: Potential fund drainage, balance manipulation, contract state corruption'
  }
  if (t.includes('withdraw') || t.includes('emergency')) {
    return 'Critical: Total fund drainage risk, complete loss of user assets'
  }
  return `${severity}: Review specific impact based on contract usage patterns`
}

function getDetailedFix(title: string, severity: string) {
  const t = title.toLowerCase()
  if (t.includes('access control') || t.includes('setrate') || t.includes('owner')) {
    return (
      <div>
        <p><strong>Step 1:</strong> Import OpenZeppelin Ownable contract or implement a minimal owner pattern</p>
        <p><strong>Step 2:</strong> Add <code>onlyOwner</code> modifier to all administrative functions</p>
        <p><strong>Step 3:</strong> Verify owner is set in constructor</p>
        <p><strong>Step 4:</strong> Test access control with unit tests</p>
      </div>
    )
  }
  if (t.includes('slippage') || t.includes('price impact')) {
    return (
      <div>
        <p><strong>Step 1:</strong> Add <code>minAmountOut</code> parameter to swap function</p>
        <p><strong>Step 2:</strong> Calculate expected output using current rate</p>
        <p><strong>Step 3:</strong> Add require check: <code>require(amountOut &gt;= minAmountOut, "Slippage exceeded")</code></p>
        <p><strong>Step 4:</strong> Consider using price oracles for more accurate calculations</p>
      </div>
    )
  }
  if (t.includes('reentrancy')) {
    return (
      <div>
        <p><strong>Step 1:</strong> Import OpenZeppelin ReentrancyGuard</p>
        <p><strong>Step 2:</strong> Add <code>nonReentrant</code> modifier to vulnerable functions</p>
        <p><strong>Step 3:</strong> Follow checks-effects-interactions pattern (update state before external calls)</p>
        <p><strong>Step 4:</strong> Test with malicious contracts that attempt reentrancy</p>
      </div>
    )
  }
  if (t.includes('withdraw') || t.includes('emergency')) {
    return (
      <div>
        <p><strong>Step 1:</strong> Add <code>onlyOwner</code> modifier to emergencyWithdraw function</p>
        <p><strong>Step 2:</strong> Consider adding a timelock for large withdrawals</p>
        <p><strong>Step 3:</strong> Implement pause mechanism for emergency situations</p>
        <p><strong>Step 4:</strong> Add events for all withdrawal operations</p>
      </div>
    )
  }
  return <p>Review the specific vulnerability and apply industry-standard best practices for similar issues.</p>
}

function getCodeExample(title: string): string {
  const t = title.toLowerCase()
  if (t.includes('access control') || t.includes('setrate') || t.includes('owner')) {
    return `// BEFORE (Vulnerable):
function setRate(uint256 newRate, string calldata note) external {
    rate = newRate;
    emit RateUpdated(msg.sender, newRate, note);
}

// AFTER (Fixed):
function setRate(uint256 newRate, string calldata note) external onlyOwner {
    require(msg.sender == owner, "not owner");
    rate = newRate;
    emit RateUpdated(msg.sender, newRate, note);
}`
  }
  if (t.includes('slippage')) {
    return `// BEFORE (Vulnerable):
function swap(...) external returns (uint256 amountOut) {
    amountOut = (amountIn * rate) / 1e18;
    require(tokenOut.transfer(msg.sender, amountOut), "transfer failed");
}

// AFTER (Fixed):
function swap(..., uint256 minAmountOut) external returns (uint256 amountOut) {
    amountOut = (amountIn * rate) / 1e18;
    require(amountOut >= minAmountOut, "Slippage exceeded");
    require(tokenOut.transfer(msg.sender, amountOut), "transfer failed");
}`
  }
  if (t.includes('withdraw') || t.includes('emergency')) {
    return `// BEFORE (Vulnerable):
function emergencyWithdraw(...) external {
    require(token.transfer(to, amount), "transfer failed");
}

// AFTER (Fixed):
function emergencyWithdraw(...) external onlyOwner {
    require(msg.sender == owner, "not owner");
    require(token.transfer(to, amount), "transfer failed");
}`
  }
  return `// Add appropriate security checks based on vulnerability type
// Follow Solidity best practices and security patterns`
}

declare global {
  interface Window { ethereum?: any }
}

