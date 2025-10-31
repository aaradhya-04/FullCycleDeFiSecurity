// AI-powered F1 Stock Prediction Service
// Uses historical data patterns and team performance metrics

const fs = require('fs');
const path = require('path');

// Mock historical race data for predictions
const historicalData = {
  "Mercedes": { wins: 8, poles: 6, points: 400, trend: 1.05 },
  "Red Bull": { wins: 14, poles: 8, points: 520, trend: 1.15 },
  "Ferrari": { wins: 5, poles: 5, points: 350, trend: 1.02 },
  "McLaren": { wins: 2, poles: 2, points: 280, trend: 0.98 },
  "Aston Martin": { wins: 1, poles: 1, points: 230, trend: 0.95 },
  "Alpine": { wins: 1, poles: 0, points: 180, trend: 0.92 },
  "AlphaTauri": { wins: 0, poles: 0, points: 120, trend: 0.90 },
  "Haas": { wins: 0, poles: 0, points: 80, trend: 0.88 },
  "Alfa Romeo": { wins: 0, poles: 0, points: 60, trend: 0.85 },
  "Williams": { wins: 0, poles: 0, points: 40, trend: 0.82 }
};

function calculatePrediction(teamName) {
  const data = historicalData[teamName] || { wins: 0, poles: 0, points: 100, trend: 1.0 };
  
  // AI prediction algorithm (simplified)
  const basePrice = 0.1; // in ether
  const performanceFactor = (data.points / 500) * 0.5; // Normalized to 0-0.5
  const momentumFactor = data.trend * 0.3;
  const volatilityFactor = (Math.random() * 0.1 - 0.05); // ±5% randomness
  
  const predictedPrice = basePrice * (1 + performanceFactor + momentumFactor + volatilityFactor);
  
  return {
    teamName,
    currentPrice: basePrice,
    predictedPrice: Math.max(0.05, Math.min(0.5, predictedPrice)), // Clamp between 0.05 and 0.5 ETH
    confidence: Math.min(95, 70 + (data.points / 10)), // 70-95% confidence
    trend: data.trend > 1 ? 'upward' : 'downward',
    factors: {
      performance: performanceFactor * 100,
      momentum: (data.trend - 1) * 100,
      recentWins: data.wins
    },
    recommendation: predictedPrice > basePrice ? 'BUY' : 'SELL',
    riskLevel: data.points > 300 ? 'LOW' : data.points > 150 ? 'MEDIUM' : 'HIGH'
  };
}

function getAllPredictions() {
  return Object.keys(historicalData).map(team => calculatePrediction(team));
}

function getTeamPrediction(teamName) {
  return calculatePrediction(teamName);
}

// Simulate price prediction based on match results
function simulateRaceResults(raceData) {
  // Update historical data based on race results
  Object.keys(raceData).forEach(team => {
    if (historicalData[team]) {
      historicalData[team].wins += raceData[team].position === 1 ? 1 : 0;
      historicalData[team].points += raceData[team].points || 0;
      
      // Update trend based on performance
      const performanceRatio = (raceData[team].points || 0) / 26; // Max points per race
      historicalData[team].trend = 0.7 * historicalData[team].trend + 0.3 * (1 + performanceRatio * 0.2);
    }
  });
  
  return getAllPredictions();
}

module.exports = {
  getAllPredictions,
  getTeamPrediction,
  simulateRaceResults,
  historicalData
};

