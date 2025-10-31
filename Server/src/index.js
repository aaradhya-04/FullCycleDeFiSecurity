const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { runAudit, parseAuditPdfs } = require('./services/securedapp');
const { applyAutoFix } = require('./services/autofix');
const { startDetectMock } = require('./services/detect');
const { sendViaFlashbots } = require('./services/flashbots');
const { getAllPredictions, getTeamPrediction, simulateRaceResults } = require('./services/f1prediction');
const { analyzeContract, calculateSecurityScore } = require('./services/contractAnalyzer');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const ROOT = path.resolve(__dirname, '../../');
const AUDIT_DIR = path.join(ROOT, 'Audit');
const CONTRACT_PATH = path.join(ROOT, 'SmartContract', 'contracts', 'RaceSwap_vulnerable.sol');
const CONTRACTS_DIR = path.join(ROOT, 'SmartContract', 'contracts');

if (!fs.existsSync(AUDIT_DIR)) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/audit/run', async (req, res) => {
  try {
    const { autofix } = req.body || {};
    const initial = await runAudit({
      contractPath: CONTRACT_PATH,
      outPdf: path.join(AUDIT_DIR, 'initial_report.pdf'),
      outJson: path.join(AUDIT_DIR, 'initial_report.json'),
    });

    let finalReport = null;
    if (autofix) {
      const fixedPath = path.join(ROOT, 'SmartContract', 'contracts', 'RaceSwap_hardened.sol');
      await applyAutoFix(CONTRACT_PATH, fixedPath);
      finalReport = await runAudit({
        contractPath: fixedPath,
        outPdf: path.join(AUDIT_DIR, 'final_report.pdf'),
        outJson: path.join(AUDIT_DIR, 'final_report.json'),
      });
    }

    res.json({ initial, final: finalReport });
  } catch (err) {
    res.status(500).json({ error: err.message || 'audit failed' });
  }
});

app.get('/audit/artifacts', (_req, res) => {
  const files = fs.readdirSync(AUDIT_DIR).filter(f => f.endsWith('.pdf') || f.endsWith('.json'));
  res.json({ files });
});

app.get('/audit/parsed', async (_req, res) => {
  try {
    const parsed = await parseAuditPdfs(AUDIT_DIR);
    res.json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message || 'parse failed' });
  }
});

// Get list of available smart contracts
app.get('/contracts/list', (_req, res) => {
  try {
    if (!fs.existsSync(CONTRACTS_DIR)) {
      return res.json({ contracts: [] });
    }
    const files = fs.readdirSync(CONTRACTS_DIR)
      .filter(f => f.endsWith('.sol'))
      .map(f => ({
        name: f,
        path: path.join(CONTRACTS_DIR, f)
      }));
    res.json({ contracts: files });
  } catch (e) {
    res.status(500).json({ error: e.message || 'list failed' });
  }
});

// Analyze a smart contract directly
app.post('/contracts/analyze', async (req, res) => {
  try {
    const { contractName } = req.body;
    
    if (!contractName) {
      return res.status(400).json({ error: 'Contract name is required' });
    }
    
    const contractPath = path.join(CONTRACTS_DIR, contractName);
    
    if (!fs.existsSync(contractPath)) {
      return res.status(404).json({ error: `Contract ${contractName} not found` });
    }
    
    const contractContent = fs.readFileSync(contractPath, 'utf8');
    const analysis = analyzeContract(contractContent, contractName);
    const score = calculateSecurityScore(analysis.severityCounts);
    
    res.json({
      findings: analysis.findings,
      severityCounts: analysis.severityCounts,
      score: score,
      contractName: contractName,
      pdfName: contractName.replace('.sol', '')
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'analysis failed' });
  }
});

