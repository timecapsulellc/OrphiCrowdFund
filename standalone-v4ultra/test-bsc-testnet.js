// Post-deployment testing script for BSC Testnet
const { ethers } = require("hardhat");
require("dotenv").config();

// Update these with the actual deployed addresses from your deployment
const MOCKUSDT_ADDRESS = "YOUR_DEPLOYED_MOCKUSDT_ADDRESS";
const V4ULTRA_ADDRESS = "YOUR_DEPLOYED_V4ULTRA_ADDRESS";

async function main() {
  console.log("\n🧪 POST-DEPLOYMENT TESTING ON BSC TESTNET");
  console.log("==========================================");

  // Get signers
  const [deployer, user1, user2, user3] = await ethers.getSigners();
  
  console.log("\n👤 Test Accounts:");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`User1: ${user1 ? user1.address : "Not available"}`);
  
  try {
    // Connect to deployed contracts
    console.log("\n🔌 Connecting to deployed contracts...");
    const mockUSDT = await ethers.getContractAt("MockUSDT", MOCKUSDT_ADDRESS);
    const v4Ultra = await ethers.getContractAt("OrphiCrowdFundV4Ultra", V4ULTRA_ADDRESS);
    
    console.log(`✅ Connected to MockUSDT at: ${MOCKUSDT_ADDRESS}`);
    console.log(`✅ Connected to OrphiCrowdFundV4Ultra at: ${V4ULTRA_ADDRESS}`);
    
    // 1. Test Basic MockUSDT Functions
    console.log("\n💰 Testing MockUSDT...");
    const decimals = await mockUSDT.decimals();
    console.log(`Token Decimals: ${decimals}`);
    
    const deployerBalance = await mockUSDT.balanceOf(deployer.address);
    console.log(`Deployer Balance: ${ethers.formatUnits(deployerBalance, decimals)} USDT`);
    
    if (user1) {
      // Mint some tokens to user1
      console.log(`Minting 10,000 USDT to ${user1.address}...`);
      const mintAmount = ethers.parseUnits("10000", decimals);
      await mockUSDT.mint(user1.address, mintAmount);
      
      const user1Balance = await mockUSDT.balanceOf(user1.address);
      console.log(`User1 Balance: ${ethers.formatUnits(user1Balance, decimals)} USDT`);
    }
    
    // 2. Test Basic V4Ultra Functions
    console.log("\n🔄 Testing OrphiCrowdFundV4Ultra...");
    
    // Check initial state
    const [totalUsers, totalVolume, automationOn] = await v4Ultra.getGlobalStats();
    console.log(`Total Users: ${totalUsers}`);
    console.log(`Total Volume: ${ethers.formatUnits(totalVolume, decimals)} USDT`);
    console.log(`Automation Enabled: ${automationOn}`);
    
    // Enable KYC requirement
    console.log("\n🔑 Setting up KYC...");
    await v4Ultra.setKYCRequired(true);
    console.log("KYC requirement enabled");
    
    if (user1) {
      // Verify user1
      await v4Ultra.setKYCStatus(user1.address, true);
      console.log(`KYC verified for ${user1.address}`);
      
      // Approve tokens
      console.log("Approving tokens for registration...");
      const tierAmount = ethers.parseUnits("500", decimals); // Tier 3
      await mockUSDT.connect(user1).approve(V4ULTRA_ADDRESS, tierAmount);
      
      // Register user1
      console.log("Registering user1...");
      await v4Ultra.connect(user1).register(ethers.ZeroAddress, 3); // Tier 3
      console.log("User1 registered successfully");
      
      // Get user info
      const user1Info = await v4Ultra.getUserInfo(user1.address);
      console.log("\n👤 User1 Information after registration:");
      console.log(`ID: ${user1Info.id}`);
      console.log(`Package Tier: ${user1Info.packageTier}`);
    }
    
    // 3. Test ClubPool setup
    console.log("\n🎯 Setting up ClubPool...");
    await v4Ultra.createClubPool(7 * 24 * 60 * 60); // 7 days
    console.log("ClubPool created with 7-day distribution interval");
    
    if (user1) {
      // Add user1 to club pool (eligible with tier 3)
      await v4Ultra.connect(user1).addToClubPool();
      console.log("User1 added to ClubPool");
    }
    
    // 4. Test Chainlink Automation setup
    console.log("\n⚙️ Setting up Chainlink Automation...");
    await v4Ultra.enableAutomation(true);
    await v4Ultra.updateAutomationConfig(3000000, 10);
    console.log("Automation enabled with gas limit 3M and batch size 10");
    
    // 5. Check pool balances
    console.log("\n💰 Current Pool Balances:");
    const balances = await v4Ultra.getPoolBalances();
    console.log(`Sponsor Pool: ${ethers.formatUnits(balances[0], decimals)} USDT`);
    console.log(`Level Pool: ${ethers.formatUnits(balances[1], decimals)} USDT`);
    console.log(`Upline Pool: ${ethers.formatUnits(balances[2], decimals)} USDT`);
    console.log(`Leader Pool: ${ethers.formatUnits(balances[3], decimals)} USDT`);
    console.log(`GHP: ${ethers.formatUnits(balances[4], decimals)} USDT`);
    
    console.log("\n🎉 POST-DEPLOYMENT TESTING COMPLETE");
    console.log("OrphiCrowdFundV4Ultra is set up and ready for thorough testing on BSC Testnet!");
    
  } catch (error) {
    console.error("\n❌ TESTING FAILED:", error);
    console.error(error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
