// Search for deployed contracts on BSC Testnet
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("\n🔍 SEARCHING FOR DEPLOYED CONTRACTS");
  console.log("=================================");
  
  try {
    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`👤 Deployer Address: ${deployer.address}`);
    
    // Get network info
    const network = await ethers.provider.getNetwork();
    console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);
    
    // Get transaction count to estimate how many contracts were deployed
    const nonce = await ethers.provider.getTransactionCount(deployer.address);
    console.log(`📊 Total Transactions: ${nonce}`);
    
    // Search for the most recent contract deployments
    console.log("\n📂 Searching for recent contract deployments...");
    
    // Get the most recent transactions
    console.log("\n📝 To find your deployed contracts:");
    console.log(`1. Visit BSCscan testnet: https://testnet.bscscan.com/address/${deployer.address}`);
    console.log(`2. Look for "Contract Creation" transactions`);
    console.log(`3. The most recent ones should be your MockUSDT and OrphiCrowdFundV4Ultra contracts`);
    
    // Try to directly search for contracts by name
    console.log("\n🔬 Attempting to load contracts from artifacts...");
    
    try {
      const MockUSDT = await ethers.getContractFactory("MockUSDT");
      const OrphiCrowdFundV4Ultra = await ethers.getContractFactory("OrphiCrowdFundV4Ultra");
      
      console.log(`✅ Contract factories loaded successfully`);
      console.log(`\nThe following commands may help find your contracts once deployed:`);
      console.log(`1. Set your address as environment variable:`);
      console.log(`   export DEPLOYER_ADDRESS="${deployer.address}"`);
      
      console.log(`\n2. Then in the BSC Testnet block explorer, search for contracts created by this address`);
      
    } catch (error) {
      console.log(`❌ Error loading contract factories: ${error.message}`);
    }
    
    console.log("\n⚠️ Since we don't have the exact addresses, you will need to:");
    console.log("1. Check BSCscan for contracts created by your account");
    console.log("2. Verify these are the correct contracts by examining the code");
    console.log("3. Set the addresses as environment variables:");
    console.log(`   export MOCKUSDT_ADDRESS="your_mockusdt_address"`);
    console.log(`   export V4ULTRA_ADDRESS="your_v4ultra_address"`);
    console.log(`   export ADMIN_ADDRESS="${deployer.address}"`);
    
  } catch (error) {
    console.error("\n❌ ERROR:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
