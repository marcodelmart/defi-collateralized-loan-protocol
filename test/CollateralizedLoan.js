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
      const duration = 7 * 24 * 60 * 60; 

      await expect(
        contract.connect(borrower).depositCollateralAndRequestLoan(interestRate, duration, { value: collateral })
      ).to.emit(contract, "LoanRequested")
       .withArgs(0, borrower.address, collateral, ethers.parseEther("1.0")); // ID is now 0

      const loan = await contract.loans(0);
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
        contract.connect(lender).fundLoan(0, { value: fundAmount })
      ).to.emit(contract, "LoanFunded")
       .withArgs(0, lender.address, fundAmount);
       
      const loan = await contract.loans(0);
      expect(loan.isFunded).to.be.true;
    });

    // NEW NEGATIVE TEST
    it("Reverts if funding amount does not exactly match loan amount", async function () {
      const { contract, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);
      await contract.connect(borrower).depositCollateralAndRequestLoan(10, 86400, { value: ethers.parseEther("2.0") });
      
      const wrongFundAmount = ethers.parseEther("0.5"); 
      
      await expect(
        contract.connect(lender).fundLoan(0, { value: wrongFundAmount })
      ).to.be.revertedWith("Funding must exactly match the requested loan amount.");
    });
  });

  describe("Repaying a Loan & Rebate System", function () {
    it("Enables the borrower to repay early and get the interest rebate", async function () {
      const { contract, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);
      
      await contract.connect(borrower).depositCollateralAndRequestLoan(10, 86400, { value: ethers.parseEther("2.0") });
      await contract.connect(lender).fundLoan(0, { value: ethers.parseEther("1.0") });

      const repaymentAmount = ethers.parseEther("1.05");

      await expect(
        contract.connect(borrower).repayLoan(0, { value: repaymentAmount })
      ).to.emit(contract, "LoanRepaid")
       .withArgs(0, borrower.address, repaymentAmount, true);
    });

    // NEW NEGATIVE TEST
    it("Reverts if the repayment amount is incorrect", async function () {
      const { contract, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);
      
      await contract.connect(borrower).depositCollateralAndRequestLoan(10, 86400, { value: ethers.parseEther("2.0") });
      await contract.connect(lender).fundLoan(0, { value: ethers.parseEther("1.0") });

      const wrongRepaymentAmount = ethers.parseEther("1.01"); 

      await expect(
        contract.connect(borrower).repayLoan(0, { value: wrongRepaymentAmount })
      ).to.be.revertedWith("Incorrect repayment amount sent.");
    });
  });

  describe("Claiming Collateral ", function () {
    it("Permits the lender to claim collateral if the loan defaults past due date", async function () {
      const { contract, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);
      
      const duration = 86400; // 1 day
      await contract.connect(borrower).depositCollateralAndRequestLoan(10, duration, { value: ethers.parseEther("2.0") });
      await contract.connect(lender).fundLoan(0, { value: ethers.parseEther("1.0") });

      await time.increase(duration + 10);

      await expect(
        contract.connect(lender).claimCollateral(0)
      ).to.emit(contract, "CollateralClaimed")
       .withArgs(0, lender.address, ethers.parseEther("2.0"));
    });

    it("Reverts if someone tries to claim collateral early", async function () {
      const { contract, borrower, lender } = await loadFixture(deployCollateralizedLoanFixture);
      
      await contract.connect(borrower).depositCollateralAndRequestLoan(10, 86400, { value: ethers.parseEther("2.0") });
      await contract.connect(lender).fundLoan(0, { value: ethers.parseEther("1.0") });

      await expect(
        contract.connect(lender).claimCollateral(0)
      ).to.be.revertedWith("Grace period has not expired yet.");
    });

    // NEW NEGATIVE TEST
    it("Reverts if an unauthorized actor tries to claim collateral ", async function () {
      const { contract, borrower, lender, maliciousActor } = await loadFixture(deployCollateralizedLoanFixture);
      
      const duration = 86400;
      await contract.connect(borrower).depositCollateralAndRequestLoan(10, duration, { value: ethers.parseEther("2.0") });
      await contract.connect(lender).fundLoan(0, { value: ethers.parseEther("1.0") });

      await time.increase(duration + 10);

      // Malicious actor tries to steal the collateral
      await expect(
        contract.connect(maliciousActor).claimCollateral(0)
      ).to.be.revertedWith("Only the authorized lender can claim the collateral.");
    });
  });
});
