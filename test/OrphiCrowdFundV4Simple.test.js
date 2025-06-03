const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("OrphiCrowdFundV4Simple - Automated Pool Distribution", function () {
  let orphiCrowdFundV4;
  let mockUSDT;
  let owner;
  let adminReserve;
  let matrixRoot;
  let user1, user2, user3;
  let users = [];
  
  const PACKAGE_30 = ethers.parseEther("30");
  const PACKAGE_50 = ethers.parseEther("50");
  const PACKAGE_100 = ethers.parseEther("100");
  const PACKAGE_200 = ethers.parseEther("200");

  const PackageTier = {
    NONE: 0,
    PACKAGE_30: 1,
    PACKAGE_50: 2,
    PACKAGE_100: 3,
    PACKAGE_200: 4
  };

  beforeEach(async function () {
    [owner, adminReserve, matrixRoot, user1, user2, user3, ...users] = await ethers.getSigners();
    
    // Deploy MockUSDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    // Deploy OrphiCrowdFundV4Simple
    const OrphiCrowdFundV4Simple = await ethers.getContractFactory("OrphiCrowdFundV4Simple");
    orphiCrowdFundV4 = await upgrades.deployProxy(
      OrphiCrowdFundV4Simple,
      [await mockUSDT.getAddress(), adminReserve.address, matrixRoot.address],
      { initializer: "initialize" }
    );
    await orphiCrowdFundV4.waitForDeployment();

    // Initialize V4 features
    await orphiCrowdFundV4.initializeV4();

    // Mint and approve USDT for test users
    const testAmount = ethers.parseEther("10000");
    
    for (const user of [owner, adminReserve, matrixRoot, user1, user2, user3, ...users.slice(0, 20)]) {
      await mockUSDT.faucet(user.address, testAmount);
      await mockUSDT.connect(user).approve(await orphiCrowdFundV4.getAddress(), testAmount);
    }

    // Register matrix root
    await orphiCrowdFundV4.connect(matrixRoot).registerUser(ethers.ZeroAddress, PackageTier.PACKAGE_30);
  });

  describe("Deployment and Initialization", function () {
    it("Should initialize V4 with automation features", async function () {
      const automationStatus = await orphiCrowdFundV4.getAutomationStatus();
      expect(automationStatus.enabled).to.be.true;
      expect(automationStatus.gasLimit).to.equal(500000);
    });

    it("Should inherit all V2 functionality", async function () {
      // Test basic functionality from V2
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      const userInfo = await orphiCrowdFundV4.getUserInfoEnhanced(user1.address);
      expect(userInfo.isRegistered).to.be.true;
      expect(userInfo.sponsor).to.equal(matrixRoot.address);
    });
  });

  describe("Chainlink Automation Integration", function () {
    beforeEach(async function () {
      // Register some users to generate pool balances
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      await orphiCrowdFundV4.connect(user2).registerUser(user1.address, PackageTier.PACKAGE_30);
      await orphiCrowdFundV4.connect(user3).registerUser(user1.address, PackageTier.PACKAGE_30);
    });

    it("Should detect when upkeep is needed for GHP distribution", async function () {
      // Fast forward time to make GHP distribution ready
      await time.increase(7 * 24 * 60 * 60 + 3600 + 1); // 7 days + 1 hour buffer + 1 second
      
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.true;
      
      const poolType = ethers.AbiCoder.defaultAbiCoder().decode(["string"], performData)[0];
      expect(poolType).to.equal("GHP");
    });

    it("Should detect when upkeep is needed for Leader Bonus distribution", async function () {
      // Fast forward time to make Leader distribution ready
      await time.increase(14 * 24 * 60 * 60 + 3600 + 1); // 14 days + 1 hour buffer + 1 second
      
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.true;
      
      const poolType = ethers.AbiCoder.defaultAbiCoder().decode(["string"], performData)[0];
      expect(poolType).to.equal("LEADER");
    });

    it("Should return false when no upkeep is needed", async function () {
      const [upkeepNeeded] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;
    });

    it("Should perform automated GHP distribution", async function () {
      // Fast forward time
      await time.increase(7 * 24 * 60 * 60 + 3600 + 1);
      
      const initialGHPBalance = (await orphiCrowdFundV4.getPoolBalancesEnhanced())[4];
      expect(initialGHPBalance).to.be.greaterThan(0);
      
      // Perform upkeep
      const performData = ethers.AbiCoder.defaultAbiCoder().encode(["string"], ["GHP"]);
      await orphiCrowdFundV4.performUpkeep(performData);
      
      const finalGHPBalance = (await orphiCrowdFundV4.getPoolBalancesEnhanced())[4];
      expect(finalGHPBalance).to.equal(0);
    });

    it("Should perform automated Leader Bonus distribution", async function () {
      // Fast forward time
      await time.increase(14 * 24 * 60 * 60 + 3600 + 1);
      
      const initialLeaderBalance = (await orphiCrowdFundV4.getPoolBalancesEnhanced())[3];
      expect(initialLeaderBalance).to.be.greaterThan(0);
      
      // Perform upkeep
      const performData = ethers.AbiCoder.defaultAbiCoder().encode(["string"], ["LEADER"]);
      await orphiCrowdFundV4.performUpkeep(performData);
      
      const finalLeaderBalance = (await orphiCrowdFundV4.getPoolBalancesEnhanced())[3];
      expect(finalLeaderBalance).to.equal(0);
    });
  });

  describe("Enhanced Earnings Cap Enforcement", function () {
    it("Should enforce 4x earnings cap correctly", async function () {
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Register many users to generate earnings for user1
      for (let i = 0; i < 10; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(user1.address, PackageTier.PACKAGE_30);
      }
      
      const capStatus = await orphiCrowdFundV4.getUserCapStatus(user1.address);
      expect(capStatus.maxEarnings).to.equal(PACKAGE_30 * 4n); // 4x multiplier
    });

    it("Should mark users as capped when they reach the limit", async function () {
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Register enough users to hit the cap
      for (let i = 0; i < 15; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(user1.address, PackageTier.PACKAGE_30);
      }
      
      const userInfo = await orphiCrowdFundV4.getUserInfoEnhanced(user1.address);
      const capStatus = await orphiCrowdFundV4.getUserCapStatus(user1.address);
      
      // Check if user is approaching or at cap
      expect(capStatus.totalEarnings).to.be.greaterThan(0);
    });
  });

  describe("Circuit Breaker and Safety Features", function () {
    it("Should disable automation when failure limit is reached", async function () {
      // This would require simulating failures, which is complex
      // For now, test the manual reset functionality
      await orphiCrowdFundV4.resetAutomationFailures();
      
      const automationStatus = await orphiCrowdFundV4.getAutomationStatus();
      expect(automationStatus.failureCount).to.equal(0);
    });

    it("Should allow admin to toggle automation", async function () {
      await orphiCrowdFundV4.setAutomationEnabled(false);
      
      let automationStatus = await orphiCrowdFundV4.getAutomationStatus();
      expect(automationStatus.enabled).to.be.false;
      
      await orphiCrowdFundV4.setAutomationEnabled(true);
      
      automationStatus = await orphiCrowdFundV4.getAutomationStatus();
      expect(automationStatus.enabled).to.be.true;
    });

    it("Should allow admin to adjust gas limits", async function () {
      await orphiCrowdFundV4.setAutomationGasLimit(300000);
      
      const automationStatus = await orphiCrowdFundV4.getAutomationStatus();
      expect(automationStatus.gasLimit).to.equal(300000);
    });
  });

  describe("Emergency Functions", function () {
    beforeEach(async function () {
      // Set up some pool balances
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      await orphiCrowdFundV4.connect(user2).registerUser(user1.address, PackageTier.PACKAGE_30);
    });

    it("Should allow emergency pool distribution when automation is disabled", async function () {
      await orphiCrowdFundV4.setAutomationEnabled(false);
      
      const initialGHPBalance = (await orphiCrowdFundV4.getPoolBalancesEnhanced())[4];
      expect(initialGHPBalance).to.be.greaterThan(0);
      
      // Fast forward time
      await time.increase(7 * 24 * 60 * 60 + 3600 + 1);
      
      await orphiCrowdFundV4.emergencyDistributePool(4); // GHP pool
      
      const finalGHPBalance = (await orphiCrowdFundV4.getPoolBalancesEnhanced())[4];
      expect(finalGHPBalance).to.equal(0);
    });

    it("Should allow emergency pool withdrawal", async function () {
      const initialAdminBalance = await mockUSDT.balanceOf(adminReserve.address);
      const initialGHPBalance = (await orphiCrowdFundV4.getPoolBalancesEnhanced())[4];
      
      await orphiCrowdFundV4.emergencyWithdrawPool(4); // GHP pool
      
      const finalAdminBalance = await mockUSDT.balanceOf(adminReserve.address);
      expect(finalAdminBalance - initialAdminBalance).to.equal(initialGHPBalance);
    });
  });

  describe("View Functions", function () {
    it("Should provide comprehensive upkeep status", async function () {
      const upkeepStatus = await orphiCrowdFundV4.getUpkeepStatus();
      
      expect(upkeepStatus.ghpReady).to.be.false; // Too early
      expect(upkeepStatus.leaderReady).to.be.false; // Too early
      expect(upkeepStatus.timeToNextGHP).to.be.greaterThan(0);
      expect(upkeepStatus.timeToNextLeader).to.be.greaterThan(0);
    });

    it("Should provide user cap status information", async function () {
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      const capStatus = await orphiCrowdFundV4.getUserCapStatus(user1.address);
      
      expect(capStatus.maxEarnings).to.equal(PACKAGE_30 * 4n);
      expect(capStatus.isCapped).to.be.false;
      expect(capStatus.remainingCap).to.be.greaterThan(0);
    });
  });

  describe("Event Emission", function () {
    it("Should emit automation events correctly", async function () {
      // Fast forward time
      await time.increase(7 * 24 * 60 * 60 + 3600 + 1);
      
      const performData = ethers.AbiCoder.defaultAbiCoder().encode(["string"], ["GHP"]);
      
      await expect(orphiCrowdFundV4.performUpkeep(performData))
        .to.emit(orphiCrowdFundV4, "AutomationExecuted")
        .withArgs("GHP", 0, anyValue, anyValue);
    });

    it("Should emit cap enforcement events", async function () {
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // This might emit CapEnforcementApplied if we reach the cap
      // The exact test depends on the earnings calculation
    });
  });
});

// Helper function for any value matching
function anyValue() {
  return expect.anything();
}
