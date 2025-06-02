# Frontend Integration Guide

This guide provides examples for integrating the OrphiCrowdFund smart contract with your frontend application.

## Web3 Setup

### Install Dependencies

```bash
npm install ethers @web3-react/core @web3-react/injected-connector
```

### Contract Configuration

```javascript
// config/contract.js
export const CONTRACT_CONFIG = {
  bsc_testnet: {
    chainId: 97,
    name: 'BSC Testnet',
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    contractAddress: 'YOUR_DEPLOYED_CONTRACT_ADDRESS', // Replace after deployment
    usdtAddress: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
    blockExplorer: 'https://testnet.bscscan.com'
  },
  bsc_mainnet: {
    chainId: 56,
    name: 'BSC Mainnet',
    rpcUrl: 'https://bsc-dataseed1.binance.org/',
    contractAddress: 'YOUR_DEPLOYED_CONTRACT_ADDRESS', // Replace after deployment
    usdtAddress: '0x55d398326f99059fF775485246999027B3197955',
    blockExplorer: 'https://bscscan.com'
  }
};

export const PACKAGE_TIERS = {
  NONE: 0,
  PACKAGE_30: 1,
  PACKAGE_50: 2,
  PACKAGE_100: 3,
  PACKAGE_200: 4
};

export const PACKAGE_AMOUNTS = {
  [PACKAGE_TIERS.PACKAGE_30]: '30',
  [PACKAGE_TIERS.PACKAGE_50]: '50',
  [PACKAGE_TIERS.PACKAGE_100]: '100',
  [PACKAGE_TIERS.PACKAGE_200]: '200'
};
```

### Contract ABI

```javascript
// abi/OrphiCrowdFund.json
export const CONTRACT_ABI = [
  "function registerUser(address _sponsor, uint8 _packageTier) external",
  "function withdraw() external",
  "function getUserInfo(address _user) external view returns (address sponsor, uint256 directSponsorsCount, uint256 teamSize, uint8 packageTier, uint256 totalInvested, bool isCapped, uint8 leaderRank, uint256 withdrawableAmount)",
  "function getMatrixInfo(address _user) external view returns (address leftChild, address rightChild, uint256 matrixPosition)",
  "function getTotalEarnings(address _user) external view returns (uint256)",
  "function isRegistered(address _user) external view returns (bool)",
  "function totalMembers() external view returns (uint256)",
  "function totalVolume() external view returns (uint256)",
  "function getPoolBalances() external view returns (uint256[5] memory)",
  "function paymentToken() external view returns (address)",
  "function adminReserve() external view returns (address)",
  "function matrixRoot() external view returns (address)",
  "event UserRegistered(address indexed user, address indexed sponsor, uint8 packageTier, uint256 userId)",
  "event CommissionPaid(address indexed recipient, uint256 amount, uint256 poolType, address indexed from)",
  "event WithdrawalMade(address indexed user, uint256 amount)",
  "event PackageUpgraded(address indexed user, uint8 oldTier, uint8 newTier)"
];

export const USDT_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)"
];
```

## React Hooks

### useContract Hook

```javascript
// hooks/useContract.js
import { useMemo } from 'react';
import { ethers } from 'ethers';
import { useWeb3React } from '@web3-react/core';
import { CONTRACT_CONFIG, CONTRACT_ABI, USDT_ABI } from '../config/contract';

export function useContract() {
  const { library, account, chainId } = useWeb3React();

  const contracts = useMemo(() => {
    if (!library || !chainId) return null;

    const config = chainId === 97 ? CONTRACT_CONFIG.bsc_testnet : CONTRACT_CONFIG.bsc_mainnet;
    const signer = library.getSigner(account);

    return {
      orphiCrowdFund: new ethers.Contract(config.contractAddress, CONTRACT_ABI, signer),
      usdt: new ethers.Contract(config.usdtAddress, USDT_ABI, signer),
      config
    };
  }, [library, account, chainId]);

  return contracts;
}
```

### useUserData Hook

