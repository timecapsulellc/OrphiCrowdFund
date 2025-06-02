const { ethers } = require("hardhat");

async function main() {
  const deployments = require("../deployments");
  
  // Get the latest deployment
  const network = await ethers.provider.getNetwork();
  const networkName = network.name;
  
  // You would typically load this from your deployment files
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const implementationAddress = process.env.IMPLEMENTATION_ADDRESS;
  
  if (!contractAddress || !implementationAddress) {
    console.log("Please set CONTRACT_ADDRESS and IMPLEMENTATION_ADDRESS environment variables");
    console.log("Or run: npx hardhat verify --network <network> <implementation_address>");
    return;
  }

  console.log("Verifying contract on", networkName);
  console.log("Implementation address:", implementationAddress);

  try {
    await hre.run("verify:verify", {
      address: implementationAddress,
      constructorArguments: [],
    });
    
    console.log("Contract verified successfully!");
  } catch (error) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("Contract is already verified!");
    } else {
      console.error("Verification failed:", error.message);
    }
  }
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
