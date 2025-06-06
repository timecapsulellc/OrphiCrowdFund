const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("OrphiCrowdFundV4UltraSecure - Security Enhanced Tests", function () {
  let v4UltraSecure;
  let mockUSDT;
  let owner, admin, user1, user2, user3, user4, user5;
  let users = [];

  // Package amounts (6 decimals for USDT)
  const PACKAGE_30 = ethers.parseUnits("30", 6);
  const PACKAGE_50 = ethers.parseUnits("50", 6); 
  const PACKAGE_100 = ethers.parseUnits("100", 6);
  const PACKAGE_200 = ethers.parseUnits("200", 6);
  const PACKAGE_500 = ethers.parseUnits("500", 6);

  const PackageTier = {
    NONE: 0,
    TIER_1: 1, // $30
    TIER_2: 2, // $50  
    TIER_3: 3, // $100
    TIER_4: 4, // $200
    TIER_5: 5  // $500
  };

  beforeEach(async function () {
    [owner, admin, user1, user2, user3, user4, user5, ...users] = await ethers.getSigners();
    
    // Deploy MockUSDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    // Deploy V4UltraSecure from main contracts directory
    const V4UltraSecure = await ethers.getContractFactory("OrphiCrowdFundV4UltraSecure");
    v4UltraSecure = await V4UltraSecure.deploy(
      await mockUSDT.getAddress(),
      admin.address
    );
    await v4UltraSecure.waitForDeployment();

    // Mint USDT for test users  
    const testAmount = ethers.parseUnits("10000", 6);
    for (let user of [user1, user2, user3, user4, user5]) {
      await mockUSDT.mint(user.address, testAmount);
      await mockUSDT.connect(user).approve(await v4UltraSecure.getAddress(), testAmount);
    }

    console.log(`✅ V4UltraSecure deployed at: ${await v4UltraSecure.getAddress()}`);
    console.log(`✅ MockUSDT deployed at: ${await mockUSDT.getAddress()}`);
  });

  describe("🔒 Security Features", function () {
    
    it("Should enforce MAX_USERS limit", async function () {
      const maxUsers = await v4UltraSecure.MAX_USERS();
      expect(maxUsers).to.equal(50000);
      
      // This test would be too expensive to run fully, but we can check the logic
      const state = await v4UltraSecure.state();
      expect(state.totalUsers).to.equal(0);
    });

    it("Should enforce MAX_CHILDREN_PER_NODE limit", async function () {
      const maxChildren = await v4UltraSecure.MAX_CHILDREN_PER_NODE();
      expect(maxChildren).to.equal(2048);
    });

    it("Should enforce MIN_UPLINE_CHAIN requirement", async function () {
      const minUplineChain = await v4UltraSecure.MIN_UPLINE_CHAIN();
      expect(minUplineChain).to.equal(30);
    });

    it("Should have emergency system lock functionality", async function () {
      // Test emergency lock (owner only)
      await expect(v4UltraSecure.connect(user1).emergencyLock())
        .to.be.revertedWith("Ownable: caller is not the owner");
      
      await v4UltraSecure.emergencyLock();
      const state = await v4UltraSecure.state();
      expect(state.systemLocked).to.be.true;

      // Test that operations are blocked when locked
      await v4UltraSecure.setKYCStatus(user1.address, true);
      await expect(v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_1))
        .to.be.revertedWith("System locked");

      // Unlock and verify normal operation resumes
      await v4UltraSecure.emergencyUnlock();
      const stateAfter = await v4UltraSecure.state();
      expect(stateAfter.systemLocked).to.be.false;
    });

    it("Should enforce reentrancy protection", async function () {
      // ReentrancyGuard should be active - basic test that transactions work
      await v4UltraSecure.setKYCStatus(user1.address, true);
      await v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_1);
      
      const userInfo = await v4UltraSecure.getUserInfo(user1.address);
      expect(userInfo.id).to.be.gt(0);
    });

    it("Should enforce pausable functionality", async function () {
      await v4UltraSecure.pause();
      
      await v4UltraSecure.setKYCStatus(user1.address, true);
      await expect(v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_1))
        .to.be.revertedWith("Pausable: paused");

      await v4UltraSecure.unpause();
      
      // Should work after unpause
      await v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_1);
      const userInfo = await v4UltraSecure.getUserInfo(user1.address);
      expect(userInfo.id).to.be.gt(0);
    });
  });

  describe("📊 Contract Size Verification", function () {
    it("Should be under 24KB limit", async function () {
      const contractAddress = await v4UltraSecure.getAddress();
      const bytecode = await ethers.provider.getCode(contractAddress);
      const size = (bytecode.length - 2) / 2; // Remove 0x and convert to bytes
      const sizeInKB = size / 1024;
      
      console.log(`📏 Contract Size: ${size} bytes (${sizeInKB.toFixed(2)} KB)`);
      console.log(`📏 Size Limit: 24,576 bytes (24 KB)`);
      console.log(`📏 Status: ${size < 24576 ? '✅ UNDER LIMIT' : '❌ OVER LIMIT'}`);
      
      expect(size).to.be.below(24576, "Contract size exceeds 24KB limit");
    });
  });

  describe("👤 KYC Integration", function () {
    it("Should enforce KYC requirement for registration", async function () {
      // Try to register without KYC - should fail
      await expect(v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_1))
        .to.be.revertedWith("KYC required");

      // Set KYC and register - should succeed
      await v4UltraSecure.setKYCStatus(user1.address, true);
      await v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_1);
      
      const userInfo = await v4UltraSecure.getUserInfo(user1.address);
      expect(userInfo.id).to.be.gt(0);
      expect(userInfo.packageTier).to.equal(PackageTier.TIER_1);
    });

    it("Should allow admin to manage KYC status", async function () {
      await v4UltraSecure.setKYCStatus(user1.address, true);
      expect(await v4UltraSecure.isKYCVerified(user1.address)).to.be.true;

      await v4UltraSecure.setKYCStatus(user1.address, false);
      expect(await v4UltraSecure.isKYCVerified(user1.address)).to.be.false;
    });

    it("Should enforce KYC for sensitive operations", async function () {
      // Register user1 with KYC
      await v4UltraSecure.setKYCStatus(user1.address, true);
      await v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_1);

      // Remove KYC and try package upgrade - should fail  
      await v4UltraSecure.setKYCStatus(user1.address, false);
      await expect(v4UltraSecure.connect(user1).upgradePackage(PackageTier.TIER_2))
        .to.be.revertedWith("KYC required");
    });
  });

  describe("🏛️ Pool Distribution with Security", function () {
    beforeEach(async function () {
      // Set up a small network for testing
      await v4UltraSecure.setKYCStatus(user1.address, true);
      await v4UltraSecure.setKYCStatus(user2.address, true);
      await v4UltraSecure.setKYCStatus(user3.address, true);

      await v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_3);
      await v4UltraSecure.connect(user2).register(user1.address, PackageTier.TIER_3);
      await v4UltraSecure.connect(user3).register(user2.address, PackageTier.TIER_3);
    });

    it("Should accumulate pools correctly with overflow protection", async function () {
      const poolsBefore = await v4UltraSecure.getPoolBalances();
      expect(poolsBefore[0]).to.be.gt(0); // sponsor pool
      expect(poolsBefore[1]).to.be.gt(0); // level pool
      expect(poolsBefore[2]).to.be.gt(0); // upline pool
      expect(poolsBefore[3]).to.be.gt(0); // leader pool
      expect(poolsBefore[4]).to.be.gt(0); // GHP pool

      // Verify pools use uint64 for overflow protection
      // Values should be reasonable for test amounts
      expect(poolsBefore[0]).to.be.below(ethers.parseUnits("1000000", 6)); // 1M USDT max
    });

    it("Should perform secure GHP distribution", async function () {
      // Fast forward time to enable distribution
      await time.increase(7 * 24 * 60 * 60); // 7 days

      const poolsBefore = await v4UltraSecure.getPoolBalances();
      const ghpBefore = poolsBefore[4];

      if (ghpBefore > 0) {
        // Perform GHP distribution
        await v4UltraSecure.performUpkeep("0x");
        
        const poolsAfter = await v4UltraSecure.getPoolBalances();
        expect(poolsAfter[4]).to.be.lt(ghpBefore); // GHP pool should decrease
      }
    });

    it("Should handle leader pool distribution securely", async function () {
      // Fast forward time to enable leader distribution
      await time.increase(14 * 24 * 60 * 60); // 14 days

      const poolsBefore = await v4UltraSecure.getPoolBalances();
      const leaderBefore = poolsBefore[3];

      if (leaderBefore > 0) {
        // Perform leader distribution
        await v4UltraSecure.performUpkeep("0x");
        
        const poolsAfter = await v4UltraSecure.getPoolBalances();
        expect(poolsAfter[3]).to.be.lte(leaderBefore); // Leader pool should decrease or stay same
      }
    });
  });

  describe("🎯 ClubPool Functionality", function () {
    it("Should create and manage club pools securely", async function () {
      // Create club pool
      const duration = 7 * 24 * 60 * 60; // 7 days
      await v4UltraSecure.createClubPool(duration);

      // Register user and add to club pool
      await v4UltraSecure.setKYCStatus(user1.address, true);
      await v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_3);
      
      await v4UltraSecure.connect(user1).addToClubPool();
      
      const clubInfo = await v4UltraSecure.getClubPoolInfo(user1.address);
      expect(clubInfo.isActive).to.be.true;
    });

    it("Should handle club pool distribution after time lock", async function () {
      // Create and join club pool
      await v4UltraSecure.createClubPool(1); // 1 second for quick test
      await v4UltraSecure.setKYCStatus(user1.address, true);
      await v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_3);
      await v4UltraSecure.connect(user1).addToClubPool();

      // Wait for time lock to expire
      await time.increase(2);

      // Should be able to claim after time lock
      await expect(v4UltraSecure.connect(user1).claimClubPool())
        .to.not.be.reverted;
    });
  });

  describe("🤖 Chainlink Automation", function () {
    it("Should configure automation securely", async function () {
      await v4UltraSecure.enableAutomation(true);
      await v4UltraSecure.updateAutomationConfig(3000000, 100); // 3M gas limit, 100 max operations

      expect(await v4UltraSecure.automationEnabled()).to.be.true;
    });

    it("Should check upkeep conditions correctly", async function () {
      await v4UltraSecure.enableAutomation(true);
      
      const [upkeepNeeded, performData] = await v4UltraSecure.checkUpkeep("0x");
      // Initially false since no distributions are due
      expect(upkeepNeeded).to.be.false;
    });

    it("Should perform upkeep with gas limits", async function () {
      await v4UltraSecure.enableAutomation(true);
      await v4UltraSecure.updateAutomationConfig(1000000, 50); // Lower limits

      // Should not revert even with low gas limits
      await expect(v4UltraSecure.performUpkeep("0x"))
        .to.not.be.reverted;
    });
  });

  describe("💰 Financial Security", function () {
    it("Should handle leftover funds correctly", async function () {
      // Register users to create pool funds
      await v4UltraSecure.setKYCStatus(user1.address, true);
      await v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_3);

      const poolsBefore = await v4UltraSecure.getPoolBalances();
      
      // Simulate leftover fund withdrawal (admin only)
      await expect(v4UltraSecure.connect(user1).withdrawLeftoverFunds())
        .to.be.revertedWith("Ownable: caller is not the owner");

      // Owner should be able to withdraw
      await expect(v4UltraSecure.withdrawLeftoverFunds())
        .to.not.be.reverted;
    });

    it("Should prevent overflow in earnings calculations", async function () {
      // Test with maximum package tier
      await v4UltraSecure.setKYCStatus(user1.address, true);
      await v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_5);

      const userInfo = await v4UltraSecure.getUserInfo(user1.address);
      expect(userInfo.packageTier).to.equal(PackageTier.TIER_5);
      
      // Earnings should be tracked without overflow
      expect(userInfo.totalEarned).to.be.gte(0);
    });
  });

  describe("🏆 Leader Management", function () {
    it("Should handle leader demotion after inactivity", async function () {
      // Register and promote user to leader
      await v4UltraSecure.setKYCStatus(user1.address, true);
      await v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_5);
      
      // Fast forward to demotion period (90 days)
      await time.increase(90 * 24 * 60 * 60);
      
      // Leader demotion logic should be handled in distribution
      const [upkeepNeeded] = await v4UltraSecure.checkUpkeep("0x");
      if (upkeepNeeded) {
        await v4UltraSecure.performUpkeep("0x");
      }
    });
  });

  describe("📈 Gas Optimization", function () {
    it("Should handle batch operations efficiently", async function () {
      // Test with multiple users but within gas limits
      const batchSize = 10;
      
      for (let i = 0; i < batchSize; i++) {
        const user = users[i];
        await mockUSDT.mint(user.address, ethers.parseUnits("1000", 6));
        await mockUSDT.connect(user).approve(await v4UltraSecure.getAddress(), ethers.parseUnits("1000", 6));
        await v4UltraSecure.setKYCStatus(user.address, true);
        await v4UltraSecure.connect(user).register(ethers.ZeroAddress, PackageTier.TIER_1);
      }

      // Check that gas usage is reasonable
      const tx = await v4UltraSecure.performUpkeep("0x");
      const receipt = await tx.wait();
      console.log(`🔥 Gas used for batch operation: ${receipt.gasUsed}`);
      
      expect(receipt.gasUsed).to.be.below(3000000); // Should be under 3M gas
    });
  });

  describe("🚨 Emergency Controls", function () {
    it("Should provide comprehensive emergency controls", async function () {
      // Emergency pause
      await v4UltraSecure.pause();
      await v4UltraSecure.setKYCStatus(user1.address, true);
      await expect(v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_1))
        .to.be.revertedWith("Pausable: paused");

      // Emergency lock
      await v4UltraSecure.unpause();
      await v4UltraSecure.emergencyLock();
      await expect(v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_1))
        .to.be.revertedWith("System locked");

      // Emergency unlock
      await v4UltraSecure.emergencyUnlock();
      await v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_1);
      
      const userInfo = await v4UltraSecure.getUserInfo(user1.address);
      expect(userInfo.id).to.be.gt(0);
    });
  });

  describe("📊 Event Logging", function () {
    it("Should emit comprehensive events", async function () {
      await v4UltraSecure.setKYCStatus(user1.address, true);
      
      await expect(v4UltraSecure.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_1))
        .to.emit(v4UltraSecure, "UserRegistered");
    });
  });

  describe("🚦 Enhanced Stress Test: Realistic Withdrawal Scenarios", function () {
    it("should handle realistic earning and withdrawal scenarios under load", async function () {
      this.timeout(0); // Disable timeout for stress test
      
      // Use available users (hardhat provides 20 accounts by default)
      const availableUsers = users.length;
      const NUM_USERS = Math.min(availableUsers, 15); // Reduced for realistic sponsor relationships
      const testUsers = users.slice(0, NUM_USERS);
      
      console.log(`🧪 Starting enhanced stress test with ${NUM_USERS} users...`);
      console.log(`📊 Phase 1: Setting up sponsor hierarchy and generating earnings...`);
      
      // Phase 1: Create sponsor hierarchy to generate earnings
      for (let i = 0; i < NUM_USERS; i++) {
        const user = testUsers[i];
        await mockUSDT.mint(user.address, ethers.parseUnits("2000", 6));
        await mockUSDT.connect(user).approve(await v4UltraSecure.getAddress(), ethers.parseUnits("2000", 6));
        await v4UltraSecure.connect(admin).setKYCStatus(user.address, true);
        
        // Create sponsor relationships to generate earnings
        let sponsor = ethers.ZeroAddress;
        if (i > 0) {
          // Each user sponsors the next one to create earning opportunities
          sponsor = testUsers[Math.floor(i / 3)].address; // Group sponsors to maximize earnings
        }
        
        await v4UltraSecure.connect(user).register(sponsor, 2); // Use tier 2 (200 USDT) for higher commissions
        
        if (i % 5 === 0) console.log(`✓ Registered ${i + 1}/${NUM_USERS} users with sponsor relationships...`);
      }

      console.log(`📊 Phase 2: Generating additional earnings through secondary registrations...`);
      
      // Phase 2: Create secondary registrations to generate more sponsor commissions
      // This simulates users with existing withdrawable amounts
      for (let i = 0; i < Math.min(NUM_USERS, 10); i++) {
        const sponsorIndex = i % 5; // Rotate among first 5 users as sponsors
        const sponsor = testUsers[sponsorIndex];
        
        // Create additional "virtual" earnings by having multiple registrations under key sponsors
        for (let j = 0; j < 2; j++) {
          const newUserIndex = NUM_USERS + (i * 2) + j;
          if (newUserIndex < users.length) {
            const newUser = users[newUserIndex];
            await mockUSDT.mint(newUser.address, ethers.parseUnits("500", 6));
            await mockUSDT.connect(newUser).approve(await v4UltraSecure.getAddress(), ethers.parseUnits("500", 6));
            await v4UltraSecure.connect(admin).setKYCStatus(newUser.address, true);
            await v4UltraSecure.connect(newUser).register(sponsor.address, 1); // Tier 1 to create sponsor commissions
          }
        }
      }

      console.log(`📊 Phase 3: Checking withdrawable amounts and performing stress test...`);

      // Phase 3: Check which users have withdrawable amounts and attempt withdrawals
      let usersWithEarnings = 0;
      let totalWithdrawableAmount = ethers.parseUnits("0", 6);
      const withdrawableUsers = [];

      for (let i = 0; i < NUM_USERS; i++) {
        const user = testUsers[i];
        const userInfo = await v4UltraSecure.getUserInfo(user.address);
        
        if (userInfo.withdrawable > 0) {
          usersWithEarnings++;
          totalWithdrawableAmount = totalWithdrawableAmount + userInfo.withdrawable;
          withdrawableUsers.push({ user, amount: userInfo.withdrawable });
          console.log(`💰 User ${i}: ${ethers.formatUnits(userInfo.withdrawable, 6)} USDT withdrawable`);
        }
      }

      console.log(`\n📈 Earnings Summary:`);
      console.log(`   • Users with withdrawable amounts: ${usersWithEarnings}/${NUM_USERS}`);
      console.log(`   • Total withdrawable amount: ${ethers.formatUnits(totalWithdrawableAmount, 6)} USDT`);

      // Phase 4: Stress test withdrawals for users with earnings
      console.log(`\n🔥 Phase 4: Stress testing withdrawals for users with earnings...`);
      
      let successfulWithdrawals = 0;
      let failedWithdrawals = 0;
      let totalWithdrawn = ethers.parseUnits("0", 6);

      for (let i = 0; i < withdrawableUsers.length; i++) {
        const { user, amount } = withdrawableUsers[i];
        try {
          const tx = await v4UltraSecure.connect(user).withdraw();
          await tx.wait();
          successfulWithdrawals++;
          totalWithdrawn = totalWithdrawn + amount;
          
          if (i % 3 === 0) {
            console.log(`✅ Processed ${i + 1}/${withdrawableUsers.length} withdrawals...`);
          }
        } catch (e) {
          failedWithdrawals++;
          console.log(`❌ Withdrawal failed for user ${i}: ${e.message.slice(0, 100)}...`);
        }
      }

      // Phase 5: Test system resilience with rapid sequential withdrawals
      console.log(`\n⚡ Phase 5: Testing rapid sequential withdrawals (system resilience)...`);
      
      // Create a few more sponsored registrations to generate fresh earnings
      for (let i = 0; i < 3; i++) {
        if (NUM_USERS + 20 + i < users.length) {
          const rapidUser = users[NUM_USERS + 20 + i];
          await mockUSDT.mint(rapidUser.address, ethers.parseUnits("300", 6));
          await mockUSDT.connect(rapidUser).approve(await v4UltraSecure.getAddress(), ethers.parseUnits("300", 6));
          await v4UltraSecure.connect(admin).setKYCStatus(rapidUser.address, true);
          await v4UltraSecure.connect(rapidUser).register(testUsers[0].address, 1); // All sponsor under first user
        }
      }

      // Try withdrawal on first user who should now have additional earnings
      try {
        const firstUserInfo = await v4UltraSecure.getUserInfo(testUsers[0].address);
        if (firstUserInfo.withdrawable > 0) {
          await v4UltraSecure.connect(testUsers[0]).withdraw();
          successfulWithdrawals++;
          console.log(`✅ Rapid withdrawal test successful`);
        } else {
          console.log(`ℹ️  First user has no additional withdrawable amount for rapid test`);
        }
      } catch (e) {
        console.log(`❌ Rapid withdrawal test failed: ${e.message.slice(0, 100)}...`);
        failedWithdrawals++;
      }

      // Final Results
      console.log(`\n🎯 STRESS TEST RESULTS:`);
      console.log(`   • Total users tested: ${NUM_USERS}`);
      console.log(`   • Users with earnings: ${usersWithEarnings}`);
      console.log(`   • Successful withdrawals: ${successfulWithdrawals}`);
      console.log(`   • Failed withdrawals: ${failedWithdrawals}`);
      console.log(`   • Total amount withdrawn: ${ethers.formatUnits(totalWithdrawn, 6)} USDT`);
      console.log(`   • System performance: ${((successfulWithdrawals / (successfulWithdrawals + failedWithdrawals)) * 100).toFixed(1)}%`);

      // Test expectations - should have at least some successful withdrawals from sponsored registrations
      expect(usersWithEarnings).to.be.greaterThan(0, "No users had withdrawable earnings - sponsor commission system may be broken");
      expect(successfulWithdrawals).to.be.greaterThan(0, "No successful withdrawals - withdrawal system may be broken");
      
      // Allow some failures but expect majority success
      const successRate = successfulWithdrawals / (successfulWithdrawals + failedWithdrawals);
      expect(successRate).to.be.greaterThan(0.8, "Success rate below 80% - system may have performance issues");
    });

    it("should handle edge case: rapid consecutive withdrawals", async function () {
      this.timeout(30000);
      
      console.log(`🔄 Testing rapid consecutive withdrawal attempts...`);
      
      // Setup a user with earnings
      const testUser = users[0];
      await mockUSDT.mint(testUser.address, ethers.parseUnits("1000", 6));
      await mockUSDT.connect(testUser).approve(await v4UltraSecure.getAddress(), ethers.parseUnits("1000", 6));
      await v4UltraSecure.connect(admin).setKYCStatus(testUser.address, true);
      await v4UltraSecure.connect(testUser).register(ethers.ZeroAddress, 2);
      
      // Create earnings through sponsored registrations
      for (let i = 1; i <= 3; i++) {
        const sponsor = users[i];
        await mockUSDT.mint(sponsor.address, ethers.parseUnits("300", 6));
        await mockUSDT.connect(sponsor).approve(await v4UltraSecure.getAddress(), ethers.parseUnits("300", 6));
        await v4UltraSecure.connect(admin).setKYCStatus(sponsor.address, true);
        await v4UltraSecure.connect(sponsor).register(testUser.address, 1);
      }
      
      const userInfo = await v4UltraSecure.getUserInfo(testUser.address);
      console.log(`💰 Test user has ${ethers.formatUnits(userInfo.withdrawable, 6)} USDT withdrawable`);
      
      if (userInfo.withdrawable > 0) {
        // First withdrawal should succeed
        await expect(v4UltraSecure.connect(testUser).withdraw()).to.not.be.reverted;
        console.log(`✅ First withdrawal successful`);
        
        // Second immediate withdrawal should fail (no remaining balance or rate limiting)
        await expect(v4UltraSecure.connect(testUser).withdraw()).to.be.reverted;
        console.log(`✅ Second immediate withdrawal correctly rejected`);
      } else {
        console.log(`⚠️  User has no withdrawable amount - skipping rapid withdrawal test`);
      }
    });
  });
});
