const fs = require('fs');

function applyAutoFix(srcPath, dstPath) {
  const original = fs.readFileSync(srcPath, 'utf8');
  let updated = original;

  // Keep EXACT same structure, just add minimal require checks
  if (!/contract\s+RaceSwap_vulnerable/.test(updated)) {
    fs.writeFileSync(dstPath, updated, 'utf8');
    return;
  }

  // Fix 1: Add access control to setRate function
  // Match the exact pattern with flexible whitespace
  const setRatePattern = /(\s+)(\/\/ Vulnerability: no onlyOwner\s*\n)?(\s+)function\s+setRate\(uint256 newRate,\s*string calldata note\)\s*external\s*\{/;
  if (setRatePattern.test(updated) && !updated.match(/setRate[^}]*require\(msg\.sender == owner/)) {
    updated = updated.replace(
      setRatePattern,
      (match, indent1, comment, indent2) => {
        const indent = indent2 || indent1;
        const commentLine = comment || `${indent}// Vulnerability: no onlyOwner\n`;
        return `${commentLine}${indent}function setRate(uint256 newRate, string calldata note) external {\n${indent}    require(msg.sender == owner, "not owner");`;
      }
    );
  }

  // Fix 2: Add access control to emergencyWithdraw function  
  const emergencyPattern = /(\s+)(\/\/ Emergency withdraw.*?\n)?(\s+)function\s+emergencyWithdraw\(IERC20 token,\s*address to,\s*uint256 amount\)\s*external\s*\{/;
  if (emergencyPattern.test(updated) && !updated.match(/emergencyWithdraw[^}]*require\(msg\.sender == owner/)) {
    updated = updated.replace(
      emergencyPattern,
      (match, indent1, comment, indent2) => {
        const indent = indent2 || indent1;
        const commentLine = comment || `${indent}// Emergency withdraw (demo)\n`;
        return `${commentLine}${indent}function emergencyWithdraw(IERC20 token, address to, uint256 amount) external {\n${indent}    require(msg.sender == owner, "not owner");`;
      }
    );
  }

  // Fix 3: Add slippage protection to swap function
  const swapPattern = /(\s+)(\/\/ Vulnerability: No slippage protection\s*\n)?(\s+)function\s+swap\(IERC20 tokenIn,\s*IERC20 tokenOut,\s*uint256 amountIn,\s*string calldata race\)\s*external\s*returns\s*\(uint256 amountOut\)\s*\{/;
  if (swapPattern.test(updated) && !updated.includes('minAmountOut')) {
    // Add minAmountOut parameter
    updated = updated.replace(
      swapPattern,
      (match, indent1, comment, indent2) => {
        const indent = indent2 || indent1;
        const commentLine = comment || `${indent}// Vulnerability: No slippage protection\n`;
        return `${commentLine}${indent}function swap(IERC20 tokenIn, IERC20 tokenOut, uint256 amountIn, uint256 minAmountOut, string calldata race) external returns (uint256 amountOut) {`;
      }
    );
    
    // Add slippage check after amountOut calculation
    const amountOutPattern = /(\s+amountOut = \(amountIn \* rate\) \/ 1e18;)/;
    if (amountOutPattern.test(updated)) {
      updated = updated.replace(
        amountOutPattern,
        '$1\n        require(amountOut >= minAmountOut, "Insufficient output amount");'
      );
    }
  }

  // DO NOT change contract name - keep it as RaceSwap_vulnerable so SecureDApp accepts it

  fs.writeFileSync(dstPath, updated, 'utf8');
}

module.exports = { applyAutoFix };
