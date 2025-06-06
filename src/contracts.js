// BSC Testnet Contract Configuration
export const CONTRACTS = {
  BSC_TESTNET: {
    chainId: 97,
    rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    blockExplorer: 'https://testnet.bscscan.com',
    contracts: {
      OrphiCrowdFundV4UltraSecure: {
        address: '0xFb586f2aF3ce424134C2F7F959cfF5db7eC083EC',
        deployedBlock: null // Add block number if needed for event filtering
      },
      MockUSDT: {
        address: '0x1F7326578e8190effd341D14184A86a1d0227A7D',
        decimals: 6,
        symbol: 'USDT'
      }
    }
  }
};

// Contract ABI for OrphiCrowdFundV4UltraSecure
export const ORPHI_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "_token", "type": "address"},
      {"internalType": "address", "name": "_admin", "type": "address"}
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "ErrSecurityViolation",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ErrSystemLocked",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InsufficientUplineChain",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidMatrixPosition",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "MaxUsersReached",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OverflowDetected",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "RateLimitExceeded",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "totalEarnings", "type": "uint256"}
    ],
    "name": "EarningsCapReached",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "uint8", "name": "oldRank", "type": "uint8"},
      {"indexed": false, "internalType": "uint8", "name": "newRank", "type": "uint8"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "LeaderRankChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": true, "internalType": "uint32", "name": "id", "type": "uint32"},
      {"indexed": true, "internalType": "address", "name": "sponsor", "type": "address"},
      {"indexed": false, "internalType": "uint16", "name": "tier", "type": "uint16"}
    ],
    "name": "UserRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
    ],
    "name": "Withdrawal",
    "type": "event"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "sponsor", "type": "address"},
      {"internalType": "uint16", "name": "tier", "type": "uint16"}
    ],
    "name": "register",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "user", "type": "address"}
    ],
    "name": "getUserInfo",
    "outputs": [
      {
        "components": [
          {"internalType": "uint32", "name": "id", "type": "uint32"},
          {"internalType": "uint32", "name": "teamSize", "type": "uint32"},
          {"internalType": "uint16", "name": "directCount", "type": "uint16"},
          {"internalType": "uint16", "name": "packageTier", "type": "uint16"},
          {"internalType": "uint32", "name": "matrixPos", "type": "uint32"},
          {"internalType": "uint64", "name": "totalEarnings", "type": "uint64"},
          {"internalType": "uint64", "name": "withdrawable", "type": "uint64"},
          {"internalType": "uint32", "name": "sponsor", "type": "uint32"},
          {"internalType": "uint32", "name": "lastActivity", "type": "uint32"},
          {"internalType": "bool", "name": "isCapped", "type": "bool"},
          {"internalType": "bool", "name": "isKYCVerified", "type": "bool"},
          {"internalType": "uint8", "name": "leaderRank", "type": "uint8"},
          {"internalType": "uint8", "name": "suspensionLevel", "type": "uint8"}
        ],
        "internalType": "struct OrphiCrowdFundV4UltraSecure.User",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getPoolBalances",
    "outputs": [
      {"internalType": "uint64[6]", "name": "", "type": "uint64[6]"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "state",
    "outputs": [
      {"internalType": "uint32", "name": "totalUsers", "type": "uint32"},
      {"internalType": "uint32", "name": "lastUserId", "type": "uint32"},
      {"internalType": "uint32", "name": "lastGHPTime", "type": "uint32"},
      {"internalType": "uint32", "name": "lastLeaderTime", "type": "uint32"},
      {"internalType": "uint32", "name": "lastSecurityCheck", "type": "uint32"},
      {"internalType": "bool", "name": "automationOn", "type": "bool"},
      {"internalType": "bool", "name": "systemLocked", "type": "bool"},
      {"internalType": "uint96", "name": "totalVolume", "type": "uint96"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "", "type": "address"}
    ],
    "name": "users",
    "outputs": [
      {"internalType": "uint32", "name": "id", "type": "uint32"},
      {"internalType": "uint32", "name": "teamSize", "type": "uint32"},
      {"internalType": "uint16", "name": "directCount", "type": "uint16"},
      {"internalType": "uint16", "name": "packageTier", "type": "uint16"},
      {"internalType": "uint32", "name": "matrixPos", "type": "uint32"},
      {"internalType": "uint64", "name": "totalEarnings", "type": "uint64"},
      {"internalType": "uint64", "name": "withdrawable", "type": "uint64"},
      {"internalType": "uint32", "name": "sponsor", "type": "uint32"},
      {"internalType": "uint32", "name": "lastActivity", "type": "uint32"},
      {"internalType": "bool", "name": "isCapped", "type": "bool"},
      {"internalType": "bool", "name": "isKYCVerified", "type": "bool"},
      {"internalType": "uint8", "name": "leaderRank", "type": "uint8"},
      {"internalType": "uint8", "name": "suspensionLevel", "type": "uint8"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// USDT ABI (simplified)
export const USDT_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "spender", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "account", "type": "address"}
    ],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "mint",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Package tiers and amounts
export const PACKAGE_TIERS = {
  1: { name: "Basic", amount: "100", usd: 100 },
  2: { name: "Standard", amount: "200", usd: 200 },
  3: { name: "Premium", amount: "500", usd: 500 },
  4: { name: "VIP", amount: "1000", usd: 1000 },
  5: { name: "Elite", amount: "2000", usd: 2000 }
};
