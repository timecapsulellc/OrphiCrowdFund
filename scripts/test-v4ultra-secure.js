// Test script for V4UltraSecure contract
const { ethers } = require("hardhat");

async function main() {
    console.log("\n🧪 ORPHI CROWDFUND V4ULTRA SECURE - TEST");
    console.log("=====================================================");

    try {
        // Deploy contracts
        const [owner, admin, user1, user2, user3] = await ethers.getSigners();
        
        console.log("Deploying MockUSDT...");
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        const mockUSDT = await MockUSDT.deploy();
        await mockUSDT.waitForDeployment();
        console.log(`MockUSDT deployed at: ${await mockUSDT.getAddress()}`);
        
        console.log("Deploying V4UltraSecure...");
        const V4UltraSecure = await ethers.getContractFactory("OrphiCrowdFundV4UltraSecure");
        const v4UltraSecure = await V4UltraSecure.deploy(
            await mockUSDT.getAddress(),
            admin.address
        );
        await v4UltraSecure.waitForDeployment();
        console.log(`V4UltraSecure deployed at: ${await v4UltraSecure.getAddress()}`);
        
        // Check contract size
        const bytecode = await ethers.provider.getCode(await v4UltraSecure.getAddress());
        const size = (bytecode.length - 2) / 2; // Remove 0x and divide by 2
        console.log(`Contract Size: ${size} bytes (${(size/1024).toFixed(2)} KB)`);
        console.log(`Size Limit: 24,576 bytes (24 KB)`);
        console.log(`Status: ${size < 24576 ? '✅ UNDER LIMIT' : '❌ OVER LIMIT'}`);
        
        // Setup test environment
        console.log("\nSetting up test environment...");
        // Mint tokens for users
        const testAmount = ethers.parseUnits("10000", 6);
        await mockUSDT.mint(user1.address, testAmount);
        await mockUSDT.mint(user2.address, testAmount);
        await mockUSDT.mint(user3.address, testAmount);
        
        await mockUSDT.connect(user1).approve(await v4UltraSecure.getAddress(), testAmount);
        await mockUSDT.connect(user2).approve(await v4UltraSecure.getAddress(), testAmount);
        await mockUSDT.connect(user3).approve(await v4UltraSecure.getAddress(), testAmount);
        
        // Test Security Features
        console.log("\n🔒 Testing Security Features...");
        
        // Test KYC requirement
        console.log("Testing KYC requirement...");
        let kyc1Before = await v4UltraSecure.isKYCVerified(user1.address);
        console.log(`User1 KYC Before: ${kyc1Before}`);
        
        await v4UltraSecure.setKYCStatus(user1.address, true);
        let kyc1After = await v4UltraSecure.isKYCVerified(user1.address);
        console.log(`User1 KYC After: ${kyc1After}`);
        
        // Test registration
        console.log("\nTesting registration with KYC...");
        await v4UltraSecure.connect(user1).register(ethers.ZeroAddress, 1); // Tier 1
        
        const user1Info = await v4UltraSecure.getUserInfo(user1.address);
        console.log(`User1 registered with ID: ${user1Info.id}`);
        console.log(`User1 package tier: ${user1Info.packageTier}`);
        
        // Test emergency controls
        console.log("\nTesting emergency controls...");
        await v4UltraSecure.emergencyLock();
        const stateAfterLock = await v4UltraSecure.state();
        console.log(`System locked: ${stateAfterLock.systemLocked}`);
        
        // Try registration during lock (should fail)
        console.log("Attempting registration during lock (should fail)...");
        await v4UltraSecure.setKYCStatus(user2.address, true);
        
        try {
            await v4UltraSecure.connect(user2).register(user1.address, 1);
            console.log("❌ Registration succeeded during lock - THIS IS A BUG");
        } catch (error) {
            console.log("✅ Registration correctly failed during lock");
        }
        
        // Unlock system
        await v4UltraSecure.emergencyUnlock();
        const stateAfterUnlock = await v4UltraSecure.state();
        console.log(`System unlocked: ${!stateAfterUnlock.systemLocked}`);
        
        // Test registration after unlock
        await v4UltraSecure.connect(user2).register(user1.address, 1);
        const user2Info = await v4UltraSecure.getUserInfo(user2.address);
        console.log(`User2 registered with ID: ${user2Info.id}`);
        
        // Test pool balances
        console.log("\nChecking pool balances...");
        const poolBalances = await v4UltraSecure.getPoolBalances();
        console.log(`Sponsor Pool: ${ethers.formatUnits(poolBalances[0], 6)} USDT`);
        console.log(`Level Pool: ${ethers.formatUnits(poolBalances[1], 6)} USDT`);
        console.log(`Upline Pool: ${ethers.formatUnits(poolBalances[2], 6)} USDT`);
        console.log(`Leader Pool: ${ethers.formatUnits(poolBalances[3], 6)} USDT`);
        console.log(`GHP Pool: ${ethers.formatUnits(poolBalances[4], 6)} USDT`);
        console.log(`Leftover Pool: ${ethers.formatUnits(poolBalances[5], 6)} USDT`);
        
        // Test ClubPool
        console.log("\nTesting ClubPool...");
        await v4UltraSecure.createClubPool(7 * 24 * 60 * 60); // 7 days
        await v4UltraSecure.connect(user1).addToClubPool();
        console.log("User1 added to club pool");
        
        console.log("\n✅ Test completed successfully!");
        
    } catch (error) {
        console.error("❌ Test failed with error:", error);
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
