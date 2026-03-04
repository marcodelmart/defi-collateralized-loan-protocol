# Decentralized Collateralized Loan Protocol

**Architect:** Marco Flavio Delgado Martinez  
**Network Deployment:** Ethereum Sepolia Testnet  

## Business Overview
In my experience working with Data Engineering, Management, and Governance, I frequently encounter the risks associated with centralized data silos, unauthorized state modifications, and counterparty risks. I developed this Collateralized Loan Protocol as a decentralized alternative. 

By utilizing Ethereum smart contracts as an immutable arbiter, this protocol natively locks collateral on-chain. It removes the need for centralized clearinghouses, ensuring transparent, mathematically verifiable agreements between borrowers and lenders.

## Etherscan Verification
The protocol is live and verified on the Sepolia Testnet. 
* Contract Address: [0xEAA280034350E9ac2A17a6E680467F8a12c5f5B2](https://sepolia.etherscan.io/address/0xeaa280034350e9ac2a17a6e680467f8a12c5f5b2)
* Deployment Hash: [0xd15c82e592e16b52373708ca7da48624291d261eff20bdaed126f9d8f9471359](https://sepolia.etherscan.io/tx/0xd15c82e592e16b52373708ca7da48624291d261eff20bdaed126f9d8f9471359)

## Strategic Feature: Liquidity Velocity via Repayment Rebates
To optimize capital efficiency, I designed an automated Early Repayment Rebate mechanism into the protocol. 

If a borrower repays the principal and interest before 50% of the loan term expires, the contract mathematically enforces a 50% reduction in the accrued interest. My analysis shows this incentivizes early debt settlement, increasing liquidity velocity for lenders while providing a tangible financial benefit to responsible borrowers.

## Architecture & Governance Controls
The contract (`CollateralizedLoan.sol`) enforces strict state machine rules to prevent re-entrancy and unauthorized claims:
1. Deposit & Request: Secures borrower collateral (ETH) and registers immutable loan parameters.
2. Fund Loan: Matches a lender's capital exactly to the requested principal.
3. Repay Loan: Processes principal and interest returns, automatically applying the rebate logic if applicable, and releases the locked collateral.
4. Claim Collateral: A time-locked governance function that permits the lender to seize collateral only if the strict maturity date has passed without repayment.

## Local Environment Setup
To audit the code or run the test suite locally, follow these steps:

1. Install project dependencies:
```bash
npm install
```

2. Run the Hardhat security and logic test suite:
```bash
npx hardhat test
```

3. Deploy to a testnet (requires configuring a .env file with an Infura API Key and a private key):
``` bash
npx hardhat run --network sepolia-testnet scripts/deploy.js
```
