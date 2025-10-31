# 🛡️ Flashbots Integration Guide

This guide explains how to set up real Flashbots integration for private transaction relay and MEV protection.

## What is Flashbots?

Flashbots is a private transaction relay that allows users to submit transactions directly to miners without exposing them to the public mempool. This prevents:
- **Front-running**: Bots can't see your transaction before it's mined
- **Sandwich attacks**: MEV bots can't insert transactions around yours
- **Slippage exploitation**: Your transaction executes at the intended price

## Prerequisites

1. **Node.js** and **npm** installed
2. **Ethereum account** with private key (for signing transactions)
3. **Flashbots account** (free) - [Sign up at flashbots.net](https://docs.flashbots.net/flashbots-auction/overview)

## Step 1: Install Flashbots Package

Navigate to the Server directory and install the Flashbots package:

```bash
cd Server
npm install @flashbots/ethers-provider-bundle --legacy-peer-deps
```

**Important**: Use `--legacy-peer-deps` flag because the Flashbots package requires `ethers@6.7.1` but this project uses `ethers@^6.13.2`. The `--legacy-peer-deps` flag allows npm to install it anyway.

**Note**: If you get peer dependency warnings, that's normal. The package will still work.

**Alternative**: If you prefer not to install the package, the system works perfectly in mock mode for demonstrations.

## Step 2: Get Flashbots Credentials

### Option A: Production (Mainnet)

1. Go to [Flashbots Documentation](https://docs.flashbots.net/)
2. Sign up for a Flashbots account
3. Get your **signer private key** (this is different from your wallet private key)
4. The relay URL is: `https://relay.flashbots.net`

### Option B: Testnet (Goerli/Sepolia)

1. Use the testnet relay: `https://relay-goerli.flashbots.net` or `https://relay-sepolia.flashbots.net`
2. Use a testnet account private key

## Step 3: Configure Environment Variables

Create or edit `Server/.env` file:

```env
# Flashbots Configuration
FLASHBOTS_SIGNER_KEY=your_flashbots_signer_private_key_here
FLASHBOTS_RELAY_URL=https://relay.flashbots.net
FLASHBOTS_NETWORK=mainnet

# Ethereum RPC (required for Flashbots)
RPC_URL=https://eth.llamarpc.com
# OR use your own RPC:
# RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
# RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# Optional: Your wallet private key (for signing transactions)
WALLET_PRIVATE_KEY=your_wallet_private_key_here
```

### Important Notes:

- **FLASHBOTS_SIGNER_KEY**: This is the private key used to authenticate with Flashbots relay. It can be any Ethereum private key (doesn't need ETH).
- **FLASHBOTS_RELAY_URL**: 
  - Mainnet: `https://relay.flashbots.net`
  - Goerli: `https://relay-goerli.flashbots.net`
  - Sepolia: `https://relay-sepolia.flashbots.net`
- **RPC_URL**: Any Ethereum RPC endpoint. You can use:
  - Public RPCs: `https://eth.llamarpc.com`, `https://rpc.ankr.com/eth`
  - Infura: `https://mainnet.infura.io/v3/YOUR_KEY`
  - Alchemy: `https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY`
  - QuickNode: Your QuickNode endpoint

## Step 4: Generate Flashbots Signer Key (Optional)

If you don't have a Flashbots signer key, you can generate one:

```bash
node -e "const { ethers } = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('Private Key:', wallet.privateKey); console.log('Address:', wallet.address);"
```

**Important**: This signer key is only for authenticating with Flashbots. It doesn't need to hold any ETH. Your actual transactions are signed by the wallet that submits them.

## Step 5: Restart the Server

After configuring the environment variables:

```bash
cd Server
npm start
```

## Step 6: Test Flashbots Integration

1. Go to the **Security Audit** page (`/audit`)
2. Start MEV Detection
3. When a threat is detected, click **"🛡️ Submit via Flashbots"**
4. You should see a success message instead of the "mocked" message

## Verification

Check server logs for Flashbots activity:

```
[Flashbots] Bundle submitted successfully. Target block: 12345678
```

## Troubleshooting

### Error: "Flashbots package not installed"
```bash
cd Server
npm install @flashbots/ethers-provider-bundle
```

### Error: "FLASHBOTS_SIGNER_KEY not set"
- Make sure `Server/.env` exists
- Add `FLASHBOTS_SIGNER_KEY=your_private_key`
- Restart the server

### Error: "Invalid RPC URL"
- Check your `RPC_URL` in `.env`
- Make sure the RPC endpoint is accessible
- Try a different public RPC: `https://eth.llamarpc.com`

### Error: "Bundle submission failed"
- Verify your Flashbots signer key is valid
- Check network connectivity
- Ensure you're using the correct relay URL for your network (mainnet vs testnet)

### Mock Mode Still Active

If you see "mocked: true" in responses:
1. Check that `FLASHBOTS_SIGNER_KEY` is set in `Server/.env`
2. Verify the package is installed: `npm list @flashbots/ethers-provider-bundle`
3. Restart the server after making changes

## Production Deployment

For production use:

1. **Never commit `.env` files** - Add `.env` to `.gitignore`
2. **Use environment variables** on your hosting platform (Heroku, AWS, etc.)
3. **Use secure key management** (AWS Secrets Manager, HashiCorp Vault)
4. **Monitor Flashbots status** - Check [Flashbots Status](https://status.flashbots.net/)

## Cost

Flashbots is **FREE** to use! You only pay:
- Normal gas fees for your transaction
- Optional: Tip to miners (increases inclusion probability)

No subscription or API fees required.

## Additional Resources

- [Flashbots Documentation](https://docs.flashbots.net/)
- [Flashbots GitHub](https://github.com/flashbots)
- [Flashbots Discord](https://discord.gg/flashbots)
- [MEV Protection Guide](https://docs.flashbots.net/flashbots-auction/overview)

## Quick Reference

```bash
# Install package
npm install @flashbots/ethers-provider-bundle

# Server/.env template
FLASHBOTS_SIGNER_KEY=0x...
FLASHBOTS_RELAY_URL=https://relay.flashbots.net
FLASHBOTS_NETWORK=mainnet
RPC_URL=https://eth.llamarpc.com

# Restart server
npm start
```

---

**Note**: Flashbots only works on Ethereum mainnet and testnets (Goerli, Sepolia). It does not work on local networks like Ganache.

