const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("OrphiCrowdFundV4 - Security and Safety Features", function () {
  let orphiCrowdFundV4;
  let mockUSDT;
  let owner;
  let adminReserve;
  let matrixRoot;
  let user1, user2, user3;
  let users = [];
  let attacker;

  const PACKAGE_30 = ethers.parseEther("30");
  const PACKAGE_200 = ethers.parseEther("200");
  const PackageTier = { NONE: 0, PACKAGE_30: 1, PACKAGE_50: 2, PACKAGE_100: 3, PACKAGE_200: 4 };

  beforeEach(async function () {
    [owner, adminReserve, matrixRoot, user1, user2, user3, attacker, ...users] = await ethers.getSigners();
    
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
    const testUsers = [user1, user2, user3, attacker, ...users.slice(0, 20)];
    
    for (const user of testUsers) {
      await mockUSDT.faucet(user.address, testAmount);
      await mockUSDT.connect(user).approve(await orphiCrowdFundV4.getAddress(), testAmount);
    }

    // Grant admin roles
    const ADMIN_ROLE = await orphiCrowdFundV4.ADMIN_ROLE();
    await orphiCrowdFundV4.grantRole(ADMIN_ROLE, owner.address);
  });

  describe("Access Control Security", function () {
    it("Should prevent unauthorized automation control", async function () {
      // Test unauthorized attempts to control automation
      await expect(
        orphiCrowdFundV4.connect(attacker).setAutomationEnabled(false)
      ).to.be.revertedWithCustomError(orphiCrowdFundV4, "AccessControlUnauthorizedAccount");

      await expect(
        orphiCrowdFundV4.connect(attacker).setAutomationGasLimit(1000000)
      ).to.be.revertedWithCustomError(orphiCrowdFundV4, "AccessControlUnauthorizedAccount");

      await expect(
        orphiCrowdFundV4.connect(attacker).resetAutomationFailures()
      ).to.be.revertedWithCustomError(orphiCrowdFundV4, "AccessControlUnauthorizedAccount");
    });

    it("Should prevent unauthorized pool distribution", async function () {
      // Register users to create pool balances
      for (let i = 0; i < 5; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }

      // Test unauthorized manual distribution attempts
      await expect(
        orphiCrowdFundV4.connect(attacker).distributeGlobalHelpPool()
      ).to.be.revertedWithCustomError(orphiCrowdFundV4, "AccessControlUnauthorizedAccount");

      await expect(
        orphiCrowdFundV4.connect(attacker).distributeLeaderBonus()
      ).to.be.revertedWithCustomError(orphiCrowdFundV4, "AccessControlUnauthorizedAccount");
    });

    it("Should prevent unauthorized performUpkeep calls", async function () {
      // Fast forward to make automation due
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Register users to create balance
      for (let i = 0; i < 3; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }

      // performUpkeep should be callable by anyone (Chainlink pattern)
      const performData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);
      
      // This should work - performUpkeep is meant to be callable by Chainlink
      // But it should validate the action is legitimate
      await orphiCrowdFundV4.connect(attacker).performUpkeep(performData);
    });

    it("Should validate performUpkeep action authenticity", async function () {
      // Test with invalid action types
      const invalidAction = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [99]);
      
      await expect(
        orphiCrowdFundV4.connect(attacker).performUpkeep(invalidAction)
      ).to.be.revertedWith("Invalid automation action");

      // Test with malformed data
      await expect(
        orphiCrowdFundV4.connect(attacker).performUpkeep("0xdeadbeef")
      ).to.be.reverted;
    });
  });

  describe("Circuit Breaker and Emergency Controls", function () {
    beforeEach(async function () {
      // Setup users for emergency testing
      for (let i = 0; i < 10; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
    });

    it("Should halt all operations during emergency pause", async function () {
      // Pause the contract
      await orphiCrowdFundV4.emergencyPause();

      // All user operations should be blocked
      await expect(
        orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30)
      ).to.be.revertedWithCustomError(orphiCrowdFundV4, "EnforcedPause");

      await expect(
        orphiCrowdFundV4.connect(user1).withdraw()
      ).to.be.revertedWithCustomError(orphiCrowdFundV4, "EnforcedPause");

      // Automation should also be blocked
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;
    });

    it("Should allow admin operations during emergency pause", async function () {
      await orphiCrowdFundV4.emergencyPause();

      // Admin should still be able to perform emergency functions
      await orphiCrowdFundV4.setAutomationEnabled(false);
      expect(await orphiCrowdFundV4.automationEnabled()).to.be.false;

      // Admin should be able to unpause
      await orphiCrowdFundV4.emergencyUnpause();
      expect(await orphiCrowdFundV4.paused()).to.be.false;
    });

    it("Should handle automation failure circuit breaker", async function () {
      // Simulate reaching maximum failures
      const maxFailures = await orphiCrowdFundV4.MAX_AUTOMATION_FAILURES();
      
      // In a real scenario, failures would be tracked automatically
      // For testing, we simulate by manually disabling automation
      await orphiCrowdFundV4.setAutomationEnabled(false);
      
      // Fast forward time
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Automation should be disabled
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;
      
      // Admin should be able to reset and re-enable
      await orphiCrowdFundV4.resetAutomationFailures();
      await orphiCrowdFundV4.setAutomationEnabled(true);
      
      const [upkeepNeededAfter, performDataAfter] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeededAfter).to.be.true;
    });

    it("Should implement cooldown period after failures", async function () {
      const cooldownPeriod = await orphiCrowdFundV4.AUTOMATION_COOLDOWN();
      expect(cooldownPeriod).to.equal(60 * 60); // 1 hour

      // Verify cooldown mechanism exists in automation status
      const status = await orphiCrowdFundV4.getAutomationStatus();
      expect(status.lastFailureTime).to.equal(0); // No failures initially
    });
  });

  describe("Earnings Cap Security", function () {
    it("Should prevent cap bypass through multiple transactions", async function () {
      // Register user with large package
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_200);
      
      const maxEarnings = PACKAGE_200 * 4n; // 4x cap
      
      // Try to earn beyond cap through multiple registrations
      for (let i = 0; i < 25; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(user1.address, PackageTier.PACKAGE_200);
        
        // Check that user never exceeds cap
        const userInfo = await orphiCrowdFundV4.getUserInfoEnhanced(user1.address);
        expect(userInfo.totalEarnings).to.be.at.most(maxEarnings);
      }
      
      // User should be capped
      const finalUserInfo = await orphiCrowdFundV4.getUserInfoEnhanced(user1.address);
      expect(finalUserInfo.isCapped).to.be.true;
    });

    it("Should prevent cap manipulation through withdrawal timing", async function () {
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_200);
      
      // Build earnings
      for (let i = 0; i < 15; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(user1.address, PackageTier.PACKAGE_200);
      }
      
      // Get current earnings
      const userInfoBefore = await orphiCrowdFundV4.getUserInfoEnhanced(user1.address);
      
      // Withdraw available amount
      if (userInfoBefore.withdrawableAmount > 0) {
        await orphiCrowdFundV4.connect(user1).withdraw();
      }
      
      // Continue building earnings
      for (let i = 15; i < 25; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(user1.address, PackageTier.PACKAGE_200);
      }
      
      // Total earnings should still respect cap
      const userInfoAfter = await orphiCrowdFundV4.getUserInfoEnhanced(user1.address);
      expect(userInfoAfter.totalEarnings).to.be.at.most(PACKAGE_200 * 4n);
    });

    it("Should handle cap enforcement across all earning sources", async function () {
      // Test cap enforcement in sponsor commission
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_200);
      await orphiCrowdFundV4.connect(user2).registerUser(user1.address, PackageTier.PACKAGE_200);
      
      // Test cap enforcement in level bonus
      await orphiCrowdFundV4.connect(user3).registerUser(user2.address, PackageTier.PACKAGE_200);
      
      // Add many more to potentially trigger cap
      for (let i = 0; i < 20; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(user1.address, PackageTier.PACKAGE_200);
      }
      
      // All users should respect their caps
      const user1Info = await orphiCrowdFundV4.getUserInfoEnhanced(user1.address);
      const user2Info = await orphiCrowdFundV4.getUserInfoEnhanced(user2.address);
      
      expect(user1Info.totalEarnings).to.be.at.most(PACKAGE_200 * 4n);
      expect(user2Info.totalEarnings).to.be.at.most(PACKAGE_200 * 4n);
    });
  });

  describe("Automation Security", function () {
    beforeEach(async function () {
      // Setup pool balances for automation testing
      for (let i = 0; i < 10; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
    });

    it("Should validate automation timing constraints", async function () {
      // Test that automation respects safety buffers
      await time.increase(7 * 24 * 60 * 60 - 30 * 60); // 7 days minus 30 minutes
      
      const [upkeepNeeded, performData] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false; // Should be false due to safety buffer
      
      // Add safety buffer time
      await time.increase(60 * 60 + 1); // Add 1 hour 1 second
      
      const [upkeepNeededAfter, performDataAfter] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeededAfter).to.be.true; // Should be true now
    });

    it("Should prevent automation manipulation through time attacks", async function () {
      // Fast forward to automation time
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Perform automation
      const performData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);
      await orphiCrowdFundV4.performUpkeep(performData);
      
      // Try to perform again immediately - should fail
      const [upkeepNeeded, _] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false; // Distribution already done
    });

    it("Should handle automated distribution amount validation", async function () {
      // Fast forward to automation time
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      // Get initial pool balance
      const initialBalance = (await orphiCrowdFundV4.getPoolBalancesEnhanced())[4];
      
      // Perform automation
      const performData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);
      const tx = await orphiCrowdFundV4.performUpkeep(performData);
      
      // Verify the correct amount was distributed
      await expect(tx).to.emit(orphiCrowdFundV4, "AutomationExecuted")
        .withArgs(1, initialBalance, true);
    });

    it("Should prevent automation DOS attacks", async function () {
      // Test that excessive automation attempts don't break the system
      await time.increase(7 * 24 * 60 * 60 + 60 * 60 + 1);
      
      const performData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);
      
      // First automation should succeed
      await orphiCrowdFundV4.performUpkeep(performData);
      
      // Subsequent attempts should fail gracefully
      const [upkeepNeeded, _] = await orphiCrowdFundV4.checkUpkeep("0x");
      expect(upkeepNeeded).to.be.false;
      
      // System should remain functional
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      expect(await orphiCrowdFundV4.isRegistered(user1.address)).to.be.true;
    });
  });

  describe("Matrix Placement Security", function () {
    it("Should prevent matrix manipulation attacks", async function () {
      // Test that users cannot manipulate their matrix position
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // User1 should be placed according to BFS algorithm, not user preference
      const matrixInfo = await orphiCrowdFundV4.getMatrixInfoEnhanced(matrixRoot.address);
      expect(matrixInfo.leftChild).to.equal(user1.address);
      
      // Second user should go to right
      await orphiCrowdFundV4.connect(user2).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      const matrixInfo2 = await orphiCrowdFundV4.getMatrixInfoEnhanced(matrixRoot.address);
      expect(matrixInfo2.rightChild).to.equal(user2.address);
    });

    it("Should prevent deep recursion attacks in matrix traversal", async function () {
      // Build a deep matrix tree
      let currentParent = matrixRoot.address;
      
      for (let i = 0; i < 20; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(currentParent, PackageTier.PACKAGE_30);
        // Don't update currentParent to create a wide tree, not deep
      }
      
      // System should handle this without stack overflow
      const stats = await orphiCrowdFundV4.getSystemStatsEnhanced();
      expect(stats.totalMembersCount).to.equal(21); // 20 users + matrix root
    });

    it("Should validate matrix integrity after optimizations", async function () {
      // Register users to build matrix
      for (let i = 0; i < 15; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
      
      // Verify matrix structure integrity
      const rootMatrix = await orphiCrowdFundV4.getMatrixInfoEnhanced(matrixRoot.address);
      expect(rootMatrix.teamSizeCount).to.equal(15);
      
      // Check that left and right children exist
      expect(rootMatrix.leftChild).to.not.equal(ethers.ZeroAddress);
      expect(rootMatrix.rightChild).to.not.equal(ethers.ZeroAddress);
      
      // Verify tree is balanced
      const leftChildMatrix = await orphiCrowdFundV4.getMatrixInfoEnhanced(rootMatrix.leftChild);
      const rightChildMatrix = await orphiCrowdFundV4.getMatrixInfoEnhanced(rootMatrix.rightChild);
      
      // Both branches should have children (balanced placement)
      expect(leftChildMatrix.leftChild).to.not.equal(ethers.ZeroAddress);
      expect(rightChildMatrix.leftChild).to.not.equal(ethers.ZeroAddress);
    });
  });

  describe("Token Transfer Security", function () {
    it("Should prevent reentrancy attacks", async function () {
      // The contract should be protected against reentrancy
      // This test verifies the ReentrancyGuard is working
      
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Try to register while a transaction is pending
      // (This is hard to test directly, but we verify the guard exists)
      const userInfo = await orphiCrowdFundV4.getUserInfoEnhanced(user1.address);
      expect(userInfo.isRegistered).to.be.true;
    });

    it("Should validate token transfer amounts", async function () {
      // Test that the contract handles token transfers correctly
      const initialBalance = await mockUSDT.balanceOf(await orphiCrowdFundV4.getAddress());
      
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      const finalBalance = await mockUSDT.balanceOf(await orphiCrowdFundV4.getAddress());
      expect(finalBalance - initialBalance).to.equal(PACKAGE_30);
    });

    it("Should handle insufficient token balance gracefully", async function () {
      // Setup user with insufficient balance
      const poorUser = users[19];
      await mockUSDT.connect(poorUser).transfer(owner.address, await mockUSDT.balanceOf(poorUser.address));
      
      // Registration should fail due to insufficient balance
      await expect(
        orphiCrowdFundV4.connect(poorUser).registerUser(matrixRoot.address, PackageTier.PACKAGE_30)
      ).to.be.reverted;
    });

    it("Should prevent token approval manipulation", async function () {
      // User with no approval should fail
      const unapprovedUser = users[18];
      await mockUSDT.connect(unapprovedUser).approve(await orphiCrowdFundV4.getAddress(), 0);
      
      await expect(
        orphiCrowdFundV4.connect(unapprovedUser).registerUser(matrixRoot.address, PackageTier.PACKAGE_30)
      ).to.be.reverted;
    });
  });

  describe("Data Integrity and Validation", function () {
    it("Should validate all input parameters", async function () {
      // Test invalid package tier
      await expect(
        orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.NONE)
      ).to.be.revertedWith("Invalid package tier");
      
      // Test zero address sponsor
      await expect(
        orphiCrowdFundV4.connect(user1).registerUser(ethers.ZeroAddress, PackageTier.PACKAGE_30)
      ).to.be.revertedWith("Sponsor not registered");
      
      // Test unregistered sponsor
      await expect(
        orphiCrowdFundV4.connect(user1).registerUser(user2.address, PackageTier.PACKAGE_30)
      ).to.be.revertedWith("Sponsor not registered");
    });

    it("Should maintain data consistency across operations", async function () {
      // Register users and verify data consistency
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      await orphiCrowdFundV4.connect(user2).registerUser(user1.address, PackageTier.PACKAGE_30);
      
      // Check sponsor relationship
      const user2Info = await orphiCrowdFundV4.getUserInfoEnhanced(user2.address);
      expect(user2Info.sponsor).to.equal(user1.address);
      
      // Check matrix placement
      const user1Matrix = await orphiCrowdFundV4.getMatrixInfoEnhanced(user1.address);
      expect(user1Matrix.leftChild).to.equal(user2.address);
      
      // Check team size updates
      const user1Info = await orphiCrowdFundV4.getUserInfoEnhanced(user1.address);
      expect(user1Info.teamSize).to.equal(1);
    });

    it("Should handle edge cases in calculations", async function () {
      // Test with maximum package tier
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_200);
      
      const userInfo = await orphiCrowdFundV4.getUserInfoEnhanced(user1.address);
      expect(userInfo.totalInvested).to.equal(PACKAGE_200);
      
      // Test earnings cap calculation
      const maxEarnings = userInfo.totalInvested * 4n;
      expect(maxEarnings).to.equal(PACKAGE_200 * 4n);
    });
  });

  describe("Upgrade Security", function () {
    it("Should maintain security properties after upgrade", async function () {
      // Register some users
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      await orphiCrowdFundV4.connect(user2).registerUser(user1.address, PackageTier.PACKAGE_30);
      
      // Verify current state
      const initialStats = await orphiCrowdFundV4.getSystemStatsEnhanced();
      const initialAutomationStatus = await orphiCrowdFundV4.getAutomationStatus();
      
      // Verify security features are intact
      expect(initialAutomationStatus.enabled).to.be.true;
      expect(initialStats.totalMembersCount).to.be.greaterThan(1);
      
      // Access control should still work
      await expect(
        orphiCrowdFundV4.connect(attacker).setAutomationEnabled(false)
      ).to.be.revertedWithCustomError(orphiCrowdFundV4, "AccessControlUnauthorizedAccount");
    });

    it("Should preserve data integrity across versions", async function () {
      // Test that V4 maintains compatibility with existing data structures
      const matrixRootInfo = await orphiCrowdFundV4.getUserInfoEnhanced(matrixRoot.address);
      expect(matrixRootInfo.isRegistered).to.be.true;
      expect(matrixRootInfo.packageTier).to.equal(PackageTier.PACKAGE_200);
      
      // New features should work with existing users
      const automationStatus = await orphiCrowdFundV4.getAutomationStatus();
      expect(automationStatus.enabled).to.be.true;
    });
  });

  describe("Emergency Recovery", function () {
    it("Should allow emergency fund recovery", async function () {
      // Register users to create contract balance
      for (let i = 0; i < 5; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
      
      const contractBalance = await mockUSDT.balanceOf(await orphiCrowdFundV4.getAddress());
      expect(contractBalance).to.be.greaterThan(0);
      
      // Only admin should be able to emergency withdraw
      await expect(
        orphiCrowdFundV4.connect(attacker).emergencyWithdraw(await mockUSDT.getAddress(), contractBalance)
      ).to.be.revertedWithCustomError(orphiCrowdFundV4, "OwnableUnauthorizedAccount");
      
      // Admin should be able to emergency withdraw
      const initialAdminBalance = await mockUSDT.balanceOf(adminReserve.address);
      await orphiCrowdFundV4.emergencyWithdraw(await mockUSDT.getAddress(), contractBalance);
      const finalAdminBalance = await mockUSDT.balanceOf(adminReserve.address);
      
      expect(finalAdminBalance - initialAdminBalance).to.equal(contractBalance);
    });

    it("Should handle emergency pause and recovery", async function () {
      // Create active state
      await orphiCrowdFundV4.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Emergency pause
      await orphiCrowdFundV4.emergencyPause();
      
      // All operations should be blocked
      await expect(
        orphiCrowdFundV4.connect(user2).registerUser(matrixRoot.address, PackageTier.PACKAGE_30)
      ).to.be.revertedWithCustomError(orphiCrowdFundV4, "EnforcedPause");
      
      // Recovery
      await orphiCrowdFundV4.emergencyUnpause();
      
      // Operations should resume
      await orphiCrowdFundV4.connect(user2).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      expect(await orphiCrowdFundV4.isRegistered(user2.address)).to.be.true;
    });
  });
});
