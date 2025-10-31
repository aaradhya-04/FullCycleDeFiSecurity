let intervalRef = null;
let detectionState = {
  active: false,
  contractAddress: null,
  detectedThreats: [],
  stats: {
    totalDetected: 0,
    sandwichAttacks: 0,
    frontRuns: 0,
    totalSlippageRisk: 0,
    avgRiskScore: 0
  }
};

function startDetectMock(contractAddress) {
  if (intervalRef) {
    return detectionState;
  }
  
  detectionState.active = true;
  detectionState.contractAddress = contractAddress;
  detectionState.detectedThreats = [];
  detectionState.stats = {
    totalDetected: 0,
    sandwichAttacks: 0,
    frontRuns: 0,
    totalSlippageRisk: 0,
    avgRiskScore: 0
  };
  
  intervalRef = setInterval(() => {
    const attackTypes = ['Sandwich Attack', 'Front-Running', 'Back-Running', 'MEV Extraction'];
    const type = attackTypes[Math.floor(Math.random() * attackTypes.length)];
    const risk = Math.round(30 + Math.random() * 70);
    const slippage = parseFloat((Math.random() * 5).toFixed(2));
    
    const threat = {
      id: `threat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      contractAddress,
      type,
      risk,
      slippageEstimated: slippage + '%',
      userAffected: `0x${Math.random().toString(16).substr(2, 40)}`,
      timestamp: Date.now(),
      transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
      gasPrice: Math.round(50 + Math.random() * 200) + ' gwei',
      potentialLoss: (slippage * 1000).toFixed(4) + ' ETH'
    };
    
    detectionState.detectedThreats.push(threat);
    
    // Update stats
    detectionState.stats.totalDetected++;
    if (type.includes('Sandwich')) detectionState.stats.sandwichAttacks++;
    if (type.includes('Front')) detectionState.stats.frontRuns++;
    detectionState.stats.totalSlippageRisk += slippage;
    detectionState.stats.avgRiskScore = Math.round(
      detectionState.detectedThreats.reduce((sum, t) => sum + t.risk, 0) / detectionState.detectedThreats.length
    );
    
    // Keep only last 50 threats
    if (detectionState.detectedThreats.length > 50) {
      detectionState.detectedThreats.shift();
    }
    
    console.log('🚨 Detection event:', threat);
  }, 3000); // Generate threat every 3 seconds
  
  return detectionState;
}

function stopDetectMock() {
  if (intervalRef) {
    clearInterval(intervalRef);
    intervalRef = null;
  }
  detectionState.active = false;
  return detectionState;
}

function getDetectionState() {
  return detectionState;
}

module.exports = { startDetectMock, stopDetectMock, getDetectionState };


