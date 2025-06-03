// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title OrphiCrowdFund
 * @dev Main contract implementing the matrix-based compensation system
 * Features:
 * - 2×∞ Forced Matrix placement with BFS algorithm
 * - Five bonus pools: Sponsor (40%), Level (10%), Global Upline (10%), Leader (10%), Global Help (30%)
 * - 4× earnings cap per member
 * - Automatic reinvestment and withdrawal system
 * - Upgradeable package tiers
 */
contract OrphiCrowdFund is 
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // Package tiers in USD (using 18 decimals for USDT)
    uint256 public constant PACKAGE_30 = 30 * 10**18;
    uint256 public constant PACKAGE_50 = 50 * 10**18;
    uint256 public constant PACKAGE_100 = 100 * 10**18;
    uint256 public constant PACKAGE_200 = 200 * 10**18;

    // Pool percentages (basis points - 10000 = 100%)
    uint256 public constant SPONSOR_COMMISSION = 4000; // 40%
    uint256 public constant LEVEL_BONUS = 1000; // 10%
    uint256 public constant GLOBAL_UPLINE_BONUS = 1000; // 10%
    uint256 public constant LEADER_BONUS = 1000; // 10%
    uint256 public constant GLOBAL_HELP_POOL = 3000; // 30%

    // Level bonus percentages for first 10 uplines (basis points) - initialized in constructor
    uint256[10] public LEVEL_PERCENTAGES;

    // Earnings cap multiplier
    uint256 public constant EARNINGS_CAP_MULTIPLIER = 4;

    // Withdrawal percentages based on direct sponsors
    uint256 public constant WITHDRAWAL_0_DIRECTS = 7000; // 70%
    uint256 public constant WITHDRAWAL_5_DIRECTS = 7500; // 75%
    uint256 public constant WITHDRAWAL_20_DIRECTS = 8000; // 80%

    // Reinvestment allocation
    uint256 public constant REINVEST_LEVEL = 4000; // 40%
    uint256 public constant REINVEST_UPLINE = 3000; // 30%
    uint256 public constant REINVEST_GHP = 3000; // 30%

    // Package upgrade thresholds (downline IDs required)
    uint256 public constant UPGRADE_30_THRESHOLD = 128; // Level 7
    uint256 public constant UPGRADE_50_THRESHOLD = 256; // Level 8
    uint256 public constant UPGRADE_100_THRESHOLD = 2048; // Level 11
    uint256 public constant UPGRADE_200_THRESHOLD = 32768; // Level 15

    enum PackageTier { NONE, PACKAGE_30, PACKAGE_50, PACKAGE_100, PACKAGE_200 }
    enum LeaderRank { NONE, SHINING_STAR, SILVER_STAR }

    struct User {
        address sponsor;
        address leftChild;
        address rightChild;
        uint256 directSponsorsCount;
        uint256 teamSize;
        PackageTier packageTier;
        mapping(uint256 => uint256) totalEarned; // poolType => amount
        uint256 totalInvested;
        bool isCapped;
        LeaderRank leaderRank;
        uint256 matrixPosition;
        uint256 lastActivity;
        uint256 withdrawableAmount;
        uint256 reinvestmentAmount;
    }

    struct GlobalPool {
        uint256 globalHelpPool;
        uint256 leaderBonusPool;
        uint256 totalDistributed;
        uint256 lastDistribution;
    }

    struct LeaderDistribution {
        uint256 timestamp;
        uint256 shiningStarPool;
        uint256 silverStarPool;
        uint256 shiningStarCount;
        uint256 silverStarCount;
    }

    // State variables
    IERC20 public paymentToken; // BEP20 USDT
    address public adminReserve;
    uint256 public totalMembers;
    uint256 public totalVolume;
    
    // Matrix root
    address public matrixRoot;
    
    // Mappings
    mapping(address => User) public users;
    mapping(address => bool) public isRegistered;
    mapping(uint256 => address) public userIdToAddress;
    mapping(address => uint256) public addressToUserId;
    
    // Global pools
    GlobalPool public globalPools;
    
    // Leader distributions
    LeaderDistribution[] public leaderDistributions;
    mapping(address => mapping(uint256 => bool)) public hasClaimedLeaderBonus;
    
    // Pool tracking
    mapping(uint256 => uint256) public poolBalances; // poolType => balance
    
    // Events
    event UserRegistered(address indexed user, address indexed sponsor, PackageTier packageTier, uint256 userId);
    event MatrixPlacement(address indexed user, address indexed parent, bool isLeft, uint256 position);
    event CommissionPaid(address indexed recipient, uint256 amount, uint256 poolType, address indexed from);
    event PackageUpgraded(address indexed user, PackageTier oldTier, PackageTier newTier);
    event WithdrawalMade(address indexed user, uint256 amount);
    event ReinvestmentMade(address indexed user, uint256 amount);
    event GlobalHelpDistributed(uint256 totalAmount, uint256 participantCount);
    event LeaderBonusDistributed(uint256 shiningStarAmount, uint256 silverStarAmount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _paymentToken,
        address _adminReserve,
        address _matrixRoot
    ) public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        paymentToken = IERC20(_paymentToken);
        adminReserve = _adminReserve;
        matrixRoot = _matrixRoot;
        
        // Initialize level percentages
        LEVEL_PERCENTAGES = [300, 100, 100, 100, 100, 100, 50, 50, 50, 50];
        
        // Initialize root user
        users[_matrixRoot].packageTier = PackageTier.PACKAGE_200;
        isRegistered[_matrixRoot] = true;
        totalMembers = 1;
        userIdToAddress[1] = _matrixRoot;
        addressToUserId[_matrixRoot] = 1;
    }

    /**
     * @dev Register new user and purchase package
     * @param _sponsor Address of the sponsor
     * @param _packageTier Package tier to purchase
     */
    function registerUser(address _sponsor, PackageTier _packageTier) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(!isRegistered[msg.sender], "User already registered");
        require(isRegistered[_sponsor], "Sponsor not registered");
        require(_packageTier != PackageTier.NONE, "Invalid package tier");
        
        uint256 packageAmount = getPackageAmount(_packageTier);
        
        // Transfer payment token to contract
        paymentToken.safeTransferFrom(msg.sender, address(this), packageAmount);
        
        // Register user
        totalMembers++;
        uint256 userId = totalMembers;
        
        users[msg.sender].sponsor = _sponsor;
        users[msg.sender].packageTier = _packageTier;
        users[msg.sender].totalInvested = packageAmount;
        users[msg.sender].lastActivity = block.timestamp;
        
        isRegistered[msg.sender] = true;
        userIdToAddress[userId] = msg.sender;
        addressToUserId[msg.sender] = userId;
        
        // Update sponsor's direct count
        users[_sponsor].directSponsorsCount++;
        
        // Place in matrix using BFS
        _placeInMatrix(msg.sender, _sponsor);
        
        // Distribute package amount to pools
        _distributePackage(msg.sender, packageAmount);
        
        // Update statistics
        totalVolume += packageAmount;
        
        // Check for package upgrades
        _checkPackageUpgrade(_sponsor);
        
        emit UserRegistered(msg.sender, _sponsor, _packageTier, userId);
    }

    /**
     * @dev Place user in matrix using Breadth-First Search (BFS)
     */
    function _placeInMatrix(address _user, address _sponsor) internal {
        address placementParent = _findMatrixPlacement(_sponsor);
        
        if (users[placementParent].leftChild == address(0)) {
            users[placementParent].leftChild = _user;
            emit MatrixPlacement(_user, placementParent, true, users[placementParent].matrixPosition * 2 + 1);
        } else if (users[placementParent].rightChild == address(0)) {
            users[placementParent].rightChild = _user;
            emit MatrixPlacement(_user, placementParent, false, users[placementParent].matrixPosition * 2 + 2);
        }
        
        // Update team sizes up the matrix
        _updateTeamSizes(placementParent);
    }

    /**
     * @dev Find placement position using BFS algorithm
     */
    function _findMatrixPlacement(address _sponsor) internal view returns (address) {
        // Start with sponsor
        if (users[_sponsor].leftChild == address(0) || users[_sponsor].rightChild == address(0)) {
            return _sponsor;
        }
        
        // BFS queue simulation - check level by level
        address[1024] memory queue;
        uint256 front = 0;
        uint256 rear = 0;
        
        queue[rear++] = _sponsor;
        
        while (front < rear && rear < 1024) {
            address current = queue[front++];
            
            // Check left child
            if (users[current].leftChild != address(0)) {
                if (users[users[current].leftChild].leftChild == address(0) || 
                    users[users[current].leftChild].rightChild == address(0)) {
                    return users[current].leftChild;
                }
                queue[rear++] = users[current].leftChild;
            }
            
            // Check right child
            if (users[current].rightChild != address(0)) {
                if (users[users[current].rightChild].leftChild == address(0) || 
                    users[users[current].rightChild].rightChild == address(0)) {
                    return users[current].rightChild;
                }
                queue[rear++] = users[current].rightChild;
            }
        }
        
        return _sponsor; // Fallback
    }

    /**
     * @dev Update team sizes up the matrix chain
     */
    function _updateTeamSizes(address _user) internal {
        address current = _user;
        while (current != address(0)) {
            users[current].teamSize++;
            
            // Update leader rank based on team size and direct sponsors
            _updateLeaderRank(current);
            
            // Move up to sponsor
            current = users[current].sponsor;
        }
    }

    /**
     * @dev Update leader rank based on qualifications
     */
    function _updateLeaderRank(address _user) internal {
        uint256 teamSize = users[_user].teamSize;
        uint256 directCount = users[_user].directSponsorsCount;
        
        if (teamSize >= 500) {
            users[_user].leaderRank = LeaderRank.SILVER_STAR;
        } else if (teamSize >= 250 && directCount >= 10) {
            users[_user].leaderRank = LeaderRank.SHINING_STAR;
        } else {
            users[_user].leaderRank = LeaderRank.NONE;
        }
    }

    /**
     * @dev Distribute package amount across all pools
     */
    function _distributePackage(address _user, uint256 _amount) internal {
        // 1. Sponsor Commission (40%)
        uint256 sponsorAmount = (_amount * SPONSOR_COMMISSION) / 10000;
        _paySponsorCommission(_user, sponsorAmount);
        
        // 2. Level Bonus (10%)
        uint256 levelAmount = (_amount * LEVEL_BONUS) / 10000;
        _payLevelBonus(_user, levelAmount);
        
        // 3. Global Upline Bonus (10%)
        uint256 uplineAmount = (_amount * GLOBAL_UPLINE_BONUS) / 10000;
        _payGlobalUplineBonus(_user, uplineAmount);
        
        // 4. Leader Bonus Pool (10%)
        uint256 leaderAmount = (_amount * LEADER_BONUS) / 10000;
        globalPools.leaderBonusPool += leaderAmount;
        poolBalances[3] += leaderAmount;
        
        // 5. Global Help Pool (30%)
        uint256 helpAmount = (_amount * GLOBAL_HELP_POOL) / 10000;
        globalPools.globalHelpPool += helpAmount;
        poolBalances[4] += helpAmount;
    }

    /**
     * @dev Pay sponsor commission (40%)
     */
    function _paySponsorCommission(address _user, uint256 _amount) internal {
        address sponsor = users[_user].sponsor;
        if (sponsor != address(0) && !users[sponsor].isCapped) {
            _creditEarnings(sponsor, _amount, 0);
            emit CommissionPaid(sponsor, _amount, 0, _user);
        } else {
            // Send to admin reserve if sponsor is capped or doesn't exist
            paymentToken.safeTransfer(adminReserve, _amount);
        }
    }

    /**
     * @dev Pay level bonus (10%) across first 10 uplines
     */
    function _payLevelBonus(address _user, uint256 _totalAmount) internal {
        address current = users[_user].sponsor;
        uint256 level = 0;
        uint256 remainingAmount = _totalAmount;
        
        while (current != address(0) && level < 10) {
            if (!users[current].isCapped) {
                uint256 levelAmount = (_totalAmount * LEVEL_PERCENTAGES[level]) / 10000;
                _creditEarnings(current, levelAmount, 1);
                remainingAmount -= levelAmount;
                emit CommissionPaid(current, levelAmount, 1, _user);
            }
            
            current = users[current].sponsor;
            level++;
        }
        
        // Send remaining to admin reserve
        if (remainingAmount > 0) {
            paymentToken.safeTransfer(adminReserve, remainingAmount);
        }
    }

    /**
     * @dev Pay global upline bonus (10%) to first 30 uplines equally
     */
    function _payGlobalUplineBonus(address _user, uint256 _totalAmount) internal {
        address current = users[_user].sponsor;
        uint256 level = 0;
        uint256 perUplineAmount = _totalAmount / 30;
        uint256 remainingAmount = _totalAmount;
        
        while (current != address(0) && level < 30) {
            if (!users[current].isCapped) {
                _creditEarnings(current, perUplineAmount, 2);
                remainingAmount -= perUplineAmount;
                emit CommissionPaid(current, perUplineAmount, 2, _user);
            }
            
            current = users[current].sponsor;
            level++;
        }
        
        // Send remaining to admin reserve
        if (remainingAmount > 0) {
            paymentToken.safeTransfer(adminReserve, remainingAmount);
        }
    }

    /**
     * @dev Credit earnings to user and check cap
     */
    function _creditEarnings(address _user, uint256 _amount, uint256 _poolType) internal {
        users[_user].totalEarned[_poolType] += _amount;
        users[_user].withdrawableAmount += _amount;
        
        // Check if user hits 4x cap
        uint256 totalEarnings = getTotalEarnings(_user);
        uint256 cap = users[_user].totalInvested * EARNINGS_CAP_MULTIPLIER;
        
        if (totalEarnings >= cap) {
            users[_user].isCapped = true;
        }
    }

    /**
     * @dev Check and perform package upgrades based on downline count
     */
    function _checkPackageUpgrade(address _user) internal {
        uint256 teamSize = users[_user].teamSize;
        PackageTier currentTier = users[_user].packageTier;
        PackageTier newTier = currentTier;
        
        if (teamSize >= UPGRADE_200_THRESHOLD && currentTier < PackageTier.PACKAGE_200) {
            newTier = PackageTier.PACKAGE_200;
        } else if (teamSize >= UPGRADE_100_THRESHOLD && currentTier < PackageTier.PACKAGE_100) {
            newTier = PackageTier.PACKAGE_100;
        } else if (teamSize >= UPGRADE_50_THRESHOLD && currentTier < PackageTier.PACKAGE_50) {
            newTier = PackageTier.PACKAGE_50;
        } else if (teamSize >= UPGRADE_30_THRESHOLD && currentTier < PackageTier.PACKAGE_30) {
            newTier = PackageTier.PACKAGE_30;
        }
        
        if (newTier != currentTier) {
            users[_user].packageTier = newTier;
            emit PackageUpgraded(_user, currentTier, newTier);
        }
    }

    /**
     * @dev Withdraw available earnings
     */
    function withdraw() external nonReentrant whenNotPaused {
        require(isRegistered[msg.sender], "User not registered");
        require(users[msg.sender].withdrawableAmount > 0, "No withdrawable amount");
        
        uint256 withdrawableAmount = users[msg.sender].withdrawableAmount;
        uint256 directCount = users[msg.sender].directSponsorsCount;
        
        // Calculate withdrawal percentage based on direct sponsors
        uint256 withdrawalPercentage;
        if (directCount >= 20) {
            withdrawalPercentage = WITHDRAWAL_20_DIRECTS;
        } else if (directCount >= 5) {
            withdrawalPercentage = WITHDRAWAL_5_DIRECTS;
        } else {
            withdrawalPercentage = WITHDRAWAL_0_DIRECTS;
        }
        
        uint256 withdrawAmount = (withdrawableAmount * withdrawalPercentage) / 10000;
        uint256 reinvestAmount = withdrawableAmount - withdrawAmount;
        
        // Reset withdrawable amount
        users[msg.sender].withdrawableAmount = 0;
        
        // Transfer withdrawal
        paymentToken.safeTransfer(msg.sender, withdrawAmount);
        
        // Handle reinvestment
        if (reinvestAmount > 0) {
            _processReinvestment(msg.sender, reinvestAmount);
        }
        
        emit WithdrawalMade(msg.sender, withdrawAmount);
        if (reinvestAmount > 0) {
            emit ReinvestmentMade(msg.sender, reinvestAmount);
        }
    }

    /**
     * @dev Process reinvestment allocation
     */
    function _processReinvestment(address _user, uint256 _amount) internal {
        // Split reinvestment: 40% Level, 30% Upline, 30% GHP
        uint256 levelAmount = (_amount * REINVEST_LEVEL) / 10000;
        uint256 uplineAmount = (_amount * REINVEST_UPLINE) / 10000;
        uint256 ghpAmount = (_amount * REINVEST_GHP) / 10000;
        
        // Add to respective pools
        poolBalances[1] += levelAmount;
        poolBalances[2] += uplineAmount;
        globalPools.globalHelpPool += ghpAmount;
        poolBalances[4] += ghpAmount;
        
        users[_user].reinvestmentAmount += _amount;
    }

    /**
     * @dev Distribute Global Help Pool (weekly)
     */
    function distributeGlobalHelpPool() external onlyOwner {
        require(globalPools.globalHelpPool > 0, "No GHP balance");
        require(block.timestamp >= globalPools.lastDistribution + 7 days, "Too early for distribution");
        
        uint256 totalPool = globalPools.globalHelpPool;
        address[] memory eligibleUsers;
        uint256[] memory userVolumes;
        uint256 totalEligibleVolume = 0;
        uint256 eligibleCount = 0;
        
        // Count eligible users and total volume
        for (uint256 i = 1; i <= totalMembers; i++) {
            address user = userIdToAddress[i];
            if (!users[user].isCapped && users[user].lastActivity >= block.timestamp - 30 days) {
                eligibleCount++;
                // Volume = personal investment + team investment (simplified)
                totalEligibleVolume += users[user].totalInvested + (users[user].teamSize * PACKAGE_30);
            }
        }
        
        if (eligibleCount > 0 && totalEligibleVolume > 0) {
            // Distribute pro-rata
            for (uint256 i = 1; i <= totalMembers; i++) {
                address user = userIdToAddress[i];
                if (!users[user].isCapped && users[user].lastActivity >= block.timestamp - 30 days) {
                    uint256 userVolume = users[user].totalInvested + (users[user].teamSize * PACKAGE_30);
                    uint256 userShare = (totalPool * userVolume) / totalEligibleVolume;
                    
                    if (userShare > 0) {
                        _creditEarnings(user, userShare, 4);
                    }
                }
            }
            
            globalPools.globalHelpPool = 0;
            poolBalances[4] = 0;
            globalPools.lastDistribution = block.timestamp;
            globalPools.totalDistributed += totalPool;
            
            emit GlobalHelpDistributed(totalPool, eligibleCount);
        }
    }

    /**
     * @dev Distribute Leader Bonus Pool (bi-monthly)
     */
    function distributeLeaderBonus() external onlyOwner {
        require(globalPools.leaderBonusPool > 0, "No leader bonus balance");
        
        uint256 totalPool = globalPools.leaderBonusPool;
        uint256 shiningStarPool = totalPool / 2;
        uint256 silverStarPool = totalPool / 2;
        
        uint256 shiningStarCount = 0;
        uint256 silverStarCount = 0;
        
        // Count qualified leaders
        for (uint256 i = 1; i <= totalMembers; i++) {
            address user = userIdToAddress[i];
            if (users[user].leaderRank == LeaderRank.SHINING_STAR) {
                shiningStarCount++;
            } else if (users[user].leaderRank == LeaderRank.SILVER_STAR) {
                silverStarCount++;
            }
        }
        
        // Distribute to qualified leaders
        if (shiningStarCount > 0) {
            uint256 perShiningShare = shiningStarPool / shiningStarCount;
            for (uint256 i = 1; i <= totalMembers; i++) {
                address user = userIdToAddress[i];
                if (users[user].leaderRank == LeaderRank.SHINING_STAR) {
                    _creditEarnings(user, perShiningShare, 3);
                }
            }
        } else {
            // Send unclaimed to admin reserve
            paymentToken.safeTransfer(adminReserve, shiningStarPool);
        }
        
        if (silverStarCount > 0) {
            uint256 perSilverShare = silverStarPool / silverStarCount;
            for (uint256 i = 1; i <= totalMembers; i++) {
                address user = userIdToAddress[i];
                if (users[user].leaderRank == LeaderRank.SILVER_STAR) {
                    _creditEarnings(user, perSilverShare, 3);
                }
            }
        } else {
            // Send unclaimed to admin reserve
            paymentToken.safeTransfer(adminReserve, silverStarPool);
        }
        
        // Record distribution
        leaderDistributions.push(LeaderDistribution({
            timestamp: block.timestamp,
            shiningStarPool: shiningStarPool,
            silverStarPool: silverStarPool,
            shiningStarCount: shiningStarCount,
            silverStarCount: silverStarCount
        }));
        
        globalPools.leaderBonusPool = 0;
        poolBalances[3] = 0;
        
        emit LeaderBonusDistributed(shiningStarPool, silverStarPool);
    }

    // View functions
    function getPackageAmount(PackageTier _tier) public pure returns (uint256) {
        if (_tier == PackageTier.PACKAGE_30) return PACKAGE_30;
        if (_tier == PackageTier.PACKAGE_50) return PACKAGE_50;
        if (_tier == PackageTier.PACKAGE_100) return PACKAGE_100;
        if (_tier == PackageTier.PACKAGE_200) return PACKAGE_200;
        return 0;
    }

    function getTotalEarnings(address _user) public view returns (uint256) {
        return users[_user].totalEarned[0] + users[_user].totalEarned[1] + 
               users[_user].totalEarned[2] + users[_user].totalEarned[3] + 
               users[_user].totalEarned[4];
    }

    function getUserInfo(address _user) external view returns (
        address sponsor,
        uint256 directSponsorsCount,
        uint256 teamSize,
        PackageTier packageTier,
        uint256 totalInvested,
        bool isCapped,
        LeaderRank leaderRank,
        uint256 withdrawableAmount
    ) {
        User storage user = users[_user];
        return (
            user.sponsor,
            user.directSponsorsCount,
            user.teamSize,
            user.packageTier,
            user.totalInvested,
            user.isCapped,
            user.leaderRank,
            user.withdrawableAmount
        );
    }

    function getMatrixInfo(address _user) external view returns (
        address leftChild,
        address rightChild,
        uint256 matrixPosition
    ) {
        User storage user = users[_user];
        return (user.leftChild, user.rightChild, user.matrixPosition);
    }

    function getPoolBalances() external view returns (uint256[5] memory) {
        return [poolBalances[0], poolBalances[1], poolBalances[2], poolBalances[3], poolBalances[4]];
    }

    // Admin functions
    function setAdminReserve(address _adminReserve) external onlyOwner {
        adminReserve = _adminReserve;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(adminReserve, _amount);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
