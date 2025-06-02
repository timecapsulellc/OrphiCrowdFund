const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Starting OrphiCrowdFundV2 test deployment and simulation...");
  
  // Deploy test USDT
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUSDT = await MockUSDT.deploy();
  await mockUSDT.waitForDeployment();
  console.log(`MockUSDT deployed to: ${await mockUSDT.getAddress()}`);
  
  // Get signers
  const [deployer, adminReserve, matrixRoot, user1, user2, user3, ...users] = await ethers.getSigners();
  console.log(`Admin reserve address: ${adminReserve.address}`);
  console.log(`Matrix root address: ${matrixRoot.address}`);
  
  // Deploy OrphiCrowdFundV2
  const OrphiCrowdFundV2 = await ethers.getContractFactory("OrphiCrowdFundV2");
  const orphiCrowdFund = await upgrades.deployProxy(
    OrphiCrowdFundV2,
    [await mockUSDT.getAddress(), adminReserve.address, matrixRoot.address],
    { initializer: "initialize" }
  );
  await orphiCrowdFund.waitForDeployment();
  console.log(`OrphiCrowdFundV2 deployed to: ${await orphiCrowdFund.getAddress()}`);
  
  // Fund test users with USDT
  const testAmount = ethers.parseEther("10000");
  console.log("Funding test users with USDT...");
  
  const testUsers = [user1, user2, user3, ...users.slice(0, 20)];
  for (const user of testUsers) {
    await mockUSDT.faucet(user.address, testAmount);
    await mockUSDT.connect(user).approve(await orphiCrowdFund.getAddress(), testAmount);
    console.log(`Funded and approved for ${user.address}`);
  }
  
  // Register users to build a small matrix
  console.log("\nRegistering users to build matrix...");
  
  // Level 1 (root)
  console.log(`Level 1: Matrix Root - ${matrixRoot.address}`);
  
  // Level 2 (direct children of root)
  await orphiCrowdFund.connect(user1).registerUser(matrixRoot.address, 1); // PackageTier.PACKAGE_30
  await orphiCrowdFund.connect(user2).registerUser(matrixRoot.address, 1);
  console.log(`Level 2: ${user1.address}, ${user2.address}`);
  
  // Level 3
  await orphiCrowdFund.connect(user3).registerUser(user1.address, 1);
  await orphiCrowdFund.connect(users[0]).registerUser(user1.address, 1);
  await orphiCrowdFund.connect(users[1]).registerUser(user2.address, 1);
  await orphiCrowdFund.connect(users[2]).registerUser(user2.address, 1);
  console.log(`Level 3: Added 4 more users`);
  
  // Add more users to simulate larger team sizes
  console.log("\nAdding more users to simulate larger teams...");
  
  // Add 10 direct sponsors under user1 to help them qualify for Shining Star
  for (let i = 3; i < 13; i++) {
    await orphiCrowdFund.connect(users[i]).registerUser(user1.address, 1);
  }
  console.log(`Added 10 more direct sponsors under user1`);
  
  // Get user info after registrations
  const user1Info = await orphiCrowdFund.getUserInfoEnhanced(user1.address);
  console.log(`\nUser1 info after registrations:`);
  console.log(`- Direct sponsors: ${user1Info.directSponsorsCount}`);
  console.log(`- Team size: ${user1Info.teamSize}`);
  console.log(`- Leader rank: ${user1Info.leaderRank}`); // 0=None, 1=Shining Star, 2=Silver Star
  
  // Check pool balances
  const poolBalances = await orphiCrowdFund.getPoolBalancesEnhanced();
  console.log(`\nPool balances:`);
  console.log(`- Sponsor Commission: ${ethers.formatEther(poolBalances[0])}`);
  console.log(`- Level Bonus: ${ethers.formatEther(poolBalances[1])}`);
  console.log(`- Global Upline Bonus: ${ethers.formatEther(poolBalances[2])}`);
  console.log(`- Leader Bonus: ${ethers.formatEther(poolBalances[3])}`);
  console.log(`- Global Help Pool: ${ethers.formatEther(poolBalances[4])}`);
  
  // Simulate time passing (for GHP distribution)
  console.log("\nSimulating time passage for GHP distribution...");
  await ethers.provider.send("evm_increaseTime", [7 * 24 * 60 * 60]); // 7 days
  await ethers.provider.send("evm_mine");
  
  // Distribute GHP
  console.log("Distributing Global Help Pool...");
  const ghpTx = await orphiCrowdFund.distributeGlobalHelpPool();
  const ghpReceipt = await ghpTx.wait();
  
  // Find GHP distribution event
  const ghpEvent = ghpReceipt.logs.find(log => 
    log.topics[0] === ethers.id("GlobalHelpPoolDistributed(uint256,uint256,uint256)")
  );
  
  if (ghpEvent) {
    const ghpInterface = new ethers.Interface([
      "event GlobalHelpPoolDistributed(uint256 totalAmount, uint256 participantCount, uint256 timestamp)"
    ]);
    const decodedEvent = ghpInterface.parseLog(ghpEvent);
    console.log(`- GHP distributed: ${ethers.formatEther(decodedEvent.args.totalAmount)} USDT`);
    console.log(`- GHP participants: ${decodedEvent.args.participantCount}`);
  } else {
    console.log("- GHP distribution event not found");
  }
  
  // Check balances after GHP distribution
  const poolBalancesAfterGHP = await orphiCrowdFund.getPoolBalancesEnhanced();
  console.log(`- GHP balance after distribution: ${ethers.formatEther(poolBalancesAfterGHP[4])}`);
  
  // Simulate time passing (for Leader Bonus distribution)
  console.log("\nSimulating time passage for Leader Bonus distribution...");
  await ethers.provider.send("evm_increaseTime", [14 * 24 * 60 * 60]); // 14 days
  await ethers.provider.send("evm_mine");
  
  // Distribute Leader Bonus
  console.log("Distributing Leader Bonus...");
  const leaderTx = await orphiCrowdFund.distributeLeaderBonus();
  const leaderReceipt = await leaderTx.wait();
  
  // Find Leader Bonus distribution event
  const leaderEvent = leaderReceipt.logs.find(log => 
    log.topics[0] === ethers.id("LeaderBonusDistributed(uint256,uint256,uint256,uint256,uint256)")
  );
  
  if (leaderEvent) {
    const leaderInterface = new ethers.Interface([
      "event LeaderBonusDistributed(uint256 shiningStarAmount, uint256 silverStarAmount, uint256 shiningStarCount, uint256 silverStarCount, uint256 timestamp)"
    ]);
    const decodedEvent = leaderInterface.parseLog(leaderEvent);
    console.log(`- Shining Star pool: ${ethers.formatEther(decodedEvent.args.shiningStarAmount)} USDT`);
    console.log(`- Silver Star pool: ${ethers.formatEther(decodedEvent.args.silverStarAmount)} USDT`);
    console.log(`- Shining Star count: ${decodedEvent.args.shiningStarCount}`);
    console.log(`- Silver Star count: ${decodedEvent.args.silverStarCount}`);
  } else {
    console.log("- Leader Bonus distribution event not found");
  }
  
  // Check balances after Leader Bonus distribution
  const poolBalancesAfterLeader = await orphiCrowdFund.getPoolBalancesEnhanced();
  console.log(`- Leader Bonus balance after distribution: ${ethers.formatEther(poolBalancesAfterLeader[3])}`);
  
  console.log("\nSimulation complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
