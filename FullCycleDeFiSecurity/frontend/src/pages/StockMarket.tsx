import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { ethers } from 'ethers'

const SERVER = 'http://localhost:4000'
const HOST_ACCOUNT = '0xc03cC503B53FE35c31aeE396a54d84A67C3CC308'

interface Prediction {
  teamName: string
  currentPrice: number
  predictedPrice: number
  confidence: number
  trend: string
  recommendation: string
  riskLevel: string
  factors: {
    performance: number
    momentum: number
    recentWins: number
  }
}

export default function StockMarket() {
  const [account, setAccount] = useState<string | null>(null)
  const [balance, setBalance] = useState<string>('0')
  const [balanceUSD, setBalanceUSD] = useState<string>('0')
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(false)
  const [buyAmount, setBuyAmount] = useState<Record<string, string>>({})
  const [sellAmount, setSellAmount] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!window.ethereum) {
      console.warn('MetaMask not found')
      return
    }
    
    // Listen for account and network changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        console.log('Account changed:', accounts)
        if (accounts.length > 0) {
          setAccount(accounts[0])
          setTimeout(() => loadBalance(accounts[0]), 500)
        } else {
          setAccount(null)
          setBalance('0')
          setBalanceUSD('0')
        }
      })
      
      window.ethereum.on('chainChanged', (chainId: string) => {
        console.log('Chain changed:', chainId)
        // Reload balance when network changes
        if (account) {
          setTimeout(() => loadBalance(account), 1000)
        }
      })
    }
    
    // Initial load - try to get current account
    ;(async () => {
      try {
        // Method 1: Try direct request (most reliable)
        const accounts = await window.ethereum.request({ method: 'eth_accounts' })
        console.log('Direct eth_accounts:', accounts)
        
        if (accounts && accounts.length > 0) {
          const addr = accounts[0]
          setAccount(addr)
          console.log('Setting account from eth_accounts:', addr)
          await loadBalance(addr)
        } else {
          // Method 2: Try ethers provider
          const provider = new ethers.BrowserProvider(window.ethereum as any)
          const ethersAccounts = await provider.listAccounts()
          console.log('Ethers accounts:', ethersAccounts.length)
          
          if (ethersAccounts.length) {
            const addr = ethersAccounts[0].address
            setAccount(addr)
            console.log('Setting account from ethers:', addr)
            await loadBalance(addr, provider)
          }
        }
        
        // Retry after delay
        setTimeout(async () => {
          if (account) {
            console.log('Retry loading balance for:', account)
            await loadBalance(account)
          }
        }, 2000)
      } catch (e) {
        console.error('Error in useEffect:', e)
      }
    })()
    
    loadPredictions()
  }, [])

  async function loadBalance(address: string, provider?: ethers.BrowserProvider) {
    if (!address || !address.startsWith('0x')) {
      console.error('Invalid address:', address)
      return
    }

    console.log('🔍 Loading balance for:', address)

    // Method 1: Try direct MetaMask RPC call first (most reliable for local networks)
    try {
      // Get chain ID first
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' })
      const chainId = parseInt(chainIdHex, 16)
      console.log('Current Chain ID:', chainId, 'Hex:', chainIdHex)
      
      // IMPORTANT: Get balance using exact same method MetaMask uses
      // This should read from whatever network MetaMask is currently on
      const balanceHex = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      })
      
      console.log('Raw balance (hex):', balanceHex)
      console.log('Address being queried:', address)
      console.log('Network Chain ID:', chainId)
      
      const balanceWei = BigInt(balanceHex)
      const ethBalance = ethers.formatEther(balanceWei)
      const balanceNum = parseFloat(ethBalance)
      
      console.log('✅ Balance loaded via eth_getBalance:', balanceNum, 'ETH')
      console.log('Balance in Wei:', balanceWei.toString())
      
      // If balance is 0 and we're on mainnet, warn user
      if (balanceNum === 0 && chainId === 1) {
        console.warn('⚠️ Balance is 0 on Mainnet. User should be on Ganache network!')
      }
      
      setBalance(balanceNum.toFixed(4))
      
      // Check network for USD conversion
      if (chainId === 1337 || chainId === 5777 || chainId === 7545 || chainIdHex === '0x539') {
        // Local network (Ganache, Hardhat, etc.)
        setBalanceUSD('Local Network')
        console.log('Detected local network, showing "Local Network"')
      } else {
        // Mainnet or testnet - show USD
        const ethPrice = 3785.48
        const usdValue = balanceNum * ethPrice
        setBalanceUSD(usdValue.toFixed(2))
        console.log('Detected mainnet/testnet, showing USD value')
      }
      
      return // Success, exit early
    } catch (e: any) {
      console.warn('❌ eth_getBalance failed:', e.message)
      console.warn('Trying ethers provider as fallback...')
    }

    // Method 2: Try ethers.js provider
    try {
      if (!provider) {
        provider = new ethers.BrowserProvider(window.ethereum as any)
      }
      
      // Ensure provider is ready
      await provider.ready
      
      const network = await provider.getNetwork()
      console.log('Network:', network.name, 'Chain ID:', network.chainId.toString())
      
      // Get balance with timeout
      const bal = await Promise.race([
        provider.getBalance(address),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]) as bigint
      
      const ethBalance = ethers.formatEther(bal)
      const balanceNum = parseFloat(ethBalance)
      
      console.log('✅ Balance loaded via ethers provider:', balanceNum, 'ETH')
      setBalance(balanceNum.toFixed(4))
      
      if (network.chainId === 1337n || network.chainId === 5777n || network.name === 'unknown' || network.name?.toLowerCase().includes('ganache')) {
        setBalanceUSD('Local Network')
      } else {
        const ethPrice = 3785.48
        const usdValue = balanceNum * ethPrice
        setBalanceUSD(usdValue.toFixed(2))
      }
    } catch (e) {
      console.error('❌ Both balance methods failed:', e)
      // Final fallback - show warning
      setBalance('0')
      setBalanceUSD('Error loading')
      alert('Failed to load balance. Please check:\n1. MetaMask is connected\n2. You are on the correct network\n3. Account has ETH\n\nCheck browser console for details.')
    }
  }

  async function connect() {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const accounts = await provider.send('eth_requestAccounts', [])
      if (accounts.length === 0) {
        alert('No accounts found. Please unlock MetaMask.')
        return
      }
      
      // Get network using direct RPC call (more reliable than ethers)
      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' })
      const chainId = parseInt(chainIdHex, 16)
      const chainIdStr = chainId.toString()
      
      // Also get network from ethers
      const network = await provider.getNetwork()
      console.log('Network from ethers:', network.name, 'Chain ID:', network.chainId.toString())
      console.log('Network from RPC:', 'Chain ID:', chainId, 'Hex:', chainIdHex)
      
      // Check if on Ganache/local network
      const isLocal = chainId === 1337 || chainId === 5777 || chainId === 7545 || 
                      chainIdStr === '1337' || chainIdStr === '5777' || chainIdStr === '7545' ||
                      network.name === 'unknown' || network.name?.toLowerCase().includes('ganache') ||
                      network.name?.toLowerCase().includes('localhost')
      
      console.log('Is local network?', isLocal)
      
      if (chainId === 1) {
        // On mainnet, prompt to switch
        const switchNet = confirm(
          `⚠️ You're on Ethereum Mainnet (Chain ID: 1)\n\n` +
          `Your Ganache account with 100 ETH is on a LOCAL network.\n\n` +
          `Switch to Ganache Local network?\n\n` +
          `MetaMask will prompt you to add the network if not already added.\n\n` +
          `Ganache settings:\n` +
          `- RPC URL: http://127.0.0.1:7545 (or http://localhost:8545)\n` +
          `- Chain ID: 1337 or 5777 (check your Ganache)\n` +
          `- Symbol: ETH`
        )
        
        if (switchNet) {
          try {
            // Try common Ganache chain IDs
            const ganacheChainIds = ['0x539', '0x1691', '0x1d7f'] // 1337, 5777, 7545 in hex
            
            for (const chainIdHex of ganacheChainIds) {
              try {
                await window.ethereum.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId: chainIdHex }],
                })
                console.log('Switched to chain:', chainIdHex)
                break
              } catch (switchError: any) {
                if (switchError.code === 4902) {
                  // Network not added, try to add it
                  try {
                    await window.ethereum.request({
                      method: 'wallet_addEthereumChain',
                      params: [{
                        chainId: chainIdHex,
                        chainName: 'Ganache Local',
                        nativeCurrency: {
                          name: 'Ethereum',
                          symbol: 'ETH',
                          decimals: 18
                        },
                        rpcUrls: ['http://127.0.0.1:7545', 'http://localhost:8545'],
                        blockExplorerUrls: null
                      }]
                    })
                    console.log('Added Ganache network with chain ID:', chainIdHex)
                    break
                  } catch (addError) {
                    console.log('Failed to add chain:', chainIdHex, addError)
                    continue
                  }
                }
              }
            }
            
            // Wait for network switch
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            // Reload after switch
            window.location.reload()
          } catch (error) {
            console.error('Network switch error:', error)
            alert(
              'Failed to switch network automatically.\n\n' +
              'Please manually switch to Ganache in MetaMask:\n\n' +
              '1. Open MetaMask\n' +
              '2. Click network dropdown (top)\n' +
              '3. Select "Localhost 8545" or add Ganache:\n' +
              '   - Name: Ganache Local\n' +
              '   - RPC: http://127.0.0.1:7545 or http://localhost:8545\n' +
              '   - Chain ID: 1337 (check Ganache UI)\n' +
              '   - Symbol: ETH\n\n' +
              'Then refresh this page.'
            )
          }
        }
      }
      
      const addr = accounts[0]
      setAccount(addr)
      console.log('Connected to account:', addr)
      
      // Load balance immediately
      await loadBalance(addr, provider)
      
      // Also retry after delay to ensure network is ready
      setTimeout(async () => {
        await loadBalance(addr, provider)
      }, 1000)
    } catch (e: any) {
      console.error('Connect error:', e)
      alert(`Failed to connect: ${e.message}`)
    }
  }

  async function loadPredictions() {
    setLoading(true)
    try {
      const { data } = await axios.get(`${SERVER}/f1/predictions`)
      setPredictions(data.predictions || [])
    } catch (e) {
      console.error('Failed to load predictions:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleBuyStock(teamName: string, price: number) {
    if (!account) {
      alert('Please connect MetaMask first')
      return
    }

    const amount = buyAmount[teamName] || '0.1'
    const ethAmount = parseFloat(amount)
    
    if (!ethAmount || ethAmount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    // Check balance before transaction - use direct RPC for accurate balance
    try {
      // Get balance using direct RPC (most reliable)
      const balanceHex = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [account, 'latest']
      })
      const currentBalanceWei = BigInt(balanceHex)
      const currentBalanceETH = parseFloat(ethers.formatEther(currentBalanceWei))
      
      console.log('Current balance check:', currentBalanceETH, 'ETH')
      
      // Estimate gas
      const provider = new ethers.BrowserProvider(window.ethereum as any)
      const gasEstimate = await provider.estimateGas({
        to: HOST_ACCOUNT,
        value: ethers.parseEther(amount.toString()),
        from: account
      })
      
      // Get current gas price
      const feeData = await provider.getFeeData()
      const gasPrice = feeData.gasPrice || BigInt(20000000000) // Fallback: 20 gwei
      const gasCostETH = parseFloat(ethers.formatEther(gasEstimate * gasPrice))
      
      const totalNeeded = ethAmount + gasCostETH
      
      console.log('Transaction needs:', ethAmount, 'ETH +', gasCostETH.toFixed(6), 'ETH gas =', totalNeeded.toFixed(6), 'ETH total')
      
      if (currentBalanceETH < totalNeeded) {
        alert(`Insufficient funds!\n\nYou have: ${currentBalanceETH.toFixed(4)} ETH\nNeeded: ${totalNeeded.toFixed(6)} ETH\n  - Amount: ${ethAmount} ETH\n  - Gas: ${gasCostETH.toFixed(6)} ETH\n\nPlease reduce the amount.`)
        return
      }

      setLoading(true)
      
      const signer = await provider.getSigner()
      
      console.log('Sending transaction:', {
        to: HOST_ACCOUNT,
        amount: amount.toString() + ' ETH',
        gasLimit: gasEstimate.toString()
      })
      
      // Send ETH transaction to host account
      const tx = await signer.sendTransaction({
        to: HOST_ACCOUNT,
        value: ethers.parseEther(amount.toString()),
        gasLimit: gasEstimate
      })
      
      console.log('Transaction sent, hash:', tx.hash)

      // Wait for transaction confirmation
      const receipt = await tx.wait()
      
      // Refresh balance after transaction
      await loadBalance(account, provider)

      // Call backend to record the transaction
      const { data } = await axios.post(`${SERVER}/f1/buy-stock`, {
        userAddress: account,
        teamName,
        amount: amount.toString(),
        txHash: tx.hash
      })

      alert(`✅ Transaction successful!\n\nHash: ${tx.hash}\nAmount: ${amount} ETH\nTo: ${HOST_ACCOUNT}\nGas Used: ${receipt.gasUsed.toString()}`)
    } catch (e: any) {
      if (e.code === 4001) {
        alert('Transaction rejected by user')
      } else if (e.code === 'INSUFFICIENT_FUNDS' || e.message?.includes('insufficient funds')) {
        alert(`Insufficient funds! Please check your ETH balance.`)
      } else {
        alert(`Error: ${e.message || 'Buy failed'}\n\nMake sure you have enough ETH for the transaction and gas fees.`)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSellStock(teamName: string, price: number) {
    if (!account) {
      alert('Please connect MetaMask first')
      return
    }

    const amount = sellAmount[teamName] || '1'
    const sellAmountNum = parseFloat(amount)
    
    if (!sellAmountNum || sellAmountNum <= 0) {
      alert('Please enter a valid amount to sell')
      return
    }

    // Ensure price is valid
    if (!price || price <= 0) {
      alert('Invalid stock price. Please try again.')
      return
    }

    // Calculate payout based on stock price (price is already in ETH)
    // Formula: payout = number_of_stocks * price_per_stock
    const payoutETH = sellAmountNum * price
    
    console.log(`[Sell Stock] Selling ${sellAmountNum} stocks of ${teamName}`)
    console.log(`[Sell Stock] Current price: ${price} ETH per stock`)
    console.log(`[Sell Stock] Total payout: ${payoutETH} ETH`)
    
    // Validate payout is reasonable
    if (payoutETH <= 0 || !isFinite(payoutETH)) {
      alert('Invalid payout amount. Please check the stock price and amount.')
      return
    }
    
    setLoading(true)
    try {
      const provider = new ethers.BrowserProvider(window.ethereum as any)
      
      // Call backend to send ETH from host account to user
      // Backend will need host account private key for real transactions
      const { data } = await axios.post(`${SERVER}/f1/sell-stock`, {
        userAddress: account,
        teamName,
        amount: sellAmountNum.toString(), // Number of stocks being sold
        payoutAmount: payoutETH.toFixed(18) // Total ETH to transfer (stocks * price)
      })

      console.log('Sell response:', data)

      if (data.success) {
        if (data.transaction && data.transaction.txHash) {
          // Real transaction was sent
          const txHash = data.transaction.txHash
          const blockNumber = data.transaction.blockNumber
          
          console.log('Transaction hash:', txHash)
          console.log('Block number:', blockNumber)
          
          // Wait a bit for the transaction to be fully confirmed
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // Refresh balance multiple times to ensure it's updated
          for (let i = 0; i < 3; i++) {
            await loadBalance(account, provider)
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
          
          alert(
            `✅ Stock sold successfully!\n\n` +
            `Team: ${teamName}\n` +
            `Amount: ${amount} stocks\n` +
            `Payout: ${payoutETH.toFixed(4)} ETH\n\n` +
            `Transaction Hash:\n${txHash}\n` +
            (blockNumber ? `Block: ${blockNumber}\n` : '') +
            `\nYour balance has been updated!`
          )
        } else if (data.transaction && data.transaction.simulated) {
          // Simulated transaction
          console.warn('Transaction was simulated (no HOST_ACCOUNT_PRIVATE_KEY set)')
          
          const instructions = data.instructions || [
            '1. Open Ganache application',
            `2. Find account with address: ${HOST_ACCOUNT}`,
            '3. Click the key icon to reveal private key',
            '4. Copy the private key',
            '5. Create Server/.env file',
            '6. Add: HOST_ACCOUNT_PRIVATE_KEY=your_private_key',
            '7. Restart the server'
          ]
          
          alert(
            `⚠️ Simulated Transaction\n\n` +
            `Team: ${teamName}\n` +
            `Amount: ${amount} stocks\n` +
            `Payout: ${payoutETH.toFixed(4)} ETH\n\n` +
            `❌ No ETH was transferred (simulation only)\n\n` +
            `📝 To enable real transactions:\n\n` +
            instructions.join('\n') +
            `\n\nHost Account Address: ${HOST_ACCOUNT}`
          )
        } else {
          // Generic success
          alert(`✅ Stock sold: ${payoutETH.toFixed(4)} ETH`)
          await loadBalance(account, provider)
        }
      } else {
        alert(
          `✅ ${data.message}\n\n` +
          `Note: This was a simulated transaction.\n` +
          `For real transactions, configure host account private key in backend.\n\n` +
          `Transaction details:\n${JSON.stringify(data.transaction, null, 2)}\n\n` +
          `Balance refreshed.`
        )
      }
      
    } catch (e: any) {
      console.error('Sell error:', e)
      // Try to refresh balance anyway
      if (account) {
        try {
          await loadBalance(account)
        } catch (refreshError) {
          console.error('Balance refresh error:', refreshError)
        }
      }
      alert(`Error: ${e.message || 'Sell failed'}\n\nYour balance has been refreshed.`)
    } finally {
      setLoading(false)
    }
  }

  function getRecommendationColor(recommendation: string) {
    return recommendation === 'BUY' ? '#2ecc40' : '#ff4136'
  }

  function getRiskColor(risk: string) {
    if (risk === 'LOW') return '#2ecc40'
    if (risk === 'MEDIUM') return '#ffdc00'
    return '#ff4136'
  }

  return (
    <div className="f1-stock-market">
      <div className="market-header">
        <h2>🏎️ F1 Team Stock Market</h2>
        <p className="section-desc">AI-Powered Stock Predictions based on Past Race Performance</p>
        <div className="market-actions">
          <button className="btn-primary" onClick={connect} disabled={!!account}>
            {account ? `🔗 Connected ${account.slice(0, 6)}...${account.slice(-4)}` : '🔌 Connect MetaMask'}
          </button>
          {account && (
            <>
              <button className="btn-action" onClick={async () => {
                if (!account) return
                setLoading(true)
                try {
                  console.log('Manual refresh triggered for:', account)
                  // Force refresh using multiple methods
                  await Promise.all([
                    loadBalance(account),
                    new Promise(resolve => setTimeout(resolve, 500)).then(() => loadBalance(account))
                  ])
                } catch (e) {
                  console.error('Refresh error:', e)
                } finally {
                  setLoading(false)
                }
              }} disabled={loading}>
                🔄 Refresh Balance
              </button>
              <button className="btn-action" onClick={async () => {
                if (!account) {
                  alert('Please connect MetaMask first')
                  return
                }
                
                try {
                  // Get chain info
                  const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' })
                  const chainId = parseInt(chainIdHex, 16)
                  
                  // Method 1: Direct RPC (same as MetaMask uses)
                  const balanceHex = await window.ethereum.request({
                    method: 'eth_getBalance',
                    params: [account, 'latest']
                  })
                  const bal1 = ethers.formatEther(BigInt(balanceHex))
                  
                  // Method 2: Ethers provider
                  const provider = new ethers.BrowserProvider(window.ethereum as any)
                  const network = await provider.getNetwork()
                  const bal2 = await provider.getBalance(account)
                  const eth2 = ethers.formatEther(bal2)
                  
                  // Also check what MetaMask shows
                  const metamaskAccounts = await window.ethereum.request({ method: 'eth_accounts' })
                  
                  const info = {
                    'Your Account Address': account,
                    'MetaMask Accounts': metamaskAccounts,
                    'Network Name': network.name,
                    'Chain ID (decimal)': chainId.toString(),
                    'Chain ID (hex)': chainIdHex,
                    'Balance Method 1 (eth_getBalance)': bal1 + ' ETH',
                    'Balance Method 2 (ethers.js)': eth2 + ' ETH',
                    'Raw Balance (hex)': balanceHex,
                    'Raw Balance (wei)': BigInt(balanceHex).toString()
                  }
                  
                  console.log('🔍 Debug Info:', info)
                  
                  const isLocal = chainId === 1337 || chainId === 5777 || chainId === 7545
                  
                  // Check if balance is 0 because wrong network
                  let networkWarning = ''
                  if (parseFloat(bal1) === 0 && chainId === 1) {
                    networkWarning = '\n\n⚠️ ISSUE DETECTED:\n' +
                      'You have 100 ETH in Ganache but app reads from Mainnet!\n' +
                      'SOLUTION: Switch MetaMask to "Localhost 8545" network.\n' +
                      'Then refresh this page.'
                  }
                  
                  alert(
                    `🔍 Balance Debug Info\n\n` +
                    `Address: ${account}\n` +
                    `Network: ${network.name}\n` +
                    `Chain ID: ${chainId} (${chainIdHex})\n` +
                    `Local Network: ${isLocal ? 'YES ✅' : 'NO ❌'}\n\n` +
                    `Method 1 (eth_getBalance):\n${bal1} ETH\n\n` +
                    `Method 2 (ethers.js):\n${eth2} ETH\n\n` +
                    `Raw Balance: ${balanceHex}\n` +
                    networkWarning
                  )
                  
                  // Force update display with Method 1 result
                  setBalance(parseFloat(bal1).toFixed(4))
                  setBalanceUSD(isLocal ? 'Local Network' : (parseFloat(bal1) * 3785.48).toFixed(2))
                  
                  // If on wrong network, show prominent warning
                  if (parseFloat(bal1) === 0 && chainId === 1) {
                    const fixNow = confirm(
                      '🔴 NETWORK MISMATCH DETECTED!\n\n' +
                      'You are on Ethereum Mainnet (Chain ID: 1)\n' +
                      'But your 100 ETH is on Ganache Local network.\n\n' +
                      'Would you like to switch to Ganache network now?'
                    )
                    if (fixNow) {
                      // Try to switch to common Ganache chain IDs
                      const chains = ['0x539', '0x1691', '0x1d7f'] // 1337, 5777, 7545
                      for (const cid of chains) {
                        try {
                          await window.ethereum.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: cid }]
                          })
                          setTimeout(() => window.location.reload(), 1000)
                          break
                        } catch (e: any) {
                          if (e.code === 4902) {
                            // Try adding
                            await window.ethereum.request({
                              method: 'wallet_addEthereumChain',
                              params: [{
                                chainId: cid,
                                chainName: 'Ganache Local',
                                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                                rpcUrls: ['http://127.0.0.1:7545', 'http://localhost:8545']
                              }]
                            })
                            setTimeout(() => window.location.reload(), 1000)
                            break
                          }
                        }
                      }
                    }
                  }
                  
                } catch (e: any) {
                  console.error('Debug error:', e)
                  alert(`Error: ${e.message}\n\nCheck browser console (F12) for details.`)
                }
              }}>
                🔍 Debug Balance
              </button>
            </>
          )}
          <button className="btn-action" onClick={loadPredictions} disabled={loading}>
            🔄 Refresh Predictions
          </button>
        </div>
        {account && (
          <div className="balance-display glass-panel">
            <div className="balance-info">
              <div className="balance-label">Your Balance</div>
              <div className="balance-amount">{balance} ETH</div>
              <div className="balance-usd">
                {balanceUSD === 'Local Network' ? 'Local Network' : `$${balanceUSD} USD`}
              </div>
              {parseFloat(balance) === 0 && (
                <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255, 220, 0, 0.1)', borderRadius: '8px', fontSize: '13px', color: '#ffdc00', border: '1px solid rgba(255, 220, 0, 0.3)' }}>
                  ⚠️ <strong>Balance shows 0?</strong><br/>
                  Make sure:<br/>
                  1. Ganache is running<br/>
                  2. MetaMask is on "Ganache Local" network<br/>
                  3. Account has ETH in Ganache<br/>
                  4. Click "Refresh Balance" or "Debug Balance"
                </div>
              )}
            </div>
            <div className="balance-address">
              <small>{account}</small>
            </div>
          </div>
        )}
        {!account && (
          <div className="balance-display glass-panel" style={{ textAlign: 'center', padding: '24px' }}>
            <p style={{ margin: '0 0 16px 0', color: 'rgba(255, 255, 255, 0.8)' }}>
              Connect MetaMask to view your balance and trade stocks
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
              Make sure MetaMask is connected to Ganache Local network
            </p>
          </div>
        )}
      </div>

      <div className="stock-grid">
        {predictions.map((pred) => (
          <div key={pred.teamName} className="stock-card glass-panel">
            <div className="stock-header">
              <h3>{pred.teamName}</h3>
              <span 
                className="recommendation-badge"
                style={{ backgroundColor: getRecommendationColor(pred.recommendation) }}
              >
                {pred.recommendation}
              </span>
            </div>

            <div className="stock-info">
              <div className="price-info">
                <div>
                  <span className="label">Current:</span>
                  <span className="value">{pred.currentPrice.toFixed(4)} ETH</span>
                </div>
                <div>
                  <span className="label">Predicted:</span>
                  <span className="value highlight">{pred.predictedPrice.toFixed(4)} ETH</span>
                </div>
                <div className="trend" style={{ color: pred.trend === 'upward' ? '#2ecc40' : '#ff4136' }}>
                  {pred.trend === 'upward' ? '📈' : '📉'} {pred.trend.toUpperCase()}
                </div>
              </div>

              <div className="prediction-metrics">
                <div className="metric">
                  <span className="metric-label">Confidence</span>
                  <span className="metric-value">{pred.confidence.toFixed(0)}%</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Risk</span>
                  <span 
                    className="metric-value"
                    style={{ color: getRiskColor(pred.riskLevel) }}
                  >
                    {pred.riskLevel}
                  </span>
                </div>
              </div>

              <div className="factors">
                <div>Performance: +{pred.factors.performance.toFixed(1)}%</div>
                <div>Momentum: {pred.factors.momentum > 0 ? '+' : ''}{pred.factors.momentum.toFixed(1)}%</div>
                <div>Recent Wins: {pred.factors.recentWins}</div>
              </div>

              <div className="stock-actions">
                <div className="action-group">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={buyAmount[pred.teamName] || '0.1'}
                    onChange={(e) => setBuyAmount({ ...buyAmount, [pred.teamName]: e.target.value })}
                    placeholder="ETH amount (min 0.01)"
                    className="amount-input"
                  />
                  <button
                    className="btn-buy"
                    onClick={() => handleBuyStock(pred.teamName, pred.predictedPrice)}
                    disabled={loading || !account}
                  >
                    💰 Buy Stock
                  </button>
                </div>
                <div className="action-group">
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={sellAmount[pred.teamName] || '1'}
                    onChange={(e) => setSellAmount({ ...sellAmount, [pred.teamName]: e.target.value })}
                    placeholder="Stock amount"
                    className="amount-input"
                  />
                  <button
                    className="btn-sell"
                    onClick={() => handleSellStock(pred.teamName, pred.currentPrice)}
                    disabled={loading || !account}
                  >
                    💸 Sell Stock
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="market-footer glass-panel">
        <div className="footer-info">
          <p><strong>Host Account:</strong> {HOST_ACCOUNT}</p>
          <p>When you buy stocks, ETH is transferred to the host account via blockchain. When you sell, you receive ETH from the host account.</p>
        </div>
      </div>
    </div>
  )
}

declare global {
  interface Window { ethereum?: any }
}

