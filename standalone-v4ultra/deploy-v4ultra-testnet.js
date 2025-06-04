// Deploys MockUSDT and OrphiCrowdFundV4Ultra to a testnet
const { ethers } = require("hardhat");

async function main() {
  console.log("\n🚀 Deploying MockUSDT...");
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUSDT = await MockUSDT.deploy();
  await mockUSDT.waitForDeployment();
  const usdtAddress = await mockUSDT.getAddress();
  console.log(`✅ MockUSDT deployed at: ${usdtAddress}`);

  // Use your own admin address or a test account
  const [deployer, adminReserve] = await ethers.getSigners();

  console.log("\n🚀 Deploying OrphiCrowdFundV4Ultra...");
  const OrphiCrowdFundV4Ultra = await ethers.getContractFactory("OrphiCrowdFundV4Ultra");
  const v4ultra = await OrphiCrowdFundV4Ultra.deploy(usdtAddress, adminReserve.address);
  await v4ultra.waitForDeployment();
  const v4ultraAddress = await v4ultra.getAddress();
  console.log(`✅ OrphiCrowdFundV4Ultra deployed at: ${v4ultraAddress}`);

  console.log("\nDeployment complete!\n");
  console.log(`MockUSDT: ${usdtAddress}`);
  console.log(`OrphiCrowdFundV4Ultra: ${v4ultraAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
