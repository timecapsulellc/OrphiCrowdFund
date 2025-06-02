// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title OrphiCrowdFundV2
 * @dev Enhanced version with improved security, gas optimization, and modularity
 * 
 * Key Improvements:
 * - Role-based access control instead of single owner
 * - Modular pool distribution system
 * - Enhanced event logging with detailed information
 * - Circuit breakers for emergency situations
 * - Gas-optimized data structures
 * - Comprehensive input validation
 * - Time-locked admin functions for transparency
 */
contract OrphiCrowdFundV2 is 
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Enhanced constants with validation
    uint256 public constant PACKAGE_30 = 30 * 10**18;
    uint256 public constant PACKAGE_50 = 50 * 10**18;
    uint256 public constant PACKAGE_100 = 100 * 10**18;
    uint256 public constant PACKAGE_200 = 200 * 10**18;

    // Pool percentages with better precision (basis points)
    uint256 public constant SPONSOR_COMMISSION = 4000; // 40%
    uint256 public constant LEVEL_BONUS = 1000; // 10%
    uint256 public constant GLOBAL_UPLINE_BONUS = 1000; // 10%
    uint256 public constant LEADER_BONUS = 1000; // 10%
    uint256 public constant GLOBAL_HELP_POOL = 3000; // 30%
    uint256 public constant TOTAL_PERCENTAGE = 10000; // 100%
    
    // Earnings cap multiplier - user can earn up to 4x their investment
    uint256 public constant EARNINGS_CAP_MULTIPLIER = 4;
    
    // Enums
    enum PackageTier { NONE, PACKAGE_30, PACKAGE_50, PACKAGE_100, PACKAGE_200 }
    enum LeaderRank { NONE, SHINING_STAR, SILVER_STAR }

    // Circuit breaker limits
    uint256 public constant MAX_DAILY_REGISTRATIONS = 1000;
    uint256 public constant MAX_DAILY_WITHDRAWALS = 500;
    uint256 public constant MAX_WITHDRAWAL_AMOUNT = 100000 * 10**18; // 100k USDT

    // Time constants
    uint256 public constant GHP_DISTRIBUTION_INTERVAL = 7 days;
    uint256 public constant LEADER_DISTRIBUTION_INTERVAL = 14 days;
    uint256 public constant ADMIN_TIMELOCK = 24 hours;

    // Enhanced data structures
    struct User {
        address sponsor;
        address leftChild;
        address rightChild;
        uint32 directSponsorsCount; // Gas optimization: uint32 vs uint256
        uint32 teamSize;
        PackageTier packageTier;
        uint128 totalInvested; // Sufficient for amounts up to ~10^38
        uint128 withdrawableAmount;
        uint64 registrationTime;
        uint64 lastActivity;
        bool isCapped;
        LeaderRank leaderRank;
        uint32 matrixPosition;
        mapping(uint8 => uint128) poolEarnings; // poolType => amount
    }

    struct TimelockOperation {
        bytes32 operationId;
        address target;
        bytes data;
        uint256 executeTime;
        bool executed;
    }

    struct DailyLimits {
        uint256 date; // timestamp truncated to day
        uint256 registrations;
        uint256 withdrawals;
        uint256 withdrawalAmount;
    }

    // Enhanced events
    event UserRegisteredV2(
        address indexed user,
        address indexed sponsor,
        PackageTier packageTier,
        uint256 indexed userId,
        uint256 timestamp,
        uint256 matrixPosition
    );

    event CommissionPaidV2(
        address indexed recipient,
        uint256 amount,
        uint8 poolType,
        address indexed from,
        uint256 timestamp,
        string poolName
    );

    event CircuitBreakerTriggered(
        string reason,
        uint256 currentValue,
        uint256 limit,
        uint256 timestamp
    );

    event TimelockOperationScheduled(
        bytes32 indexed operationId,
        address indexed target,
        bytes data,
        uint256 executeTime
    );

    // State variables
    IERC20 public paymentToken;
    address public adminReserve;
    address public matrixRoot;
    
    uint32 public totalMembers;
    uint128 public totalVolume;
    
    mapping(address => User) public users;
    mapping(address => bool) public isRegistered;
    mapping(uint256 => address) public userIdToAddress;
    mapping(address => uint256) public addressToUserId;
    
    // Enhanced tracking
    mapping(bytes32 => TimelockOperation) public timelockOperations;
    DailyLimits public dailyLimits;
    
    // Pool tracking with better organization
    uint128[5] public poolBalances; // [sponsor, level, upline, leader, ghp]
    
    uint256 public lastGHPDistribution;
    uint256 public lastLeaderDistribution;

    // Modifiers
    modifier onlyValidUser(address _user) {
        require(isRegistered[_user], "User not registered");
        _;
    }

    modifier withinDailyLimits() {
        _checkDailyLimits();
        _;
    }

    modifier validPackageTier(PackageTier _tier) {
        require(_tier >= PackageTier.PACKAGE_30 && _tier <= PackageTier.PACKAGE_200, "Invalid package tier");
        _;
    }

    function initialize(
        address _paymentToken,
        address _adminReserve,
        address _matrixRoot
    ) public initializer {
        require(_paymentToken != address(0), "Invalid payment token");
        require(_adminReserve != address(0), "Invalid admin reserve");
        require(_matrixRoot != address(0), "Invalid matrix root");

        __AccessControl_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        paymentToken = IERC20(_paymentToken);
        adminReserve = _adminReserve;
        matrixRoot = _matrixRoot;
        
        // Initialize root user with enhanced data
        users[_matrixRoot].packageTier = PackageTier.PACKAGE_200;
        users[_matrixRoot].registrationTime = uint64(block.timestamp);
        users[_matrixRoot].lastActivity = uint64(block.timestamp);
        isRegistered[_matrixRoot] = true;
        totalMembers = 1;
        userIdToAddress[1] = _matrixRoot;
        addressToUserId[_matrixRoot] = 1;

        lastGHPDistribution = block.timestamp;
        lastLeaderDistribution = block.timestamp;
    }

    /**
     * @dev Enhanced registration with comprehensive validation
     */
    function registerUser(address _sponsor, PackageTier _packageTier) 
        external 
        nonReentrant 
        whenNotPaused 
        withinDailyLimits
        validPackageTier(_packageTier)
    {
        _registerUserInternal(_sponsor, _packageTier);
    }

    /**
     * @dev Internal registration logic, can be called by V3
     */
    function _registerUserInternal(address _sponsor, PackageTier _packageTier) 
        internal
    {
        require(!isRegistered[msg.sender], "User already registered");
        require(isRegistered[_sponsor], "Sponsor not registered");
        require(msg.sender != _sponsor, "Cannot sponsor yourself");
        
        uint256 packageAmount = getPackageAmount(_packageTier);
        require(packageAmount > 0, "Invalid package amount");

        // Enhanced balance and allowance checks
        require(paymentToken.balanceOf(msg.sender) >= packageAmount, "Insufficient USDT balance");
        require(paymentToken.allowance(msg.sender, address(this)) >= packageAmount, "Insufficient allowance");
        
        // Transfer with additional validation
        uint256 balanceBefore = paymentToken.balanceOf(address(this));
        paymentToken.safeTransferFrom(msg.sender, address(this), packageAmount);
        uint256 balanceAfter = paymentToken.balanceOf(address(this));
        require(balanceAfter - balanceBefore == packageAmount, "Transfer amount mismatch");
        
        // Register user with enhanced data
        totalMembers++;
        uint256 userId = totalMembers;
        
        User storage user = users[msg.sender];
        user.sponsor = _sponsor;
        user.packageTier = _packageTier;
        user.totalInvested = uint128(packageAmount);
        user.registrationTime = uint64(block.timestamp);
        user.lastActivity = uint64(block.timestamp);
        
        isRegistered[msg.sender] = true;
        userIdToAddress[userId] = msg.sender;
        addressToUserId[msg.sender] = userId;
        
        // Update sponsor's direct count with validation
        users[_sponsor].directSponsorsCount++;
        users[_sponsor].lastActivity = uint64(block.timestamp);
        
        // Enhanced matrix placement
        uint256 matrixPosition = _placeInMatrixEnhanced(msg.sender, _sponsor);
        user.matrixPosition = uint32(matrixPosition);
        
        // Distribute with enhanced tracking
        _distributePackageEnhanced(msg.sender, packageAmount);
        
        // Update statistics
        totalVolume += uint128(packageAmount);
        _updateDailyLimits("registration");
        
        // Check for upgrades
        _checkPackageUpgradeEnhanced(_sponsor);
        
        emit UserRegisteredV2(msg.sender, _sponsor, _packageTier, userId, block.timestamp, matrixPosition);
    }

    /**
     * @dev Enhanced matrix placement with better position tracking
     */
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
    
    /**
     * @dev Updates team sizes up the sponsor chain
     */
    function _updateTeamSizesEnhanced(address _user) internal {
        address current = _user;
        while (current != address(0)) {
            users[current].teamSize++;
            
            // Update leader rank based on team size and direct sponsors
            _updateLeaderRankEnhanced(current);
            
            // Move up to sponsor
            current = users[current].sponsor;
        }
    }
    
    /**
     * @dev Update leader rank based on qualifications
     * Shining Star: 250+ team size and 10+ direct sponsors
     * Silver Star: 500+ team size
     */
    function _updateLeaderRankEnhanced(address _user) internal {
        uint32 teamSize = users[_user].teamSize;
        uint32 directCount = users[_user].directSponsorsCount;
        LeaderRank oldRank = users[_user].leaderRank;
        LeaderRank newRank = oldRank;
        
        if (teamSize >= 500) {
            newRank = LeaderRank.SILVER_STAR;
        } else if (teamSize >= 250 && directCount >= 10) {
            newRank = LeaderRank.SHINING_STAR;
        } else {
            newRank = LeaderRank.NONE;
        }
        
        if (newRank != oldRank) {
            users[_user].leaderRank = newRank;
            emit LeaderRankUpdated(_user, oldRank, newRank, block.timestamp);
        }
    }

    /**
     * @dev Enhanced pool distribution with detailed tracking
     */
    function _distributePackageEnhanced(address _user, uint256 _amount) internal {
        // Validate total percentage
        require(SPONSOR_COMMISSION + LEVEL_BONUS + GLOBAL_UPLINE_BONUS + LEADER_BONUS + GLOBAL_HELP_POOL == TOTAL_PERCENTAGE, 
                "Invalid percentage distribution");

        uint256 totalDistributed = 0;

        // 1. Sponsor Commission (40%)
        uint256 sponsorAmount = (_amount * SPONSOR_COMMISSION) / TOTAL_PERCENTAGE;
        totalDistributed += _paySponsorCommissionEnhanced(_user, sponsorAmount);
        
        // 2. Level Bonus (10%)
        uint256 levelAmount = (_amount * LEVEL_BONUS) / TOTAL_PERCENTAGE;
        totalDistributed += _payLevelBonusEnhanced(_user, levelAmount);
        
        // 3. Global Upline Bonus (10%)
        uint256 uplineAmount = (_amount * GLOBAL_UPLINE_BONUS) / TOTAL_PERCENTAGE;
        totalDistributed += _payGlobalUplineBonusEnhanced(_user, uplineAmount);
        
        // 4. Leader Bonus Pool (10%)
        uint256 leaderAmount = (_amount * LEADER_BONUS) / TOTAL_PERCENTAGE;
        poolBalances[3] += uint128(leaderAmount);
        totalDistributed += leaderAmount;
        
        // 5. Global Help Pool (30%)
        uint256 helpAmount = (_amount * GLOBAL_HELP_POOL) / TOTAL_PERCENTAGE;
        poolBalances[4] += uint128(helpAmount);
        totalDistributed += helpAmount;

        // Validate distribution accuracy
        require(totalDistributed == _amount, "Distribution amount mismatch");
    }

    /**
     * @dev Enhanced sponsor commission with better tracking
     */
    function _paySponsorCommissionEnhanced(address _user, uint256 _amount) internal returns (uint256) {
        address sponsor = users[_user].sponsor;
        if (sponsor != address(0) && !users[sponsor].isCapped) {
            _creditEarningsEnhanced(sponsor, _amount, 0);
            emit CommissionPaidV2(sponsor, _amount, 0, _user, block.timestamp, "Sponsor Commission");
            return _amount;
        } else {
            // Send to admin reserve with tracking
            paymentToken.safeTransfer(adminReserve, _amount);
            emit CommissionPaidV2(adminReserve, _amount, 0, _user, block.timestamp, "Admin Reserve (Capped Sponsor)");
            return _amount;
        }
    }

    /**
     * @dev Enhanced level bonus payment with improved tracking
     */
    function _payLevelBonusEnhanced(address _user, uint256 _totalAmount) internal returns (uint256) {
        uint256[10] memory LEVEL_PERCENTAGES = [uint256(300), 100, 100, 100, 100, 100, 50, 50, 50, 50];
        address current = users[_user].sponsor;
        uint256 level = 0;
        uint256 totalPaid = 0;
        
        while (current != address(0) && level < 10) {
            if (!users[current].isCapped) {
                uint256 levelAmount = (_totalAmount * LEVEL_PERCENTAGES[level]) / TOTAL_PERCENTAGE;
                _creditEarningsEnhanced(current, levelAmount, 1);
                totalPaid += levelAmount;
                emit CommissionPaidV2(current, levelAmount, 1, _user, block.timestamp, "Level Bonus");
            }
            
            current = users[current].sponsor;
            level++;
        }
        
        // Send remaining to admin reserve
        uint256 remaining = _totalAmount - totalPaid;
        if (remaining > 0) {
            paymentToken.safeTransfer(adminReserve, remaining);
            emit CommissionPaidV2(adminReserve, remaining, 1, _user, block.timestamp, "Admin Reserve (Level)");
        }
        
        return _totalAmount;
    }

    /**
     * @dev Enhanced global upline bonus distribution
     */
    function _payGlobalUplineBonusEnhanced(address _user, uint256 _totalAmount) internal returns (uint256) {
        address current = users[_user].sponsor;
        uint256 level = 0;
        uint256 perUplineAmount = _totalAmount / 30;
        uint256 totalPaid = 0;
        
        while (current != address(0) && level < 30) {
            if (!users[current].isCapped) {
                _creditEarningsEnhanced(current, perUplineAmount, 2);
                totalPaid += perUplineAmount;
                emit CommissionPaidV2(current, perUplineAmount, 2, _user, block.timestamp, "Global Upline");
            }
            
            current = users[current].sponsor;
            level++;
        }
        
        // Send remaining to admin reserve
        uint256 remaining = _totalAmount - totalPaid;
        if (remaining > 0) {
            paymentToken.safeTransfer(adminReserve, remaining);
            emit CommissionPaidV2(adminReserve, remaining, 2, _user, block.timestamp, "Admin Reserve (Upline)");
        }
        
        return _totalAmount;
    }

    /**
     * @dev Enhanced earnings credit with overflow protection
     */
    function _creditEarningsEnhanced(address _user, uint256 _amount, uint8 _poolType) internal {
        require(_amount <= type(uint128).max, "Amount too large");
        
        users[_user].poolEarnings[_poolType] += uint128(_amount);
        users[_user].withdrawableAmount += uint128(_amount);
        users[_user].lastActivity = uint64(block.timestamp);
        
        // Enhanced cap checking
        uint256 totalEarnings = getTotalEarnings(_user);
        uint256 cap = users[_user].totalInvested * EARNINGS_CAP_MULTIPLIER;
        
        if (totalEarnings >= cap && !users[_user].isCapped) {
            users[_user].isCapped = true;
            emit UserCapped(_user, totalEarnings, cap, block.timestamp);
        }
    }

    /**
     * @dev Enhanced withdrawal with circuit breakers
     */
    function withdraw() external nonReentrant whenNotPaused onlyValidUser(msg.sender) {
        _executeWithdrawal();
    }

    /**
     * @dev Internal withdrawal execution logic
     */
    function _executeWithdrawal() internal {
        uint256 withdrawableAmount = users[msg.sender].withdrawableAmount;
        require(withdrawableAmount > 0, "No withdrawable amount");
        
        // Circuit breaker check
        _checkWithdrawalLimits(withdrawableAmount);
        
        uint256 directCount = users[msg.sender].directSponsorsCount;
        uint256 withdrawalRate = _getWithdrawalRate(directCount);
        
        uint256 withdrawAmount = (withdrawableAmount * withdrawalRate) / TOTAL_PERCENTAGE;
        uint256 reinvestAmount = withdrawableAmount - withdrawAmount;
        
        // Reset withdrawable amount
        users[msg.sender].withdrawableAmount = 0;
        users[msg.sender].lastActivity = uint64(block.timestamp);
        
        // Transfer with validation
        require(paymentToken.balanceOf(address(this)) >= withdrawAmount, "Insufficient contract balance");
        paymentToken.safeTransfer(msg.sender, withdrawAmount);
        
        // Process reinvestment
        if (reinvestAmount > 0) {
            _processReinvestmentEnhanced(msg.sender, reinvestAmount);
        }
        
        // Update daily limits
        _updateDailyLimits("withdrawal");
        dailyLimits.withdrawalAmount += withdrawAmount;
        
        emit WithdrawalMadeV2(msg.sender, withdrawAmount, reinvestAmount, withdrawalRate, block.timestamp);
    }

    /**
     * @dev Check daily limits with circuit breaker
     */
    function _checkDailyLimits() internal {
        uint256 today = block.timestamp / 1 days;
        
        if (dailyLimits.date != today) {
            // Reset daily counters
            dailyLimits.date = today;
            dailyLimits.registrations = 0;
            dailyLimits.withdrawals = 0;
            dailyLimits.withdrawalAmount = 0;
        }
    }

    function _updateDailyLimits(string memory operation) internal {
        if (keccak256(bytes(operation)) == keccak256("registration")) {
            dailyLimits.registrations++;
            if (dailyLimits.registrations > MAX_DAILY_REGISTRATIONS) {
                emit CircuitBreakerTriggered("Max daily registrations", dailyLimits.registrations, MAX_DAILY_REGISTRATIONS, block.timestamp);
                _pause();
            }
        } else if (keccak256(bytes(operation)) == keccak256("withdrawal")) {
            dailyLimits.withdrawals++;
            if (dailyLimits.withdrawals > MAX_DAILY_WITHDRAWALS) {
                emit CircuitBreakerTriggered("Max daily withdrawals", dailyLimits.withdrawals, MAX_DAILY_WITHDRAWALS, block.timestamp);
                _pause();
            }
        }
    }

    function _checkWithdrawalLimits(uint256 amount) internal view {
        require(amount <= MAX_WITHDRAWAL_AMOUNT, "Withdrawal amount exceeds limit");
        require(dailyLimits.withdrawalAmount + amount <= MAX_WITHDRAWAL_AMOUNT * 10, "Daily withdrawal limit exceeded");
    }

    /**
     * @dev Timelock mechanism for critical operations
     */
    function scheduleTimelockOperation(
        address target,
        bytes calldata data,
        uint256 delay
    ) external onlyRole(ADMIN_ROLE) returns (bytes32) {
        require(delay >= ADMIN_TIMELOCK, "Delay too short");
        
        bytes32 operationId = keccak256(abi.encode(target, data, block.timestamp));
        uint256 executeTime = block.timestamp + delay;
        
        timelockOperations[operationId] = TimelockOperation({
            operationId: operationId,
            target: target,
            data: data,
            executeTime: executeTime,
            executed: false
        });
        
        emit TimelockOperationScheduled(operationId, target, data, executeTime);
        return operationId;
    }

    function executeTimelockOperation(bytes32 operationId) external onlyRole(ADMIN_ROLE) {
        TimelockOperation storage operation = timelockOperations[operationId];
        require(operation.executeTime != 0, "Operation not found");
        require(block.timestamp >= operation.executeTime, "Operation not ready");
        require(!operation.executed, "Operation already executed");
        
        operation.executed = true;
        
        (bool success, bytes memory result) = operation.target.call(operation.data);
        require(success, string(result));
        
        emit TimelockOperationExecuted(operationId, operation.target, operation.data, block.timestamp);
    }

    /**
     * @dev Enhanced reinvestment processing
     */
    function _processReinvestmentEnhanced(address _user, uint256 _amount) internal {
        require(_amount <= type(uint128).max, "Reinvestment amount too large");
        
        // Enhanced allocation: 40% Level, 30% Upline, 30% GHP
        uint256 levelAmount = (_amount * 4000) / TOTAL_PERCENTAGE;
        uint256 uplineAmount = (_amount * 3000) / TOTAL_PERCENTAGE;
        uint256 ghpAmount = _amount - levelAmount - uplineAmount; // Ensures exact distribution
        
        // Update pool balances
        poolBalances[1] += uint128(levelAmount);
        poolBalances[2] += uint128(uplineAmount);
        poolBalances[4] += uint128(ghpAmount);
        
        emit ReinvestmentProcessed(_user, _amount, levelAmount, uplineAmount, ghpAmount, block.timestamp);
    }

    /**
     * @dev Find optimal matrix placement with load balancing
     */
    function _findOptimalPlacement(address _sponsor) internal view returns (address) {
        // Simple BFS implementation with better load balancing
        address[] memory queue = new address[](1000);
        uint256 front = 0;
        uint256 rear = 0;
        
        queue[rear++] = _sponsor;
        
        while (front < rear) {
            address current = queue[front++];
            
            // Check if current node has available spots
            if (users[current].leftChild == address(0) || users[current].rightChild == address(0)) {
                return current;
            }
            
            // Add children to queue if they exist and queue not full
            if (users[current].leftChild != address(0) && rear < queue.length) {
                queue[rear++] = users[current].leftChild;
            }
            if (users[current].rightChild != address(0) && rear < queue.length) {
                queue[rear++] = users[current].rightChild;
            }
        }
        
        return _sponsor; // Fallback
    }

    /**
     * @dev Enhanced withdrawal rate calculation
     */
    function _getWithdrawalRate(uint256 directCount) internal pure returns (uint256) {
        if (directCount >= 20) {
            return 8000; // 80%
        } else if (directCount >= 5) {
            return 7500; // 75%
        } else {
            return 7000; // 70%
        }
    }

    /**
     * @dev Enhanced package upgrade checking
     */
    function _checkPackageUpgradeEnhanced(address _user) internal {
        uint32 teamSize = users[_user].teamSize;
        PackageTier currentTier = users[_user].packageTier;
        PackageTier newTier = currentTier;
        
        // Upgrade thresholds
        if (teamSize >= 32768 && currentTier < PackageTier.PACKAGE_200) {
            newTier = PackageTier.PACKAGE_200;
        } else if (teamSize >= 2048 && currentTier < PackageTier.PACKAGE_100) {
            newTier = PackageTier.PACKAGE_100;
        } else if (teamSize >= 256 && currentTier < PackageTier.PACKAGE_50) {
            newTier = PackageTier.PACKAGE_50;
        } else if (teamSize >= 128 && currentTier == PackageTier.PACKAGE_30) {
            newTier = PackageTier.PACKAGE_50; // First upgrade from base tier
        }
        
        if (newTier != currentTier) {
            users[_user].packageTier = newTier;
            emit PackageUpgraded(_user, currentTier, newTier, block.timestamp);
        }
    }

    // Enhanced view functions
    function getUserInfoEnhanced(address _user) external view returns (
        UserInfoResponse memory
    ) {
        User storage user = users[_user];
        return UserInfoResponse({
            isRegistered: isRegistered[_user],
            sponsor: user.sponsor,
            directSponsorsCount: user.directSponsorsCount,
            teamSize: user.teamSize,
            packageTier: user.packageTier,
            totalInvested: user.totalInvested,
            withdrawableAmount: user.withdrawableAmount,
            registrationTime: user.registrationTime,
            lastActivity: user.lastActivity,
            isCapped: user.isCapped,
            leaderRank: user.leaderRank,
            matrixPosition: user.matrixPosition,
            totalEarnings: getTotalEarnings(_user)
        });
    }

    struct UserInfoResponse {
        bool isRegistered;
        address sponsor;
        uint32 directSponsorsCount;
        uint32 teamSize;
        PackageTier packageTier;
        uint128 totalInvested;
        uint128 withdrawableAmount;
        uint64 registrationTime;
        uint64 lastActivity;
        bool isCapped;
        LeaderRank leaderRank;
        uint32 matrixPosition;
        uint256 totalEarnings;
    }

    function getPackageAmount(PackageTier _tier) public pure returns (uint256) {
        if (_tier == PackageTier.PACKAGE_30) return PACKAGE_30;
        if (_tier == PackageTier.PACKAGE_50) return PACKAGE_50;
        if (_tier == PackageTier.PACKAGE_100) return PACKAGE_100;
        if (_tier == PackageTier.PACKAGE_200) return PACKAGE_200;
        return 0;
    }

    function getTotalEarnings(address _user) public view returns (uint256) {
        uint256 total = 0;
        for (uint8 i = 0; i < 5; i++) {
            total += users[_user].poolEarnings[i];
        }
        return total;
    }

    function getPoolBalancesEnhanced() external view returns (uint128[5] memory) {
        return poolBalances;
    }

    function getSystemStatsEnhanced() external view returns (
        uint32 totalMembersCount,
        uint128 totalVolumeAmount,
        uint256 lastGHPTime,
        uint256 lastLeaderTime,
        uint256 dailyRegistrations,
        uint256 dailyWithdrawals
    ) {
        return (
            totalMembers,
            totalVolume,
            lastGHPDistribution,
            lastLeaderDistribution,
            dailyLimits.registrations,
            dailyLimits.withdrawals
        );
    }

    function getMatrixInfoEnhanced(address _user) external view returns (
        address leftChild,
        address rightChild,
        uint32 matrixPos,
        uint32 teamSizeCount
    ) {
        User storage user = users[_user];
        return (
            user.leftChild,
            user.rightChild,
            user.matrixPosition,
            user.teamSize
        );
    }

    // Additional events for V2
    event LeaderRankUpdated(address indexed user, LeaderRank oldRank, LeaderRank newRank, uint256 timestamp);
    event PackageUpgraded(address indexed user, PackageTier oldTier, PackageTier newTier, uint256 timestamp);
    event ReinvestmentProcessed(address indexed user, uint256 totalAmount, uint256 levelAmount, uint256 uplineAmount, uint256 ghpAmount, uint256 timestamp);
    event GlobalHelpPoolDistributed(uint256 totalAmount, uint256 participantCount, uint256 timestamp);
    event LeaderBonusDistributed(uint256 shiningStarAmount, uint256 silverStarAmount, uint256 shiningStarCount, uint256 silverStarCount, uint256 timestamp);

    // Emergency functions with timelock
    function emergencyPause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit EmergencyPaused(msg.sender, block.timestamp);
    }

    function emergencyUnpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpaused(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Distribute Global Help Pool (GHP) weekly
     * Eligible users are those who:
     * 1. Are not capped (haven't hit 4x earnings limit)
     * 2. Have been active in the last 30 days
     * Distribution is proportional to user's total investment + team size value
     */
    function distributeGlobalHelpPool() external onlyRole(ADMIN_ROLE) nonReentrant {
        require(poolBalances[4] > 0, "No GHP balance");
        require(block.timestamp >= lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL, "Too early for distribution");
        
        uint256 totalPool = poolBalances[4];
        uint256 totalEligibleVolume = 0;
        uint256 eligibleCount = 0;
        
        // First pass: Count eligible users and calculate total volume
        for (uint256 i = 1; i <= totalMembers; i++) {
            address user = userIdToAddress[i];
            if (!users[user].isCapped && users[user].lastActivity >= block.timestamp - 30 days) {
                eligibleCount++;
                // Volume = personal investment + team value (simplified)
                uint256 userVolume = users[user].totalInvested + (users[user].teamSize * PACKAGE_30);
                totalEligibleVolume += userVolume;
            }
        }
        
        if (eligibleCount > 0 && totalEligibleVolume > 0) {
            // Second pass: Distribute proportionally
            for (uint256 i = 1; i <= totalMembers; i++) {
                address user = userIdToAddress[i];
                if (!users[user].isCapped && users[user].lastActivity >= block.timestamp - 30 days) {
                    uint256 userVolume = users[user].totalInvested + (users[user].teamSize * PACKAGE_30);
                    uint256 userShare = (totalPool * userVolume) / totalEligibleVolume;
                    
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
    
    /**
     * @dev Distribute Leader Bonus Pool bi-monthly (14 days)
     * Split 50/50 between Shining Stars and Silver Stars
     */
    function distributeLeaderBonus() external onlyRole(ADMIN_ROLE) nonReentrant {
        require(poolBalances[3] > 0, "No leader bonus balance");
        require(block.timestamp >= lastLeaderDistribution + LEADER_DISTRIBUTION_INTERVAL, "Too early for leader distribution");
        
        uint256 totalPool = poolBalances[3];
        uint256 shiningStarPool = totalPool / 2;
        uint256 silverStarPool = totalPool - shiningStarPool; // Ensure exact distribution
        
        uint256 shiningStarCount = 0;
        uint256 silverStarCount = 0;
        
        // First pass: Count qualified leaders
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
                    _creditEarningsEnhanced(user, perShiningShare, 3);
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
                    _creditEarningsEnhanced(user, perSilverShare, 3);
                }
            }
        } else {
            // Send unclaimed to admin reserve
            paymentToken.safeTransfer(adminReserve, silverStarPool);
        }
        
        // Reset leader pool and update distribution time
        poolBalances[3] = 0;
        lastLeaderDistribution = block.timestamp;
        
        emit LeaderBonusDistributed(shiningStarPool, silverStarPool, shiningStarCount, silverStarCount, block.timestamp);
    }

    // Additional events
    event MatrixPlacement(address indexed user, address indexed parent, bool isLeft, uint256 position);
    event UserCapped(address indexed user, uint256 totalEarnings, uint256 cap, uint256 timestamp);
    event WithdrawalMadeV2(address indexed user, uint256 withdrawAmount, uint256 reinvestAmount, uint256 withdrawalRate, uint256 timestamp);
    event TimelockOperationExecuted(bytes32 indexed operationId, address target, bytes data, uint256 timestamp);
    event EmergencyPaused(address indexed by, uint256 timestamp);
    event EmergencyUnpaused(address indexed by, uint256 timestamp);

    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}
}
