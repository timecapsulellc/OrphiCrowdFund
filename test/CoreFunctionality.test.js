const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("OrphiCrowdFundV2 Core Functionality", function () {
  let tester;
  let mockUSDT;
  let owner;
  let adminReserve;
  let matrixRoot;
  let user1, user2, user3;
  
  const PACKAGE_30 = ethers.parseEther("30");
  
  const LeaderRank = {
    NONE: 0,
    SHINING_STAR: 1,
    SILVER_STAR: 2
  };

  before(async function () {
    [owner, adminReserve, matrixRoot, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy MockUSDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    // Deploy test contract
    const Tester = await ethers.getContractFactory("OrphiCrowdFundTester");
    tester = await upgrades.deployProxy(
      Tester,
      [await mockUSDT.getAddress(), adminReserve.address, matrixRoot.address],
      { initializer: "initialize" }
    );
    await tester.waitForDeployment();

    // Mint USDT
    await mockUSDT.faucet(owner.address, ethers.parseEther("10000"));
    await mockUSDT.approve(await tester.getAddress(), ethers.parseEther("10000"));
  });

  describe("Leader Rank Updates", function () {
    it("Should update to Shining Star with 250+ team size and 10+ directs", async function () {
      await tester.testUpdateLeaderRank(user1.address, 250, 10);
      expect(await tester.getLeaderRank(user1.address)).to.equal(LeaderRank.SHINING_STAR);
    });

    it("Should update to Silver Star with 500+ team size", async function () {
      await tester.testUpdateLeaderRank(user2.address, 500, 5);
      expect(await tester.getLeaderRank(user2.address)).to.equal(LeaderRank.SILVER_STAR);
    });

    it("Should not qualify with insufficient team size", async function () {
      await tester.testUpdateLeaderRank(user3.address, 200, 15);
      expect(await tester.getLeaderRank(user3.address)).to.equal(LeaderRank.NONE);
    });
  });

  describe("Earnings Cap", function () {
    it("Should mark user as capped when reaching 4x their investment", async function () {
      // Register user1
      const testAmount = ethers.parseEther("100");
      await mockUSDT.faucet(user1.address, testAmount);
      await mockUSDT.connect(user1).approve(await tester.getAddress(), testAmount);
      
      // Set user's investment manually for testing
      await tester.testUpdateLeaderRank(user1.address, 0, 0); // Reset rank
      
      // Manually set investment amount
      await tester.registerUser(matrixRoot.address, 1); // PACKAGE_30
      
      // Credit earnings up to 4x (should mark as capped)
      const userInfo = await tester.getUserInfoEnhanced(user1.address);
      const capAmount = userInfo.totalInvested * 4n;
      
      // Credit earnings in chunks to reach cap
      const chunkSize = capAmount / 4n;
      await tester.testCreditEarnings(user1.address, chunkSize, 0);
      await tester.testCreditEarnings(user1.address, chunkSize, 1);
      await tester.testCreditEarnings(user1.address, chunkSize, 2);
      await tester.testCreditEarnings(user1.address, chunkSize, 3);
      
      // Check if user is capped
      const updatedInfo = await tester.getUserInfoEnhanced(user1.address);
      expect(updatedInfo.isCapped).to.be.true;
    });
  });
});
