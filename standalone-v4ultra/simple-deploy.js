// Simple deployment script for BSC Testnet
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("\n📢 DEPLOYMENT LOG FOR V4ULTRA - BSC TESTNET");
  console.log("===========================================");
  
  try {
    // Get network information
    const network = await ethers.provider.getNetwork();
    console.log(`Network: ${network.name}`);
    console.log(`Chain ID: ${network.chainId}`);
    
    // Get signer information
    const [deployer] = await ethers.getSigners();
    if (!deployer) {
      throw new Error("No deployer account available. Check your private key and network configuration.");
    }
    
    console.log(`\n🔑 Deployer Address: ${deployer.address}`);
    
    // Check balance
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} BNB`);
    
    if (balance === 0n) {
      throw new Error("Deployer account has no BNB. Please fund your account first.");
    }
    
    // Deploy MockUSDT
    console.log("\n🚀 Deploying MockUSDT...");
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();
    const mockUSDTAddress = await mockUSDT.getAddress();
    console.log(`✅ MockUSDT deployed at: ${mockUSDTAddress}`);
    
    // Deploy V4Ultra using the admin address
    const adminAddress = deployer.address; // Using deployer as admin for simplicity
    console.log(`\n👤 Admin Address: ${adminAddress}`);
    
    console.log("\n🚀 Deploying OrphiCrowdFundV4Ultra...");
    const OrphiCrowdFundV4Ultra = await ethers.getContractFactory("OrphiCrowdFundV4Ultra");
    const v4Ultra = await OrphiCrowdFundV4Ultra.deploy(mockUSDTAddress, adminAddress);
    await v4Ultra.waitForDeployment();
    const v4UltraAddress = await v4Ultra.getAddress();
    console.log(`✅ OrphiCrowdFundV4Ultra deployed at: ${v4UltraAddress}`);
    
    // Summary
    console.log("\n📋 DEPLOYMENT SUMMARY");
    console.log("==================");
    console.log(`Network: BSC Testnet (Chain ID: ${network.chainId})`);
    console.log(`MockUSDT Address: ${mockUSDTAddress}`);
    console.log(`V4Ultra Address: ${v4UltraAddress}`);
    console.log(`Admin Address: ${adminAddress}`);
    console.log(`Deployer Address: ${deployer.address}`);
    console.log("\n✅ DEPLOYMENT COMPLETED SUCCESSFULLY");
    
    // Provide environment variables for easy export
    console.log("\n🔸 Set these environment variables for testing:");
    console.log(`export MOCKUSDT_ADDRESS="${mockUSDTAddress}"`);
    console.log(`export V4ULTRA_ADDRESS="${v4UltraAddress}"`);
    console.log(`export ADMIN_ADDRESS="${adminAddress}"`);
    
  } catch (error) {
    console.error("\n❌ DEPLOYMENT FAILED:");
    console.error(error);
    
    console.log("\n⚠️ Troubleshooting tips:");
    console.log("1. Ensure your .env file contains DEPLOYER_PRIVATE_KEY");
    console.log("2. Make sure you have BNB in your deployer account for gas");
    console.log("3. Check your BSC Testnet connection");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
