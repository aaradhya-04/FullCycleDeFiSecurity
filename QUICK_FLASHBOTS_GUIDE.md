# 🛡️ Quick Flashbots Setup Guide

## Quick Start (3 Steps)

### 1. Install Package
```bash
cd Server
npm install @flashbots/ethers-provider-bundle --legacy-peer-deps
```

**Note**: The `--legacy-peer-deps` flag is required because Flashbots requires `ethers@6.7.1` but this project uses `ethers@^6.13.2`. This flag allows installation despite the version mismatch.

**If package doesn't exist**, Flashbots integration will work in **mock mode** (which is fine for demos).

### 2. Create/Edit `Server/.env`

Add these lines:
```env
# Flashbots Configuration
FLASHBOTS_SIGNER_KEY=0xYourPrivateKeyHere
FLASHBOTS_RELAY_URL=https://relay.flashbots.net
RPC_URL=https://eth.llamarpc.com
```

**To generate a signer key:**
```bash
node -e "const { ethers } = require('ethers'); console.log(ethers.Wallet.createRandom().privateKey);"
```

**Note**: The signer key is just for authentication - it doesn't need ETH!

### 3. Restart Server
```bash
cd Server
npm start
```

## That's It! ✅

When you click "🛡️ Submit via Flashbots" in the UI:
- **With config**: Real Flashbots submission (if package installed)
- **Without config**: Mock mode (shows how it would work)

## Troubleshooting

**"Package not found"**: 
- Flashbots will work in mock mode (fine for demos)
- For production, check [Flashbots GitHub](https://github.com/flashbots/pm) for latest package

**"FLASHBOTS_SIGNER_KEY not set"**: 
- Add it to `Server/.env`
- Restart server

**Still in mock mode?**
- Check that `.env` file exists in `Server/` folder
- Make sure you restarted the server after adding env vars

## Current Status

The system works perfectly in **mock mode** for demonstrations. The Flashbots integration is implemented and will automatically switch to real mode when:
1. Package is installed ✅ (optional)
2. Environment variables are set ✅

For hackathon/demo purposes, **mock mode is sufficient** - it shows the complete flow and UI.