```javascript
// hooks/useUserData.js
import { useState, useEffect } from 'react';
import { useWeb3React } from '@web3-react/core';
import { useContract } from './useContract';

export function useUserData() {
  const { account } = useWeb3React();
  const contracts = useContract();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUserData = async () => {
    if (!contracts || !account) return;

    setLoading(true);
    setError(null);

    try {
      const [userInfo, matrixInfo, totalEarnings, isRegistered, usdtBalance] = await Promise.all([
        contracts.orphiCrowdFund.getUserInfo(account),
        contracts.orphiCrowdFund.getMatrixInfo(account),
        contracts.orphiCrowdFund.getTotalEarnings(account),
        contracts.orphiCrowdFund.isRegistered(account),
        contracts.usdt.balanceOf(account)
      ]);

      setUserData({
        isRegistered,
        sponsor: userInfo.sponsor,
        directSponsorsCount: userInfo.directSponsorsCount.toString(),
        teamSize: userInfo.teamSize.toString(),
        packageTier: userInfo.packageTier,
        totalInvested: ethers.utils.formatEther(userInfo.totalInvested),
        isCapped: userInfo.isCapped,
        leaderRank: userInfo.leaderRank,
        withdrawableAmount: ethers.utils.formatEther(userInfo.withdrawableAmount),
        totalEarnings: ethers.utils.formatEther(totalEarnings),
        matrixInfo: {
          leftChild: matrixInfo.leftChild,
          rightChild: matrixInfo.rightChild,
          matrixPosition: matrixInfo.matrixPosition.toString()
        },
        usdtBalance: ethers.utils.formatEther(usdtBalance)
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [contracts, account]);

  return { userData, loading, error, refetch: fetchUserData };
}
```

## Component Examples

### Registration Component

```javascript
// components/Registration.jsx
import React, { useState } from 'react';
import { ethers } from 'ethers';
import { useContract } from '../hooks/useContract';
import { useUserData } from '../hooks/useUserData';
import { PACKAGE_TIERS, PACKAGE_AMOUNTS } from '../config/contract';

export function Registration() {
  const contracts = useContract();
  const { userData, refetch } = useUserData();
  const [sponsor, setSponsor] = useState('');
  const [packageTier, setPackageTier] = useState(PACKAGE_TIERS.PACKAGE_30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRegister = async () => {
    if (!contracts || !sponsor) return;

    setLoading(true);
    setError(null);

    try {
      // First approve USDT spending
      const packageAmount = ethers.utils.parseEther(PACKAGE_AMOUNTS[packageTier]);
      
      const allowance = await contracts.usdt.allowance(
        await contracts.orphiCrowdFund.signer.getAddress(),
        contracts.config.contractAddress
      );

      if (allowance.lt(packageAmount)) {
        const approveTx = await contracts.usdt.approve(
          contracts.config.contractAddress,
          packageAmount
        );
        await approveTx.wait();
      }

      // Register user
      const registerTx = await contracts.orphiCrowdFund.registerUser(sponsor, packageTier);
      await registerTx.wait();

      await refetch();
      alert('Registration successful!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (userData?.isRegistered) {
    return <div>You are already registered!</div>;
  }

  return (
    <div className="registration-form">
      <h2>Register for OrphiCrowdFund</h2>
      
      <div className="form-group">
        <label>Sponsor Address:</label>
        <input
          type="text"
          value={sponsor}
          onChange={(e) => setSponsor(e.target.value)}
          placeholder="0x..."
        />
      </div>

      <div className="form-group">
        <label>Package Tier:</label>
        <select value={packageTier} onChange={(e) => setPackageTier(parseInt(e.target.value))}>
          <option value={PACKAGE_TIERS.PACKAGE_30}>$30 Package</option>
          <option value={PACKAGE_TIERS.PACKAGE_50}>$50 Package</option>
          <option value={PACKAGE_TIERS.PACKAGE_100}>$100 Package</option>
          <option value={PACKAGE_TIERS.PACKAGE_200}>$200 Package</option>
        </select>
      </div>

      {userData && (
        <div className="balance-info">
          <p>Your USDT Balance: {userData.usdtBalance} USDT</p>
          <p>Required Amount: {PACKAGE_AMOUNTS[packageTier]} USDT</p>
        </div>
      )}

      <button onClick={handleRegister} disabled={loading || !sponsor}>
        {loading ? 'Registering...' : 'Register'}
      </button>

      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

### Dashboard Component

```javascript
// components/Dashboard.jsx
import React from 'react';
import { useUserData } from '../hooks/useUserData';
import { PACKAGE_AMOUNTS } from '../config/contract';

