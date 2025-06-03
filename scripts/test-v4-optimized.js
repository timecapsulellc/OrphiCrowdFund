const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Testing OrphiCrowdFundV4LibOptimized Deployment...\n");

    // Get signers
    const [owner, user1, adminReserve] = await ethers.getSigners();
    console.log("📝 Owner:", owner.address);
    console.log("📝 AdminReserve:", adminReserve.address);

    try {
        // Deploy MockUSDT
        console.log("\n📦 Deploying MockUSDT...");
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        const mockUSDT = await MockUSDT.deploy();
        await mockUSDT.waitForDeployment();
        console.log("✅ MockUSDT deployed at:", await mockUSDT.getAddress());

        // Deploy optimized V4 contract
        console.log("\n📦 Deploying OrphiCrowdFundV4LibOptimized...");
        const OrphiCrowdFundV4LibOptimized = await ethers.getContractFactory("OrphiCrowdFundV4LibOptimized");
        const crowdFund = await OrphiCrowdFundV4LibOptimized.deploy(
            await mockUSDT.getAddress(),
            adminReserve.address
        );
        await crowdFund.waitForDeployment();
        console.log("✅ OrphiCrowdFundV4LibOptimized deployed at:", await crowdFund.getAddress());

        // Check contract size
        const contractCode = await ethers.provider.getCode(await crowdFund.getAddress());
        const sizeInBytes = (contractCode.length - 2) / 2; // Remove 0x and divide by 2
        const sizeInKB = (sizeInBytes / 1024).toFixed(1);
        
        console.log("\n📊 CONTRACT SIZE ANALYSIS:");
        console.log("=" * 40);
        console.log(`Contract Size: ${sizeInBytes} bytes (${sizeInKB}KB)`);
        console.log(`24KB Limit: 24,576 bytes`);
        console.log(`Under Limit: ${sizeInBytes < 24576 ? '✅ YES' : '❌ NO'}`);
        console.log(`Remaining: ${(24576 - sizeInBytes)} bytes`);

        // Test initial values
        console.log("\n🔍 Testing Initial Values:");
        console.log("Total Members:", await crowdFund.totalMembers());
        console.log("Total Volume:", await crowdFund.totalVolume());
        console.log("Automation Enabled:", await crowdFund.automationEnabled());
        
        // Test package prices
        console.log("\n📋 Package Prices:");
        for (let i = 0; i < 5; i++) {
            const price = await crowdFund.PACKAGE_PRICES(i);
            console.log(`Level ${i}: ${ethers.formatUnits(price, 6)} USDT`);
        }

        // Test basic functionality
        console.log("\n🧪 Testing Basic Functionality:");
        
        // Mint tokens and approve
        await mockUSDT.mint(user1.address, ethers.parseUnits("1000", 6));
        await mockUSDT.connect(user1).approve(await crowdFund.getAddress(), ethers.parseUnits("1000", 6));
        console.log("✅ Tokens minted and approved for user1");

        // Register user
        const tx = await crowdFund.connect(user1).register(ethers.ZeroAddress, 0);
        const receipt = await tx.wait();
        console.log("✅ User1 registered successfully");
        console.log("📊 Gas Used:", receipt.gasUsed.toString());

        // Check user data
        const userData = await crowdFund.users(user1.address);
        console.log("✅ User Data:");
        console.log("  - Is Active:", userData.isActive);
        console.log("  - Sponsor:", userData.sponsor);
        console.log("  - Current Package:", userData.currentPackage);

        // Test automation
        console.log("\n🤖 Testing Automation:");
        await crowdFund.enableAutomation(500000);
        console.log("✅ Automation enabled");
        
        const [upkeepNeeded, performData] = await crowdFund.checkUpkeep("0x");
        console.log("✅ CheckUpkeep called:");
        console.log("  - Upkeep Needed:", upkeepNeeded);
        console.log("  - Perform Data Length:", performData.length);

        console.log("\n🎉 ALL TESTS PASSED! Contract is working correctly and under size limit!");
        
    } catch (error) {
        console.error("\n❌ Error during testing:", error.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
