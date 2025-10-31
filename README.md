# 🏎️ FullCycle DeFi Security

Full-Cycle DeFi Security is an F1-themed MEV Defense System securing DeFi transactions through audited smart contracts, real-time attack detection, and Node.js + Truffle + React integration. Like F1 telemetry, it monitors on-chain activity live—making DeFi faster, safer, and more transparent.

## 🚀 Quick Start

### Step 1: Install Dependencies

**Backend:**
```bash
cd Server
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### Step 2: Configure Environment (Optional)

Create `Server/.env`:
```env
SECUREDAPP_API_KEY=your_api_key  # Optional
HOST_ACCOUNT_PRIVATE_KEY=your_private_key  # Optional
GANACHE_RPC_URL=http://127.0.0.1:7545  # Optional
PORT=4000  # Optional

# Flashbots Configuration (Optional - see FLASHBOTS_SETUP.md)
FLASHBOTS_SIGNER_KEY=your_flashbots_signer_key  # Optional
FLASHBOTS_RELAY_URL=https://relay.flashbots.net  # Optional
RPC_URL=https://eth.llamarpc.com  # Optional (for Flashbots)
```

### Step 3: Start Ganache
- Open **Ganache** (Truffle Suite)
- Create a workspace
- Note the RPC URL and Chain ID

### Step 4: Start the Server
```bash
cd Server
npm start
```
Server runs on `http://localhost:4000`

### Step 5: Start the Frontend
```bash
cd frontend
npm run dev
```
App runs on `http://localhost:5173`

### Step 6: Connect MetaMask
1. Switch MetaMask to **Ganache Local** network
2. Import a Ganache account (use private key from Ganache)
3. Open the app and connect MetaMask

**📖 For detailed setup instructions, see [QUICK_START.md](./QUICK_START.md)**
**📖 For Ganache setup, see [GANACHE_SETUP.md](./GANACHE_SETUP.md)**
**📖 For Flashbots integration, see [FLASHBOTS_SETUP.md](./FLASHBOTS_SETUP.md)**

## 📁 Project Structure
- `Server/` - Backend API (Node.js + Express)
- `frontend/` - Frontend (React + Vite)
- `Audit/` - Audit PDFs and reports
- `SmartContract/` - Solidity contracts

## ✨ Features
- 🔒 **Smart Contract Auditing** - Automated vulnerability scanning and fixes
- ⚡ **MEV Defense** - Real-time front-running detection
- 📈 **F1 Stock Market** - AI-powered predictions and blockchain trading
- 📊 **Progress Tracking** - Visual charts showing security improvements

## 🎯 Pages
- **Home** (`/`) - Landing page with navigation
- **Security Audit** (`/audit`) - Contract vulnerability scanning
- **Stock Market** (`/stocks`) - F1 team stock trading