export function Dashboard() {
  const { userData, loading, error } = useUserData();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!userData?.isRegistered) return <div>Please register first</div>;

  const getPackageName = (tier) => {
    return tier ? `$${PACKAGE_AMOUNTS[tier]} Package` : 'None';
  };

  const getLeaderRank = (rank) => {
    switch (parseInt(rank)) {
      case 1: return 'Shining Star';
      case 2: return 'Silver Star';
      default: return 'None';
    }
  };

  return (
    <div className="dashboard">
      <h2>My Dashboard</h2>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Package Information</h3>
          <p>Current Package: {getPackageName(userData.packageTier)}</p>
          <p>Total Invested: ${userData.totalInvested}</p>
          <p>Status: {userData.isCapped ? 'Capped' : 'Active'}</p>
        </div>

        <div className="stat-card">
          <h3>Team Statistics</h3>
          <p>Direct Sponsors: {userData.directSponsorsCount}</p>
          <p>Team Size: {userData.teamSize}</p>
          <p>Leader Rank: {getLeaderRank(userData.leaderRank)}</p>
        </div>

        <div className="stat-card">
          <h3>Earnings</h3>
          <p>Total Earnings: ${userData.totalEarnings}</p>
          <p>Withdrawable: ${userData.withdrawableAmount}</p>
          <p>USDT Balance: {userData.usdtBalance} USDT</p>
        </div>

        <div className="stat-card">
          <h3>Matrix Position</h3>
          <p>Position: {userData.matrixInfo.matrixPosition}</p>
          <p>Left Child: {userData.matrixInfo.leftChild !== '0x0000000000000000000000000000000000000000' ? 'Occupied' : 'Empty'}</p>
          <p>Right Child: {userData.matrixInfo.rightChild !== '0x0000000000000000000000000000000000000000' ? 'Occupied' : 'Empty'}</p>
        </div>
      </div>
    </div>
  );
}
```

### Withdrawal Component

```javascript
// components/Withdrawal.jsx
import React, { useState } from 'react';
import { useContract } from '../hooks/useContract';
import { useUserData } from '../hooks/useUserData';

