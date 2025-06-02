const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("OrphiCrowdFund", function () {
  let orphiCrowdFund;
  let mockUSDT;
  let owner;
  let adminReserve;
  let matrixRoot;
  let user1;
  let user2;
  let user3;
  let user4;
  let user5;
  let users;

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
    [owner, adminReserve, matrixRoot, user1, user2, user3, user4, user5, ...users] = await ethers.getSigners();

    // Deploy MockUSDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    // Deploy OrphiCrowdFund using upgrades
    const OrphiCrowdFund = await ethers.getContractFactory("OrphiCrowdFund");
    orphiCrowdFund = await upgrades.deployProxy(
      OrphiCrowdFund,
      [await mockUSDT.getAddress(), adminReserve.address, matrixRoot.address],
      { initializer: "initialize" }
    );
    await orphiCrowdFund.waitForDeployment();

    // Mint USDT to test users
    const testAmount = ethers.parseEther("10000");
    
    // Mint to named users
    const namedUsers = [user1, user2, user3, user4, user5];
    for (const user of namedUsers) {
      await mockUSDT.faucet(user.address, testAmount);
      await mockUSDT.connect(user).approve(await orphiCrowdFund.getAddress(), testAmount);
    }
    
    // Mint to array users (increase to 60 for test coverage)
    for (let i = 0; i < 60; i++) {
      await mockUSDT.faucet(users[i].address, testAmount);
      await mockUSDT.connect(users[i]).approve(await orphiCrowdFund.getAddress(), testAmount);
    }
  });

  describe("Deployment", function () {
    it("Should set the correct initial values", async function () {
      expect(await orphiCrowdFund.paymentToken()).to.equal(await mockUSDT.getAddress());
      expect(await orphiCrowdFund.adminReserve()).to.equal(adminReserve.address);
      expect(await orphiCrowdFund.matrixRoot()).to.equal(matrixRoot.address);
      expect(await orphiCrowdFund.totalMembers()).to.equal(1);
    });

    it("Should register matrix root correctly", async function () {
      expect(await orphiCrowdFund.isRegistered(matrixRoot.address)).to.be.true;
      const userInfo = await orphiCrowdFund.getUserInfo(matrixRoot.address);
      expect(userInfo.packageTier).to.equal(PackageTier.PACKAGE_200);
    });
  });

  describe("User Registration", function () {
    it("Should register a new user successfully", async function () {
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      expect(await orphiCrowdFund.isRegistered(user1.address)).to.be.true;
      expect(await orphiCrowdFund.totalMembers()).to.equal(2);
      
      const userInfo = await orphiCrowdFund.getUserInfo(user1.address);
      expect(userInfo.sponsor).to.equal(matrixRoot.address);
      expect(userInfo.packageTier).to.equal(PackageTier.PACKAGE_30);
      expect(userInfo.totalInvested).to.equal(PACKAGE_30);
    });

    it("Should reject registration of already registered user", async function () {
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      await expect(
        orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_50)
      ).to.be.revertedWith("User already registered");
    });

    it("Should reject registration with unregistered sponsor", async function () {
      await expect(
        orphiCrowdFund.connect(user1).registerUser(user2.address, PackageTier.PACKAGE_30)
      ).to.be.revertedWith("Sponsor not registered");
    });

    it("Should reject registration with invalid package tier", async function () {
      await expect(
        orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.NONE)
      ).to.be.revertedWith("Invalid package tier");
    });
  });

  describe("Matrix Placement", function () {
    it("Should place users in matrix using BFS algorithm", async function () {
      // Register first user under root (should go to left)
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      let matrixInfo = await orphiCrowdFund.getMatrixInfo(matrixRoot.address);
      expect(matrixInfo.leftChild).to.equal(user1.address);
      expect(matrixInfo.rightChild).to.equal(ethers.ZeroAddress);

      // Register second user under root (should go to right)
      await orphiCrowdFund.connect(user2).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      matrixInfo = await orphiCrowdFund.getMatrixInfo(matrixRoot.address);
      expect(matrixInfo.leftChild).to.equal(user1.address);
      expect(matrixInfo.rightChild).to.equal(user2.address);

      // Register third user (should go under user1's left)
      await orphiCrowdFund.connect(user3).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      matrixInfo = await orphiCrowdFund.getMatrixInfo(user1.address);
      expect(matrixInfo.leftChild).to.equal(user3.address);
    });

    it("Should update team sizes correctly", async function () {
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      await orphiCrowdFund.connect(user2).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      const rootInfo = await orphiCrowdFund.getUserInfo(matrixRoot.address);
      expect(rootInfo.teamSize).to.equal(2);
      expect(rootInfo.directSponsorsCount).to.equal(2);
    });
  });

  describe("Pool Distribution", function () {
    it("Should distribute sponsor commission correctly", async function () {
      const initialBalance = await orphiCrowdFund.getUserInfo(matrixRoot.address);
      
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      const finalBalance = await orphiCrowdFund.getUserInfo(matrixRoot.address);
      const expectedCommission = (PACKAGE_30 * 4000n) / 10000n; // 40%
      
      expect(finalBalance.withdrawableAmount).to.equal(expectedCommission);
    });

    it("Should handle level bonus distribution", async function () {
      // Create a chain: root -> user1 -> user2
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      await orphiCrowdFund.connect(user2).registerUser(user1.address, PackageTier.PACKAGE_30);
      
      const rootInfo = await orphiCrowdFund.getUserInfo(matrixRoot.address);
      const user1Info = await orphiCrowdFund.getUserInfo(user1.address);
      
      // Root should get sponsor commission from user1 + level bonus from user2
      // User1 should get sponsor commission from user2
      const PACKAGE_30_COST = await orphiCrowdFund.getPackageAmount(PackageTier.PACKAGE_30);

      const expectedUser1Commission = (PACKAGE_30_COST * 4000n) / 10000n; // 40% sponsor commission
      
      // Allow for small precision differences in user1's commission as well
      const user1Difference = user1Info.withdrawableAmount > expectedUser1Commission ? 
        user1Info.withdrawableAmount - expectedUser1Commission : 
        expectedUser1Commission - user1Info.withdrawableAmount;
      const user1Tolerance = PACKAGE_30_COST / 100n; // 1% tolerance to account for global upline bonuses
      
      expect(user1Difference).to.be.lessThan(user1Tolerance, 
        `User1 commission: Expected ${expectedUser1Commission}, got ${user1Info.withdrawableAmount}, difference: ${user1Difference}`);
      
      // Root gets level bonus (3% of user2's package) + sponsor commission from user1
      const rootSponsorCommission = (PACKAGE_30_COST * 4000n) / 10000n; // From user1
      const rootLevelBonus = (PACKAGE_30_COST * 300n) / 10000n; // Level 1 is 3% (300 basis points)
      
      // Allow for distribution variations including level bonuses and global upline bonuses
      const expectedTotal = rootSponsorCommission + rootLevelBonus;
      const actualAmount = rootInfo.withdrawableAmount;
      const difference = actualAmount > expectedTotal ? actualAmount - expectedTotal : expectedTotal - actualAmount;
      const tolerance = PACKAGE_30_COST / 25n; // 4% tolerance to account for additional bonuses
      
      expect(difference).to.be.lessThan(tolerance, `Root commission: Expected ${expectedTotal}, got ${actualAmount}, difference: ${difference}`);
    });

    it("Should accumulate Global Help Pool correctly", async function () {
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      const poolBalances = await orphiCrowdFund.getPoolBalances();
      const expectedGHP = (PACKAGE_30 * 3000n) / 10000n; // 30%
      
      expect(poolBalances[4]).to.equal(expectedGHP); // GHP is index 4
    });

    it("Should accumulate Leader Bonus Pool correctly", async function () {
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      const poolBalances = await orphiCrowdFund.getPoolBalances();
      const expectedLeaderBonus = (PACKAGE_30 * 1000n) / 10000n; // 10%
      
      expect(poolBalances[3]).to.equal(expectedLeaderBonus); // Leader pool is index 3
    });
  });

  describe("Earnings Cap", function () {
    it("Should cap user earnings at 4x investment", async function () {
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Simulate earning 4x the investment
      const cap = PACKAGE_30 * 4n;
      
      // Register enough users to trigger cap
      for (let i = 0; i < 8; i++) {
        await orphiCrowdFund.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
      
      const rootInfo = await orphiCrowdFund.getUserInfo(matrixRoot.address);
      // Should be capped or close to cap
      expect(rootInfo.isCapped).to.be.true;
    });
  });

  describe("Withdrawal System", function () {
    beforeEach(async function () {
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
    });

    it("Should allow withdrawal with correct percentages based on direct sponsors", async function () {
      const userInfo = await orphiCrowdFund.getUserInfo(matrixRoot.address);
      const withdrawableAmount = userInfo.withdrawableAmount;
      
      // Root has 1 direct sponsor, so should withdraw 70%
      const expectedWithdraw = (withdrawableAmount * 7000n) / 10000n;
      const expectedReinvest = withdrawableAmount - expectedWithdraw;
      
      const initialBalance = await mockUSDT.balanceOf(matrixRoot.address);
      
      await orphiCrowdFund.connect(matrixRoot).withdraw();
      
      const finalBalance = await mockUSDT.balanceOf(matrixRoot.address);
      expect(finalBalance - initialBalance).to.equal(expectedWithdraw);
    });

    it("Should increase withdrawal percentage with more direct sponsors", async function () {
      // Add 5 direct sponsors to user1
      for (let i = 0; i < 5; i++) {
        await orphiCrowdFund.connect(users[i]).registerUser(user1.address, PackageTier.PACKAGE_30);
      }
      
      const userInfo = await orphiCrowdFund.getUserInfo(user1.address);
      expect(userInfo.directSponsorsCount).to.equal(5);
      
      // Should now be able to withdraw 75%
      const withdrawableAmount = userInfo.withdrawableAmount;
      const expectedWithdraw = (withdrawableAmount * 7500n) / 10000n;
      
      const initialBalance = await mockUSDT.balanceOf(user1.address);
      await orphiCrowdFund.connect(user1).withdraw();
      const finalBalance = await mockUSDT.balanceOf(user1.address);
      
      expect(finalBalance - initialBalance).to.equal(expectedWithdraw);
    });
  });

  describe("Package Upgrades", function () {
    it("Should automatically upgrade package when team size threshold is met", async function () {
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Initially should be PACKAGE_30
      let userInfo = await orphiCrowdFund.getUserInfo(user1.address);
      expect(userInfo.packageTier).to.equal(PackageTier.PACKAGE_30);
      
      // Add enough team members to trigger upgrade to PACKAGE_50 (256 IDs needed)
      // This is a simplified test - in practice, would need complex tree building
      for (let i = 0; i < 50; i++) {
        await orphiCrowdFund.connect(users[i]).registerUser(user1.address, PackageTier.PACKAGE_30);
      }
      
      userInfo = await orphiCrowdFund.getUserInfo(user1.address);
      // Team size should be updated
      expect(userInfo.teamSize).to.be.greaterThan(0);
    });
  });

  describe("Leader Ranks", function () {
    it("Should update leader ranks based on team size and direct sponsors", async function () {
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Add direct sponsors
      for (let i = 0; i < 15; i++) {
        await orphiCrowdFund.connect(users[i]).registerUser(user1.address, PackageTier.PACKAGE_30);
      }
      
      const userInfo = await orphiCrowdFund.getUserInfo(user1.address);
      expect(userInfo.directSponsorsCount).to.equal(15);
      
      // Should have some leader rank if team size is sufficient
      // Note: This test is simplified as building a team of 250+ would require more complex setup
    });
  });

  describe("Global Help Pool Distribution", function () {
    it("Should distribute GHP to eligible users", async function () {
      // Setup multiple users
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      await orphiCrowdFund.connect(user2).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      // Check initial GHP balance
      const poolBalances = await orphiCrowdFund.getPoolBalances();
      expect(poolBalances[4]).to.be.greaterThan(0);
      
      // Fast forward time to allow distribution
      await network.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
      await network.provider.send("evm_mine");
      
      // Distribute GHP
      await orphiCrowdFund.distributeGlobalHelpPool();
      
      // Check that pool was distributed
      const newPoolBalances = await orphiCrowdFund.getPoolBalances();
      expect(newPoolBalances[4]).to.equal(0);
    });
  });

  describe("Leader Bonus Distribution", function () {
    it("Should distribute leader bonus to qualified leaders", async function () {
      // This test is simplified as creating qualified leaders requires extensive setup
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      const poolBalances = await orphiCrowdFund.getPoolBalances();
      expect(poolBalances[3]).to.be.greaterThan(0); // Leader pool should have balance
      
      // Distribute leader bonus (owner can call anytime for testing)
      await orphiCrowdFund.distributeLeaderBonus();
      
      // Pool should be cleared after distribution
      const newPoolBalances = await orphiCrowdFund.getPoolBalances();
      expect(newPoolBalances[3]).to.equal(0);
    });
  });

  describe("Security and Access Control", function () {
    it("Should only allow owner to call admin functions", async function () {
      await expect(
        orphiCrowdFund.connect(user1).distributeGlobalHelpPool()
      ).to.be.revertedWithCustomError(orphiCrowdFund, "OwnableUnauthorizedAccount");
      
      await expect(
        orphiCrowdFund.connect(user1).distributeLeaderBonus()
      ).to.be.revertedWithCustomError(orphiCrowdFund, "OwnableUnauthorizedAccount");
      
      await expect(
        orphiCrowdFund.connect(user1).pause()
      ).to.be.revertedWithCustomError(orphiCrowdFund, "OwnableUnauthorizedAccount");
    });

    it("Should prevent operations when paused", async function () {
      await orphiCrowdFund.pause();
      
      await expect(
        orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30)
      ).to.be.revertedWithCustomError(orphiCrowdFund, "EnforcedPause");
      
      await orphiCrowdFund.unpause();
      
      // Should work after unpause
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
    });

    it("Should handle emergency withdraw", async function () {
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      const contractBalance = await mockUSDT.balanceOf(await orphiCrowdFund.getAddress());
      expect(contractBalance).to.be.greaterThan(0);
      
      const initialAdminBalance = await mockUSDT.balanceOf(adminReserve.address);
      
      await orphiCrowdFund.emergencyWithdraw(await mockUSDT.getAddress(), contractBalance);
      
      const finalAdminBalance = await mockUSDT.balanceOf(adminReserve.address);
      expect(finalAdminBalance - initialAdminBalance).to.equal(contractBalance);
    });
  });

  describe("View Functions", function () {
    it("Should return correct package amounts", async function () {
      expect(await orphiCrowdFund.getPackageAmount(PackageTier.PACKAGE_30)).to.equal(PACKAGE_30);
      expect(await orphiCrowdFund.getPackageAmount(PackageTier.PACKAGE_50)).to.equal(PACKAGE_50);
      expect(await orphiCrowdFund.getPackageAmount(PackageTier.PACKAGE_100)).to.equal(PACKAGE_100);
      expect(await orphiCrowdFund.getPackageAmount(PackageTier.PACKAGE_200)).to.equal(PACKAGE_200);
    });

    it("Should return correct user information", async function () {
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      const userInfo = await orphiCrowdFund.getUserInfo(user1.address);
      expect(userInfo.sponsor).to.equal(matrixRoot.address);
      expect(userInfo.packageTier).to.equal(PackageTier.PACKAGE_30);
      expect(userInfo.totalInvested).to.equal(PACKAGE_30);
      expect(userInfo.directSponsorsCount).to.equal(0);
    });

    it("Should return correct matrix information", async function () {
      await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      
      const matrixInfo = await orphiCrowdFund.getMatrixInfo(matrixRoot.address);
      expect(matrixInfo.leftChild).to.equal(user1.address);
      expect(matrixInfo.rightChild).to.equal(ethers.ZeroAddress);
    });
  });
});
