# How to Connect Ganache to MetaMask

## Step-by-Step Guide

### 1. Start Ganache

1. Open Ganache (Truffle Ganache)
2. Click **"Quickstart"** or create a new workspace
3. Note the **RPC URL** (usually: `http://127.0.0.1:7545` or `http://localhost:7545`)
4. Note the **Network ID** (usually: `5777` or `1337`)

### 2. Add Ganache Network to MetaMask

**Method A: Automatic (Recommended)**

1. Click the **"🔍 Debug Balance"** button in the app
2. Check what Network ID it shows
3. Use the network ID from step 1

**Method B: Manual Setup**

1. Open MetaMask
2. Click the **network dropdown** (top of MetaMask, shows "Ethereum Mainnet" or current network)
3. Click **"Add Network"** → **"Add a network manually"**
4. Enter these details:
   - **Network Name:** `Ganache Local`
   - **RPC URL:** `http://127.0.0.1:7545` (or `http://localhost:7545`)
   - **Chain ID:** `1337` (or `5777` - check your Ganache)
   - **Currency Symbol:** `ETH`
   - **Block Explorer URL:** (leave empty)
5. Click **"Save"**

### 3. Import Account to MetaMask

1. In Ganache, you'll see a list of accounts
2. Click the **key icon** next to the account you want to use
3. Copy the **Private Key**
4. In MetaMask:
   - Click the **account icon** (top right, circle)
   - Click **"Import Account"**
   - Paste the **Private Key**
   - Click **"Import"**

### 4. Verify Connection

1. In MetaMask, make sure you're on **"Ganache Local"** network
2. Check your balance - should show **100 ETH** (or whatever Ganache gave you)
3. In the app, click **"Connect MetaMask"**
4. Click **"🔄 Refresh Balance"**
5. Should now show **100 ETH**!

## Troubleshooting

### Balance still shows 0?

1. **Check Network in MetaMask:**
   - Make sure MetaMask shows "Ganache Local" (or your Ganache network name)
   - If it shows "Ethereum Mainnet", switch networks

2. **Check Ganache is Running:**
   - Ganache must be running for MetaMask to connect
   - Check if RPC URL is accessible: `http://127.0.0.1:7545`

3. **Check Chain ID:**
   - Common Ganache Chain IDs: `1337`, `5777`, `7545`
   - Must match in both Ganache and MetaMask

4. **Try Debug Button:**
   - Click "🔍 Debug Balance" in the app
   - Check what Network and Chain ID it shows
   - Make sure it matches your Ganache settings

### Common Ganache RPC URLs:
- `http://127.0.0.1:7545` (default)
- `http://localhost:7545` (alternative)
- `http://127.0.0.1:8545` (Truffle default)
- `http://localhost:8545` (Truffle alternative)

### Common Chain IDs:
- `1337` - Ganache default
- `5777` - Ganache newer versions
- `7545` - Some Ganache setups

Check your Ganache UI for the exact values!

