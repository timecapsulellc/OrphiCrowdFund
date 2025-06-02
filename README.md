# Orphi CrowdFund Smart Contract System

## Overview

Orphi CrowdFund is a sophisticated blockchain-based crowdfunding platform built on Binance Smart Chain (BSC) that implements a 2×∞ forced-matrix compensation system with multiple bonus pools. The system is designed to ensure fair distribution, sustainable growth, and transparent operations.

## Features

- **2×∞ Forced Matrix**: Breadth-First Search (BFS) placement algorithm ensuring fair positioning
- **Five Bonus Pools**: Sponsor Commission (40%), Level Bonus (10%), Global Upline Bonus (10%), Leader Bonus (10%), Global Help Pool (30%)
- **Package Tiers**: $30, $50, $100, $200 USDT packages
- **Earnings Cap**: 4× investment cap for sustainability
- **Smart Reinvestment**: Automatic reinvestment based on direct sponsor count
- **Upgradeable Contracts**: UUPS proxy pattern for future improvements
- **Leader Ranks**: Shining Star and Silver Star qualification system

## Security Notice ⚠️

This repository contains smart contract code intended to be deployed on BSC. Please follow these security practices:

1. **Never commit private keys or secrets to GitHub**
2. **Always use environment variables for sensitive information**
3. **Create a proper `.env` file based on the `.env.example` template**
4. **Keep your production deployment keys separate from development keys**

## System Architecture

### Smart Contracts

1. **OrphiCrowdFund.sol** - Initial implementation of the system
2. **OrphiCrowdFundV2.sol** - Enhanced version with improved security and feature completeness
3. **OrphiCrowdFundV3.sol** - Production-ready version with additional security features
4. **MockUSDT.sol** - Test token for development (BEP20 compatible)

### Key Components

- **Matrix Placement**: Enhanced BFS algorithm for fair tree positioning
- **Pool Distribution**: Automatic splitting of package payments with improved tracking
- **Earnings Tracking**: Individual user earnings with cap enforcement
- **Leader System**: Rank-based bonus distribution with qualifications
- **Distribution System**: Weekly GHP and bi-monthly Leader Bonus distribution
- **Withdrawal System**: Flexible withdrawal with mandatory reinvestment
- **Security**: Role-based access control with circuit breakers

## Compensation Structure

### Package Distribution (100%)

| Pool Type | Percentage | $30 Package | $50 Package | $100 Package | $200 Package |
|-----------|------------|-------------|-------------|--------------|--------------|
| Sponsor Commission | 40% | $12.00 | $20.00 | $40.00 | $80.00 |
| Level Bonus | 10% | $3.00 | $5.00 | $10.00 | $20.00 |
| Global Upline Bonus | 10% | $3.00 | $5.00 | $10.00 | $20.00 |
| Leader Bonus Pool | 10% | $3.00 | $5.00 | $10.00 | $20.00 |
| Global Help Pool | 30% | $9.00 | $15.00 | $30.00 | $60.00 |

### Level Bonus Distribution

The 10% Level Bonus pool is distributed among the first 10 uplines:

| Level | Percentage of Package | Amount on $30 | Amount on $100 |
|-------|----------------------|---------------|-----------------|
| 1 | 3.0% | $0.90 | $3.00 |
| 2-6 | 1.0% each | $0.30 each | $1.00 each |
| 7-10 | 0.5% each | $0.15 each | $0.50 each |

### Global Upline Bonus

- 10% of package split equally among first 30 straight-line uplines
- Example: $30 package → $3.00 ÷ 30 = $0.10 per upline

### Withdrawal System

Based on direct sponsor count:

| Direct Sponsors | Withdrawal Rate | Reinvestment Rate |
|-----------------|-----------------|-------------------|
| 0-4 | 70% | 30% |
| 5-19 | 75% | 25% |
| 20+ | 80% | 20% |

### Reinvestment Allocation

Reinvested funds are split:
- 40% → Level Bonus Pool
- 30% → Global Upline Pool  
- 30% → Global Help Pool

