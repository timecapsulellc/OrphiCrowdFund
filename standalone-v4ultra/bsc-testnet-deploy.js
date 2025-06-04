// Robust deployment script for BSC testnet
const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  // Verify network and signer setup
  const [deployer] = await ethers.getSigners();
  
  console.log("\n🔑 Deployment Account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account Balance:", ethers.formatUnits(balance, "ether"), "BNB");
  
  if (balance === BigInt(0)) {
    console.error("⚠️ ERROR: Deployer account has zero balance. Please fund your account first.");
    process.exit(1);
  }
  
  console.log("\n🌐 Network:", network.name);
  console.log("🔗 Chain ID:", (await ethers.provider.getNetwork()).chainId);
  
  console.log("\n🚀 Deploying MockUSDT...");
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUSDT = await MockUSDT.deploy();
  await mockUSDT.waitForDeployment();
  const usdtAddress = await mockUSDT.getAddress();
  console.log(`✅ MockUSDT deployed at: ${usdtAddress}`);

  // Admin address - either from accounts[1] or use the deployer address if only one account
  let adminAddress;
  try {
    const accounts = await ethers.getSigners();
    adminAddress = accounts.length > 1 ? accounts[1].address : deployer.address;
  } catch (error) {
    adminAddress = deployer.address;
  }
  console.log(`👤 Using admin address: ${adminAddress}`);

  console.log("\n🚀 Deploying OrphiCrowdFundV4UltraSecure...");
  const OrphiCrowdFundV4UltraSecure = await ethers.getContractFactory("OrphiCrowdFundV4UltraSecure");
  const v4ultra = await OrphiCrowdFundV4UltraSecure.deploy(usdtAddress, adminAddress);
  await v4ultra.waitForDeployment();
  const v4ultraAddress = await v4ultra.getAddress();
  console.log(`✅ OrphiCrowdFundV4Ultra deployed at: ${v4ultraAddress}`);

  console.log("\n📝 Contract Deployment Summary:");
  console.log(`Network: ${network.name}`);
  console.log(`MockUSDT: ${usdtAddress}`);
  console.log(`OrphiCrowdFundV4Ultra: ${v4ultraAddress}`);
  console.log(`Admin: ${adminAddress}`);
  console.log(`Deployer: ${deployer.address}`);
  console.log("\n🎉 Deployment complete!");
}

main().catch((error) => {
  console.error("\n❌ DEPLOYMENT FAILED:");
  console.error(error);
  process.exit(1);
});
