const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CollateralizedLoan", function () {
  
  async function deployCollateralizedLoanFixture() {
    const [owner, borrower, lender, maliciousActor] = await ethers.getSigners();
    const CollateralizedLoan = await ethers.getContractFactory("CollateralizedLoan");
    const contract = await CollateralizedLoan.deploy();
    
    return { contract, owner, borrower, lender, maliciousActor };
  }

  describe("Loan Request", function () {
    it("Should let a borrower deposit collateral and request a loan", async function () {
      const { contract, borrower } = await loadFixture(deployCollateralizedLoanFixture);
      
      const collateral = ethers.parseEther("2.0");
      const interestRate = 10;
      const duration = 7 * 24 * 60 * 60; // 7 days

      await expect(
        contract.connect(borrower).depositCollateralAndRequestLoan(interestRate, duration, { value: collateral })
      ).to.emit(contract, "LoanRequested")
       .withArgs(1, borrower.address, collateral, ethers.parseEther("1.0"));

      const loan = await contract.loans(1);
      expect(loan.collateralAmount).to.equal(collateral);
      expect(loan.loanAmount).to.equal(ethers.parseEther("1.0"));
    });
  });

  describe("Funding a Loan", function () {
    it("Allows a lender to fund a requested loan securely", async function () {
      const { contract, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);
      
      await contract.connect(borrower).depositCollateralAndRequestLoan(10, 86400, { value: ethers.parseEther("2.0") });
      
      const fundAmount = ethers.parseEther("1.0");
      
      await expect(
        contract.connect(lender).fundLoan(1, { value: fundAmount })
      ).to.emit(contract, "LoanFunded")
       .withArgs(1, lender.address, fundAmount);
       
      const loan = await contract.loans(1);
      expect(loan.isFunded).to.be.true;
    });
  });

  describe("Repaying a Loan & Rebate System", function () {
    it("Enables the borrower to repay early and get the interest rebate", async function () {
      const { contract, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);
      
      await contract.connect(borrower).depositCollateralAndRequestLoan(10, 86400, { value: ethers.parseEther("2.0") });
      await contract.connect(lender).fundLoan(1, { value: ethers.parseEther("1.0") });

      // Calculate total repayment with the 50% rebate on the 10% interest
      // Loan: 1.0 ETH. Normal Interest: 0.1 ETH. Rebate Interest: 0.05 ETH.
      const repaymentAmount = ethers.parseEther("1.05");

      await expect(
        contract.connect(borrower).repayLoan(1, { value: repaymentAmount })
      ).to.emit(contract, "LoanRepaid")
       .withArgs(1, borrower.address, repaymentAmount, true);
    });
  });

  describe("Claiming Collateral (Governance Enforcement)", function () {
    it("Permits the lender to claim collateral if the loan defaults past due date", async function () {
      const { contract, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);
      
      const duration = 86400; // 1 day
      await contract.connect(borrower).depositCollateralAndRequestLoan(10, duration, { value: ethers.parseEther("2.0") });
      await contract.connect(lender).fundLoan(1, { value: ethers.parseEther("1.0") });

      // Fast forward time past the due date
      await time.increase(duration + 10);

      await expect(
        contract.connect(lender).claimCollateral(1)
      ).to.emit(contract, "CollateralClaimed")
       .withArgs(1, lender.address, ethers.parseEther("2.0"));
    });

    it("Reverts if someone tries to claim collateral early", async function () {
      const { contract, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);
      
      await contract.connect(borrower).depositCollateralAndRequestLoan(10, 86400, { value: ethers.parseEther("2.0") });
      await contract.connect(lender).fundLoan(1, { value: ethers.parseEther("1.0") });

      // Try to claim immediately without passing time
      await expect(
        contract.connect(lender).claimCollateral(1)
      ).to.be.revertedWith("Grace period has not expired yet.");
    });
  });
});