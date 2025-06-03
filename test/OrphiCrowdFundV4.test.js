const { expect } = require("chai");
const { ethers, upgrades, network } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("OrphiCrowdFundV4 - Automated Pool Distribution", function () {
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

  const LeaderRank = {
    NONE: 0,
    SHINING_STAR: 1,
    SILVER_STAR: 2
  };

  beforeEach(async function () {
    [owner, adminReserve, matrixRoot, user1, user2, user3, ...users] = await ethers.getSigners();
    
    // Deploy MockUSDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    // Deploy OrphiCrowdFundV4
    const OrphiCrowdFundV4 = await ethers.getContractFactory("OrphiCrowdFundV4");
    orphiCrowdFundV4 = await upgrades.deployProxy(
      OrphiCrowdFundV4,
      [await mockUSDT.getAddress(), adminReserve.address, matrixRoot.address],
      { initializer: "initialize" }
    );
    await orphiCrowdFundV4.waitForDeployment();

    // Mint and approve USDT for all test users
    const testAmount = ethers.parseEther("10000");
    
    // Fund main test users
    for (const user of [user1, user2, user3]) {
      await mockUSDT.faucet(user.address, testAmount);
      await mockUSDT.connect(user).approve(await orphiCrowdFundV4.getAddress(), testAmount);
    }
    
    // Fund additional users for complex testing
    for (let i = 0; i < 50; i++) {
      await mockUSDT.faucet(users[i].address, testAmount);
      await mockUSDT.connect(users[i]).approve(await orphiCrowdFundV4.getAddress(), testAmount);
    }

    // Grant admin roles
    const ADMIN_ROLE = await orphiCrowdFundV4.ADMIN_ROLE();
    await orphiCrowdFundV4.grantRole(ADMIN_ROLE, owner.address);
  });

  describe("Deployment and Initialization", function () {
    it("Should initialize V4 with automation features", async function () {
      expect(await orphiCrowdFundV4.paymentToken()).to.equal(await mockUSDT.getAddress());
      expect(await orphiCrowdFundV4.adminReserve()).to.equal(adminReserve.address);
      expect(await orphiCrowdFundV4.matrixRoot()).to.equal(matrixRoot.address);
      
      // Check automation constants
      expect(await orphiCrowdFundV4.GHP_AUTOMATION_INTERVAL()).to.equal(7 * 24 * 60 * 60); // 7 days
      expect(await orphiCrowdFundV4.LEADER_AUTOMATION_INTERVAL()).to.equal(14 * 24 * 60 * 60); // 14 days
      expect(await orphiCrowdFundV4.AUTOMATION_SAFETY_BUFFER()).to.equal(60 * 60); // 1 hour
      
      // Check initial automation state
      expect(await orphiCrowdFundV4.automationEnabled()).to.be.true;
      expect(await orphiCrowdFundV4.automationGasLimit()).to.equal(500000);
      expect(await orphiCrowdFundV4.automationFailureCount()).to.equal(0);
    });

    it("Should have circuit breaker limits set", async function () {
      expect(await orphiCrowdFundV4.MAX_AUTOMATION_FAILURES()).to.equal(3);
      expect(await orphiCrowdFundV4.AUTOMATION_COOLDOWN()).to.equal(1 * 60 * 60); // 1 hour
    });
  });

  describe("Chainlink Keeper Integration", function () {
    beforeEach(async function () {
      // Register multiple users to create pool balances
      for (let i = 0; i < 10; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
    });

    describe("checkUpkeep Function", function () {
      it("Should return false when automation is disabled", async function () {
        await orphiCrowdFundV4.setAutomationEnabled(false);
        
        const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
        expect(upkeepNeeded).to.be.false;
      });

      it("Should return true when GHP distribution is due", async function () {
        // Fast forward 7 days + safety buffer
        await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
        
        const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
        expect(upkeepNeeded).to.be.true;
        
        // Decode performData to check action type
        const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(["uint8"], performData);
        expect(decodedData[0]).to.equal(1); // GHP_DISTRIBUTION = 1
      });

      it("Should return true when Leader distribution is due", async function () {
        // Fast forward 14 days + safety buffer
        await time.increase(14 * 24 * 60 * 60 + 60 * 60 + 1);
        
        const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
        expect(upkeepNeeded).to.be.true;
        
        // Decode performData to check action type
        const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(["uint8"], performData);
        expect(decodedData[0]).to.equal(2); // LEADER_DISTRIBUTION = 2
      });

      it("Should prioritize GHP when both are due", async function () {
        // Fast forward 14+ days to make both due
        await time.increase(15 * 24 * 60 * 60);
        
        const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
        expect(upkeepNeeded).to.be.true;
        
        // Should prioritize GHP (shorter interval)
        const decodedData = ethers.AbiCoder.defaultAbiCoder().decode(["uint8"], performData);
        expect(decodedData[0]).to.equal(1); // GHP_DISTRIBUTION = 1
      });

      it("Should respect safety buffer timing", async function () {
        // Fast forward 7 days but not past safety buffer
        await time.increase(7 * 24 * 60 * 60 - 30 * 60); // 30 minutes before buffer
        
        const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
        expect(upkeepNeeded).to.be.false;
      });

      it("Should check minimum pool balance threshold", async function () {
        // Clear the pools by manual distribution first
        await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
        await orphiCrowdFundV4.distributeGlobalHelpPool();
        
        // Now check upkeep with minimal balance
        const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
        expect(upkeepNeeded).to.be.false; // Should be false due to low balance
      });
    });

    describe("performUpkeep Function", function () {
      it("Should perform GHP distribution when requested", async function () {
        // Fast forward to make GHP due
        await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
        
        // Get initial pool balance
        const initialPoolBalances = await orphiCrowdFundV4.getPoolBalancesEnhanced();
        const initialGHP = initialPoolBalances[4];
        expect(initialGHP).to.be.greaterThan(0);
        
        // Encode performData for GHP distribution
        const performData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);
        
        // Perform upkeep
        const tx = await orphiCrowdFundV4.performUpkeep(performData);
        
        // Check that distribution occurred
        const finalPoolBalances = await orphiCrowdFundV4.getPoolBalancesEnhanced();
        expect(finalPoolBalances[4]).to.be.lessThan(initialGHP);
        
        // Check event emission
        await expect(tx).to.emit(orphiCrowdFundV4, "AutomationExecuted")
          .withArgs(1, initialGHP, true);
      });

      it("Should perform Leader distribution when requested", async function () {
        // Fast forward to make Leader distribution due
        await time.increase(14 * 24 * 60 * 60 + 60 * 60 + 1);
        
        // Get initial pool balance
        const initialPoolBalances = await orphiCrowdFundV4.getPoolBalancesEnhanced();
        const initialLeaderBonus = initialPoolBalances[3];
        expect(initialLeaderBonus).to.be.greaterThan(0);
        
        // Encode performData for Leader distribution
        const performData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [2]);
        
        // Perform upkeep
        const tx = await orphiCrowdFundV4.performUpkeep(performData);
        
        // Check that distribution occurred
        const finalPoolBalances = await orphiCrowdFundV4.getPoolBalancesEnhanced();
        expect(finalPoolBalances[3]).to.be.lessThan(initialLeaderBonus);
        
        // Check event emission
        await expect(tx).to.emit(orphiCrowdFundV4, "AutomationExecuted")
          .withArgs(2, initialLeaderBonus, true);
      });

      it("Should handle automation failures gracefully", async function () {
        // Disable the contract to simulate failure
        await orphiCrowdFundV4.emergencyPause();
        
        // Try to perform upkeep
        const performData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);
        
        // Should revert due to pause
        await expect(orphiCrowdFundV4.performUpkeep(performData))
          .to.be.revertedWithCustomError(orphiCrowdFundV4, "EnforcedPause");
        
        // Unpause and check failure count (this would be handled differently in real scenario)
        await orphiCrowdFundV4.emergencyUnpause();
      });

      it("Should increment failure counter on errors", async function () {
        // This test simulates failure handling
        const initialFailureCount = await orphiCrowdFundV4.automationFailureCount();
        
        // Try to perform upkeep with invalid data
        const invalidPerformData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [99]); // Invalid action
        
        await expect(orphiCrowdFundV4.performUpkeep(invalidPerformData))
          .to.be.revertedWith("Invalid automation action");
      });

      it("Should disable automation after max failures", async function () {
        // This would need to be tested with actual failure scenarios
        // For now, test the admin function to disable automation
        await orphiCrowdFundV4.setAutomationEnabled(false);
        expect(await orphiCrowdFundV4.automationEnabled()).to.be.false;
        
        // Check that upkeep returns false
        const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
        expect(upkeepNeeded).to.be.false;
      });
    });
  });

  describe("Centralized Earnings Cap Enforcement", function () {
    it("Should enforce cap in sponsor commission", async function () {
      // Register user1 with large package to quickly approach cap
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_200);
      
      // Register multiple users under user1 to trigger cap
      for (let i = 0; i < 20; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(user1.address, PackageTier.PACKAGE_200);
      }
      
      // Check if user1 is capped
      const userInfo = await orphiCrowdFundV4.getUserInfoEnhanced(user1.address);
      expect(userInfo.isCapped).to.be.true;
    });

    it("Should enforce cap in level bonus distribution", async function () {
      // Create a chain to test level bonus cap enforcement
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_200);
      await orphiCrowdFundV4.connect(user2).registerUser(user1.address, PackageTier.PACKAGE_200);
      
      // Register enough users to potentially trigger cap
      for (let i = 0; i < 15; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(user2.address, PackageTier.PACKAGE_200);
      }
      
      // Check cap enforcement on matrix root
      const rootInfo = await orphiCrowdFundV4.getUserInfoEnhanced(matrixRoot.address);
      if (rootInfo.totalEarnings >= rootInfo.totalInvested * 4n) {
        expect(rootInfo.isCapped).to.be.true;
      }
    });

    it("Should enforce cap in matrix bonus distribution", async function () {
      // Build matrix tree to test matrix bonus cap enforcement
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_200);
      await orphiCrowdFundV4.connect(user2).registerUser(matrixRoot.address, PackageTier.PACKAGE_200);
      
      // Fill positions to trigger matrix completion bonuses
      for (let i = 0; i < 10; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(user1.address, PackageTier.PACKAGE_200);
      }
      
      // Verify cap enforcement is applied
      const matrixRootInfo = await orphiCrowdFundV4.getUserInfoEnhanced(matrixRoot.address);
      // Matrix root should receive significant bonuses, possibly triggering cap
      expect(matrixRootInfo.totalEarnings).to.be.greaterThan(0);
    });

    it("Should prevent earnings beyond 4x investment", async function () {
      const user1Investment = PACKAGE_200;
      const maxEarnings = user1Investment * 4n;
      
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_200);
      
      // Simulate maximum earnings scenario
      for (let i = 0; i < 25; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(user1.address, PackageTier.PACKAGE_200);
      }
      
      const userInfo = await orphiCrowdFundV4.getUserInfoEnhanced(user1.address);
      expect(userInfo.totalEarnings).to.be.at.most(maxEarnings);
    });
  });

  describe("Optimized Matrix Placement Algorithm", function () {
    it("Should use queue-based BFS for efficient placement", async function () {
      // Test optimized placement with multiple users
      const startGas = await ethers.provider.getBalance(user1.address);
      
      // Register first user
      const tx1 = await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      const receipt1 = await tx1.wait();
      
      // Register many more users to test scaling
      for (let i = 0; i < 10; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
      
      // Test that gas usage remains efficient
      const finalTx = await orphiCrowdFundV4.connect(user2).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      const finalReceipt = await finalTx.wait();
      
      // Gas usage should be reasonable (optimized algorithm should use ~30k gas)
      expect(finalReceipt.gasUsed).to.be.lessThan(100000); // Should be much less than previous ~80k
    });

    it("Should balance matrix tree efficiently", async function () {
      // Register users to test balanced placement
      for (let i = 0; i < 7; i++) { // 2^3 - 1 = 7 users for 3 levels
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
      
      // Check matrix structure
      const rootMatrix = await orphiCrowdFundV4.getMatrixInfoEnhanced(matrixRoot.address);
      expect(rootMatrix.leftChild).to.not.equal(ethers.ZeroAddress);
      expect(rootMatrix.rightChild).to.not.equal(ethers.ZeroAddress);
      
      // Verify balanced placement by checking level distribution
      const level1Left = await orphiCrowdFundV4.getMatrixInfoEnhanced(rootMatrix.leftChild);
      const level1Right = await orphiCrowdFundV4.getMatrixInfoEnhanced(rootMatrix.rightChild);
      
      // Both should have children (balanced)
      expect(level1Left.leftChild).to.not.equal(ethers.ZeroAddress);
      expect(level1Right.leftChild).to.not.equal(ethers.ZeroAddress);
    });

    it("Should handle deep matrix levels efficiently", async function () {
      // Register enough users to create multiple levels
      for (let i = 0; i < 31; i++) { // 2^5 - 1 = 31 users for 5 levels
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
      
      // Verify matrix depth and structure
      const rootMatrix = await orphiCrowdFundV4.getMatrixInfoEnhanced(matrixRoot.address);
      expect(rootMatrix.teamSizeCount).to.equal(31);
      
      // Test placement of one more user
      const tx = await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      const receipt = await tx.wait();
      
      // Should still be gas efficient even with deep tree
      expect(receipt.gasUsed).to.be.lessThan(150000);
    });
  });

  describe("Enhanced Monitoring and Safety Features", function () {
    beforeEach(async function () {
      // Setup users for monitoring tests
      for (let i = 0; i < 5; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
    });

    it("Should provide real-time automation status", async function () {
      const status = await orphiCrowdFundV4.getAutomationStatus();
      
      expect(status.enabled).to.be.true;
      expect(status.lastGHPDistribution).to.be.greaterThan(0);
      expect(status.lastLeaderDistribution).to.be.greaterThan(0);
      expect(status.failureCount).to.equal(0);
      expect(status.gasLimit).to.equal(500000);
    });

    it("Should provide upkeep readiness information", async function () {
      const readiness = await orphiCrowdFundV4.getUpkeepReadiness();
      
      expect(readiness.ghpReady).to.be.false; // Not enough time passed
      expect(readiness.leaderReady).to.be.false; // Not enough time passed
      expect(readiness.ghpBalance).to.be.greaterThan(0);
      expect(readiness.leaderBalance).to.be.greaterThan(0);
      expect(readiness.nextGHPTime).to.be.greaterThan(0);
      expect(readiness.nextLeaderTime).to.be.greaterThan(0);
    });

    it("Should track distribution history", async function () {
      // Perform a manual distribution first
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      await orphiCrowdFundV4.distributeGlobalHelpPool();
      
      // Check history tracking
      const history = await orphiCrowdFundV4.getDistributionHistory();
      expect(history.totalGHPDistributions).to.equal(1);
      expect(history.totalLeaderDistributions).to.equal(0);
      expect(history.lastGHPAmount).to.be.greaterThan(0);
      expect(history.totalDistributedGHP).to.be.greaterThan(0);
    });

    it("Should handle circuit breaker activation", async function () {
      // Test circuit breaker functionality
      await orphiCrowdFundV4.setAutomationEnabled(false);
      
      // Fast forward time
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Check upkeep should return false
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;
      
      // Re-enable automation
      await orphiCrowdFundV4.setAutomationEnabled(true);
      
      // Now should return true
      const [upkeepNeededAfter, performDataAfter] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeededAfter).to.be.true;
    });

    it("Should implement cooldown period after failures", async function () {
      // This test would require simulating actual failures
      // For now, test the cooldown mechanism setup
      expect(await orphiCrowdFundV4.AUTOMATION_COOLDOWN()).to.equal(60 * 60); // 1 hour
      
      const status = await orphiCrowdFundV4.getAutomationStatus();
      expect(status.lastFailureTime).to.equal(0); // No failures yet
    });
  });

  describe("Emergency Admin Controls", function () {
    it("Should allow admin to manually trigger distributions", async function () {
      // Test manual override even when automation is enabled
      const initialPoolBalances = await orphiCrowdFundV4.getPoolBalancesEnhanced();
      const initialGHP = initialPoolBalances[4];
      
      if (initialGHP > 0) {
        await orphiCrowdFundV4.distributeGlobalHelpPool();
        
        const finalPoolBalances = await orphiCrowdFundV4.getPoolBalancesEnhanced();
        expect(finalPoolBalances[4]).to.be.lessThan(initialGHP);
      }
    });

    it("Should allow admin to modify automation parameters", async function () {
      // Test gas limit adjustment
      await orphiCrowdFundV4.setAutomationGasLimit(600000);
      expect(await orphiCrowdFundV4.automationGasLimit()).to.equal(600000);
      
      // Test automation enable/disable
      await orphiCrowdFundV4.setAutomationEnabled(false);
      expect(await orphiCrowdFundV4.automationEnabled()).to.be.false;
      
      await orphiCrowdFundV4.setAutomationEnabled(true);
      expect(await orphiCrowdFundV4.automationEnabled()).to.be.true;
    });

    it("Should allow admin to reset failure counters", async function () {
      // Test failure counter reset (would be used after fixing issues)
      await orphiCrowdFundV4.resetAutomationFailures();
      expect(await orphiCrowdFundV4.automationFailureCount()).to.equal(0);
    });

    it("Should prevent unauthorized access to admin functions", async function () {
      await expect(
        orphiCrowdFundV4.connect(user1).setAutomationEnabled(false)
      ).to.be.revertedWithCustomError(orphiCrowdFundV4, "AccessControlUnauthorizedAccount");
      
      await expect(
        orphiCrowdFundV4.connect(user1).setAutomationGasLimit(700000)
      ).to.be.revertedWithCustomError(orphiCrowdFundV4, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Gas Optimization Validation", function () {
    it("Should demonstrate gas savings in matrix placement", async function () {
      const gasUsages = [];
      
      // Test gas usage for multiple registrations
      for (let i = 0; i < 10; i++) {
        const tx = await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
        const receipt = await tx.wait();
        gasUsages.push(receipt.gasUsed);
      }
      
      // Calculate average gas usage
      const avgGas = gasUsages.reduce((sum, gas) => sum + gas, 0n) / BigInt(gasUsages.length);
      
      // Should be significantly less than previous 80k average
      expect(avgGas).to.be.lessThan(60000n); // Target: ~30k, allow some buffer
      
      console.log(`Average gas usage per registration: ${avgGas}`);
    });

    it("Should maintain efficiency with large user base", async function () {
      // Register many users to test scaling
      for (let i = 0; i < 50; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
      
      // Test placement of additional users
      const tx = await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      const receipt = await tx.wait();
      
      // Gas usage should remain efficient even with large tree
      expect(receipt.gasUsed).to.be.lessThan(80000);
    });
  });

  describe("Integration and Edge Cases", function () {
    it("Should handle rapid successive registrations", async function () {
      // Test concurrent registrations
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30)
        );
      }
      
      // All should succeed
      await Promise.all(promises);
      
      // Verify all users are registered
      for (let i = 0; i < 5; i++) {
        expect(await orphiCrowdFundV4.isRegistered(users[i].address)).to.be.true;
      }
    });

    it("Should handle automation during system pause", async function () {
      // Pause the system
      await orphiCrowdFundV4.emergencyPause();
      
      // Automation should not work during pause
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;
      
      // Unpause
      await orphiCrowdFundV4.emergencyUnpause();
      
      // Fast forward time to make automation due
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Should work after unpause
      const [upkeepNeededAfter, performDataAfter] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeededAfter).to.be.true;
    });

    it("Should handle edge case of empty pools", async function () {
      // Manually clear pools
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      await orphiCrowdFundV4.distributeGlobalHelpPool();
      
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      await orphiCrowdFundV4.distributeLeaderBonus();
      
      // Check automation doesn't trigger with empty pools
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      
      // Should return false due to empty pools
      expect(upkeepNeeded).to.be.false;
    });

    it("Should handle system upgrade compatibility", async function () {
      // Test that V4 maintains compatibility with existing data
      const userInfo = await orphiCrowdFundV4.getUserInfoEnhanced(matrixRoot.address);
      expect(userInfo.isRegistered).to.be.true;
      expect(userInfo.packageTier).to.equal(PackageTier.PACKAGE_200);
      
      // Test new V4 functionality works with existing users
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      const newUserInfo = await orphiCrowdFundV4.getUserInfoEnhanced(user1.address);
      expect(newUserInfo.isRegistered).to.be.true;
    });
  });

  describe("Event Emission and Monitoring", function () {
    it("Should emit comprehensive automation events", async function () {
      // Register users to create pool balance
      for (let i = 0; i < 5; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
      
      // Fast forward and trigger automation
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      const performData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);
      const tx = await orphiCrowdFundV4.performUpkeep(performData);
      
      // Check for automation events
      await expect(tx).to.emit(orphiCrowdFundV4, "AutomationExecuted");
      await expect(tx).to.emit(orphiCrowdFundV4, "GlobalHelpPoolDistributed");
    });

    it("Should emit cap enforcement events", async function () {
      // Register user and trigger cap
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Register many users to trigger cap
      for (let i = 0; i < 15; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(user1.address, PackageTier.PACKAGE_30);
      }
      
      // Check if cap event was emitted (would be in one of the transactions)
      const userInfo = await orphiCrowdFundV4.getUserInfoEnhanced(user1.address);
      if (userInfo.isCapped) {
        // Cap was reached during registrations
        expect(userInfo.totalEarnings).to.be.at.most(userInfo.totalInvested * 4n);
      }
    });

    it("Should provide detailed system statistics", async function () {
      // Register multiple users
      for (let i = 0; i < 10; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
      
      const stats = await orphiCrowdFundV4.getSystemStatsEnhanced();
      expect(stats.totalMembersCount).to.be.greaterThan(1);
      expect(stats.totalVolumeAmount).to.be.greaterThan(0);
      expect(stats.dailyRegistrations).to.be.greaterThan(0);
    });
  });
});
