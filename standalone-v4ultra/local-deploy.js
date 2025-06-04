// Local deployment script
const { ethers } = require("hardhat");

async function main() {
  console.log("\n🚀 DEPLOYING V4ULTRA TO LOCAL NETWORK");
  console.log("===================================");
  
  try {
    // Get signers
    const [deployer, admin] = await ethers.getSigners();
    console.log(`\n👤 Deployer: ${deployer.address}`);
    console.log(`👤 Admin: ${admin.address}`);
    
    // Deploy MockUSDT
    console.log("\n📦 Deploying MockUSDT...");
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();
    const mockUSDTAddress = await mockUSDT.getAddress();
    console.log(`✅ MockUSDT deployed at: ${mockUSDTAddress}`);
    
    // Deploy V4Ultra
    console.log("\n📦 Deploying OrphiCrowdFundV4Ultra...");
    const OrphiCrowdFundV4Ultra = await ethers.getContractFactory("OrphiCrowdFundV4Ultra");
    const v4Ultra = await OrphiCrowdFundV4Ultra.deploy(mockUSDTAddress, admin.address);
    await v4Ultra.waitForDeployment();
    const v4UltraAddress = await v4Ultra.getAddress();
    console.log(`✅ OrphiCrowdFundV4Ultra deployed at: ${v4UltraAddress}`);
    
    // Summary
    console.log("\n📋 DEPLOYMENT SUMMARY");
    console.log("==================");
    console.log(`MockUSDT: ${mockUSDTAddress}`);
    console.log(`V4Ultra: ${v4UltraAddress}`);
    console.log(`Admin: ${admin.address}`);
    
    // Environment variables
    console.log("\n🔸 Set these environment variables for testing:");
    console.log(`export MOCKUSDT_ADDRESS="${mockUSDTAddress}"`);
    console.log(`export V4ULTRA_ADDRESS="${v4UltraAddress}"`);
    console.log(`export ADMIN_ADDRESS="${admin.address}"`);
    
    return {
      mockUSDT: mockUSDTAddress,
      v4Ultra: v4UltraAddress,
      admin: admin.address
    };
    
  } catch (error) {
    console.error("\n❌ DEPLOYMENT FAILED:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