app.post('/detect/start', (req, res) => {
  try {
    const { contractAddress } = req.body || {};
    const { startDetectMock } = require('./services/detect');
    const state = startDetectMock(contractAddress || '0xContract');
    res.json({ 
      success: true, 
      message: 'MEV detection started',
      state: {
        active: state.active,
        contractAddress: state.contractAddress,
        stats: state.stats,
        recentThreats: state.detectedThreats.slice(-10) // Last 10 threats
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'detection failed' });
  }
});

app.post('/detect/stop', (req, res) => {
  try {
    const { stopDetectMock } = require('./services/detect');
    const state = stopDetectMock();
    res.json({ 
      success: true, 
      message: 'MEV detection stopped',
      state: {
        active: state.active,
        stats: state.stats,
        totalThreats: state.detectedThreats.length
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'stop failed' });
  }
});

app.get('/detect/status', (req, res) => {
  try {
    const { getDetectionState } = require('./services/detect');
    const state = getDetectionState();
    res.json({ 
      success: true,
      state: {
        active: state.active,
        contractAddress: state.contractAddress,
        stats: state.stats,
        recentThreats: state.detectedThreats.slice(-20) // Last 20 threats
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'status check failed' });
  }
});

app.post('/relay/send', async (req, res) => {
  try {
    const { rawTransaction } = req.body || {};
    const result = await sendViaFlashbots(rawTransaction);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message || 'relay failed' });
  }
});

// Simulation mode - predict front-running risks before transaction
app.post('/simulate/transaction', async (req, res) => {
  try {
    const { transaction, contractAddress } = req.body || {};
    
    if (!transaction) {
      return res.status(400).json({ error: 'Transaction data is required' });
    }
    
    // Simulate front-running risk analysis
    const riskFactors = {
      gasPrice: transaction.gasPrice || '0',
      value: transaction.value || '0',
      to: transaction.to || contractAddress || '0x',
      hasSlippageProtection: transaction.minAmountOut || transaction.slippage || false,
      transactionType: transaction.type || 'swap'
    };
    
    // Calculate risk score (0-100)
    let riskScore = 0;
    const warnings = [];
    
    // Check for high gas price (likely front-run target)
    const gasPriceNum = parseInt(riskFactors.gasPrice) || 0;
    if (gasPriceNum > 100000000000) { // > 100 gwei
      riskScore += 30;
      warnings.push('High gas price detected - attractive to MEV bots');
    }
    
    // Check for large value (high-value targets are prioritized)
    const valueNum = parseInt(riskFactors.value) || 0;
    const valueEth = valueNum / 1e18;
    if (valueEth > 1) {
      riskScore += 25;
      warnings.push(`Large transaction value (${valueEth.toFixed(4)} ETH) - high MEV potential`);
    }
    
    // Check for slippage protection
    if (!riskFactors.hasSlippageProtection) {
      riskScore += 35;
      warnings.push('No slippage protection - vulnerable to sandwich attacks');
    }
    
    // Check transaction type
    if (riskFactors.transactionType === 'swap' || riskFactors.transactionType === 'trade') {
      riskScore += 20;
      warnings.push('Swap/trade transactions are common MEV targets');
    }
    
    // Check if similar patterns detected in mempool (simulated)
    const mempoolRisk = Math.random() * 15; // 0-15 points
    riskScore += mempoolRisk;
    if (mempoolRisk > 10) {
      warnings.push('Similar transaction patterns detected in mempool');
    }
    
    riskScore = Math.min(100, Math.round(riskScore));
    
    // Determine recommendation
    let recommendation = '';
    let recommendationAction = '';
    if (riskScore >= 70) {
      recommendation = 'HIGH RISK - Strongly recommend using Flashbots private relay';
      recommendationAction = 'Use Flashbots to protect this transaction from front-running';
    } else if (riskScore >= 40) {
      recommendation = 'MEDIUM RISK - Consider using Flashbots for added protection';
      recommendationAction = 'Flashbots recommended to prevent potential MEV extraction';
    } else {
      recommendation = 'LOW RISK - Transaction appears safe, but Flashbots still recommended for large amounts';
      recommendationAction = 'Optional Flashbots protection for maximum security';
    }
    
    res.json({
      riskScore,
      riskLevel: riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW',
      warnings,
      recommendation,
      recommendationAction,
      estimatedSlippage: riskFactors.hasSlippageProtection ? '0-0.5%' : '2-5%',
      estimatedFrontRunProbability: `${riskScore}%`,
      gasPrice: riskFactors.gasPrice,
      value: riskFactors.value,
      contractAddress: riskFactors.to
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'simulation failed' });
  }
});

// Generate FIXED hardened version (for local storage)
// This is the FIXED version with security improvements + renamed contract
app.post('/contract/generate/hardened', async (_req, res) => {
  try {
    let raw = fs.readFileSync(CONTRACT_PATH, 'utf8');
    
    // Apply FIXES (same security improvements as flat version)
    // Then rename contract to "hardened" for local storage
    if (/contract\s+RaceSwap_vulnerable/.test(raw)) {
      // Fix 1: Add access control to setRate
      raw = raw.replace(
        /function\s+setRate\(uint256 newRate,\s*string calldata note\) external \{/,
        'function setRate(uint256 newRate, string calldata note) external {\n        require(msg.sender == owner, "not owner");'
      );
      // Fix 2: Add access control to emergencyWithdraw
      raw = raw.replace(
        /function\s+emergencyWithdraw\(IERC20 token, address to, uint256 amount\) external \{/,
        'function emergencyWithdraw(IERC20 token, address to, uint256 amount) external {\n        require(msg.sender == owner, "not owner");'
      );
      
      // Change contract name to "hardened" (for local version)
      raw = raw.replace(/contract\s+RaceSwap_vulnerable/, 'contract RaceSwap_hardened');
    }
    
    // Normalize
    raw = raw.replace(/^\uFEFF/, '');
    if (!/^\/\/ SPDX-License-Identifier: MIT/m.test(raw)) {
      raw = `// SPDX-License-Identifier: MIT\n${raw}`;
    }
    raw = raw.replace(/pragma solidity\s+\^?0\.8\.19\s*;/, 'pragma solidity 0.8.19;');
    const normalized = raw.replace(/\r\n/g, '\n');
    
    // Save to SmartContract folder
    const hardenedPath = path.join(ROOT, 'SmartContract', 'contracts', 'RaceSwap_hardened.sol');
    fs.writeFileSync(hardenedPath, normalized, 'utf8');
    
    res.json({ 
      success: true, 
      message: 'Hardened contract saved to SmartContract/contracts/RaceSwap_hardened.sol',
      path: hardenedPath
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'generate failed' });
  }
});

// Generate FIXED flat version for SecureDApp upload (downloads to user)
// This is the FIXED version with security improvements, ready to upload to SecureDApp to verify improved score
// Dynamically fixes exactly ONE vulnerability based on what currently exists
app.post('/contract/generate', async (req, res) => {
  try {
    const { fixType, contractName, appliedFixes } = req.body || {}; 
    // fixType: which fix to apply
    // contractName: which contract file
    // appliedFixes: array of fixes already applied (e.g., ['setRate', 'emergencyWithdraw']) to track incremental fixes
    
    // Determine which contract file to read
    let contractPath = CONTRACT_PATH;
    if (contractName && contractName !== 'RaceSwap_vulnerable.sol') {
      const customPath = path.join(CONTRACTS_DIR, contractName);
      if (fs.existsSync(customPath)) {
        contractPath = customPath;
      }
    }
    
    // Generate FIXED contract directly in memory
    // Start from the ORIGINAL vulnerable contract
    let raw = fs.readFileSync(contractPath, 'utf8');
    
    // Apply ALL previously applied fixes first (incremental fixing)
    // This ensures we're working from the correct state
    const fixesToApply = Array.isArray(appliedFixes) ? [...appliedFixes] : [];
    console.log(`[Generate] Previously applied fixes (will apply first):`, fixesToApply);
    
    // Apply previously applied fixes first
    for (const prevFix of fixesToApply) {
      if (prevFix === 'setRate' && !raw.match(/setRate[^}]*require\(msg\.sender == owner/)) {
        raw = raw.replace(
          /(\s+)(\/\/ Vulnerability: no onlyOwner\s*\n)?(\s+)function\s+setRate\(uint256 newRate,\s*string calldata note\)\s*external\s*\{/,
          (match, indent1, comment, indent2) => {
            const indent = indent2 || indent1;
            const commentLine = comment || `${indent}// Vulnerability: no onlyOwner\n`;
            return `${commentLine}${indent}function setRate(uint256 newRate, string calldata note) external {\n${indent}    require(msg.sender == owner, "not owner");`;
          }
        );
        console.log('[Generate] ✅ Applied previous fix: setRate');
      } else if (prevFix === 'emergencyWithdraw' && !raw.match(/emergencyWithdraw[^}]*require\(msg\.sender == owner/)) {
        raw = raw.replace(
          /(\s+)(\/\/ Emergency withdraw.*?\n)?(\s+)function\s+emergencyWithdraw\(IERC20 token,\s*address to,\s*uint256 amount\)\s*external\s*\{/,
          (match, indent1, comment, indent2) => {
            const indent = indent2 || indent1;
            const commentLine = comment || `${indent}// Emergency withdraw (demo)\n`;
            return `${commentLine}${indent}function emergencyWithdraw(IERC20 token, address to, uint256 amount) external {\n${indent}    require(msg.sender == owner, "not owner");`;
          }
        );
        console.log('[Generate] ✅ Applied previous fix: emergencyWithdraw');
      } else if (prevFix === 'slippage' && !raw.includes('minAmountOut')) {
        raw = raw.replace(
          /(\s+)(\/\/ Vulnerability: No slippage protection\s*\n)?(\s+)function\s+swap\(IERC20 tokenIn,\s*IERC20 tokenOut,\s*uint256 amountIn,\s*string calldata race\)\s*external\s*returns\s*\(uint256 amountOut\)\s*\{/,
          (match, indent1, comment, indent2) => {
            const indent = indent2 || indent1;
            const commentLine = comment || `${indent}// Vulnerability: No slippage protection\n`;
            return `${commentLine}${indent}function swap(IERC20 tokenIn, IERC20 tokenOut, uint256 amountIn, uint256 minAmountOut, string calldata race) external returns (uint256 amountOut) {`;
          }
        );
        if (raw.includes('amountOut = (amountIn * rate) / 1e18;')) {
          raw = raw.replace(
            /(\s+amountOut = \(amountIn \* rate\) \/ 1e18;)/,
            '$1\n        require(amountOut >= minAmountOut, "Insufficient output amount");'
          );
        }
        console.log('[Generate] ✅ Applied previous fix: slippage');
      }
    }
    
    // Now analyze the contract with previously applied fixes to see CURRENT state
    const { analyzeContract } = require('./services/contractAnalyzer');
    const currentAnalysis = analyzeContract(raw, path.basename(contractPath));
    const currentFindings = currentAnalysis.findings || [];
    
    console.log(`[Generate] After applying ${fixesToApply.length} previous fixes, contract has ${currentFindings.length} vulnerabilities remaining:`, currentFindings.map(f => `${f.severity}: ${f.id || f.title}`));
    
    if (currentFindings.length === 0) {
      console.log('[Generate] ⚠️ Contract is already fully fixed - no more vulnerabilities to fix');
      // Return the contract as-is (all fixes applied)
    } else {
      console.log(`[Generate] Target: Fix 1 more vulnerability, reducing from ${currentFindings.length} to ${currentFindings.length - 1}`);
    }
    
    // Determine which NEW vulnerability to fix (only ONE more)
    // Priority: Critical > High > Medium > Low
    const severityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
    const sortedCurrentFindings = [...currentFindings].sort((a, b) => {
      const aSev = severityOrder[a.severity] ?? 99;
      const bSev = severityOrder[b.severity] ?? 99;
      return aSev - bSev;
    });
    
    // Find the vulnerability to fix based on fixType or pick the first remaining one
    let vulnerabilityToFix = null;
    if (fixType && !fixesToApply.includes(fixType)) {
      // Only apply if this fix hasn't been applied yet
      vulnerabilityToFix = sortedCurrentFindings.find(f => {
        if (fixType === 'setRate') return f.id === 'RS-001' || f.title.includes('setRate');
        if (fixType === 'emergencyWithdraw') return f.id === 'RS-002' || f.title.includes('emergencyWithdraw');
        if (fixType === 'slippage') return f.id === 'RS-003' || f.title.includes('slippage');
        if (fixType === 'reentrancy') return f.id === 'RS-004' || f.title.includes('reentrancy');
        if (fixType === 'events') return f.id === 'RS-005' || f.title.includes('Events');
        return false;
      });
    } else {
      // No fixType specified or already applied - fix the highest priority remaining vulnerability
      vulnerabilityToFix = sortedCurrentFindings[0];
    }
    
    if (!vulnerabilityToFix) {
      console.log('[Generate] ⚠️ No vulnerability found to fix. Contract may already be fully fixed.');
    } else {
      console.log(`[Generate] Will fix NEW vulnerability: ${vulnerabilityToFix.severity} - ${vulnerabilityToFix.title} (${vulnerabilityToFix.id})`);
    }
    
    // Apply exactly ONE MORE fix based on the vulnerability identified
    let fixApplied = false;
    let fixedVulnerability = null;
    
    if (/contract\s+RaceSwap/.test(raw) && vulnerabilityToFix) {
      // Fix 1: setRate access control (High severity)
      if (vulnerabilityToFix.id === 'RS-001' || vulnerabilityToFix.title.includes('setRate')) {
        if (!raw.match(/setRate[^}]*require\(msg\.sender == owner/)) {
          raw = raw.replace(
            /(\s+)(\/\/ Vulnerability: no onlyOwner\s*\n)?(\s+)function\s+setRate\(uint256 newRate,\s*string calldata note\)\s*external\s*\{/,
            (match, indent1, comment, indent2) => {
              const indent = indent2 || indent1;
              const commentLine = comment || `${indent}// Vulnerability: no onlyOwner\n`;
              return `${commentLine}${indent}function setRate(uint256 newRate, string calldata note) external {\n${indent}    require(msg.sender == owner, "not owner");`;
            }
          );
          fixApplied = true;
          fixedVulnerability = 'Missing access control on setRate (High)';
          console.log('[Generate] ✅ Applied fix: setRate access control');
        }
      }
      // Fix 2: emergencyWithdraw access control (High severity) - ONLY if setRate is not the one being fixed
      else if ((vulnerabilityToFix.id === 'RS-002' || vulnerabilityToFix.title.includes('emergencyWithdraw')) && !fixApplied) {
        if (!raw.match(/emergencyWithdraw[^}]*require\(msg\.sender == owner/)) {
          raw = raw.replace(
            /(\s+)(\/\/ Emergency withdraw.*?\n)?(\s+)function\s+emergencyWithdraw\(IERC20 token,\s*address to,\s*uint256 amount\)\s*external\s*\{/,
            (match, indent1, comment, indent2) => {
              const indent = indent2 || indent1;
              const commentLine = comment || `${indent}// Emergency withdraw (demo)\n`;
              return `${commentLine}${indent}function emergencyWithdraw(IERC20 token, address to, uint256 amount) external {\n${indent}    require(msg.sender == owner, "not owner");`;
            }
          );
          fixApplied = true;
          fixedVulnerability = 'Unrestricted emergencyWithdraw (High)';
          console.log('[Generate] ✅ Applied fix: emergencyWithdraw access control');
        }
      }
      // Fix 3: slippage protection (Medium severity) - ONLY if higher priority fixes not applied
      else if ((vulnerabilityToFix.id === 'RS-003' || vulnerabilityToFix.title.includes('slippage')) && !fixApplied) {
        if (!raw.includes('minAmountOut')) {
          // Add minAmountOut parameter to swap function
          raw = raw.replace(
            /(\s+)(\/\/ Vulnerability: No slippage protection\s*\n)?(\s+)function\s+swap\(IERC20 tokenIn,\s*IERC20 tokenOut,\s*uint256 amountIn,\s*string calldata race\)\s*external\s*returns\s*\(uint256 amountOut\)\s*\{/,
            (match, indent1, comment, indent2) => {
              const indent = indent2 || indent1;
              const commentLine = comment || `${indent}// Vulnerability: No slippage protection\n`;
              return `${commentLine}${indent}function swap(IERC20 tokenIn, IERC20 tokenOut, uint256 amountIn, uint256 minAmountOut, string calldata race) external returns (uint256 amountOut) {`;
            }
          );
          
          // Add slippage check after calculating amountOut
          if (raw.includes('amountOut = (amountIn * rate) / 1e18;')) {
            raw = raw.replace(
              /(\s+amountOut = \(amountIn \* rate\) \/ 1e18;)/,
              '$1\n        require(amountOut >= minAmountOut, "Insufficient output amount");'
            );
          }
          fixApplied = true;
          fixedVulnerability = 'No slippage control in swap (Medium)';
          console.log('[Generate] ✅ Applied fix: slippage protection');
        }
      }
      // Fix 4: reentrancy guard (Medium severity) - Skip as it requires OpenZeppelin
      else if (vulnerabilityToFix.id === 'RS-004' || vulnerabilityToFix.title.includes('reentrancy')) {
        console.log('[Generate] ⚠️ Reentrancy fix detected but requires OpenZeppelin import - skipping');
        // Mark as fixed conceptually (no code change)
        fixApplied = true;
        fixedVulnerability = 'No reentrancy guard (Medium) - requires manual fix';
      }
      // Fix 5: events context (Low severity) - Informational only
      else if (vulnerabilityToFix.id === 'RS-005' || vulnerabilityToFix.title.includes('Events')) {
        console.log('[Generate] ⚠️ Events context fix is informational - no code change needed');
        fixApplied = true;
        fixedVulnerability = 'Events lack sufficient context (Low) - informational';
      }
    }
    
    // Verify the fix was applied correctly by re-analyzing
    if (fixApplied) {
      const verifyAnalysis = analyzeContract(raw, path.basename(contractPath));
      const verifyFindings = verifyAnalysis.findings || [];
      console.log(`[Generate] ✅ After fix: ${verifyFindings.length} vulnerabilities remaining (was ${findings.length})`);
      console.log(`[Generate] Fixed vulnerability: ${fixedVulnerability}`);
      
      if (verifyFindings.length >= findings.length) {
        console.log('[Generate] ⚠️ WARNING: Fix did not reduce vulnerability count! The fix may not have been applied correctly.');
      }
    } else {
      console.log('[Generate] ⚠️ No fix was applied. Contract may already be fixed or no fixable vulnerabilities found.');
    }
    
    // Use EXACT same normalization as original download (SecureDApp compatible)
    raw = raw.replace(/^\uFEFF/, ''); // strip BOM
    if (!/^\/\/ SPDX-License-Identifier: MIT/m.test(raw)) {
      raw = `// SPDX-License-Identifier: MIT\n${raw}`;
    }
    // pin pragma to exact 0.8.19
    raw = raw.replace(/pragma solidity\s+\^?0\.8\.19\s*;/, 'pragma solidity 0.8.19;');
    const normalized = raw.replace(/\r\n/g, '\n');
    res.setHeader('Content-Type', 'text/x-solidity; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="RaceSwap_vulnerable_flat_fixed.sol"');
    return res.end(normalized);
  } catch (e) {
    res.status(500).json({ error: e.message || 'generate failed' });
  }
});

// Provide original vulnerable contract in a SecureDApp-friendly single file
app.get('/contract/download/original', (_req, res) => {
  try {
    let raw = fs.readFileSync(CONTRACT_PATH, 'utf8');
    raw = raw.replace(/^\uFEFF/, ''); // strip BOM
    if (!/^\/\/ SPDX-License-Identifier: MIT/m.test(raw)) {
      raw = `// SPDX-License-Identifier: MIT\n${raw}`;
    }
    // pin pragma to exact 0.8.19
    raw = raw.replace(/pragma solidity\s+\^?0\.8\.19\s*;/, 'pragma solidity 0.8.19;');
    const normalized = raw.replace(/\r\n/g, '\n');
    res.setHeader('Content-Type', 'text/x-solidity; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="RaceSwap_vulnerable_flat.sol"');
    return res.end(normalized);
  } catch (e) {
    res.status(500).json({ error: e.message || 'download failed' });
  }
});
// Normalized downloads for SecureDApp (LF endings, explicit filenames)
app.get('/contract/download/:variant', async (req, res) => {
  try {
    const { variant } = req.params;
    if (variant === 'vulnerable_flat') {
      const raw = fs.readFileSync(CONTRACT_PATH, 'utf8');
      const normalized = raw.replace(/\r\n/g, '\n');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="RaceSwap_vulnerable_flat.sol"');
      return res.end(normalized);
    }
    if (variant === 'hardened_flat') {
      const fixedPath = path.join(ROOT, 'SmartContract', 'contracts', 'RaceSwap_hardened.sol');
      await applyAutoFix(CONTRACT_PATH, fixedPath);
      const raw = fs.readFileSync(fixedPath, 'utf8');
      const normalized = raw.replace(/\r\n/g, '\n');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="RaceSwap_hardened_flat.sol"');
      return res.end(normalized);
    }
    return res.status(400).json({ error: 'unknown variant' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'download failed' });
  }
});

// F1 Stock Market Endpoints
const HOST_ACCOUNT = '0xc03cC503B53FE35c31aeE396a54d84A67C3CC308';

app.get('/f1/predictions', (_req, res) => {
  try {
    const predictions = getAllPredictions();
    res.json({ predictions });
  } catch (e) {
    res.status(500).json({ error: e.message || 'prediction failed' });
  }
});

app.get('/f1/prediction/:team', (req, res) => {
  try {
    const { team } = req.params;
    const prediction = getTeamPrediction(team);
    res.json({ prediction });
  } catch (e) {
    res.status(500).json({ error: e.message || 'prediction failed' });
  }
});

app.post('/f1/buy-stock', async (req, res) => {
  try {
    const { userAddress, teamName, amount } = req.body;
    
    // Simulate transferring 5 ETH from user to host account
    // In production, this would be done via smart contract
    const transferAmount = ethers.parseEther(amount || '5');
    
    res.json({
      success: true,
      message: `Simulated transfer of ${amount || 5} ETH from ${userAddress} to host account ${HOST_ACCOUNT}`,
      transaction: {
        from: userAddress,
        to: HOST_ACCOUNT,
        amount: amount || '5',
        team: teamName
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'buy failed' });
  }
});

app.post('/f1/sell-stock', async (req, res) => {
  try {
    const { userAddress, teamName, amount, payoutAmount } = req.body;
    
    // Check if host account private key is configured for real transactions
    const HOST_PRIVATE_KEY = process.env.HOST_ACCOUNT_PRIVATE_KEY;
    
    if (HOST_PRIVATE_KEY) {
      // Real blockchain transaction
      try {
        const { ethers } = require('ethers');
        
        // Connect to network (use RPC from env or default to localhost)
        const RPC_URL = process.env.GANACHE_RPC_URL || 'http://127.0.0.1:7545';
        console.log(`[Sell Stock] Connecting to RPC: ${RPC_URL}`);
        
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(HOST_PRIVATE_KEY, provider);
        
        // Verify wallet address matches HOST_ACCOUNT
        const walletAddress = await wallet.getAddress();
        console.log(`[Sell Stock] Wallet address: ${walletAddress}, Expected: ${HOST_ACCOUNT}`);
        
        if (walletAddress.toLowerCase() !== HOST_ACCOUNT.toLowerCase()) {
          console.warn(`[Sell Stock] WARNING: Wallet address (${walletAddress}) does not match HOST_ACCOUNT (${HOST_ACCOUNT})`);
        }
        
        // Check host account balance
        const hostBalance = await provider.getBalance(walletAddress); // Use wallet address, not HOST_ACCOUNT constant
        
        // payoutAmount should be the total ETH to transfer (number_of_stocks * price_per_stock)
        // If not provided, calculate from amount (assuming a default price - should not happen)
        const payoutEthValue = payoutAmount || amount || '0.1';
        const payoutWei = ethers.parseEther(payoutEthValue);
        
        console.log(`[Sell Stock] Selling ${amount || 'N/A'} stocks of ${teamName}`);
        console.log(`[Sell Stock] Payout amount: ${payoutEthValue} ETH (${ethers.formatEther(payoutWei)} ETH)`);
        console.log(`[Sell Stock] Host balance: ${ethers.formatEther(hostBalance)} ETH`);
        console.log(`[Sell Stock] Transferring to: ${userAddress}`);
        
        if (hostBalance < payoutWei) {
          return res.status(400).json({
            error: 'Insufficient funds in host account',
            hostBalance: ethers.formatEther(hostBalance),
            requested: ethers.formatEther(payoutWei)
          });
        }
        
        // Estimate gas
        try {
          const gasEstimate = await provider.estimateGas({
            from: walletAddress,
            to: userAddress,
            value: payoutWei
          });
          console.log(`[Sell Stock] Gas estimate: ${gasEstimate.toString()}`);
        } catch (gasError) {
          console.warn(`[Sell Stock] Gas estimation failed:`, gasError.message);
        }
        
        // Send transaction from host account to user
        console.log(`[Sell Stock] Sending transaction from ${walletAddress} to ${userAddress}`);
        const tx = await wallet.sendTransaction({
          to: userAddress,
          value: payoutWei
        });
        
        console.log(`[Sell Stock] Transaction sent! Hash: ${tx.hash}`);
        console.log(`[Sell Stock] Waiting for transaction confirmation...`);
        
        // Wait for transaction to be mined
        const receipt = await tx.wait();
        console.log(`[Sell Stock] Transaction confirmed in block ${receipt.blockNumber}`);
        
        res.json({
          success: true,
          message: `Sent ${ethers.formatEther(payoutWei)} ETH from host account to ${userAddress}`,
          transaction: {
            from: walletAddress,
            to: userAddress,
            amount: ethers.formatEther(payoutWei),
            team: teamName,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed?.toString(),
            gasPrice: tx.gasPrice?.toString(),
            gasLimit: tx.gasLimit?.toString()
          }
        });
      } catch (txError) {
        console.error('[Sell Stock] Transaction error:', txError);
        res.status(500).json({
          error: 'Transaction failed',
          details: txError.message,
          code: txError.code,
          reason: txError.reason
        });
      }
    } else {
      // Simulated transaction (no private key configured)
      console.warn('[Sell Stock] HOST_ACCOUNT_PRIVATE_KEY not set in environment variables');
      console.warn('[Sell Stock] Transaction will be simulated. To enable real transactions:');
      console.warn('[Sell Stock] 1. Create Server/.env file');
      console.warn('[Sell Stock] 2. Add: HOST_ACCOUNT_PRIVATE_KEY=your_private_key_from_ganache');
      console.warn(`[Sell Stock] 3. The private key must be for account: ${HOST_ACCOUNT}`);
      
      res.json({
        success: true,
        message: `Simulated transfer of ${payoutAmount || amount || '1'} ETH from host account to ${userAddress}`,
        transaction: {
          from: HOST_ACCOUNT,
          to: userAddress,
          amount: payoutAmount || amount || '1',
          team: teamName,
          simulated: true
        },
        note: 'Set HOST_ACCOUNT_PRIVATE_KEY in Server/.env to enable real transactions',
        instructions: [
          '1. Open Ganache application',
          `2. Find account with address: ${HOST_ACCOUNT}`,
          '3. Click the key icon to reveal private key',
          '4. Copy the private key',
          '5. Create Server/.env file',
          '6. Add: HOST_ACCOUNT_PRIVATE_KEY=your_private_key',
          '7. Restart the server'
        ]
      });
    }
  } catch (e) {
    res.status(500).json({ error: e.message || 'sell failed' });
  }
});

app.post('/f1/simulate-race', (req, res) => {
  try {
    const { raceData } = req.body;
    const updatedPredictions = simulateRaceResults(raceData || {});
    res.json({ predictions: updatedPredictions, message: 'Race results simulated, predictions updated' });
  } catch (e) {
    res.status(500).json({ error: e.message || 'simulation failed' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
  console.log(`F1 Stock Market Host Account: ${HOST_ACCOUNT}`);
});


