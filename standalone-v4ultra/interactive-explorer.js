// Interactive script to verify V4Ultra features on BSC Testnet
const { ethers } = require("hardhat");
require("dotenv").config();
const readline = require("readline");

// To be populated after deployment
let MOCKUSDT_ADDRESS = process.env.MOCKUSDT_ADDRESS || "";
let V4ULTRA_ADDRESS = process.env.V4ULTRA_ADDRESS || "";

// Create readline interface for interactive testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Format amounts with proper decimals
function formatAmount(amount, decimals = 6) {
  return ethers.formatUnits(amount, decimals);
}

// Display a menu and get user choice
function displayMenu() {
  console.log("\n🔍 V4ULTRA INTERACTIVE TESTNET EXPLORER");
  console.log("======================================");
  console.log("1. View Contract Information");
  console.log("2. Test KYC Functions");
  console.log("3. Register Test User");
  console.log("4. Test Club Pool Functions");
  console.log("5. Test Chainlink Automation");
  console.log("6. View Pool Balances");
  console.log("7. Test Emergency Functions");
  console.log("8. View User Information");
  console.log("0. Exit");
  
  rl.question("\nSelect an option (0-8): ", (choice) => handleChoice(choice));
}

// Handle user's menu choice
async function handleChoice(choice) {
  try {
    // Connect to contracts first
    const mockUSDT = await ethers.getContractAt("MockUSDT", MOCKUSDT_ADDRESS);
    const v4Ultra = await ethers.getContractAt("OrphiCrowdFundV4Ultra", V4ULTRA_ADDRESS);
    const [deployer] = await ethers.getSigners();
    
    switch(choice) {
      case "1": // View Contract Information
        console.log("\n📄 CONTRACT INFORMATION");
        console.log("----------------------");
        console.log(`MockUSDT Address: ${MOCKUSDT_ADDRESS}`);
        console.log(`V4Ultra Address: ${V4ULTRA_ADDRESS}`);
        
        const [totalUsers, totalVolume, automationOn] = await v4Ultra.getGlobalStats();
        console.log(`\nTotal Users: ${totalUsers}`);
        console.log(`Total Volume: ${formatAmount(totalVolume)} USDT`);
        console.log(`Automation Enabled: ${automationOn}`);
        
        rl.question("\nPress Enter to continue...", () => displayMenu());
        break;
        
      case "2": // Test KYC Functions
        console.log("\n🔑 KYC FUNCTIONS");
        console.log("--------------");
        rl.question("Enter wallet address to verify: ", async (address) => {
          try {
            await v4Ultra.setKYCStatus(address, true);
            console.log(`✅ KYC verified for ${address}`);
          } catch (error) {
            console.log(`❌ Error: ${error.message}`);
          }
          rl.question("\nPress Enter to continue...", () => displayMenu());
        });
        break;
        
      case "3": // Register Test User
        console.log("\n📝 REGISTER TEST USER");
        console.log("-------------------");
        rl.question("Enter wallet address to register: ", async (address) => {
          try {
            const balance = await mockUSDT.balanceOf(address);
            console.log(`Current balance: ${formatAmount(balance)} USDT`);
            
            rl.question("Enter tier (1-5): ", async (tier) => {
              const tierNum = parseInt(tier);
              if (tierNum < 1 || tierNum > 5) {
                console.log("❌ Invalid tier. Must be between 1-5.");
                rl.question("\nPress Enter to continue...", () => displayMenu());
                return;
              }
              
              console.log(`\nTo register a tier ${tierNum} user, you need to:`);
              console.log("1. Mint USDT to the user");
              console.log("2. Approve USDT for the V4Ultra contract");
              console.log("3. Call register function from user's wallet\n");
              
              rl.question("Proceed with registration preparation? (y/n): ", async (confirm) => {
                if (confirm.toLowerCase() === 'y') {
                  // Get package amount
                  const packages = [100e6, 200e6, 500e6, 1000e6, 2000e6];
                  const amount = packages[tierNum - 1];
                  
                  try {
                    console.log(`Minting ${formatAmount(BigInt(amount))} USDT to ${address}...`);
                    await mockUSDT.mint(address, amount);
                    console.log("✅ Tokens minted successfully");
                    
                    console.log(`\nNext steps to complete registration:`);
                    console.log(`1. From address ${address}, call mockUSDT.approve("${V4ULTRA_ADDRESS}", ${amount})`);
                    console.log(`2. From address ${address}, call v4Ultra.register("${deployer.address}", ${tierNum})`);
                  } catch (error) {
                    console.log(`❌ Error: ${error.message}`);
                  }
                }
                rl.question("\nPress Enter to continue...", () => displayMenu());
              });
            });
          } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            rl.question("\nPress Enter to continue...", () => displayMenu());
          }
        });
        break;
        
      case "4": // Test Club Pool Functions
        console.log("\n🎯 CLUB POOL FUNCTIONS");
        console.log("-------------------");
        console.log("1. Create Club Pool");
        console.log("2. Add Member to Club Pool");
        console.log("3. View Club Pool Information");
        
        rl.question("\nSelect Club Pool option (1-3): ", async (subChoice) => {
          try {
            switch(subChoice) {
              case "1":
                await v4Ultra.createClubPool(7 * 24 * 60 * 60);
                console.log("✅ Club Pool created with 7-day distribution interval");
                break;
              case "2":
                rl.question("Enter member address: ", async (member) => {
                  try {
                    await v4Ultra.addToClubPool();
                    console.log(`✅ ${member} added to Club Pool`);
                  } catch (error) {
                    console.log(`❌ Error: ${error.message}`);
                  }
                  rl.question("\nPress Enter to continue...", () => displayMenu());
                });
                return; // Don't call the outer question yet
              case "3":
                console.log("Club Pool information is available through contract events");
                break;
              default:
                console.log("Invalid option");
            }
          } catch (error) {
            console.log(`❌ Error: ${error.message}`);
          }
          rl.question("\nPress Enter to continue...", () => displayMenu());
        });
        break;
        
      case "5": // Test Chainlink Automation
        console.log("\n⚙️ CHAINLINK AUTOMATION");
        console.log("---------------------");
        console.log("1. Enable/Disable Automation");
        console.log("2. Update Automation Config");
        console.log("3. Check Upkeep Status");
        
        rl.question("\nSelect Automation option (1-3): ", async (subChoice) => {
          try {
            switch(subChoice) {
              case "1":
                rl.question("Enable automation? (true/false): ", async (enable) => {
                  const enableBool = enable.toLowerCase() === "true";
                  await v4Ultra.enableAutomation(enableBool);
                  console.log(`✅ Automation ${enableBool ? "enabled" : "disabled"}`);
                  rl.question("\nPress Enter to continue...", () => displayMenu());
                });
                return;
              case "2":
                rl.question("Enter gas limit: ", async (gasLimit) => {
                  rl.question("Enter batch size: ", async (batchSize) => {
                    await v4Ultra.updateAutomationConfig(parseInt(gasLimit), parseInt(batchSize));
                    console.log(`✅ Automation config updated: Gas limit=${gasLimit}, Batch size=${batchSize}`);
                    rl.question("\nPress Enter to continue...", () => displayMenu());
                  });
                });
                return;
              case "3":
                const [upkeepNeeded, performData] = await v4Ultra.checkUpkeep("0x");
                console.log(`Upkeep needed: ${upkeepNeeded}`);
                break;
              default:
                console.log("Invalid option");
            }
          } catch (error) {
            console.log(`❌ Error: ${error.message}`);
          }
          rl.question("\nPress Enter to continue...", () => displayMenu());
        });
        break;
        
      case "6": // View Pool Balances
        console.log("\n💰 POOL BALANCES");
        console.log("--------------");
        try {
          const balances = await v4Ultra.getPoolBalances();
          console.log(`Sponsor Pool: ${formatAmount(balances[0])} USDT`);
          console.log(`Level Pool: ${formatAmount(balances[1])} USDT`);
          console.log(`Upline Pool: ${formatAmount(balances[2])} USDT`);
          console.log(`Leader Pool: ${formatAmount(balances[3])} USDT`);
          console.log(`GHP: ${formatAmount(balances[4])} USDT`);
        } catch (error) {
          console.log(`❌ Error: ${error.message}`);
        }
        rl.question("\nPress Enter to continue...", () => displayMenu());
        break;
        
      case "7": // Test Emergency Functions
        console.log("\n🚨 EMERGENCY FUNCTIONS");
        console.log("-------------------");
        console.log("1. Activate Emergency Mode");
        console.log("2. Deactivate Emergency Mode");
        console.log("3. Set Withdrawal Limit");
        console.log("4. Emergency Withdraw");
        
        rl.question("\nSelect Emergency option (1-4): ", async (subChoice) => {
          try {
            switch(subChoice) {
              case "1":
                rl.question("Enter fee percentage (0-1000): ", async (fee) => {
                  await v4Ultra.activateEmergencyMode(parseInt(fee));
                  console.log(`✅ Emergency mode activated with ${fee/100}% fee`);
                  rl.question("\nPress Enter to continue...", () => displayMenu());
                });
                return;
              case "2":
                await v4Ultra.deactivateEmergencyMode();
                console.log("✅ Emergency mode deactivated");
                break;
              case "3":
                rl.question("Enter daily withdrawal limit (USDT): ", async (limit) => {
                  const limitAmount = ethers.parseUnits(limit, 6);
                  await v4Ultra.setWithdrawalLimit(limitAmount);
                  console.log(`✅ Withdrawal limit set to ${limit} USDT`);
                  rl.question("\nPress Enter to continue...", () => displayMenu());
                });
                return;
              case "4":
                rl.question("Enter amount to withdraw (USDT): ", async (amount) => {
                  const withdrawAmount = ethers.parseUnits(amount, 6);
                  await v4Ultra.emergencyWithdraw(withdrawAmount);
                  console.log(`✅ Emergency withdrawal of ${amount} USDT completed`);
                  rl.question("\nPress Enter to continue...", () => displayMenu());
                });
                return;
              default:
                console.log("Invalid option");
            }
          } catch (error) {
            console.log(`❌ Error: ${error.message}`);
          }
          rl.question("\nPress Enter to continue...", () => displayMenu());
        });
        break;
        
      case "8": // View User Information
        console.log("\n👤 USER INFORMATION");
        console.log("----------------");
        rl.question("Enter user address: ", async (address) => {
          try {
            const userInfo = await v4Ultra.getUserInfo(address);
            console.log(`ID: ${userInfo.id}`);
            console.log(`Team Size: ${userInfo.teamSize}`);
            console.log(`Direct Count: ${userInfo.directCount}`);
            console.log(`Package Tier: ${userInfo.packageTier}`);
            console.log(`Matrix Position: ${userInfo.matrixPos}`);
            console.log(`Total Earnings: ${formatAmount(userInfo.totalEarnings)} USDT`);
            console.log(`Withdrawable: ${formatAmount(userInfo.withdrawable)} USDT`);
            console.log(`Sponsor ID: ${userInfo.sponsor}`);
            console.log(`Is Capped: ${userInfo.isCapped}`);
            console.log(`Leader Rank: ${userInfo.leaderRank} (0=None, 1=Shining, 2=Silver)`);
          } catch (error) {
            console.log(`❌ Error: ${error.message}`);
          }
          rl.question("\nPress Enter to continue...", () => displayMenu());
        });
        break;
        
      case "0": // Exit
        console.log("\n👋 Exiting V4Ultra Testnet Explorer");
        rl.close();
        process.exit(0);
        break;
        
      default:
        console.log("\n❌ Invalid option. Please try again.");
        rl.question("\nPress Enter to continue...", () => displayMenu());
    }
  } catch (error) {
    console.error("\n❌ Error connecting to contracts:", error.message);
    console.log("\nPlease ensure:");
    console.log("1. Contracts are deployed correctly");
    console.log("2. Contract addresses are set correctly");
    console.log(`3. You're connected to BSC Testnet`);
    
    rl.question("\nWould you like to update contract addresses? (y/n): ", (answer) => {
      if (answer.toLowerCase() === 'y') {
        rl.question("Enter MockUSDT address: ", (mockAddr) => {
          MOCKUSDT_ADDRESS = mockAddr;
          rl.question("Enter V4Ultra address: ", (v4Addr) => {
            V4ULTRA_ADDRESS = v4Addr;
            console.log("\n✅ Addresses updated");
            rl.question("\nPress Enter to continue...", () => displayMenu());
          });
        });
      } else {
        rl.question("\nPress Enter to continue...", () => displayMenu());
      }
    });
  }
}

// Main function
async function main() {
  console.log("\n🚀 V4ULTRA TESTNET EXPLORER");
  console.log("==========================");
  
  if (!MOCKUSDT_ADDRESS || !V4ULTRA_ADDRESS) {
    console.log("\n⚠️ Contract addresses not set");
    rl.question("Enter MockUSDT address: ", (mockAddr) => {
      MOCKUSDT_ADDRESS = mockAddr;
      rl.question("Enter V4Ultra address: ", (v4Addr) => {
        V4ULTRA_ADDRESS = v4Addr;
        console.log("\n✅ Addresses set");
        displayMenu();
      });
    });
  } else {
    console.log(`MockUSDT: ${MOCKUSDT_ADDRESS}`);
    console.log(`V4Ultra: ${V4ULTRA_ADDRESS}`);
    displayMenu();
  }
}

// Run the interactive explorer
main().catch((error) => {
  console.error("Critical error:", error);
  rl.close();
  process.exit(1);
});
