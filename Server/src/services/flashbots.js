const { ethers } = require('ethers');
let FlashbotsBundleProvider;

// Try to load Flashbots provider (optional dependency)
try {
  const flashbotsBundle = require('@flashbots/ethers-provider-bundle');
  FlashbotsBundleProvider = flashbotsBundle.FlashbotsBundleProvider;
  console.log('[Flashbots] Package loaded successfully');
} catch (e) {
  // Package not installed - will work in mock mode
  console.log('[Flashbots] Package not available:', e.message);
}

async function sendViaFlashbots(rawTransaction) {
  // Check if Flashbots is configured
  if (!process.env.FLASHBOTS_SIGNER_KEY) {
    return { 
      mocked: true, 
      status: 'queued', 
      relay: 'none',
      message: 'Flashbots not configured. Set FLASHBOTS_SIGNER_KEY in Server/.env. See FLASHBOTS_SETUP.md for instructions.'
    };
  }

  // Check if package is installed
  if (!FlashbotsBundleProvider) {
    return {
      mocked: true,
      status: 'error',
      relay: 'none',
      error: 'Flashbots package not available',
      message: 'Flashbots package may have compatibility issues. Working in mock mode.'
    };
  }

  try {
    // Connect to Ethereum provider
    const providerUrl = process.env.RPC_URL || process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com';
    const provider = new ethers.JsonRpcProvider(providerUrl);
    
    // Create Flashbots auth signer (this is just for authentication, doesn't need ETH)
    const authSigner = new ethers.Wallet(process.env.FLASHBOTS_SIGNER_KEY);
    
    // Get Flashbots relay URL (defaults to mainnet)
    const network = process.env.FLASHBOTS_NETWORK || 'mainnet';
    const relayUrl = process.env.FLASHBOTS_RELAY_URL || 
      (network === 'mainnet' 
        ? 'https://relay.flashbots.net' 
        : network === 'goerli'
        ? 'https://relay-goerli.flashbots.net'
        : 'https://relay-sepolia.flashbots.net');
    
    console.log('[Flashbots] Creating provider with relay:', relayUrl);
    
    // Create Flashbots provider
    // Note: This may need adjustment based on ethers version compatibility
    const flashbotsProvider = await FlashbotsBundleProvider.create(provider, authSigner, relayUrl);
    
    // Get target block (next block)
    const currentBlock = await provider.getBlockNumber();
    const targetBlock = currentBlock + 1;
    
    console.log('[Flashbots] Target block:', targetBlock);
    
    // Prepare transaction object
    let transaction = rawTransaction;
    
    // If transaction is an object, ensure it has required fields
    if (typeof transaction === 'object') {
      const feeData = await provider.getFeeData();
      transaction = {
        to: transaction.to || '0x0000000000000000000000000000000000000000',
        value: transaction.value || '0',
        data: transaction.data || '0x',
        gasLimit: transaction.gasLimit || 21000,
        gasPrice: transaction.gasPrice || feeData.gasPrice || ethers.parseUnits('20', 'gwei')
      };
    }
    
    // Note: For production, transactions should be pre-signed by the wallet that owns the funds
    // This is a demonstration. In reality, you'd bundle pre-signed transactions.
    
    // Create bundle
    // The Flashbots API expects bundles with signed transactions
    // For demo purposes, we'll create a simple bundle structure
    const bundle = [
      {
        transaction: transaction,
        signer: authSigner
      }
    ];
    
    console.log('[Flashbots] Sending bundle for block', targetBlock);
    
    // Send bundle to Flashbots
    const bundleResponse = await flashbotsProvider.sendBundle(bundle, targetBlock);
    
    // Wait for bundle to be included
    const response = await bundleResponse.wait();
    
    if (response) {
      return {
        mocked: false,
        status: 'submitted',
        relay: relayUrl,
        bundleHash: response.bundleHash || 'pending',
        targetBlock: targetBlock,
        message: `Bundle submitted to Flashbots. Target block: ${targetBlock}`,
        success: true
      };
    } else {
      return {
        mocked: false,
        status: 'pending',
        relay: relayUrl,
        targetBlock: targetBlock,
        message: 'Bundle submitted, waiting for block inclusion',
        success: true
      };
    }
  } catch (error) {
    console.error('[Flashbots] Error:', error);
    console.error('[Flashbots] Error stack:', error.stack);
    
    // If there's a compatibility issue, fall back to mock mode
    if (error.message && error.message.includes('ethers')) {
      return {
        mocked: true,
        status: 'error',
        relay: 'unknown',
        error: 'Ethers version compatibility issue',
        message: 'Flashbots package requires ethers@6.7.1 but project uses newer version. Using mock mode.',
        fallback: true
      };
    }
    
    return {
      mocked: false,
      status: 'error',
      relay: 'unknown',
      error: error.message || 'Failed to submit via Flashbots',
      message: `Flashbots error: ${error.message}`,
      success: false
    };
  }
}

module.exports = { sendViaFlashbots };
