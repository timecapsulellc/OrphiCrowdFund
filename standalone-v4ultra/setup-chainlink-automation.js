// Script to set up Chainlink Automation for V4Ultra
const { ethers } = require("hardhat");
require("dotenv").config();

// Update with your deployed V4Ultra address
const V4ULTRA_ADDRESS = "YOUR_DEPLOYED_V4ULTRA_ADDRESS";

async function main() {
  console.log("\n⚙️ CHAINLINK AUTOMATION SETUP FOR V4ULTRA");
  console.log("=========================================");

  try {
    // Connect to deployed V4Ultra contract
    console.log("\n🔌 Connecting to OrphiCrowdFundV4Ultra...");
    const v4Ultra = await ethers.getContractAt("OrphiCrowdFundV4Ultra", V4ULTRA_ADDRESS);
    console.log(`✅ Connected to V4Ultra at: ${V4ULTRA_ADDRESS}`);
    
    // Configure automation parameters
    console.log("\n🔧 Configuring Chainlink Automation...");
    
    // 1. Enable automation
    console.log("Enabling automation...");
    await v4Ultra.enableAutomation(true);
    
    // 2. Set optimal gas limit and batch size
    // - Gas limit: 3,000,000 gas units (adjust based on network conditions)
    // - Batch size: 10 users per processing round
    console.log("Setting gas limit and batch size...");
    const gasLimit = 3000000;
    const batchSize = 10;
    await v4Ultra.updateAutomationConfig(gasLimit, batchSize);
    
    // 3. Verify configuration
    console.log("\n🔍 Verifying automation configuration...");
    const [upkeepNeeded, performData] = await v4Ultra.checkUpkeep("0x");
    console.log(`Upkeep needed: ${upkeepNeeded}`);
    
    // 4. Test with forced upkeep
    console.log("\n🧪 Testing performUpkeep (simulation only)...");
    // Note: This is just to show the call, it won't actually execute distribution
    // since conditions may not be met yet
    console.log("Call would be: await v4Ultra.performUpkeep('0x')");
    
    console.log("\n✅ AUTOMATION SETUP COMPLETE");
    console.log(`
NEXT STEPS:
1. Register this contract with Chainlink Keeper Network:
   - Go to: https://automation.chain.link
   - Network: BSC Testnet
   - Contract address: ${V4ULTRA_ADDRESS}
   - Gas limit: ${gasLimit}
   - Funding: 1-2 LINK tokens minimum

2. Monitor upkeeps at: https://automation.chain.link
   - Your automation should trigger based on your time intervals
   - First upkeep might happen ~24 hours after registration

3. Additional settings can be adjusted via:
   - v4Ultra.updateAutomationConfig(gasLimit, batchSize)
   - v4Ultra.enableAutomation(true/false)
`);
    
  } catch (error) {
    console.error("\n❌ AUTOMATION SETUP FAILED:", error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