export function Withdrawal() {
  const contracts = useContract();
  const { userData, refetch } = useUserData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getWithdrawalRate = (directCount) => {
    if (directCount >= 20) return 80;
    if (directCount >= 5) return 75;
    return 70;
  };

  const handleWithdraw = async () => {
    if (!contracts || !userData?.withdrawableAmount || userData.withdrawableAmount === '0.0') return;

    setLoading(true);
    setError(null);

    try {
      const withdrawTx = await contracts.orphiCrowdFund.withdraw();
      await withdrawTx.wait();
      
      await refetch();
      alert('Withdrawal successful!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!userData?.isRegistered) {
    return <div>Please register first</div>;
  }

  const withdrawalRate = getWithdrawalRate(parseInt(userData.directSponsorsCount));
  const withdrawAmount = (parseFloat(userData.withdrawableAmount) * withdrawalRate / 100).toFixed(2);
  const reinvestAmount = (parseFloat(userData.withdrawableAmount) * (100 - withdrawalRate) / 100).toFixed(2);

  return (
    <div className="withdrawal">
      <h2>Withdraw Earnings</h2>
      
      <div className="withdrawal-info">
        <p>Available for Withdrawal: ${userData.withdrawableAmount}</p>
        <p>Your Direct Sponsors: {userData.directSponsorsCount}</p>
        <p>Withdrawal Rate: {withdrawalRate}%</p>
        
        <div className="breakdown">
          <p>You will receive: ${withdrawAmount} USDT</p>
          <p>Auto-reinvested: ${reinvestAmount}</p>
        </div>
      </div>

      <button 
        onClick={handleWithdraw} 
        disabled={loading || !userData.withdrawableAmount || userData.withdrawableAmount === '0.0'}
      >
        {loading ? 'Processing...' : 'Withdraw'}
      </button>

      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

### Matrix Tree Visualization

```javascript
// components/MatrixTree.jsx
import React, { useState, useEffect } from 'react';
import { useContract } from '../hooks/useContract';

export function MatrixTree({ rootAddress, maxDepth = 3 }) {
  const contracts = useContract();
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);

  const buildTree = async (address, depth = 0) => {
    if (depth > maxDepth || address === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    try {
      const [userInfo, matrixInfo] = await Promise.all([
        contracts.orphiCrowdFund.getUserInfo(address),
        contracts.orphiCrowdFund.getMatrixInfo(address)
      ]);

      const node = {
        address,
        packageTier: userInfo.packageTier.toString(),
        teamSize: userInfo.teamSize.toString(),
        directCount: userInfo.directSponsorsCount.toString(),
        leftChild: null,
        rightChild: null
      };

      if (depth < maxDepth) {
        node.leftChild = await buildTree(matrixInfo.leftChild, depth + 1);
        node.rightChild = await buildTree(matrixInfo.rightChild, depth + 1);
      }

      return node;
    } catch (error) {
      console.error('Error building tree node:', error);
      return null;
    }
  };

  const fetchTree = async () => {
    if (!contracts || !rootAddress) return;

    setLoading(true);
    try {
      const treeData = await buildTree(rootAddress);
      setTree(treeData);
    } catch (error) {
      console.error('Error fetching tree:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, [contracts, rootAddress]);

  const renderNode = (node, depth = 0) => {
    if (!node) return <div className="empty-node">Empty</div>;

    return (
      <div className={`tree-node depth-${depth}`}>
        <div className="node-info">
          <div className="address">{node.address.slice(0, 6)}...{node.address.slice(-4)}</div>
          <div className="package">Pkg: {node.packageTier}</div>
          <div className="team">Team: {node.teamSize}</div>
        </div>
        
        {(node.leftChild || node.rightChild) && (
          <div className="children">
            <div className="child-left">
              {renderNode(node.leftChild, depth + 1)}
            </div>
            <div className="child-right">
              {renderNode(node.rightChild, depth + 1)}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div>Loading matrix tree...</div>;

  return (
    <div className="matrix-tree">
      <h3>Matrix Tree</h3>
      {tree ? renderNode(tree) : <div>No data available</div>}
    </div>
  );
}
```

## Event Listening

### Real-time Updates

```javascript
// hooks/useEvents.js
import { useEffect } from 'react';
import { useContract } from './useContract';

export function useEvents(onUserRegistered, onCommissionPaid, onWithdrawal) {
  const contracts = useContract();

  useEffect(() => {
    if (!contracts) return;

    const contract = contracts.orphiCrowdFund;

    // Listen for user registrations
    const onRegistered = (user, sponsor, packageTier, userId) => {
      onUserRegistered?.({
        user,
        sponsor,
        packageTier: packageTier.toString(),
        userId: userId.toString()
      });
    };

    // Listen for commission payments
    const onCommission = (recipient, amount, poolType, from) => {
      onCommissionPaid?.({
        recipient,
        amount: ethers.utils.formatEther(amount),
        poolType: poolType.toString(),
        from
      });
    };

    // Listen for withdrawals
    const onWithdrawalMade = (user, amount) => {
      onWithdrawal?.({
        user,
        amount: ethers.utils.formatEther(amount)
      });
    };

    // Attach listeners
    contract.on('UserRegistered', onRegistered);
    contract.on('CommissionPaid', onCommission);
    contract.on('WithdrawalMade', onWithdrawalMade);

    // Cleanup
    return () => {
      contract.off('UserRegistered', onRegistered);
      contract.off('CommissionPaid', onCommission);
      contract.off('WithdrawalMade', onWithdrawalMade);
    };
  }, [contracts, onUserRegistered, onCommissionPaid, onWithdrawal]);
}
```

## Styling

### CSS Styles

```css
/* styles/components.css */
.registration-form {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.dashboard {
  padding: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.stat-card {
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.stat-card h3 {
  margin-bottom: 15px;
  color: #495057;
}

.stat-card p {
  margin-bottom: 8px;
  color: #6c757d;
}

.matrix-tree {
  padding: 20px;
}

.tree-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 10px;
}

.node-info {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 10px;
  border-radius: 8px;
  text-align: center;
  min-width: 120px;
}

.children {
  display: flex;
  margin-top: 20px;
}

.child-left,
.child-right {
  margin: 0 20px;
}

.empty-node {
  background: #f8f9fa;
  border: 2px dashed #dee2e6;
  padding: 10px;
  border-radius: 8px;
  color: #6c757d;
  text-align: center;
  min-width: 80px;
}

.error {
  color: #dc3545;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  padding: 10px;
  border-radius: 4px;
  margin-top: 10px;
}

.balance-info {
  background: #e7f3ff;
  padding: 10px;
  border-radius: 4px;
  margin: 10px 0;
}

.withdrawal-info {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.breakdown {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #dee2e6;
}
```

This frontend integration guide provides a complete foundation for building a React-based dashboard for the OrphiCrowdFund system. The examples include wallet connection, contract interaction, real-time event listening, and a responsive UI for all major functions.
