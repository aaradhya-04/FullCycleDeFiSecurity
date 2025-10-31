# Full-Cycle DeFi Security - Setup Guide

## Prerequisites
- Node.js (v18 or higher)
- npm (comes with Node.js)
- MetaMask browser extension

## Step-by-Step Setup

### 1. Install Backend Dependencies

Open PowerShell/Terminal and navigate to the Server directory:

```powershell
cd C:\Users\aarya\OneDrive\Desktop\FullCycleDeFiSecurity-main\Server
npm install
```

This will install:
- express
- ethers
- axios
- cors
- dotenv
- pdf-parse
- pdfkit

### 2. Start the Backend Server

In the same Server directory:

```powershell
npm start
```

Or for development with auto-restart:

```powershell
npm run dev
```

The server will start on **http://localhost:4000**

You should see:
```
Server listening on 4000
F1 Stock Market Host Account: 0xc03cC503B53FE35c31aeE396a54d84A67C3CC308
```

**Keep this terminal window open!**

### 3. Install Frontend Dependencies

Open a **NEW** PowerShell/Terminal window and navigate to the frontend directory:

```powershell
cd C:\Users\aarya\OneDrive\Desktop\FullCycleDeFiSecurity-main\frontend
npm install
```

This will install:
- react
- react-dom
- ethers
- axios
- recharts
- vite
- @vitejs/plugin-react

### 4. Start the Frontend Development Server

In the frontend directory:

```powershell
npm run dev
```

The frontend will start on **http://localhost:5173**

You should see:
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:5173/
```

### 5. Open in Browser

1. Open your browser and go to: **http://localhost:5173**
2. Make sure MetaMask is installed and connected
3. You should see the F1 DeFi Security Dashboard

## Project Structure

```
FullCycleDeFiSecurity-main/
├── Server/              # Backend API server
│   └── src/
│       ├── index.js    # Main server file
│       └── services/   # Service modules
├── frontend/           # React frontend
│   └── src/
│       ├── App.tsx     # Main app component
│       └── components/ # React components
├── SmartContract/      # Solidity contracts
│   └── contracts/
├── Audit/             # PDF audit reports (put your SecureDApp PDFs here)
└── README.md
```

## Features Available

1. **SecureDApp Audit Express**
   - Upload PDFs to `Audit/` folder
   - Click "Load PDFs from Audit/" to parse vulnerabilities
   - View vulnerabilities and fix advice
   - Download fixed contracts

2. **F1 Stock Market**
   - AI-powered stock predictions
   - Buy/sell F1 team stocks
   - Real-time price predictions

3. **Progress Tracking**
   - Vulnerability comparison charts
   - Progress over time graphs

## Troubleshooting

### Port Already in Use
If port 4000 or 5173 is already in use:

**For Backend (4000):**
```powershell
# Find and kill the process
netstat -ano | findstr :4000
taskkill /PID <PID_NUMBER> /F

# Or change port in Server/src/index.js
const PORT = process.env.PORT || 4001;  # Change to 4001
```

**For Frontend (5173):**
```powershell
# Or change port in frontend/vite.config.ts
server: {
  port: 5174  # Change to 5174
}
```

### Missing Dependencies
If you see module errors:
```powershell
# Delete node_modules and reinstall
rm -r node_modules
npm install
```

### MetaMask Not Connecting
- Make sure MetaMask is installed
- Unlock your MetaMask wallet
- Click "Connect MetaMask" button in the app

## Next Steps

1. **Add Audit PDFs**: Put your SecureDApp audit PDFs in the `Audit/` folder
2. **Load PDFs**: Click "Load PDFs from Audit/" in the dashboard
3. **View Vulnerabilities**: Switch between "Show Vulnerabilities" and "Show Fix Advice"
4. **Download Fixed Contract**: Click "Download Fixed Contract (flat)"
5. **Trade Stocks**: Connect MetaMask and buy/sell F1 team stocks!

## Notes

- The backend must be running for the frontend to work
- Keep both terminal windows open while developing
- The F1 Stock Market uses simulated transactions (5 ETH default transfer to host account)
- SecureDApp API key is optional - the system works in mock mode without it

