import React, { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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

export default function ProgressLineChart({ history }: { history: AuditHistory[] }) {
  // Group by contract name and track security score progress over time
  const chartData = useMemo(() => {
    if (!history || history.length === 0) {
      return []
    }

    // Group entries by contract name (default to 'RaceSwap_vulnerable' if not specified)
    const byContract: Record<string, AuditHistory[]> = {}
    
    history.forEach(entry => {
      const contractName = entry.contractName || 'RaceSwap_vulnerable'
      if (!byContract[contractName]) {
        byContract[contractName] = []
      }
      byContract[contractName].push(entry)
    })

    // For each contract, create chart data showing security score progress
    const allData: any[] = []
    
    Object.keys(byContract).forEach(contractName => {
      const entries = byContract[contractName].sort((a, b) => a.timestamp - b.timestamp)
      
      entries.forEach((entry, idx) => {
        const score = entry.securityScore ?? 0
        allData.push({
          name: `${contractName} - Fix ${idx + 1}`,
          contractName: contractName,
          fixNumber: idx + 1,
          securityScore: score,
          timestamp: new Date(entry.timestamp).toLocaleString(),
          total: entry.totalVulns,
          critical: entry.critical,
          high: entry.high,
          medium: entry.medium,
          low: entry.low,
        })
      })
    })

    // Sort by timestamp to show chronological progression
    return allData.sort((a, b) => {
      const contractA = a.contractName
      const contractB = b.contractName
      if (contractA !== contractB) {
        return contractA.localeCompare(contractB)
      }
      return a.fixNumber - b.fixNumber
    })
  }, [history])

  if (!history || history.length === 0) {
    return <p style={{ padding: '20px', textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>No audit history yet. Load PDFs to track progress.</p>
  }

  // Custom tooltip to show more details
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div style={{
          background: 'rgba(17, 19, 23, 0.95)',
          border: '1px solid rgba(225, 6, 0, 0.5)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
        }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#ffffff' }}>
            {data.name}
          </p>
          <p style={{ margin: '0 0 4px 0', color: '#e10600', fontSize: '18px', fontWeight: 'bold' }}>
            Security Score: {data.securityScore}%
          </p>
          <p style={{ margin: '4px 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
            {data.timestamp}
          </p>
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <p style={{ margin: '2px 0', fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
              Critical: {data.critical} | High: {data.high} | Medium: {data.medium} | Low: {data.low}
            </p>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={80}
            stroke="rgba(255, 255, 255, 0.7)"
            fontSize={11}
          />
          <YAxis 
            domain={[0, 100]}
            stroke="rgba(255, 255, 255, 0.7)"
            label={{ value: 'Security Score (%)', angle: -90, position: 'insideLeft', style: { fill: 'rgba(255, 255, 255, 0.7)' } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="securityScore" 
            stroke="#e10600" 
            name="Security Score (%)" 
            strokeWidth={3}
            dot={{ fill: '#e10600', r: 5 }}
            activeDot={{ r: 7 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

