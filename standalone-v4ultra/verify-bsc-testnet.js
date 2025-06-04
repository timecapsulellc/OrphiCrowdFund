// Verification script for BSC Testnet deployment
const { run, ethers } = require("hardhat");
require("dotenv").config();

// Update these with the actual deployed addresses from your deployment
const MOCKUSDT_ADDRESS = "YOUR_DEPLOYED_MOCKUSDT_ADDRESS";
const V4ULTRA_ADDRESS = "YOUR_DEPLOYED_V4ULTRA_ADDRESS";
const ADMIN_ADDRESS = "YOUR_ADMIN_ADDRESS";

async function main() {
  console.log("\n🔍 VERIFYING CONTRACTS ON BSC TESTNET");
  console.log("======================================");

  try {
    // 1. Verify MockUSDT
    console.log("\n📝 Verifying MockUSDT contract...");
    await run("verify:verify", {
      address: MOCKUSDT_ADDRESS,
      constructorArguments: [],
      contract: "standalone-v4ultra/MockUSDT.sol:MockUSDT"
    });
    console.log("✅ MockUSDT verified successfully!");
    
    // 2. Verify OrphiCrowdFundV4UltraSecure
    console.log("\n📝 Verifying OrphiCrowdFundV4UltraSecure contract...");
    await run("verify:verify", {
      address: V4ULTRA_ADDRESS,
      constructorArguments: [MOCKUSDT_ADDRESS, ADMIN_ADDRESS],
      contract: "standalone-v4ultra/OrphiCrowdFundV4UltraSecure.sol:OrphiCrowdFundV4UltraSecure"
    });
    console.log("✅ OrphiCrowdFundV4UltraSecure verified successfully!");
    
    console.log("\n🎉 VERIFICATION COMPLETE");
    console.log("Contracts are now verified on BSCScan and ready for interaction!");
    
  } catch (error) {
    console.error("\n❌ VERIFICATION FAILED:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
