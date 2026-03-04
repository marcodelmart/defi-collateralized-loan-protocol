// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// --- DATA GOVERNANCE & ARCHITECTURE NOTES ---
// This contract acts as an immutable arbiter for loan agreements.
// By natively locking collateral on-chain, we eliminate counterparty risk,
// data silos, and unauthorized state modifications inherent in traditional centralized ledgers.

contract CollateralizedLoan {
    
    struct Loan {
        address payable borrower;
        address payable lender;
        uint collateralAmount;
        uint loanAmount;
        uint interestRate; 
        uint dueDate;
        uint duration;     
        bool isFunded;
        bool isRepaid;
    }

    mapping(uint => Loan) public loans;
    uint public nextLoanId = 1;

    // --- EVENTS (AUDIT TRAILS) ---
    event LoanRequested(uint indexed loanId, address indexed borrower, uint collateralAmount, uint loanAmount);
    event LoanFunded(uint indexed loanId, address indexed lender, uint fundingAmount);
    event LoanRepaid(uint indexed loanId, address indexed borrower, uint repaymentAmount, bool rebateApplied);
    event CollateralClaimed(uint indexed loanId, address indexed lender, uint collateralAmount);

    // --- ACCESS CONTROL & VALIDATION MODIFIERS ---
    modifier loanExists(uint _loanId) {
        require(_loanId < nextLoanId && _loanId > 0, "Loan record does not exist.");
        _;
    }

    modifier notFunded(uint _loanId) {
        require(!loans[_loanId].isFunded, "Loan is already funded.");
        _;
    }

    // 1. DEPOSIT COLLATERAL AND REQUEST LOAN
    function depositCollateralAndRequestLoan(uint _interestRate, uint _duration) external payable {
        require(msg.value > 0, "Collateral must be greater than zero.");
        require(_duration > 0, "Duration must be valid.");

        // Risk Strategy: Loan amount is strictly 50% of the collateral (Over-collateralized)
        uint _loanAmount = msg.value / 2;

        loans[nextLoanId] = Loan({
            borrower: payable(msg.sender),
            lender: payable(address(0)),
            collateralAmount: msg.value,
            loanAmount: _loanAmount,
            interestRate: _interestRate,
            dueDate: 0,
            duration: _duration,
            isFunded: false,
            isRepaid: false
        });

        emit LoanRequested(nextLoanId, msg.sender, msg.value, _loanAmount);
        nextLoanId++;
    }

    // 2. FUND A LOAN
    function fundLoan(uint _loanId) external payable loanExists(_loanId) notFunded(_loanId) {
        Loan storage loan = loans[_loanId];
        require(msg.value == loan.loanAmount, "Funding must exactly match the requested loan amount.");

        loan.lender = payable(msg.sender);
        loan.isFunded = true;
        loan.dueDate = block.timestamp + loan.duration;

        // Transfer the funded amount to the borrower securely
        loan.borrower.transfer(msg.value);

        emit LoanFunded(_loanId, msg.sender, msg.value);
    }

    // 3. REPAY A LOAN 
    function repayLoan(uint _loanId) external payable loanExists(_loanId) {
        Loan storage loan = loans[_loanId];
        require(loan.isFunded, "Cannot repay an unfunded loan.");
        require(!loan.isRepaid, "Loan is already repaid.");
        
        // Calculate standard interest
        uint interest = (loan.loanAmount * loan.interestRate) / 100;
        bool rebateApplied = false;

        // Rebate Logic: If repaid before 50% of the duration has passed, discount interest by 50%
        if (block.timestamp <= (loan.dueDate - (loan.duration / 2))) {
            interest = interest / 2;
            rebateApplied = true;
        }

        uint totalRepayment = loan.loanAmount + interest;
        require(msg.value == totalRepayment, "Incorrect repayment amount sent.");

        loan.isRepaid = true;

        // Settle the ledger: Send principal + interest to lender, return collateral to borrower
        loan.lender.transfer(totalRepayment);
        loan.borrower.transfer(loan.collateralAmount);

        emit LoanRepaid(_loanId, msg.sender, msg.value, rebateApplied);
    }

    // 4. CLAIM COLLATERAL
    function claimCollateral(uint _loanId) external loanExists(_loanId) {
        Loan storage loan = loans[_loanId];
        require(loan.isFunded, "Loan was never funded.");
        require(!loan.isRepaid, "Loan has been repaid.");
        require(block.timestamp > loan.dueDate, "Grace period has not expired yet.");
        require(msg.sender == loan.lender, "Only the authorized lender can claim the collateral.");

        // Transfer collateral to the lender to settle the debt
        uint collateral = loan.collateralAmount;
        loan.collateralAmount = 0; // Prevent re-entrancy
        
        loan.lender.transfer(collateral);

        emit CollateralClaimed(_loanId, msg.sender, collateral);
    }
}