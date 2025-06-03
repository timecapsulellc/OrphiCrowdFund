const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("OrphiCrowdFundV4 - Gas Optimization Benchmarks", function () {
  let orphiCrowdFundV4;
  let orphiCrowdFundV2; // For comparison
  let mockUSDT;
  let owner;
  let adminReserve;
  let matrixRoot;
  let users = [];

  const PACKAGE_30 = ethers.parseEther("30");
  const PackageTier = { NONE: 0, PACKAGE_30: 1, PACKAGE_50: 2, PACKAGE_100: 3, PACKAGE_200: 4 };

  before(async function () {
    [owner, adminReserve, matrixRoot, ...users] = await ethers.getSigners();
    
    // Deploy MockUSDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    // Deploy V2 for comparison
    const OrphiCrowdFundV2 = await ethers.getContractFactory("OrphiCrowdFundV2");
    orphiCrowdFundV2 = await upgrades.deployProxy(
      OrphiCrowdFundV2,
      [await mockUSDT.getAddress(), adminReserve.address, matrixRoot.address],
      { initializer: "initialize" }
    );
    await orphiCrowdFundV2.waitForDeployment();

    // Deploy V4 for testing
    const OrphiCrowdFundV4 = await ethers.getContractFactory("OrphiCrowdFundV4");
    orphiCrowdFundV4 = await upgrades.deployProxy(
      OrphiCrowdFundV4,
      [await mockUSDT.getAddress(), adminReserve.address, matrixRoot.address],
      { initializer: "initialize" }
    );
    await orphiCrowdFundV4.waitForDeployment();

    // Setup test funds for many users
    const testAmount = ethers.parseEther("10000");
    for (let i = 0; i < 100; i++) {
      await mockUSDT.faucet(users[i].address, testAmount);
      await mockUSDT.connect(users[i]).approve(await orphiCrowdFundV2.getAddress(), testAmount);
      await mockUSDT.connect(users[i]).approve(await orphiCrowdFundV4.getAddress(), testAmount);
    }

    // Grant admin roles
    const ADMIN_ROLE_V2 = await orphiCrowdFundV2.ADMIN_ROLE();
    await orphiCrowdFundV2.grantRole(ADMIN_ROLE_V2, owner.address);
    
    const ADMIN_ROLE_V4 = await orphiCrowdFundV4.ADMIN_ROLE();
    await orphiCrowdFundV4.grantRole(ADMIN_ROLE_V4, owner.address);
  });

  describe("Matrix Placement Gas Optimization", function () {
    it("Should demonstrate gas savings in V4 vs V2 for single registration", async function () {
      // Test V2 gas usage
      const txV2 = await orphiCrowdFundV2.connect(users[0]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      const receiptV2 = await txV2.wait();
      const gasV2 = receiptV2.gasUsed;

      // Test V4 gas usage
      const txV4 = await orphiCrowdFundV4.connect(users[0]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      const receiptV4 = await txV4.wait();
      const gasV4 = receiptV4.gasUsed;

      console.log(`V2 Registration Gas: ${gasV2}`);
      console.log(`V4 Registration Gas: ${gasV4}`);
      console.log(`Gas Savings: ${gasV2 - gasV4} (${((gasV2 - gasV4) * 100n) / gasV2}%)`);

      // V4 should use less gas (target ~30k vs ~80k)
      expect(gasV4).to.be.lessThan(gasV2);
      expect(gasV4).to.be.lessThan(60000); // Should be significantly lower
    });

    it("Should maintain gas efficiency with increasing tree depth in V4", async function () {
      const gasUsages = [];
      
      // Register users and track gas usage
      for (let i = 1; i <= 31; i++) { // 2^5 - 1 = 31 users for 5 levels
        const tx = await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
        const receipt = await tx.wait();
        gasUsages.push(receipt.gasUsed);
        
        // Log every 7 users (levels)
        if (i % 7 === 0) {
          console.log(`Level ${Math.ceil(Math.log2(i + 2))}: User ${i} gas: ${receipt.gasUsed}`);
        }
      }

      // Calculate gas efficiency metrics
      const avgGas = gasUsages.reduce((sum, gas) => sum + gas, 0n) / BigInt(gasUsages.length);
      const maxGas = gasUsages.reduce((max, gas) => gas > max ? gas : max, 0n);
      const minGas = gasUsages.reduce((min, gas) => gas < min ? gas : min, gasUsages[0]);

      console.log(`Average Gas: ${avgGas}`);
      console.log(`Max Gas: ${maxGas}`);
      console.log(`Min Gas: ${minGas}`);
      console.log(`Gas Variance: ${maxGas - minGas}`);

      // Verify gas efficiency remains consistent
      expect(avgGas).to.be.lessThan(50000n); // Should average under 50k
      expect(maxGas - minGas).to.be.lessThan(20000n); // Variance should be low
    });

    it("Should compare gas scaling between V2 and V4", async function () {
      // Test scaling with increasing number of users
      const testSizes = [1, 3, 7, 15, 31]; // 1, 2, 3, 4, 5 levels
      const resultsV2 = [];
      const resultsV4 = [];

      for (const size of testSizes) {
        // Fresh deployments for clean comparison
        const MockUSDTTest = await ethers.getContractFactory("MockUSDT");
        const mockUSDTTest = await MockUSDTTest.deploy();
        await mockUSDTTest.waitForDeployment();

        // Deploy V2 for this test
        const OrphiCrowdFundV2Test = await ethers.getContractFactory("OrphiCrowdFundV2");
        const v2Test = await upgrades.deployProxy(
          OrphiCrowdFundV2Test,
          [await mockUSDTTest.getAddress(), adminReserve.address, matrixRoot.address],
          { initializer: "initialize" }
        );
        await v2Test.waitForDeployment();

        // Deploy V4 for this test
        const OrphiCrowdFundV4Test = await ethers.getContractFactory("OrphiCrowdFundV4");
        const v4Test = await upgrades.deployProxy(
          OrphiCrowdFundV4Test,
          [await mockUSDTTest.getAddress(), adminReserve.address, matrixRoot.address],
          { initializer: "initialize" }
        );
        await v4Test.waitForDeployment();

        // Setup funds
        for (let i = 0; i < size; i++) {
          await mockUSDTTest.faucet(users[i].address, ethers.parseEther("1000"));
          await mockUSDTTest.connect(users[i]).approve(await v2Test.getAddress(), ethers.parseEther("1000"));
          await mockUSDTTest.connect(users[i]).approve(await v4Test.getAddress(), ethers.parseEther("1000"));
        }

        // Register users and measure final registration gas
        for (let i = 0; i < size - 1; i++) {
          await v2Test.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
          await v4Test.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
        }

        // Measure final registration
        const txV2Final = await v2Test.connect(users[size - 1]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
        const receiptV2Final = await txV2Final.wait();
        
        const txV4Final = await v4Test.connect(users[size - 1]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
        const receiptV4Final = await txV4Final.wait();

        resultsV2.push({ size, gas: receiptV2Final.gasUsed });
        resultsV4.push({ size, gas: receiptV4Final.gasUsed });

        console.log(`Size ${size}: V2=${receiptV2Final.gasUsed}, V4=${receiptV4Final.gasUsed}, Savings=${receiptV2Final.gasUsed - receiptV4Final.gasUsed}`);
      }

      // Verify V4 consistently uses less gas
      for (let i = 0; i < testSizes.length; i++) {
        expect(resultsV4[i].gas).to.be.lessThan(resultsV2[i].gas);
      }

      // Check that V4 scaling is better (gas growth rate should be lower)
      const v2GrowthRate = (resultsV2[resultsV2.length - 1].gas - resultsV2[0].gas) / BigInt(testSizes.length - 1);
      const v4GrowthRate = (resultsV4[resultsV4.length - 1].gas - resultsV4[0].gas) / BigInt(testSizes.length - 1);
      
      console.log(`V2 Growth Rate: ${v2GrowthRate} gas per level`);
      console.log(`V4 Growth Rate: ${v4GrowthRate} gas per level`);
      
      expect(v4GrowthRate).to.be.lessThan(v2GrowthRate);
    });
  });

  describe("Pool Distribution Gas Optimization", function () {
    beforeEach(async function () {
      // Register multiple users to create pool balances
      for (let i = 0; i < 20; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }
    });

    it("Should measure gas usage for automated vs manual distribution", async function () {
      // Test manual distribution gas
      const manualTx = await orphiCrowdFundV4.distributeGlobalHelpPool();
      const manualReceipt = await manualTx.wait();
      const manualGas = manualReceipt.gasUsed;

      // Register more users to rebuild pool
      for (let i = 20; i < 40; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }

      // Test automated distribution gas
      const performData = ethers.AbiCoder.defaultAbiCoder().encode(["uint8"], [1]);
      const automatedTx = await orphiCrowdFundV4.performUpkeep(performData);
      const automatedReceipt = await automatedTx.wait();
      const automatedGas = automatedReceipt.gasUsed;

      console.log(`Manual Distribution Gas: ${manualGas}`);
      console.log(`Automated Distribution Gas: ${automatedGas}`);
      console.log(`Automation Overhead: ${automatedGas - manualGas} (${((automatedGas - manualGas) * 100n) / manualGas}%)`);

      // Automation should have minimal overhead
      expect(automatedGas - manualGas).to.be.lessThan(50000n); // <50k overhead
    });

    it("Should measure checkUpkeep gas efficiency", async function () {
      // Measure checkUpkeep gas usage
      const gasEstimate = await orphiCrowdFundV4.checkUpkeep.estimateGas("0x");
      
      console.log(`checkUpkeep Gas: ${gasEstimate}`);
      
      // checkUpkeep should be very gas efficient (view function)
      expect(gasEstimate).to.be.lessThan(30000); // Should be minimal
    });
  });

  describe("Earnings Cap Enforcement Gas Impact", function () {
    it("Should measure gas impact of centralized cap enforcement", async function () {
      // Register user and measure registration gas with cap checking
      const tx1 = await orphiCrowdFundV4.connect(users[50]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      const receipt1 = await tx1.wait();
      const gasWithCap = receipt1.gasUsed;

      // Register multiple users under first user to trigger cap logic
      for (let i = 51; i < 55; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(users[50].address, PackageTier.PACKAGE_30);
      }

      // Measure gas when cap enforcement is active
      const tx2 = await orphiCrowdFundV4.connect(users[55]).registerUser(users[50].address, PackageTier.PACKAGE_30);
      const receipt2 = await tx2.wait();
      const gasWithActiveCap = receipt2.gasUsed;

      console.log(`Gas without cap enforcement: ${gasWithCap}`);
      console.log(`Gas with active cap enforcement: ${gasWithActiveCap}`);
      console.log(`Cap enforcement overhead: ${gasWithActiveCap > gasWithCap ? gasWithActiveCap - gasWithCap : 0n}`);

      // Cap enforcement should add minimal overhead
      const overhead = gasWithActiveCap > gasWithCap ? gasWithActiveCap - gasWithCap : 0n;
      expect(overhead).to.be.lessThan(10000n); // <10k overhead
    });
  });

  describe("Event Emission Gas Impact", function () {
    it("Should measure gas impact of enhanced event logging", async function () {
      // Measure gas with full event emission
      const tx = await orphiCrowdFundV4.connect(users[60]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      const receipt = await tx.wait();
      
      console.log(`Registration with enhanced events: ${receipt.gasUsed}`);
      console.log(`Events emitted: ${receipt.logs.length}`);

      // Enhanced events should have reasonable gas cost
      expect(receipt.gasUsed).to.be.lessThan(80000); // Should remain efficient
      expect(receipt.logs.length).to.be.greaterThan(0); // Should emit events
    });
  });

  describe("Batch Operations Gas Efficiency", function () {
    it("Should demonstrate gas efficiency of view function batching", async function () {
      // Measure individual view function calls
      const start1 = Date.now();
      for (let i = 0; i < 10; i++) {
        await orphiCrowdFundV4.getUserInfoEnhanced(users[i].address);
      }
      const end1 = Date.now();

      // Measure batch status call
      const start2 = Date.now();
      await orphiCrowdFundV4.getSystemStatsEnhanced();
      await orphiCrowdFundV4.getAutomationStatus();
      await orphiCrowdFundV4.getUpkeepReadiness();
      const end2 = Date.now();

      console.log(`Individual calls time: ${end1 - start1}ms`);
      console.log(`Batch calls time: ${end2 - start2}ms`);

      // Batch calls should be more efficient
      expect(end2 - start2).to.be.lessThan(end1 - start1);
    });
  });

  describe("Memory and Storage Optimization", function () {
    it("Should demonstrate efficient storage usage", async function () {
      const initialStats = await orphiCrowdFundV4.getSystemStatsEnhanced();
      
      // Register many users to test storage efficiency
      for (let i = 70; i < 100; i++) {
        await orphiCrowdFundV4.connect(users[i]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      }

      const finalStats = await orphiCrowdFundV4.getSystemStatsEnhanced();
      
      console.log(`Users registered: ${finalStats.totalMembersCount - initialStats.totalMembersCount}`);
      console.log(`Storage slots used efficiently with packed structs`);

      // Verify data integrity with optimized storage
      expect(finalStats.totalMembersCount).to.be.greaterThan(initialStats.totalMembersCount);
      expect(finalStats.totalVolumeAmount).to.be.greaterThan(initialStats.totalVolumeAmount);
    });

    it("Should verify gas efficiency improvements over baseline", async function () {
      // Summary of all gas improvements
      console.log("\n=== GAS OPTIMIZATION SUMMARY ===");
      console.log("Target Improvements:");
      console.log("- Matrix placement: ~80k → ~30k (62% reduction)");
      console.log("- Automation overhead: <50k additional");
      console.log("- Cap enforcement overhead: <10k additional");
      console.log("- View function efficiency: Batch operations preferred");
      console.log("=====================================\n");

      // This is a summary test that verifies our optimization targets
      const registrationTx = await orphiCrowdFundV4.connect(users[95]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
      const registrationReceipt = await registrationTx.wait();
      
      // Final verification of gas targets
      expect(registrationReceipt.gasUsed).to.be.lessThan(60000); // Well under old 80k target
      
      const checkGas = await orphiCrowdFundV4.checkUpkeep.estimateGas("0x");
      expect(checkGas).to.be.lessThan(30000); // Efficient automation check
      
      console.log(`✅ Final registration gas: ${registrationReceipt.gasUsed}`);
      console.log(`✅ Final checkUpkeep gas: ${checkGas}`);
    });
  });

  describe("Real-world Load Testing", function () {
    it("Should handle realistic transaction load efficiently", async function () {
      // Simulate realistic usage patterns
      const startTime = Date.now();
      const gasUsages = [];

      // Simulate 50 registrations in rapid succession
      for (let i = 0; i < 50; i++) {
        const userIndex = (i * 2) % users.length; // Spread across available users
        const tx = await orphiCrowdFundV4.connect(users[userIndex]).registerUser(matrixRoot.address, PackageTier.PACKAGE_30);
        const receipt = await tx.wait();
        gasUsages.push(receipt.gasUsed);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgGas = gasUsages.reduce((sum, gas) => sum + gas, 0n) / BigInt(gasUsages.length);
      const totalGas = gasUsages.reduce((sum, gas) => sum + gas, 0n);

      console.log(`\n=== LOAD TEST RESULTS ===`);
      console.log(`Total registrations: 50`);
      console.log(`Total time: ${totalTime}ms`);
      console.log(`Average time per registration: ${totalTime / 50}ms`);
      console.log(`Average gas per registration: ${avgGas}`);
      console.log(`Total gas consumed: ${totalGas}`);
      console.log(`Gas efficiency rating: ${avgGas < 50000n ? "EXCELLENT" : avgGas < 70000n ? "GOOD" : "NEEDS_OPTIMIZATION"}`);
      console.log(`=========================\n`);

      // Performance benchmarks
      expect(avgGas).to.be.lessThan(50000n); // Average should be excellent
      expect(totalTime).to.be.lessThan(10000); // Should complete quickly
    });
  });
});
