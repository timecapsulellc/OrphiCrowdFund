const { ethers, upgrades } = require("hardhat");

async function main() {
    console.log("Testing OrphiCrowdFundV4Minimal deployment...");
    
    try {
        const [owner, adminReserve, matrixRoot] = await ethers.getSigners();
        console.log("Got signers");
        
        // Deploy MockUSDT
        console.log("Deploying MockUSDT...");
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        const mockUSDT = await MockUSDT.deploy();
        await mockUSDT.waitForDeployment();
        console.log("MockUSDT deployed at:", await mockUSDT.getAddress());
        
        // Try to deploy OrphiCrowdFundV4Minimal
        console.log("Getting OrphiCrowdFundV4Minimal factory...");
        const OrphiCrowdFundV4Minimal = await ethers.getContractFactory("OrphiCrowdFundV4Minimal");
        console.log("Contract factory created");
        
        console.log("Deploying OrphiCrowdFundV4Minimal...");
        const orphiCrowdFundV4 = await upgrades.deployProxy(
            OrphiCrowdFundV4Minimal,
            [await mockUSDT.getAddress(), adminReserve.address, matrixRoot.address],
            { initializer: "initialize" }
        );
        await orphiCrowdFundV4.waitForDeployment();
        console.log("OrphiCrowdFundV4Minimal deployed at:", await orphiCrowdFundV4.getAddress());
        
        // Initialize V4 features
        console.log("Initializing V4 features...");
        await orphiCrowdFundV4.initializeV4();
        console.log("V4 features initialized");
        
        // Test basic functionality
        console.log("Testing automation status...");
        const automationStatus = await orphiCrowdFundV4.getAutomationStatus();
        console.log("Automation enabled:", automationStatus.enabled);
        
        console.log("Testing GHP distribution readiness...");
        const ghpReady = await orphiCrowdFundV4.isGHPDistributionReady();
        console.log("GHP distribution ready:", ghpReady);
        
        console.log("✅ All deployment tests passed!");
        
    } catch (error) {
        console.error("❌ Deployment failed:", error.message);
        if (error.message.includes("code is too large")) {
            console.error("Contract size is too large for deployment");
        }
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Script failed:", error);
        process.exit(1);
    });
