const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Orphi Modular Architecture Integration Tests", function () {
  let owner, adminReserve, matrixRoot, user1, user2, user3, user4, user5;
  let mockUSDT;
  let orphiCore, orphiPro, orphiEnterprise;
  let matrixContract, commissionContract, earningsContract;
  let ghpContract, leaderPoolContract, automationContract;
  let accessControl, emergencyContract;

  // Package amounts
  const PACKAGE_30 = ethers.parseEther("30");
  const PACKAGE_50 = ethers.parseEther("50");
  const PACKAGE_100 = ethers.parseEther("100");
  const PACKAGE_200 = ethers.parseEther("200");

  // Package tiers enum
  const PackageTier = {
    NONE: 0,
    PACKAGE_30: 1,
    PACKAGE_50: 2,
    PACKAGE_100: 3,
    PACKAGE_200: 4
  };

  beforeEach(async function () {
    [owner, adminReserve, matrixRoot, user1, user2, user3, user4, user5] = await ethers.getSigners();

    // Deploy MockUSDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    // Mint USDT to test users
    const testAmount = ethers.parseEther("10000");
    const users = [user1, user2, user3, user4, user5];
    
    for (const user of users) {
      await mockUSDT.faucet(user.address, testAmount);
    }
  });

  describe("Core Contract Deployment and Setup", function () {
    beforeEach(async function () {
      // Deploy Core contract
      const OrphiCrowdFundCore = await ethers.getContractFactory("OrphiCrowdFundCore");
      orphiCore = await OrphiCrowdFundCore.deploy(
        await mockUSDT.getAddress(),
        adminReserve.address,
        matrixRoot.address,
        owner.address
      );
      await orphiCore.waitForDeployment();

      // Deploy modular contracts
      await orphiCore.deployModularContracts();

      // Get deployed contract addresses
      const contracts = await orphiCore.getModularContracts();
      
      // Get contract instances
      const OrphiMatrix = await ethers.getContractFactory("OrphiMatrix");
      matrixContract = OrphiMatrix.attach(contracts.matrix);
      
      const OrphiCommissions = await ethers.getContractFactory("OrphiCommissions");
      commissionContract = OrphiCommissions.attach(contracts.commission);
      
      const OrphiEarnings = await ethers.getContractFactory("OrphiEarnings");
      earningsContract = OrphiEarnings.attach(contracts.earnings);
      
      const OrphiGlobalHelpPool = await ethers.getContractFactory("OrphiGlobalHelpPool");
      ghpContract = OrphiGlobalHelpPool.attach(contracts.ghp);
      
      const OrphiLeaderPool = await ethers.getContractFactory("OrphiLeaderPool");
      leaderPoolContract = OrphiLeaderPool.attach(contracts.leaderPool);

      // Approve USDT for users
      for (const user of [user1, user2, user3, user4, user5]) {
        await mockUSDT.connect(user).approve(await orphiCore.getAddress(), testAmount);
      }
    });

    it("Should deploy all modular contracts correctly", async function () {
      const contracts = await orphiCore.getModularContracts();
      
      expect(contracts.matrix).to.not.equal(ethers.ZeroAddress);
      expect(contracts.commission).to.not.equal(ethers.ZeroAddress);
      expect(contracts.earnings).to.not.equal(ethers.ZeroAddress);
      expect(contracts.ghp).to.not.equal(ethers.ZeroAddress);
      expect(contracts.leaderPool).to.not.equal(ethers.ZeroAddress);
    });

    it("Should register users and place in matrix correctly", async function () {
      // Register user1 under matrixRoot
      await orphiCore.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Check user registration
      const userInfo = await orphiCore.getUserInfo(user1.address);
      expect(userInfo.sponsor).to.equal(matrixRoot.address);
      expect(userInfo.packageTier).to.equal(PackageTier.PACKAGE_30);
      expect(userInfo.isUserRegistered).to.be.true;

      // Check matrix placement
      const matrixInfo = await matrixContract.getMatrixInfo(user1.address);
      expect(matrixInfo.isPlaced).to.be.true;
      expect(matrixInfo.sponsor).to.equal(matrixRoot.address);
    });

    it("Should distribute commissions correctly", async function () {
      // Register user1 under matrixRoot
      await orphiCore.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Check sponsor commission was credited
      const rootEarnings = await earningsContract.getUserEarningsInfo(matrixRoot.address);
      expect(rootEarnings.totalEarnings).to.be.greaterThan(0);
    });

    it("Should handle package upgrades", async function () {
      // Register user1 with PACKAGE_30
      await orphiCore.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Upgrade to PACKAGE_50
      const upgradeAmount = PACKAGE_50 - PACKAGE_30;
      await orphiCore.connect(user1).upgradePackage(PackageTier.PACKAGE_50, { value: upgradeAmount });
      
      // Check upgrade
      const userInfo = await orphiCore.getUserInfo(user1.address);
      expect(userInfo.packageTier).to.equal(PackageTier.PACKAGE_50);
    });
  });

  describe("Pro Contract Features", function () {
    beforeEach(async function () {
      // Deploy Pro contract
      const OrphiCrowdFundPro = await ethers.getContractFactory("OrphiCrowdFundPro");
      orphiPro = await OrphiCrowdFundPro.deploy(
        await mockUSDT.getAddress(),
        adminReserve.address,
        matrixRoot.address,
        owner.address
      );
      await orphiPro.waitForDeployment();

      // Deploy modular contracts
      await orphiPro.deployModularContracts();
      
      // Deploy governance contracts
      await orphiPro.deployGovernanceContracts();

      // Get governance contract instances
      const contracts = await orphiPro.getModularContracts();
      accessControl = await ethers.getContractAt("OrphiAccessControl", contracts.accessControl);
      emergencyContract = await ethers.getContractAt("OrphiEmergency", contracts.emergency);

      // Approve USDT for users
      for (const user of [user1, user2, user3, user4, user5]) {
        await mockUSDT.connect(user).approve(await orphiPro.getAddress(), testAmount);
      }
    });

    it("Should deploy governance contracts", async function () {
      expect(await orphiPro.accessControl()).to.not.equal(ethers.ZeroAddress);
      expect(await orphiPro.emergencyContract()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should enforce withdrawal cooldowns", async function () {
      // Register user
      await orphiPro.connect(user1).registerUserPro(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Try to withdraw immediately - should fail due to cooldown
      await expect(
        orphiPro.connect(user1).withdrawPro(ethers.parseEther("10"))
      ).to.be.revertedWith("Withdrawal cooldown not passed");
    });

    it("Should track advanced analytics", async function () {
      // Enable advanced analytics
      await orphiPro.toggleAdvancedAnalytics();
      
      // Register user
      await orphiPro.connect(user1).registerUserPro(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Check analytics tracking
      const userStats = await orphiPro.getAdvancedUserStats(user1.address);
      expect(userStats.earningsCount).to.be.greaterThan(0);
    });

    it("Should enforce daily limits", async function () {
      // Set low daily limits
      await orphiPro.updateRiskLimits(ethers.parseEther("100"), 1);
      
      // Register one user
      await orphiPro.connect(user1).registerUserPro(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Try to register another - should fail due to daily limit
      await expect(
        orphiPro.connect(user2).registerUserPro(matrixRoot.address, PackageTier.PACKAGE_30)
      ).to.be.revertedWith("Daily registration limit exceeded");
    });
  });

  describe("Enterprise Contract Features", function () {
    beforeEach(async function () {
      // Deploy Enterprise contract
      const OrphiCrowdFundEnterprise = await ethers.getContractFactory("OrphiCrowdFundEnterprise");
      orphiEnterprise = await OrphiCrowdFundEnterprise.deploy(
        await mockUSDT.getAddress(),
        adminReserve.address,
        matrixRoot.address,
        owner.address
      );
      await orphiEnterprise.waitForDeployment();

      // Deploy modular contracts
      await orphiEnterprise.deployModularContracts();
      
      // Deploy automation contract
      await orphiEnterprise.deployAutomationContract();

      // Approve USDT for users
      for (const user of [user1, user2, user3, user4, user5]) {
        await mockUSDT.connect(user).approve(await orphiEnterprise.getAddress(), testAmount);
      }
    });

    it("Should deploy automation contract", async function () {
      expect(await orphiEnterprise.automationContract()).to.not.equal(ethers.ZeroAddress);
    });

    it("Should register users with enterprise features", async function () {
      const affiliateData = ethers.randomBytes(32);
      
      await orphiEnterprise.connect(user1).registerUserEnterprise(
        matrixRoot.address,
        PackageTier.PACKAGE_30,
        affiliateData
      );
      
      // Check enterprise metrics
      const userStats = await orphiEnterprise.getEnterpriseUserStats(user1.address);
      expect(userStats.lifetimeVolume).to.equal(PACKAGE_30);
    });

    it("Should create and manage custom pools", async function () {
      const poolName = "TEST_POOL";
      const initialBalance = ethers.parseEther("1000");
      
      // Create custom pool
      await mockUSDT.approve(await orphiEnterprise.getAddress(), initialBalance);
      await orphiEnterprise.createCustomPool(poolName, initialBalance);
      
      // Check pool balance
      const balance = await orphiEnterprise.getCustomPoolBalance(poolName);
      expect(balance).to.equal(initialBalance);
    });

    it("Should handle automated distributions", async function () {
      // Configure automation
      await orphiEnterprise.configureAutomation(true, 3600, 500000); // 1 hour interval
      
      // Fund GHP to trigger automation
      const fundAmount = ethers.parseEther("15000"); // Above threshold
      await mockUSDT.approve(await orphiEnterprise.getAddress(), fundAmount);
      await orphiEnterprise.fundGHP(fundAmount);
      
      // Execute automation
      await orphiEnterprise.executeAutomatedDistributions();
      
      // Check automation status
      const status = await orphiEnterprise.getAutomationStatus();
      expect(status.enabled).to.be.true;
    });

    it("Should track enterprise analytics", async function () {
      // Register users to generate data
      await orphiEnterprise.connect(user1).registerUserEnterprise(
        matrixRoot.address,
        PackageTier.PACKAGE_100,
        "0x"
      );
      
      await orphiEnterprise.connect(user2).registerUserEnterprise(
        user1.address,
        PackageTier.PACKAGE_50,
        "0x"
      );
      
      // Check enterprise metrics
      const user1Stats = await orphiEnterprise.getEnterpriseUserStats(user1.address);
      expect(user1Stats.lifetimeVolume).to.equal(PACKAGE_100);
      expect(user1Stats.referralCount).to.equal(1);
    });
  });

  describe("Emergency Management", function () {
    beforeEach(async function () {
      // Deploy Pro contract with emergency features
      const OrphiCrowdFundPro = await ethers.getContractFactory("OrphiCrowdFundPro");
      orphiPro = await OrphiCrowdFundPro.deploy(
        await mockUSDT.getAddress(),
        adminReserve.address,
        matrixRoot.address,
        owner.address
      );
      await orphiPro.waitForDeployment();

      await orphiPro.deployModularContracts();
      await orphiPro.deployGovernanceContracts();

      // Get emergency contract
      emergencyContract = await ethers.getContractAt(
        "OrphiEmergency",
        await orphiPro.emergencyContract()
      );

      // Approve USDT for users
      for (const user of [user1, user2, user3, user4, user5]) {
        await mockUSDT.connect(user).approve(await orphiPro.getAddress(), testAmount);
      }
    });

    it("Should activate emergency mode", async function () {
      await emergencyContract.activateEmergency("Testing emergency activation");
      
      const status = await emergencyContract.getEmergencyStatus();
      expect(status.emergency).to.be.true;
      expect(status.withdrawalsDisabledFlag).to.be.true;
      expect(status.registrationsDisabledFlag).to.be.true;
    });

    it("Should prevent operations during emergency", async function () {
      await emergencyContract.activateEmergency("Testing emergency prevention");
      
      // Try to register - should fail
      await expect(
        orphiPro.connect(user1).registerUserPro(matrixRoot.address, PackageTier.PACKAGE_30)
      ).to.be.revertedWith("Emergency: system in emergency mode");
    });

    it("Should manage emergency operators", async function () {
      await emergencyContract.addEmergencyOperator(user1.address);
      
      // User1 should now be able to toggle emergency pause
      await emergencyContract.connect(user1).toggleEmergencyPause();
      
      const status = await emergencyContract.getEmergencyStatus();
      expect(status.paused).to.be.true;
    });

    it("Should blacklist addresses", async function () {
      await emergencyContract.blacklistAddress(user1.address, "Suspicious activity");
      
      // Check blacklist status
      expect(await emergencyContract.blacklistedAddresses(user1.address)).to.be.true;
    });
  });

  describe("Integration and Gas Optimization", function () {
    beforeEach(async function () {
      // Deploy Core for gas testing
      const OrphiCrowdFundCore = await ethers.getContractFactory("OrphiCrowdFundCore");
      orphiCore = await OrphiCrowdFundCore.deploy(
        await mockUSDT.getAddress(),
        adminReserve.address,
        matrixRoot.address,
        owner.address
      );
      await orphiCore.waitForDeployment();

      await orphiCore.deployModularContracts();

      // Approve USDT for users
      for (const user of [user1, user2, user3, user4, user5]) {
        await mockUSDT.connect(user).approve(await orphiCore.getAddress(), testAmount);
      }
    });

    it("Should maintain reasonable gas costs for registration", async function () {
      const tx = await orphiCore.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      const receipt = await tx.wait();
      
      console.log(`Registration gas used: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lessThan(1000000); // Less than 1M gas
    });

    it("Should handle bulk operations efficiently", async function () {
      // Register multiple users and measure total gas
      const users = [user1, user2, user3, user4, user5];
      let totalGas = 0n;
      
      for (let i = 0; i < users.length; i++) {
        const sponsor = i === 0 ? matrixRoot.address : users[i-1].address;
        const tx = await orphiCore.connect(users[i]).registerUser(sponsor, PackageTier.PACKAGE_30);
        const receipt = await tx.wait();
        totalGas += receipt.gasUsed;
      }
      
      console.log(`Total gas for 5 registrations: ${totalGas.toString()}`);
      console.log(`Average gas per registration: ${(totalGas / 5n).toString()}`);
      
      expect(totalGas).to.be.lessThan(4000000n); // Less than 4M gas total
    });

    it("Should maintain contract size limits", async function () {
      // This test would be run during compilation to check contract sizes
      // Each modular contract should be under 24KB
      console.log("Contract size verification should be done during compilation");
    });
  });

  describe("Complete System Integration", function () {
    it("Should demonstrate complete workflow", async function () {
      // Deploy Enterprise version for full feature demo
      const OrphiCrowdFundEnterprise = await ethers.getContractFactory("OrphiCrowdFundEnterprise");
      orphiEnterprise = await OrphiCrowdFundEnterprise.deploy(
        await mockUSDT.getAddress(),
        adminReserve.address,
        matrixRoot.address,
        owner.address
      );
      await orphiEnterprise.waitForDeployment();

      await orphiEnterprise.deployModularContracts();
      await orphiEnterprise.deployAutomationContract();

      // Approve USDT for users
      for (const user of [user1, user2, user3, user4, user5]) {
        await mockUSDT.connect(user).approve(await orphiEnterprise.getAddress(), testAmount);
      }

      // 1. Register users in a tree structure
      await orphiEnterprise.connect(user1).registerUserEnterprise(matrixRoot.address, PackageTier.PACKAGE_100, "0x");
      await orphiEnterprise.connect(user2).registerUserEnterprise(user1.address, PackageTier.PACKAGE_50, "0x");
      await orphiEnterprise.connect(user3).registerUserEnterprise(user1.address, PackageTier.PACKAGE_50, "0x");
      await orphiEnterprise.connect(user4).registerUserEnterprise(user2.address, PackageTier.PACKAGE_30, "0x");
      await orphiEnterprise.connect(user5).registerUserEnterprise(user3.address, PackageTier.PACKAGE_30, "0x");

      // 2. Check system statistics
      const systemStats = await orphiEnterprise.getSystemStats();
      expect(systemStats.totalMembers).to.equal(6); // Including matrix root
      expect(systemStats.totalVolume).to.be.greaterThan(0);

      // 3. Create and fund custom pool
      const poolName = "BONUS_POOL";
      const poolAmount = ethers.parseEther("5000");
      await mockUSDT.approve(await orphiEnterprise.getAddress(), poolAmount);
      await orphiEnterprise.createCustomPool(poolName, poolAmount);

      // 4. Distribute custom pool
      const recipients = [user1.address, user2.address];
      const amounts = [ethers.parseEther("2000"), ethers.parseEther("1000")];
      await orphiEnterprise.distributeCustomPool(poolName, recipients, amounts);

      // 5. Check enterprise analytics
      const user1Stats = await orphiEnterprise.getEnterpriseUserStats(user1.address);
      expect(user1Stats.referralCount).to.equal(2); // user2 and user3

      // 6. Test automation
      await orphiEnterprise.configureAutomation(true, 3600, 500000);
      
      console.log("Complete workflow test passed successfully!");
    });
  });
});
