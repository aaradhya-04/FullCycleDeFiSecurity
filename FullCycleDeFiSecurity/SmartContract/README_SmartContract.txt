RaceSwap_vulnerable — Member1 deliverables

Files:
- contracts/RaceSwap_vulnerable.sol  (vulnerable demo)
- contracts/ERC20Mock.sol            (mock token)
- migrations/2_deploy_raceswap.js
- test/raceswap.test.js
- SmartContract/RaceSwap_ABI.json    (ABI for backend)
- SmartContract/sample_transactions.json
Notes:
- Intentional vulnerabilities: setRate() missing onlyOwner; swap() no slippage protection.
- After Member2 audit, apply fixes and produce RaceSwap.sol (hardened).
