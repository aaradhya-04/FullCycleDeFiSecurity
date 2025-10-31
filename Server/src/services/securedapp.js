const fs = require('fs');
const path = require('path');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const pdfParse = require('pdf-parse');

async function runAudit({ contractPath, outPdf, outJson }) {
  const apiKey = process.env.SECUREDAPP_API_KEY;
  const endpoint = process.env.SECUREDAPP_ENDPOINT || 'https://api.securedapp.ai/audit-express';

  const contractSource = fs.readFileSync(contractPath, 'utf8');

  // If no API key, return a mocked result and generate a placeholder PDF
  if (!apiKey) {
    const mock = {
      tool: 'SecureDApp Audit Express (mocked)',
      score: 82,
      severityCounts: { critical: 0, high: 2, medium: 2, low: 1 },
      findings: [
        { id: 'RS-001', severity: 'High', title: 'Missing access control on setRate', fixed: false },
        { id: 'RS-002', severity: 'High', title: 'Unrestricted emergencyWithdraw', fixed: false },
        { id: 'RS-003', severity: 'Medium', title: 'No slippage control in swap', fixed: false },
        { id: 'RS-004', severity: 'Medium', title: 'No reentrancy guard', fixed: false },
        { id: 'RS-005', severity: 'Low', title: 'Events lack sufficient context', fixed: false }
      ]
    };
    writePdf(outPdf, 'SecureDApp Audit (Mock)', contractPath, mock);
    fs.writeFileSync(outJson, JSON.stringify(mock, null, 2));
    return mock;
  }

  try {
    const resp = await axios.post(
      endpoint,
      { source: contractSource, fileName: path.basename(contractPath) },
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    const data = resp.data;
    fs.writeFileSync(outJson, JSON.stringify(data, null, 2));
    writePdf(outPdf, 'SecureDApp Audit', contractPath, data);
    return data;
  } catch (e) {
    throw new Error(`SecureDApp audit failed: ${e.response?.data?.message || e.message}`);
  }
}

function writePdf(outPath, title, contractPath, report) {
  const doc = new PDFDocument();
  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);
  doc.fontSize(18).text(title, { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(`Contract: ${path.basename(contractPath)}`);
  doc.text(`Score: ${report.score}`);
  doc.moveDown();
  doc.text('Findings:');
  (report.findings || []).forEach((f, i) => {
    doc.text(`${i + 1}. [${f.severity}] ${f.title}`);
  });
  doc.end();
}

module.exports = { runAudit };

async function parseAuditPdfs(auditDir) {
  const files = fs.readdirSync(auditDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  const findings = [];
  let extractedScore = null;
  let pdfName = null;
  
  for (const f of files) {
    try {
      const buf = fs.readFileSync(path.join(auditDir, f));
      const parsed = await pdfParse(buf);
      const text = parsed.text || '';
      const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      
      // Extract PDF name from filename
      if (!pdfName) {
        pdfName = f.replace(/\.pdf$/i, '');
      }
      
      // Extract security score from PDF text
      // SecureDApp formats can vary, so check entire text first, then line by line
      // Look for patterns in the full text first (some PDFs may have score across lines)
      const fullTextLower = text.toLowerCase();
      
      // Try to find score in full text (handles multi-line scores)
      const fullTextPatterns = [
        /(?:security\s+)?score\s*[:\-]?\s*(\d+\.?\d*)\s*%/i,
        /score\s*[:\-]?\s*(\d+\.?\d*)\s*%/i,
        /(\d+\.?\d*)\s*%\s*(?:security\s+)?score/i,
        /security\s+score[:\-]?\s*(\d+\.?\d*)/i,
        /score[:\-]?\s*(\d+\.?\d*)/i,
      ];
      
      for (const pattern of fullTextPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          const scoreValue = parseFloat(match[1]);
          if (!isNaN(scoreValue) && scoreValue >= 0 && scoreValue <= 100) {
            extractedScore = scoreValue;
            break;
          }
        }
      }
      
      // If not found in full text, try line by line
      if (extractedScore === null) {
        for (const line of lines) {
          // Try multiple patterns to match SecureDApp score format
          const scorePatterns = [
            /(?:Security\s+)?Score\s*[:\-]?\s*(\d+\.?\d*)\s*%/i,
            /Score\s*[:\-]?\s*(\d+\.?\d*)/i,
            /(\d+\.?\d*)\s*%\s*Security\s+Score/i,
            /Security\s+Score\s*[:\-]?\s*(\d+\.?\d*)/i,
            /(\d+\.?\d*)\s*\(?Security\s+Score\)?/i,
            /score[:\-]\s*(\d+\.?\d*)/i,
          ];
          
          for (const pattern of scorePatterns) {
            const match = line.match(pattern);
            if (match && match[1]) {
              const scoreValue = parseFloat(match[1]);
              if (!isNaN(scoreValue) && scoreValue >= 0 && scoreValue <= 100) {
                extractedScore = scoreValue;
                break;
              }
            }
          }
          if (extractedScore !== null) break;
        }
      }
      
      // Also check for just numbers that look like scores (90-100 range, possibly with decimals)
      if (extractedScore === null) {
        for (const line of lines) {
          const numberPattern = /\b(9[0-9]\.?\d*|100)\b/; // Match 90-100 range
          const match = line.match(numberPattern);
          if (match) {
            const scoreValue = parseFloat(match[1]);
            if (scoreValue >= 90 && scoreValue <= 100 && line.toLowerCase().includes('score')) {
              extractedScore = scoreValue;
              break;
            }
          }
        }
      }
      
      // Debug: log extracted score
      if (extractedScore !== null) {
        console.log(`[PDF Parser] Extracted score ${extractedScore} from ${f}`);
      } else {
        console.log(`[PDF Parser] Could not extract score from ${f}. Sample text:`, text.substring(0, 500));
      }
      
      // Also look for vulnerability findings in all lines
      for (const line of lines) {
        const m = line.match(/\[(Critical|High|Medium|Low)\]\s*(.+)/i) || line.match(/(Critical|High|Medium|Low)\s*[:\-]\s*(.+)/i);
        if (m) {
          findings.push({ severity: capitalize(m[1]), title: m[2].trim(), source: f });
        }
      }
    } catch (_) {
      // ignore parse errors per file
    }
  }
  
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const v of findings) {
    if (/^critical$/i.test(v.severity)) counts.critical++;
    else if (/^high$/i.test(v.severity)) counts.high++;
    else if (/^medium$/i.test(v.severity)) counts.medium++;
    else if (/^low$/i.test(v.severity)) counts.low++;
  }
  
  return { 
    findings, 
    severityCounts: counts,
    score: extractedScore, // Include extracted score from PDF
    pdfName: pdfName // Include PDF name
  };
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s }

module.exports.parseAuditPdfs = parseAuditPdfs;


