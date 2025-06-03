const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OrphiCrowdFund - New Optimized Version", function () {
  let orphiCrowdFund;
  let mockUSDT;
  let owner;
  let adminReserve;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, adminReserve, user1, user2] = await ethers.getSigners();

    // Deploy MockUSDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    // Deploy libraries first
    const PoolDistributionLibSimple = await ethers.getContractFactory("PoolDistributionLibSimple");
    const poolDistributionLib = await PoolDistributionLibSimple.deploy();
    await poolDistributionLib.waitForDeployment();

    const AutomationLibSimple = await ethers.getContractFactory("AutomationLibSimple");
    const automationLib = await AutomationLibSimple.deploy();
    await automationLib.waitForDeployment();

    // Deploy OrphiCrowdFund with library linking
    const OrphiCrowdFund = await ethers.getContractFactory("OrphiCrowdFund", {
      libraries: {
        "PoolDistributionLibSimple": await poolDistributionLib.getAddress(),
        "AutomationLibSimple": await automationLib.getAddress(),
      },
    });
    
    orphiCrowdFund = await OrphiCrowdFund.deploy(
      await mockUSDT.getAddress(),
      adminReserve.address,
      owner.address
    );
    await orphiCrowdFund.waitForDeployment();

    // Mint tokens to users
    const mintAmount = ethers.parseUnits("10000", 6); // 10,000 USDT
    await mockUSDT.faucet(user1.address, mintAmount);
    await mockUSDT.faucet(user2.address, mintAmount);

    // Approve tokens
    await mockUSDT.connect(user1).approve(await orphiCrowdFund.getAddress(), mintAmount);
    await mockUSDT.connect(user2).approve(await orphiCrowdFund.getAddress(), mintAmount);
  });

  describe("Deployment & Configuration", function () {
    it("Should deploy successfully with correct configuration", async function () {
      expect(await orphiCrowdFund.paymentToken()).to.equal(await mockUSDT.getAddress());
      expect(await orphiCrowdFund.adminReserve()).to.equal(adminReserve.address);
      expect(await orphiCrowdFund.owner()).to.equal(owner.address);
    });

    it("Should have correct package prices", async function () {
      const packages = await orphiCrowdFund.PACKAGE_PRICES(0);
      expect(packages).to.equal(ethers.parseUnits("100", 6)); // 100 USDT
    });

    it("Should have automation enabled by default", async function () {
      const stats = await orphiCrowdFund.getAutomationStats();
      expect(stats[0]).to.be.true; // enabled
      expect(stats[3]).to.equal(500000); // gasLimit
    });
  });

  describe("User Registration", function () {
    it("Should register user successfully", async function () {
      await orphiCrowdFund.connect(user1).register(owner.address, 1); // Package level 1 (100 USDT)
      
      const userInfo = await orphiCrowdFund.getUserInfo(user1.address);
      expect(userInfo.id).to.equal(1);
      expect(userInfo.sponsor).to.equal(owner.address);
      expect(userInfo.packageLevel).to.equal(1);
      expect(userInfo.isActive).to.be.true;
    });

    it("Should update total members count", async function () {
      await orphiCrowdFund.connect(user1).register(owner.address, 1);
      expect(await orphiCrowdFund.totalMembers()).to.equal(1);
    });
  });

  describe("Pool Balances", function () {
    it("Should have zero pool balances initially", async function () {
      const poolBalances = await orphiCrowdFund.getPoolBalances();
      for (let i = 0; i < 5; i++) {
        expect(poolBalances[i]).to.equal(0);
      }
    });

    it("Should accumulate pool balances after registration", async function () {
      await orphiCrowdFund.connect(user1).register(owner.address, 1);
      
      const poolBalances = await orphiCrowdFund.getPoolBalances();
      // Should have some accumulated pools from the 100 USDT registration
      let totalPools = 0n;
      for (let i = 0; i < 5; i++) {
        totalPools += poolBalances[i];
      }
      expect(totalPools).to.be.greaterThan(0);
    });
  });

  describe("Chainlink Automation", function () {
    it("Should check upkeep correctly", async function () {
      // Register user to create pool balances
      await orphiCrowdFund.connect(user1).register(owner.address, 1);
      
      const result = await orphiCrowdFund.checkUpkeep("0x");
      // With fresh deployment, upkeep should not be needed yet
      expect(result[0]).to.be.false; // upkeepNeeded
    });

    it("Should allow owner to configure automation", async function () {
      await orphiCrowdFund.setAutomationEnabled(false);
      const stats = await orphiCrowdFund.getAutomationStats();
      expect(stats[0]).to.be.false; // enabled
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to pause/unpause", async function () {
      await orphiCrowdFund.pause();
      expect(await orphiCrowdFund.paused()).to.be.true;
      
      await orphiCrowdFund.unpause();
      expect(await orphiCrowdFund.paused()).to.be.false;
    });

    it("Should prevent non-owner from admin functions", async function () {
      await expect(
        orphiCrowdFund.connect(user1).pause()
      ).to.be.revertedWithCustomError(orphiCrowdFund, "OwnableUnauthorizedAccount");
    });
  });
});
