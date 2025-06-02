const { ethers } = require("hardhat");
const { getUserInfo, getSystemStats, getMatrixTree } = require("./utils");

async function main() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    console.log("Please set CONTRACT_ADDRESS environment variable");
    return;
  }

  const [operator] = await ethers.getSigners();
  console.log("Admin operations with account:", operator.address);
  console.log("Contract address:", contractAddress);

  const OrphiCrowdFund = await ethers.getContractFactory("OrphiCrowdFund");
  const contract = OrphiCrowdFund.attach(contractAddress);

  // Check if caller is owner
  const owner = await contract.owner();
  if (owner.toLowerCase() !== operator.address.toLowerCase()) {
    console.log("Warning: Current account is not the contract owner");
    console.log("Owner:", owner);
    console.log("Current:", operator.address);
  }

  console.log("\n=== System Statistics ===");
  const stats = await getSystemStats(contractAddress);
  console.log(JSON.stringify(stats, null, 2));

  const action = process.argv[2];

  switch (action) {
    case "distribute-ghp":
      console.log("\n=== Distributing Global Help Pool ===");
      try {
        const tx = await contract.distributeGlobalHelpPool();
        await tx.wait();
        console.log("GHP distributed successfully");
        console.log("Transaction hash:", tx.hash);
      } catch (error) {
        console.error("Failed to distribute GHP:", error.message);
      }
      break;

    case "distribute-leader":
      console.log("\n=== Distributing Leader Bonus ===");
      try {
        const tx = await contract.distributeLeaderBonus();
        await tx.wait();
        console.log("Leader bonus distributed successfully");
        console.log("Transaction hash:", tx.hash);
      } catch (error) {
        console.error("Failed to distribute leader bonus:", error.message);
      }
      break;

    case "pause":
      console.log("\n=== Pausing Contract ===");
      try {
        const tx = await contract.pause();
        await tx.wait();
        console.log("Contract paused successfully");
      } catch (error) {
        console.error("Failed to pause contract:", error.message);
      }
      break;

    case "unpause":
      console.log("\n=== Unpausing Contract ===");
      try {
        const tx = await contract.unpause();
        await tx.wait();
        console.log("Contract unpaused successfully");
      } catch (error) {
        console.error("Failed to unpause contract:", error.message);
      }
      break;

    case "set-admin":
      const newAdmin = process.argv[3];
      if (!newAdmin) {
        console.log("Usage: npm run admin set-admin <address>");
        return;
      }
      console.log("\n=== Setting Admin Reserve ===");
      try {
        const tx = await contract.setAdminReserve(newAdmin);
        await tx.wait();
        console.log("Admin reserve updated to:", newAdmin);
      } catch (error) {
        console.error("Failed to set admin reserve:", error.message);
      }
      break;

    case "emergency-withdraw":
      const tokenAddress = process.argv[3];
      const amount = process.argv[4];
      if (!tokenAddress || !amount) {
        console.log("Usage: npm run admin emergency-withdraw <token_address> <amount>");
        return;
      }
      console.log("\n=== Emergency Withdraw ===");
      try {
        const withdrawAmount = ethers.parseEther(amount);
        const tx = await contract.emergencyWithdraw(tokenAddress, withdrawAmount);
        await tx.wait();
        console.log(`Withdrawn ${amount} tokens to admin reserve`);
      } catch (error) {
        console.error("Failed to emergency withdraw:", error.message);
      }
      break;

    case "user-info":
      const userAddress = process.argv[3];
      if (!userAddress) {
        console.log("Usage: npm run admin user-info <address>");
        return;
      }
      console.log("\n=== User Information ===");
      try {
        const info = await getUserInfo(contractAddress, userAddress);
        console.log(JSON.stringify(info, null, 2));
      } catch (error) {
        console.error("Failed to get user info:", error.message);
      }
      break;

    case "matrix-tree":
      const rootAddress = process.argv[3];
      const depth = process.argv[4] || 3;
      if (!rootAddress) {
        console.log("Usage: npm run admin matrix-tree <root_address> [depth]");
        return;
      }
      console.log("\n=== Matrix Tree ===");
      try {
        const tree = await getMatrixTree(contractAddress, rootAddress, parseInt(depth));
        console.log(JSON.stringify(tree, null, 2));
      } catch (error) {
        console.error("Failed to get matrix tree:", error.message);
      }
      break;

    default:
      console.log("\n=== Available Admin Commands ===");
      console.log("npm run admin distribute-ghp       - Distribute Global Help Pool");
      console.log("npm run admin distribute-leader    - Distribute Leader Bonus");
      console.log("npm run admin pause                - Pause contract");
      console.log("npm run admin unpause              - Unpause contract");
      console.log("npm run admin set-admin <address>  - Set admin reserve address");
      console.log("npm run admin emergency-withdraw <token> <amount> - Emergency withdraw");
      console.log("npm run admin user-info <address>  - Get user information");
      console.log("npm run admin matrix-tree <address> [depth] - Get matrix tree");
      break;
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
