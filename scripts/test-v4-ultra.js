// Script to verify V4Ultra contract size and functionality
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying V4Ultra contract to measure size...");
  
  // Deploy mock token first
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUSDT = await MockUSDT.deploy();
  await mockUSDT.deployTransaction.wait();
  console.log(`Mock USDT deployed at: ${mockUSDT.address}`);
  
  // Deploy V4Ultra contract
  const [deployer] = await ethers.getSigners();
  const V4Ultra = await ethers.getContractFactory("OrphiCrowdFundV4Ultra");
  const v4Ultra = await V4Ultra.deploy(mockUSDT.address, deployer.address);
  await v4Ultra.deployTransaction.wait();
  console.log(`OrphiCrowdFundV4Ultra deployed at: ${v4Ultra.address}`);
  
  // Get contract bytecode
  const bytecode = await ethers.provider.getCode(v4Ultra.address);
  const bytecodeSize = (bytecode.length - 2) / 2; // subtract '0x' and convert to bytes
  console.log(`Contract bytecode size: ${bytecodeSize} bytes`);
  
  // Check if it fits within 24KB limit
  const sizeInKB = bytecodeSize / 1024;
  console.log(`Size in KB: ${sizeInKB.toFixed(2)} KB`);
  
  if (bytecodeSize <= 24 * 1024) {
    console.log("✅ SUCCESS: Contract size is within the 24KB limit!");
  } else {
    console.log(`❌ FAIL: Contract exceeds 24KB limit by ${(bytecodeSize - 24 * 1024)} bytes`);
  }
  
  // Write size report to file
  const report = `
# V4Ultra Contract Size Report
- **Date**: ${new Date().toISOString()}
- **Contract**: OrphiCrowdFundV4Ultra
- **Bytecode Size**: ${bytecodeSize} bytes (${sizeInKB.toFixed(2)} KB)
- **Status**: ${bytecodeSize <= 24 * 1024 ? '✅ Within 24KB limit' : '❌ Exceeds 24KB limit'}

## Additional Information
- Deployment address: ${v4Ultra.address}
- Mock token address: ${mockUSDT.address}
- Network: ${network.name}
- Gas used for deployment: ${v4Ultra.deployTransaction.gasLimit.toString()}
`;

  fs.writeFileSync(
    path.join(__dirname, "../V4Ultra_Size_Report.md"),
    report
  );
  
  console.log("Size report written to V4Ultra_Size_Report.md");
  
  // Basic functionality test
  console.log("\nTesting basic functionality...");
  
  // Enable automation
  await v4Ultra.enableAutomation(true);
  console.log("Automation enabled");
  
  // Update automation config
  await v4Ultra.updateAutomationConfig(3000000, 100);
  console.log("Automation config updated");
  
  // Create club pool
  await v4Ultra.createClubPool(7 * 24 * 60 * 60); // 7 days
  console.log("Club pool created");
  
  console.log("All tests passed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
