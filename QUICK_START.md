# 🚀 Quick Start Guide - FullCycle DeFi Security

Follow these steps to run the project:

## Prerequisites
- **Node.js** (v16 or higher) - [Download](https://nodejs.org/)
- **MetaMask** browser extension - [Install](https://metamask.io/)
- **Ganache** (Truffle Suite) - [Download](https://trufflesuite.com/ganache/)

---

## Step 1: Install Dependencies

### Backend (Server)
```bash
cd Server
npm install
```

### Frontend
```bash
cd frontend
npm install
```

---

## Step 2: Configure Environment Variables (Optional)

Create a `.env` file in the `Server` folder:

```bash
# Server/.env
SECUREDAPP_API_KEY=your_api_key_here  # Optional: for real SecureDApp API
HOST_ACCOUNT_PRIVATE_KEY=your_private_key  # Optional: for real blockchain sell transactions
GANACHE_RPC_URL=http://127.0.0.1:7545  # Optional: defaults to localhost:7545
PORT=4000  # Optional: defaults to 4000
```

**Note:** If you don't add these, the app will work with mocked/simulated features.

---

## Step 3: Start Ganache

1. Open **Ganache** (Truffle Suite)
2. Create a new workspace or use Quickstart
3. **Note down:**
   - RPC Server URL (usually `http://127.0.0.1:7545`)
   - Chain ID (usually `1337` or `5777`)
4. Keep Ganache running!

---

## Step 4: Connect Ganache to MetaMask

### Method 1: Automatic (Recommended)
When you first connect MetaMask in the app, it will prompt you to switch networks.

### Method 2: Manual Setup
1. Open MetaMask
2. Click network dropdown (top) → **"Add Network"** → **"Add a network manually"**
3. Fill in:
   - **Network Name:** `Ganache Local`
   - **RPC URL:** `http://127.0.0.1:7545` (or your Ganache URL)
   - **Chain ID:** `1337` (check Ganache for exact value)
   - **Currency Symbol:** `ETH`
4. Click **"Save"**

### Import Account to MetaMask
1. In Ganache, click the **key icon** next to any account
2. Copy the **Private Key**
3. In MetaMask: Account menu → **"Import Account"** → Paste private key
4. Switch MetaMask to **"Ganache Local"** network

---

## Step 5: Start the Backend Server

Open a terminal and run:

```bash
cd Server
npm start
```

You should see:
```
Server listening on 4000
F1 Stock Market Host Account: 0xc03cC503B53FE35c31aeE396a54d84A67C3CC308
```

**Keep this terminal open!**

---

## Step 6: Start the Frontend

Open a **NEW terminal** and run:

```bash
cd frontend
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

## Step 7: Open the Application

1. Open your browser and go to: **http://localhost:5173/**
2. You'll see the **Home Page** with two options:
   - **🔒 Security Audit** - For smart contract vulnerability scanning
   - **📈 Stock Market** - For F1 team stock trading

---

## 🎯 What You Can Do Now

### Security Audit Page (`/audit`)
- Upload or scan smart contract PDFs
- View vulnerabilities and fixes
- Download fixed contracts
- Track security improvements with graphs

### Stock Market Page (`/stocks`)
- Connect MetaMask wallet
- View F1 team stock predictions
- Buy/sell stocks using real ETH transactions
- Monitor your balance and portfolio

---

## 🔧 Troubleshooting

### Port Already in Use
If port 4000 is busy:
```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# Or change PORT in Server/.env
PORT=4001
```

### MetaMask Balance Shows 0
1. ✅ Make sure you're on **"Ganache Local"** network in MetaMask
2. ✅ Verify the account imported matches Ganache
3. ✅ Check Ganache shows ETH balance
4. ✅ Click **"🔄 Refresh Balance"** button in the app
5. ✅ Try **"🔍 Debug Balance"** for detailed info

### Frontend Won't Start
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Backend Won't Start
```bash
cd Server
rm -rf node_modules package-lock.json
npm install
npm start
```

### SecureDApp Upload Errors
- The fixed contract must be a **flat Solidity file**
- Make sure it has proper SPDX header and pinned pragma
- Check file encoding is UTF-8 with LF line endings

---

## 📁 Project Structure

```
FullCycleDeFiSecurity-main/
├── Server/              # Backend API (Node.js + Express)
│   ├── src/
│   │   ├── index.js    # Main server file
│   │   └── services/   # API services
│   └── .env            # Environment variables
│
├── frontend/           # Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/      # Page components
│   │   ├── components/ # Reusable components
│   │   └── App.tsx     # Main app component
│   └── package.json
│
├── Audit/              # Audit PDFs and reports
│
└── SmartContract/      # Solidity contracts
    └── contracts/
```

---

## 🎉 You're All Set!

The app is now running. Navigate between:
- **Home** (`/`) - Landing page
- **Security Audit** (`/audit`) - Contract scanning
- **Stock Market** (`/stocks`) - F1 trading

Enjoy your Full-Cycle DeFi Security Dashboard! 🏎️

