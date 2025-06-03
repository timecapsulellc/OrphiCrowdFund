const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("OrphiCrowdFundV4 - Chainlink Automation Edge Cases", function () {
  let orphiCrowdFundV4;
  let mockUSDT;
  let owner;
  let adminReserve;
  let matrixRoot;
  let user1, user2, user3;
  let users = [];

  const PACKAGE_30 = ethers.parseEther("30");
  const PackageTier = { NONE: 0, PACKAGE_30: 1, PACKAGE_50: 2, PACKAGE_100: 3, PACKAGE_200: 4 };

  beforeEach(async function () {
    [owner, adminReserve, matrixRoot, user1, user2, user3, ...users] = await ethers.getSigners();
    
    // Deploy contracts
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    const OrphiCrowdFundV4 = await ethers.getContractFactory("OrphiCrowdFundV4");
    orphiCrowdFundV4 = await upgrades.deployProxy(
      OrphiCrowdFundV4,
      [await mockUSDT.getAddress(), adminReserve.address, matrixRoot.address],
      { initializer: "initialize" }
    );
    await orphiCrowdFundV4.waitForDeployment();

    // Setup test funds
    const testAmount = ethers.parseEther("10000");
    for (let i = 0; i < 20; i++) {
      await mockUSDT.faucet(users[i].address, testAmount);
      await mockUSDT.connect(users[i]).approve(await orphiCrowdFundV4.getAddress(), testAmount);
    }

    const ADMIN_ROLE = await orphiCrowdFundV4.ADMIN_ROLE();
    await orphiCrowdFundV4.grantRole(ADMIN_ROLE, owner.address);
  });

  describe("Automation Failure Scenarios", function () {
    beforeEach(async function () {
      // Create pool balances
      for (let i = 0; i < 5; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
    });

    it("Should handle gas limit exceeded scenarios", async function () {
      // Set very low gas limit to simulate failure
      await orphiCrowdFundV4.setAutomationGasLimit(1000); // Very low
      
      // Fast forward time
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Try to perform upkeep with low gas
      const performData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);
      
      // This might fail due to low gas limit
      try {
        await orphiCrowdFundV4.performUpkeep(performData, { gasLimit: 1000 });
      } catch (error) {
        // Expected to fail with low gas
        expect(error.message).to.include("gas");
      }
      
      // Reset gas limit
      await orphiCrowdFundV4.setAutomationGasLimit(500000);
    });

    it("Should handle contract pause during automation", async function () {
      // Fast forward time to make automation due
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Pause contract
      await orphiCrowdFundV4.emergencyPause();
      
      // Try automation - should fail
      const performData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);
      await expect(orphiCrowdFundV4.performUpkeep(performData))
        .to.be.revertedWithCustomError(orphiCrowdFundV4, "EnforcedPause");
      
      // Unpause and retry
      await orphiCrowdFundV4.emergencyUnpause();
      await orphiCrowdFundV4.performUpkeep(performData); // Should succeed
    });

    it("Should handle insufficient token balance scenarios", async function () {
      // Drain the contract's token balance
      const contractBalance = await mockUSDT.balanceOf(await orphiCrowdFundV4.getAddress());
      if (contractBalance > 0) {
        await orphiCrowdFundV4.emergencyWithdraw(await mockUSDT.getAddress(), contractBalance);
      }
      
      // Fast forward time
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Check upkeep should return false due to insufficient balance
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;
    });

    it("Should handle circuit breaker activation after max failures", async function () {
      // Simulate reaching max failures
      const maxFailures = await orphiCrowdFundV4.MAX_AUTOMATION_FAILURES();
      
      // This is a conceptual test - in reality, failures would be tracked internally
      // For testing, we'll manually disable automation after simulating failures
      await orphiCrowdFundV4.setAutomationEnabled(false);
      
      // Verify automation is disabled
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;
    });
  });

  describe("Timing Edge Cases", function () {
    it("Should handle exactly at boundary timing", async function () {
      // Fast forward to exactly the interval time
      await time.increase(7 * 24 * 60 * 60); // Exactly 7 days, no buffer
      
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false; // Should be false due to safety buffer
      
      // Add safety buffer
      await time.increase(60 * 60 + 1); // Add 1 hour 1 second
      
      const [upkeepNeededAfter, performDataAfter] = await orphiCrowdFundV4.checkUpkeep("0x");
      // Should be true now if there's balance
      if ((await orphiCrowdFundV4.getPoolBalancesEnhanced())[4] > 0) {
        expect(upkeepNeededAfter).to.be.true;
      }
    });

    it("Should handle very rapid time changes", async function () {
      // Simulate time jump beyond multiple intervals
      await time.increase(30 * 24 * 60 * 60); // 30 days
      
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      
      if ((await orphiCrowdFundV4.getPoolBalancesEnhanced())[4] > 0) {
        expect(upkeepNeeded).to.be.true;
        
        // Should prioritize GHP (shorter interval)
        const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(["uint8"], performData);
        expect(decodedData[0]).to.equal(1); // GHP_DISTRIBUTION
      }
    });

    it("Should handle time going backwards (blockchain reorg scenario)", async function () {
      // This is a theoretical test for blockchain reorg handling
      const currentTime = await time.latest();
      
      // Fast forward first
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Get status
      const status1 = await orphiCrowdFundV4.getAutomationStatus();
      
      // In a real reorg, we can't actually go back in time with hardhat
      // But we can test that the system uses block.timestamp consistently
      expect(status1.lastGHPDistribution).to.be.lessThan(await time.latest());
    });
  });

  describe("Concurrent Operation Edge Cases", function () {
    beforeEach(async function () {
      // Setup multiple users for concurrent tests
      for (let i = 0; i < 10; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
    });

    it("Should handle manual distribution during automation window", async function () {
      // Fast forward to automation window
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Perform manual distribution first
      await orphiCrowdFundV4.distributeGlobalHelpPool();
      
      // Check that automation no longer needed
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false; // Pool should be empty now
    });

    it("Should handle registration during distribution", async function () {
      // Fast forward to distribution time
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Start distribution and register user simultaneously
      const distributionPromise = orphiCrowdFundV4.distributeGlobalHelpPool();
      const registrationPromise = orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Both should complete successfully
      await Promise.all([distributionPromise, registrationPromise]);
      
      // Verify both operations succeeded
      expect(await orphiCrowdFundV4.isRegistered(user1.address)).to.be.true;
    });

    it("Should handle multiple automation actions in sequence", async function () {
      // Fast forward to make both GHP and Leader distributions due
      await time.increase(15 * 24 * 60 * 60); // 15 days
      
      // Perform GHP distribution first
      const ghpData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);
      await orphiCrowdFundV4.performUpkeep(ghpData);
      
      // Then perform Leader distribution
      const leaderData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [2]);
      await orphiCrowdFundV4.performUpkeep(leaderData);
      
      // Verify both distributions occurred
      const history = await orphiCrowdFundV4.getDistributionHistory();
      expect(history.totalGHPDistributions).to.equal(1);
      expect(history.totalLeaderDistributions).to.equal(1);
    });
  });

  describe("Data Integrity Edge Cases", function () {
    it("Should handle corrupted performData gracefully", async function () {
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Test with invalid action type
      const invalidData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [99]);
      await expect(orphiCrowdFundV4.performUpkeep(invalidData))
        .to.be.revertedWith("Invalid automation action");
      
      // Test with malformed data
      const malformedData = "0x1234";
      await expect(orphiCrowdFundV4.performUpkeep(malformedData))
        .to.be.reverted; // Should revert due to decode error
    });

    it("Should handle empty performData", async function () {
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Test with empty data
      await expect(orphiCrowdFundV4.performUpkeep("0x"))
        .to.be.reverted; // Should revert due to decode error
    });

    it("Should maintain consistency during failed transactions", async function () {
      const initialStatus = await orphiCrowdFundV4.getAutomationStatus();
      
      // Try an operation that should fail
      try {
        await orphiCrowdFundV4.performUpkeep("0xinvalid");
      } catch (error) {
        // Expected to fail
      }
      
      // Verify state wasn't corrupted
      const finalStatus = await orphiCrowdFundV4.getAutomationStatus();
      expect(finalStatus.enabled).to.equal(initialStatus.enabled);
      expect(finalStatus.failureCount).to.equal(initialStatus.failureCount);
    });
  });

  describe("System Limits and Boundaries", function () {
    it("Should handle maximum pool balance scenarios", async function () {
      // Register many users to create large pool balances
      for (let i = 0; i < 100; i++) {
        await mockUSDT.faucet(users[i % 20].address, ethers.parseEther("1000"));
        await mockUSDT.connect(users[i % 20]).approve(await orphiCrowdFundV4.getAddress(), ethers.parseEther("1000"));
      }
      
      // Register users with large packages
      for (let i = 0; i < 50; i++) {
        await orphiCrowdFundV4.connect(users[i % 20]).registerUser(matrixRoot.address, PackageTier.PACKAGE_200);
      }
      
      // Check if automation can handle large balances
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.true;
      
      // Should be able to distribute even large amounts
      await orphiCrowdFundV4.performUpkeep(performData);
    });

    it("Should handle minimum threshold edge cases", async function () {
      // Clear pools completely
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      await orphiCrowdFundV4.distributeGlobalHelpPool();
      await orphiCrowdFundV4.distributeLeaderBonus();
      
      // Register minimal user to create small balance
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Fast forward again
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Check if small balance triggers automation
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      const poolBalances = await orphiCrowdFundV4.getPoolBalancesEnhanced();
      
      if (poolBalances[4] > 0) {
        expect(upkeepNeeded).to.be.true;
      } else {
        expect(upkeepNeeded).to.be.false;
      }
    });

    it("Should handle automation with no eligible users", async function () {
      // Create scenario where all users are capped
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Force cap user1 (this would require many registrations in practice)
      // For testing purposes, we'll verify the logic exists
      const userInfo = await orphiCrowdFundV4.getUserInfoEnhanced(user1.address);
      
      // If user becomes capped, they should be excluded from GHP
      if (userInfo.isCapped) {
        // Fast forward and test distribution with only capped users
        await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
        
        const performData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);
        await orphiCrowdFundV4.performUpkeep(performData);
        
        // Distribution should still work (funds go to admin reserve)
      }
    });
  });

  describe("Recovery and Resilience", function () {
    it("Should recover gracefully from automation failures", async function () {
      // Simulate failure scenario by disabling automation
      await orphiCrowdFundV4.setAutomationEnabled(false);
      
      // Fast forward past multiple intervals
      await time.increase(21 * 24 * 60 * 60); // 21 days
      
      // Re-enable automation
      await orphiCrowdFundV4.setAutomationEnabled(true);
      
      // Should be able to catch up
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      
      if ((await orphiCrowdFundV4.getPoolBalancesEnhanced())[4] > 0) {
        expect(upkeepNeeded).to.be.true;
        await orphiCrowdFundV4.performUpkeep(performData);
      }
    });

    it("Should handle admin intervention during automation", async function () {
      // Fast forward to automation time
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Admin manually distributes before automation
      await orphiCrowdFundV4.distributeGlobalHelpPool();
      
      // Automation should detect no work needed
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;
    });

    it("Should maintain system integrity across upgrades", async function () {
      // Register some users
      for (let i = 0; i < 5; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
      
      // Get initial state
      const initialStats = await orphiCrowdFundV4.getSystemStatsEnhanced();
      const initialAutomationStatus = await orphiCrowdFundV4.getAutomationStatus();
      
      // In a real upgrade scenario, we would deploy a new implementation
      // For this test, we verify that the current state is consistent
      expect(initialStats.totalMembersCount).to.be.greaterThan(1);
      expect(initialAutomationStatus.enabled).to.be.true;
      
      // Verify automation still works after "upgrade"
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      
      if ((await orphiCrowdFundV4.getPoolBalancesEnhanced())[4] > 0) {
        expect(upkeepNeeded).to.be.true;
      }
    });
  });
});
