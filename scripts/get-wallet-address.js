const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.error("Private key not found in environment variables");
    process.exit(1);
  }
  
  // Create wallet from private key
  const wallet = new ethers.Wallet(privateKey);
  
  console.log("=== WALLET INFORMATION ===");
  console.log("Address:", wallet.address);
  console.log("Private Key:", privateKey);
  console.log("\nThis address will be used for:");
  console.log("- Contract deployment");
  console.log("- Admin reserve (if not specified)");
  console.log("- Matrix root (if not specified)");
  
  return wallet.address;
}

main()
  .then((address) => {
    console.log("\n✅ Wallet address derived successfully:", address);
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