### Leader Qualifications

| Rank | Team Size | Direct Sponsors | Pool Share |
|------|-----------|-----------------|------------|
| Shining Star | 250+ | 10+ | 50% of Leader Pool |
| Silver Star | 500+ | Any | 50% of Leader Pool |

### Distribution Schedule

| Pool Type | Distribution Interval | Eligibility Criteria | Distribution Method |
|-----------|------------------------|----------------------|---------------------|
| Global Help Pool | Weekly (7 days) | Not capped, active in last 30 days | Proportional to user's total investment + team size value |
| Leader Bonus | Bi-monthly (14 days) | Qualified leader rank | Equal share within rank category |

## V2 Enhanced Features

The V2 implementation adds several key improvements:

1. **Enhanced Security**
   - Role-based access control
   - Circuit breakers for emergency situations
   - Time-locked admin functions
   - Comprehensive input validation

2. **Optimized Distribution**
   - Improved GHP distribution algorithm
   - Enhanced Leader Bonus distribution
   - Exact percentage tracking

3. **Gas Optimization**
   - Optimized data types
   - Efficient algorithms
   - Reduced storage requirements

4. **Better Event Logging**
   - Detailed events with timestamps
   - Enhanced error reporting
   - Comprehensive activity tracking

## Technical Implementation

### Matrix Placement Algorithm

```solidity
function _placeInMatrixEnhanced(address _user, address _sponsor) internal returns (uint256) {
    address placementParent = _findOptimalPlacement(_sponsor);
    uint256 position;
    
    if (users[placementParent].leftChild == address(0)) {
        users[placementParent].leftChild = _user;
        position = users[placementParent].matrixPosition * 2 + 1;
        emit MatrixPlacement(_user, placementParent, true, position);
    } else if (users[placementParent].rightChild == address(0)) {
        users[placementParent].rightChild = _user;
        position = users[placementParent].matrixPosition * 2 + 2;
        emit MatrixPlacement(_user, placementParent, false, position);
    } else {
        revert("No placement position found");
    }
    
    _updateTeamSizesEnhanced(placementParent);
    return position;
}
```

### GHP Distribution Logic

```solidity
function distributeGlobalHelpPool() external onlyRole(ADMIN_ROLE) nonReentrant {
    require(poolBalances[4] > 0, "No GHP balance");
    require(block.timestamp >= lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL, "Too early for distribution");
    
    uint256 totalPool = poolBalances[4];
    uint256 totalVolume = 0;
    uint256 eligibleCount = 0;
    
    // First pass: Count eligible users and calculate total volume
    for (uint256 i = 1; i <= totalMembers; i++) {
        address user = userIdToAddress[i];
        if (!users[user].isCapped && users[user].lastActivity >= block.timestamp - 30 days) {
            eligibleCount++;
            // Volume = personal investment + team value (simplified)
            uint256 userVolume = users[user].totalInvested + (users[user].teamSize * PACKAGE_30);
            totalVolume += userVolume;
        }
    }
    
    if (eligibleCount > 0 && totalVolume > 0) {
        // Second pass: Distribute proportionally
        for (uint256 i = 1; i <= totalMembers; i++) {
            address user = userIdToAddress[i];
            if (!users[user].isCapped && users[user].lastActivity >= block.timestamp - 30 days) {
                uint256 userVolume = users[user].totalInvested + (users[user].teamSize * PACKAGE_30);
                uint256 userShare = (totalPool * userVolume) / totalVolume;
                
                if (userShare > 0) {
                    _creditEarningsEnhanced(user, userShare, 4);
                }
            }
        }
        
        // Reset GHP pool and update distribution time
        poolBalances[4] = 0;
        lastGHPDistribution = block.timestamp;
        
        emit GlobalHelpPoolDistributed(totalPool, eligibleCount, block.timestamp);
    } else {
        // If no eligible users, send to admin reserve
        paymentToken.safeTransfer(adminReserve, totalPool);
        poolBalances[4] = 0;
        lastGHPDistribution = block.timestamp;
        
        emit GlobalHelpPoolDistributed(totalPool, 0, block.timestamp);
    }
}
```

