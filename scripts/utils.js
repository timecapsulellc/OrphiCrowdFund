const { ethers } = require("hardhat");

/**
 * Utility functions for interacting with OrphiCrowdFund contract
 */

async function getContractInstance(address) {
  const OrphiCrowdFund = await ethers.getContractFactory("OrphiCrowdFund");
  return OrphiCrowdFund.attach(address);
}

async function getUserInfo(contractAddress, userAddress) {
  const contract = await getContractInstance(contractAddress);
  
  const userInfo = await contract.getUserInfo(userAddress);
  const matrixInfo = await contract.getMatrixInfo(userAddress);
  const totalEarnings = await contract.getTotalEarnings(userAddress);
  const isRegistered = await contract.isRegistered(userAddress);
  
  return {
    isRegistered,
    sponsor: userInfo.sponsor,
    directSponsorsCount: userInfo.directSponsorsCount.toString(),
    teamSize: userInfo.teamSize.toString(),
    packageTier: userInfo.packageTier.toString(),
    totalInvested: ethers.formatEther(userInfo.totalInvested),
    isCapped: userInfo.isCapped,
    leaderRank: userInfo.leaderRank.toString(),
    withdrawableAmount: ethers.formatEther(userInfo.withdrawableAmount),
    totalEarnings: ethers.formatEther(totalEarnings),
    matrixInfo: {
      leftChild: matrixInfo.leftChild,
      rightChild: matrixInfo.rightChild,
      matrixPosition: matrixInfo.matrixPosition.toString()
    }
  };
}

async function getSystemStats(contractAddress) {
  const contract = await getContractInstance(contractAddress);
  
  const totalMembers = await contract.totalMembers();
  const totalVolume = await contract.totalVolume();
  const poolBalances = await contract.getPoolBalances();
  
  return {
    totalMembers: totalMembers.toString(),
    totalVolume: ethers.formatEther(totalVolume),
    poolBalances: {
      sponsorCommission: ethers.formatEther(poolBalances[0]),
      levelBonus: ethers.formatEther(poolBalances[1]),
      globalUplineBonus: ethers.formatEther(poolBalances[2]),
      leaderBonusPool: ethers.formatEther(poolBalances[3]),
      globalHelpPool: ethers.formatEther(poolBalances[4])
    }
  };
}

async function getMatrixTree(contractAddress, rootAddress, maxDepth = 5) {
  const contract = await getContractInstance(contractAddress);
  
  async function buildTree(address, depth) {
    if (depth > maxDepth || address === ethers.ZeroAddress) {
      return null;
    }
    
    const matrixInfo = await contract.getMatrixInfo(address);
    const userInfo = await contract.getUserInfo(address);
    
    return {
      address,
      packageTier: userInfo.packageTier.toString(),
      teamSize: userInfo.teamSize.toString(),
      directCount: userInfo.directSponsorsCount.toString(),
      leftChild: await buildTree(matrixInfo.leftChild, depth + 1),
      rightChild: await buildTree(matrixInfo.rightChild, depth + 1)
    };
  }
  
  return await buildTree(rootAddress, 0);
}

async function simulateEarnings(contractAddress, userAddress, newJoinsUnderUser) {
  const contract = await getContractInstance(contractAddress);
  const userInfo = await contract.getUserInfo(userAddress);
  
  // Calculate potential earnings from new joins
  const sponsorCommission = ethers.parseEther("30") * 4000n / 10000n; // 40% of $30
  const levelBonus = ethers.parseEther("30") * 300n / 10000n; // 3% for Level 1
  const uplineBonus = ethers.parseEther("30") / 30n; // Equal split among 30
  
  const potentialEarnings = {
    fromDirectJoins: ethers.formatEther(sponsorCommission * BigInt(newJoinsUnderUser)),
    fromTeamJoins: ethers.formatEther((levelBonus + uplineBonus) * BigInt(newJoinsUnderUser * 2)), // Estimate
    currentWithdrawable: ethers.formatEther(userInfo.withdrawableAmount)
  };
  
  return potentialEarnings;
}

module.exports = {
  getContractInstance,
  getUserInfo,
  getSystemStats,
  getMatrixTree,
  simulateEarnings
};
