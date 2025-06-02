const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Upgrading contracts with account:", deployer.address);

  // Get the current proxy address (you'll need to set this)
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS;
  
  if (!PROXY_ADDRESS) {
    throw new Error("Please set PROXY_ADDRESS environment variable");
  }

  console.log("Upgrading OrphiCrowdFund at:", PROXY_ADDRESS);

  const OrphiCrowdFundV2 = await ethers.getContractFactory("OrphiCrowdFund");
  
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, OrphiCrowdFundV2);
  await upgraded.waitForDeployment();

  const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  
  console.log("OrphiCrowdFund upgraded successfully");
  console.log("Proxy address:", PROXY_ADDRESS);
  console.log("New implementation address:", newImplementationAddress);

  // Verify the upgrade worked
  const totalMembers = await upgraded.totalMembers();
  console.log("Total members after upgrade:", totalMembers.toString());

  return {
    proxy: PROXY_ADDRESS,
    implementation: newImplementationAddress
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