The system uses a queue-based BFS algorithm to find the next available position in the matrix, ensuring:
- Left-to-right filling at each level
- No gaps in the tree structure
- Fair positioning for all users

### Earnings Cap Implementation

```solidity
function _creditEarnings(address _user, uint256 _amount, uint256 _poolType) internal {
    users[_user].totalEarned[_poolType] += _amount;
    users[_user].withdrawableAmount += _amount;
    
    uint256 totalEarnings = getTotalEarnings(_user);
    uint256 cap = users[_user].totalInvested * EARNINGS_CAP_MULTIPLIER;
    
    if (totalEarnings >= cap) {
        users[_user].isCapped = true;
    }
}
```

## Deployment Guide

### Prerequisites

1. Node.js v16+
2. npm or yarn
3. BSC wallet with BNB for gas fees
4. BSCScan API key (for verification)

### Installation

Clone the repository and install dependencies:

```bash
# Clone the repository
git clone https://github.com/your-username/orphi-crowdfund.git
cd orphi-crowdfund

# Install dependencies
npm install
```

### Environment Setup

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```
DEPLOYER_PRIVATE_KEY=your_private_key_here_without_0x_prefix
BSCSCAN_API_KEY=your_bscscan_api_key_here
ADMIN_RESERVE=your_admin_reserve_address_here
MATRIX_ROOT=your_matrix_root_address_here
```

### Deployment Commands

```bash
# Compile contracts
npm run compile

# Run tests
npm test

# Deploy to BSC Testnet
npm run deploy:testnet

# Deploy to BSC Mainnet
npm run deploy:mainnet

# Verify on BSCScan
npm run verify:testnet
```

### Admin Operations

```bash
# Distribute Global Help Pool (weekly)
npm run admin distribute-ghp

# Distribute Leader Bonus (bi-monthly)
npm run admin distribute-leader

# Get user information
npm run admin user-info 0x...

# View matrix tree
npm run admin matrix-tree 0x... 5

# Pause/unpause contract
npm run admin pause
npm run admin unpause
```

## Security Features

### Access Control
- **Owner**: Can upgrade contract, distribute pools, pause/unpause
- **Users**: Can register, withdraw, and view their data
- **Public**: Read-only access to system statistics

### Safety Mechanisms
- **Reentrancy Protection**: All state-changing functions use `nonReentrant`
- **Pausable**: Emergency pause functionality
- **Upgradeable**: UUPS proxy for bug fixes and improvements
- **Input Validation**: Comprehensive parameter checking
- **Overflow Protection**: SafeMath and Solidity 0.8+ built-in protection

### Earnings Cap
- 4× investment cap prevents unsustainable payouts
- Capped users become ineligible for new GHP distributions
- Excess funds go to admin reserve for system sustainability

## Integration Guide

### Frontend Integration

```javascript
import { ethers } from 'ethers';

// Contract ABI and address
const CONTRACT_ABI = [...]; // Import from artifacts
const CONTRACT_ADDRESS = '0x...';

// Connect to contract
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

// Register user
async function registerUser(sponsor, packageTier) {
    const tx = await contract.registerUser(sponsor, packageTier);
    await tx.wait();
    return tx.hash;
}

// Get user info
async function getUserInfo(address) {
    return await contract.getUserInfo(address);
}

// Withdraw earnings
async function withdraw() {
    const tx = await contract.withdraw();
    await tx.wait();
    return tx.hash;
}
```

### Events for Monitoring

```solidity
event UserRegistered(address indexed user, address indexed sponsor, PackageTier packageTier, uint256 userId);
event CommissionPaid(address indexed recipient, uint256 amount, uint256 poolType, address indexed from);
event WithdrawalMade(address indexed user, uint256 amount);
event GlobalHelpDistributed(uint256 totalAmount, uint256 participantCount);
```

## Testing

