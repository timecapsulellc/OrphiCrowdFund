const { ethers, upgrades } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("Starting deployment of Orphi CrowdFund system...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId.toString());

  // Configuration based on network
  let usdtAddress;
  let adminReserve;
  let matrixRoot;

  if (network.chainId === 97n) { // BSC Testnet
    usdtAddress = process.env.USDT_TESTNET || "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";
    adminReserve = process.env.ADMIN_RESERVE || deployer.address;
    matrixRoot = process.env.MATRIX_ROOT || deployer.address;
    console.log("Deploying to BSC Testnet");
  } else if (network.chainId === 56n) { // BSC Mainnet
    usdtAddress = process.env.USDT_MAINNET || "0x55d398326f99059fF775485246999027B3197955";
    adminReserve = process.env.ADMIN_RESERVE;
    matrixRoot = process.env.MATRIX_ROOT;
    
    if (!adminReserve || !matrixRoot) {
      throw new Error("ADMIN_RESERVE and MATRIX_ROOT must be set for mainnet deployment");
    }
    console.log("Deploying to BSC Mainnet");
  } else if (network.chainId === 1337n) { // Local/Hardhat
    // Deploy mock USDT for local testing
    console.log("Deploying Mock USDT for local testing...");
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();
    usdtAddress = await mockUSDT.getAddress();
    console.log("Mock USDT deployed to:", usdtAddress);
    
    adminReserve = deployer.address;
    matrixRoot = deployer.address;
  } else {
    throw new Error("Unsupported network");
  }

  console.log("Configuration:");
  console.log("- USDT Address:", usdtAddress);
  console.log("- Admin Reserve:", adminReserve);
  console.log("- Matrix Root:", matrixRoot);

  // Deploy the main contract
  console.log("\nDeploying OrphiCrowdFund...");
  const OrphiCrowdFund = await ethers.getContractFactory("OrphiCrowdFund");
  const orphiCrowdFund = await upgrades.deployProxy(
    OrphiCrowdFund,
    [usdtAddress, adminReserve, matrixRoot],
    { initializer: "initialize" }
  );
  await orphiCrowdFund.waitForDeployment();
  const contractAddress = await orphiCrowdFund.getAddress();
  
  console.log("OrphiCrowdFund deployed to:", contractAddress);
  
  // Output summary
  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log("Network:", network.name, "Chain ID:", network.chainId.toString());
  console.log("OrphiCrowdFund:", contractAddress);
  console.log("USDT:", usdtAddress);
  console.log("Admin Reserve:", adminReserve);
  console.log("Matrix Root:", matrixRoot);
  console.log("Deployer:", deployer.address);
  
  // Security reminder
  console.log("\n⚠️ IMPORTANT: Keep your deployment information secure and never share private keys.");
  console.log("For verification, use 'npx hardhat verify --network [network] [contract-address]'");
  
  return {
    contractAddress,
    usdtAddress,
    adminReserve,
    matrixRoot,
    deployer: deployer.address
  };
}
  console.log("- Matrix Root:", matrixRoot);

  // Deploy OrphiCrowdFund using upgrades proxy
  console.log("\nDeploying OrphiCrowdFund...");
  const OrphiCrowdFund = await ethers.getContractFactory("OrphiCrowdFund");
  
  const orphiCrowdFund = await upgrades.deployProxy(
    OrphiCrowdFund,
    [usdtAddress, adminReserve, matrixRoot],
    {
      initializer: "initialize",
      kind: "uups"
    }
  );
  
  await orphiCrowdFund.waitForDeployment();
  const orphiAddress = await orphiCrowdFund.getAddress();
  
  console.log("OrphiCrowdFund proxy deployed to:", orphiAddress);

  // Get implementation address for verification
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(orphiAddress);
  console.log("Implementation address:", implementationAddress);

  // Verify initial state
  console.log("\nVerifying deployment...");
  const totalMembers = await orphiCrowdFund.totalMembers();
  const isRootRegistered = await orphiCrowdFund.isRegistered(matrixRoot);
  const paymentTokenAddress = await orphiCrowdFund.paymentToken();
  
  console.log("- Total members:", totalMembers.toString());
  console.log("- Matrix root registered:", isRootRegistered);
  console.log("- Payment token:", paymentTokenAddress);
  console.log("- Admin reserve:", await orphiCrowdFund.adminReserve());

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    orphiCrowdFund: orphiAddress,
    implementation: implementationAddress,
    paymentToken: usdtAddress,
    adminReserve: adminReserve,
    matrixRoot: matrixRoot,
    deployer: deployer.address,
    timestamp: new Date().toISOString()
  };

  console.log("\n=== Deployment Summary ===");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const fs = require('fs');
  const path = require('path');
  
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  
  const filename = `deployment-${network.name}-${Date.now()}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log(`\nDeployment info saved to: deployments/${filename}`);

  // Instructions for next steps
  console.log("\n=== Next Steps ===");
  console.log("1. Verify the contract on BSCScan:");
  console.log(`   npx hardhat verify --network ${network.name} ${implementationAddress}`);
  console.log("\n2. Set up frontend with contract address:", orphiAddress);
  console.log("\n3. Configure admin operations:");
  console.log("   - Set up automated GHP distributions (weekly)");
  console.log("   - Set up automated Leader Bonus distributions (bi-monthly)");
  console.log("   - Monitor pool balances and system health");

  return {
    orphiCrowdFund: orphiAddress,
    implementation: implementationAddress,
    paymentToken: usdtAddress
  };
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = main;