### Comprehensive Test Suite

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npx hardhat test test/OrphiCrowdFund.test.js
```

### Test Coverage Areas

- ✅ User registration and matrix placement
- ✅ Pool distribution calculations
- ✅ Earnings cap enforcement
- ✅ Withdrawal and reinvestment logic
- ✅ Package upgrade system
- ✅ Leader rank calculations
- ✅ Global Help Pool distribution
- ✅ Leader Bonus distribution
- ✅ Security and access control
- ✅ Emergency functions

## Monitoring and Analytics

### Key Metrics to Track

1. **System Health**
   - Total members
   - Total volume
   - Pool balances
   - Capped users percentage

2. **User Activity**
   - Daily registrations
   - Withdrawal patterns
   - Package distribution
   - Leader rank progression

3. **Financial Flows**
   - Pool distribution accuracy
   - Reinvestment rates
   - Admin reserve accumulation

### Dashboard Integration

Use events and view functions to build real-time dashboards:

```javascript
// Get system statistics
const stats = await contract.getSystemStats();

// Listen for new registrations
contract.on('UserRegistered', (user, sponsor, packageTier, userId) => {
    console.log(`New user ${user} registered with package ${packageTier}`);
});

// Monitor pool distributions
contract.on('GlobalHelpDistributed', (totalAmount, participantCount) => {
    console.log(`GHP distributed: ${ethers.utils.formatEther(totalAmount)} to ${participantCount} users`);
});
```

## Maintenance Operations

### Weekly Tasks
- Monitor Global Help Pool accumulation
- Distribute GHP to eligible users
- Check system health metrics
- Review capped user reports

### Bi-Monthly Tasks  
- Distribute Leader Bonus Pool
- Update leader qualifications
- Review pool balance ratios
- Analyze upgrade patterns

### Monthly Tasks
- System performance review
- Security audit of recent transactions
- Smart contract upgrade assessment
- Community feedback integration

## Troubleshooting

### Common Issues

1. **Transaction Failures**
   - Check gas limits and prices
   - Verify USDT approval amounts
   - Ensure user is not already registered

2. **Matrix Placement Issues**
   - Verify sponsor is registered
   - Check matrix tree structure
   - Review BFS algorithm execution

3. **Pool Distribution Errors**
   - Validate percentage calculations
   - Check upline chain integrity
   - Verify cap enforcement

### Error Codes

- `"User already registered"` - Attempting to register existing user
- `"Sponsor not registered"` - Invalid sponsor address
- `"Invalid package tier"` - Package tier out of range
- `"No withdrawable amount"` - User has no earnings to withdraw
- `"Too early for distribution"` - GHP distribution timing restriction

## Future Enhancements

### Planned Features

1. **Mobile App Integration**
   - React Native mobile app
   - Push notifications for earnings
   - QR code registration

2. **Advanced Analytics**
   - Genealogy tree visualization
   - Earnings projection calculator
   - Team performance metrics

3. **Additional Bonus Pools**
   - Achievement-based rewards
   - Referral contests
   - Loyalty programs

4. **Cross-Chain Support**
   - Multi-chain deployment
   - Bridge functionality
   - Unified user experience

## Support and Documentation

### Resources

- **Smart Contract Source**: `/contracts/OrphiCrowdFund.sol`
- **Test Suite**: `/test/OrphiCrowdFund.test.js`
- **Deployment Scripts**: `/scripts/deploy.js`
- **Admin Tools**: `/scripts/admin.js`

### Community

- **Telegram**: [OrphiCrowdFund Community]
- **Discord**: [Developer Support]
- **GitHub**: [Smart Contract Repository]
- **Documentation**: [Full Technical Docs]

## License

MIT License - See LICENSE file for details.

---

**⚠️ Important Security Notice**

This smart contract system handles real financial transactions. Always:
- Conduct thorough testing on testnets
- Perform professional security audits
- Implement proper monitoring systems
- Have emergency response procedures
- Keep private keys secure
- Use multi-sig wallets for admin functions
