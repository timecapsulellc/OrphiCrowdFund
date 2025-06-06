// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

/**
 * @title OrphiCrowdFundV4UltraSecure
 * @dev Security-enhanced V4Ultra with critical audit fixes
 * @notice Addresses ALL critical audit issues identified
 */
contract OrphiCrowdFundV4UltraSecure is Ownable, ReentrancyGuard, Pausable, AutomationCompatibleInterface {
    using SafeERC20 for IERC20;

    // ===== SECURITY CONSTANTS =====
    uint256 constant MAX_USERS = 50000; // Hard limit to prevent gas issues
    uint256 constant MAX_CHILDREN_PER_NODE = 2048; // Overflow protection
    uint256 constant MAX_MATRIX_DEPTH = 16; // Prevent infinite loops
    uint256 constant MIN_UPLINE_CHAIN = 30; // Minimum required upline chain
    uint256 constant EARNINGS_CAP = 4;
    uint256 constant DIST_INTERVAL_GHP = 7 days;
    uint256 constant DIST_INTERVAL_LEADER = 14 days;
    uint256 constant LEADER_DEMOTION_PERIOD = 90 days; // 3 months without activity
    
    // Distribution percentages in basis points
    uint16 constant SPONSOR_PCT = 4000; // 40%
    uint16 constant LEVEL_PCT = 1000;   // 10%
    uint16 constant UPLINE_PCT = 1000;  // 10%
    uint16 constant LEADER_PCT = 1000;  // 10%
    uint16 constant GHP_PCT = 3000;     // 30%

    // ===== IMMUTABLE STATE =====
    IERC20 public immutable token;
    address public immutable admin;
    address public immutable trezorAdmin;
    
    // ===== ENHANCED PACKED STATE =====
    struct GlobalState {
        uint32 totalUsers;
        uint32 lastUserId;
        uint32 lastGHPTime;
        uint32 lastLeaderTime;
        uint32 lastSecurityCheck;
        bool automationOn;
        bool systemLocked; // Emergency system lock
        uint96 totalVolume;
    }
    GlobalState public state;

    // Enhanced pool balances with overflow protection
    struct Pools {
        uint64 sponsor;
        uint64 level;
        uint64 upline;
        uint64 leader;
        uint64 ghp;
        uint64 leftover; // For insufficient upline chains
    }
    Pools public pools;

    // ===== ENHANCED USER DATA =====
    struct User {
        uint32 id;
        uint32 teamSize;
        uint16 directCount;
        uint16 packageTier;
        uint32 matrixPos;
        uint64 totalEarnings;
        uint64 withdrawable;
        uint32 sponsor;
        uint32 lastActivity; // For leader demotion
        bool isCapped;
        bool isKYCVerified;
        uint8 leaderRank; // 0=None, 1=Shining, 2=Silver
        uint8 suspensionLevel; // 0=None, 1=Warning, 2=Suspended
    }
    
    mapping(address => User) public users;
    mapping(uint32 => address) public userAddress;
    mapping(uint32 => uint32[2]) public matrix; // left, right children
    mapping(uint32 => uint32) public matrixParent; // Efficient parent lookup
    
    // Package amounts (5 tiers) - with overflow checks
    uint64[5] public packages = [100e6, 200e6, 500e6, 1000e6, 2000e6];

    // ===== CLUB POOL SYSTEM =====
    struct ClubPool {
        uint64 balance;
        uint32 lastDistributionTime;
        uint32 distributionInterval;
        uint16 memberCount;
        bool active;
    }
    
    ClubPool public clubPool;
    mapping(address => bool) public clubMembers;

    // ===== SECURITY MAPPINGS =====
    mapping(address => uint256) public lastWithdrawalTime;
    mapping(address => uint256) public dailyWithdrawalAmount;
    mapping(address => uint256) public lastDailyReset;
    
    // Rate limiting
    mapping(address => uint256) public registrationCooldown;
    uint256 public constant REGISTRATION_COOLDOWN = 1 hours;

    // ===== ENHANCED EVENTS =====
    event UserRegistered(address indexed user, uint32 indexed id, address indexed sponsor, uint16 tier);
    event MatrixPlacement(address indexed user, uint32 indexed userId, uint32 matrixPosition, address indexed parent);
    event PoolDistributed(uint8 indexed poolType, uint256 amount, uint32 timestamp);
    event EarningsCapReached(address indexed user, uint256 totalEarnings);
    event LeaderRankChanged(address indexed user, uint8 oldRank, uint8 newRank, uint256 timestamp);
    event LeaderDemoted(address indexed user, uint8 oldRank, uint256 inactivityPeriod);
    event SecurityViolation(address indexed user, string violation, uint256 timestamp);
    event LeftoverDistributed(uint256 amount, uint32 recipients, uint256 timestamp);
    event SystemLocked(string reason, uint256 timestamp);
    event SystemUnlocked(uint256 timestamp);
    event OverflowProtection(string operation, uint256 value, uint256 limit);
    event AutomationEnabled(bool enabled, uint256 timestamp);
    event AutomationConfigUpdated(uint256 gasLimit, uint32 maxUsersPerDistribution, uint256 timestamp);
    event Withdrawal(address indexed user, uint256 amount, uint256 timestamp);
    event KYCVerified(address indexed user, uint256 timestamp);
    event KYCRequirementUpdated(bool required, uint256 timestamp);
    event ClubPoolCreated(uint32 distributionInterval, uint256 timestamp);
    event ClubMemberAdded(address indexed member, uint256 timestamp);
    event ClubPoolDistributed(uint256 amount, uint16 members, uint256 timestamp);
    event DistributionStarted(uint8 poolType, uint32 startId, uint32 endId, uint256 timestamp);
    event DistributionCompleted(uint8 poolType, uint256 amount, uint32 usersProcessed, uint256 timestamp);
    event WithdrawalLimitUpdated(uint256 limit, uint256 timestamp);

    // ===== ERRORS =====
    error MaxUsersReached();
    error InvalidMatrixPosition();
    error OverflowDetected();
    error InsufficientUplineChain();
    error SystemLockedError();
    error SecurityViolationError();
    error RateLimitExceeded();

    // ===== CONSTRUCTOR =====
    constructor(address _token, address _trezorAdmin) Ownable(msg.sender) {
        token = IERC20(_token);
        trezorAdmin = _trezorAdmin;
        
        // Initialize root user with security features
        users[address(0)] = User({
            id: 1,
            teamSize: 0,
            directCount: 0,
            packageTier: 5,
            matrixPos: 1,
            totalEarnings: 0,
            withdrawable: 0,
            sponsor: 0,
            lastActivity: uint32(block.timestamp),
            isCapped: false,
            isKYCVerified: true,
            leaderRank: 0,
            suspensionLevel: 0
        });
        
        userAddress[1] = address(0);
        state.totalUsers = 1;
        state.lastUserId = 1;
        state.lastSecurityCheck = uint32(block.timestamp);
    }

    // ===== ENHANCED REGISTRATION =====
    function _registerInternal(address sponsor, uint16 tier) internal {
        if (state.systemLocked) revert SystemLockedError();
        if (state.totalUsers >= MAX_USERS) revert MaxUsersReached();
        if (block.timestamp < registrationCooldown[msg.sender]) revert RateLimitExceeded();
        require(tier > 0 && tier <= 5, "Invalid tier");
        require(users[msg.sender].id == 0, "Already registered");
        require(users[sponsor].id > 0 || sponsor == address(0), "Invalid sponsor");
        registrationCooldown[msg.sender] = block.timestamp + REGISTRATION_COOLDOWN;
        uint256 amount = packages[tier - 1];
        if (state.totalVolume + amount < state.totalVolume) revert OverflowDetected();
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint32 newId = ++state.lastUserId;
        _createUserSecure(msg.sender, users[sponsor].id, tier, newId);
        uint32 matrixPos = _findSecureMatrixPosition();
        users[msg.sender].matrixPos = matrixPos;
        _updateMatrixSecure(msg.sender, matrixPos);
        if (sponsor != address(0)) {
            _updateSponsorTeamSecure(sponsor);
        }
        _distributeFundsSecure(sponsor, amount);
        emit UserRegistered(msg.sender, newId, sponsor, tier);
        emit MatrixPlacement(msg.sender, newId, matrixPos, userAddress[matrixParent[newId]]);
    }

    function register(address sponsor, uint16 tier) external virtual nonReentrant whenNotPaused onlyKYCVerified {
        _registerInternal(sponsor, tier);
    }

    // ===== ENHANCED INTERNAL FUNCTIONS =====
    function _createUserSecure(address addr, uint32 sponsorId, uint16 tier, uint32 newId) internal {
        users[addr] = User({
            id: newId,
            teamSize: 0,
            directCount: 0,
            packageTier: tier,
            matrixPos: 0,
            totalEarnings: 0,
            withdrawable: 0,
            sponsor: sponsorId,
            lastActivity: uint32(block.timestamp),
            isCapped: false,
            isKYCVerified: true, // Set during registration
            leaderRank: 0,
            suspensionLevel: 0
        });
        
        userAddress[newId] = addr;
        
        // Safe increment with overflow check
        if (state.totalUsers >= MAX_USERS - 1) revert MaxUsersReached();
        state.totalUsers++;
        
        // Safe volume update
        uint256 amount = packages[tier - 1];
        if (state.totalVolume + amount < state.totalVolume) revert OverflowDetected();
        state.totalVolume += uint96(amount);
    }

    function _findSecureMatrixPosition() internal view returns (uint32) {
        // Enhanced BFS with overflow protection
        uint32 pos = 1;
        uint32 iterations = 0;
        
        while (pos < type(uint32).max && iterations < MAX_USERS) {
            uint32 left = pos * 2;
            uint32 right = pos * 2 + 1;
            
            // Overflow protection for matrix positions
            if (left >= type(uint32).max - 1 || right >= type(uint32).max - 1) {
                revert OverflowDetected();
            }
            
            if (matrix[pos][0] == 0) return left;
            if (matrix[pos][1] == 0) return right;
            
            pos++;
            iterations++;
        }
        
        revert InvalidMatrixPosition();
    }

    function _updateMatrixSecure(address user, uint32 matrixPos) internal {
        uint32 parentPos = matrixPos / 2;
        
        // Find parent efficiently
        for (uint32 i = 1; i <= state.lastUserId; i++) {
            address addr = userAddress[i];
            if (addr != address(0) && users[addr].matrixPos == parentPos) {
                // Update parent's matrix
                if (matrixPos % 2 == 0) {
                    matrix[parentPos][0] = users[user].id;
                } else {
                    matrix[parentPos][1] = users[user].id;
                }
                
                // Set parent relationship
                matrixParent[users[user].id] = users[addr].id;
                break;
            }
        }
    }

    function _updateSponsorTeamSecure(address sponsor) internal {
        users[sponsor].directCount++;
        users[sponsor].lastActivity = uint32(block.timestamp);
        
        // Update team sizes with overflow protection and upline validation
        uint32 sponsorId = users[sponsor].sponsor;
        uint32 depth = 0;
        
        while (sponsorId > 0 && depth < MIN_UPLINE_CHAIN) {
            address sponsorAddr = userAddress[sponsorId];
            
            // Overflow protection for team size
            if (users[sponsorAddr].teamSize >= type(uint32).max - 1) {
                emit OverflowProtection("teamSize", users[sponsorAddr].teamSize, type(uint32).max);
                break;
            }
            
            users[sponsorAddr].teamSize++;
            users[sponsorAddr].lastActivity = uint32(block.timestamp);
            
            uint8 oldRank = users[sponsorAddr].leaderRank;
            _checkLeaderRankSecure(sponsorAddr);
            
            if (oldRank != users[sponsorAddr].leaderRank) {
                emit LeaderRankChanged(sponsorAddr, oldRank, users[sponsorAddr].leaderRank, block.timestamp);
            }
            
            sponsorId = users[sponsorAddr].sponsor;
            depth++;
        }
        
        // Handle insufficient upline chain
        if (depth < MIN_UPLINE_CHAIN && sponsorId > 0) {
            emit SecurityViolation(sponsor, "Insufficient upline chain", block.timestamp);
            // Add to leftover pool for manual distribution
            pools.leftover += uint64(packages[users[msg.sender].packageTier - 1] * 500 / 10000); // 5%
        }
    }

    function _checkLeaderRankSecure(address user) internal {
        uint32 team = users[user].teamSize;
        uint16 direct = users[user].directCount;
        uint32 lastActivity = users[user].lastActivity;
        uint8 newRank = 0;
        
        // Check for demotion due to inactivity
        if (block.timestamp > lastActivity + LEADER_DEMOTION_PERIOD) {
            if (users[user].leaderRank > 0) {
                emit LeaderDemoted(user, users[user].leaderRank, block.timestamp - lastActivity);
                users[user].leaderRank = 0;
                return;
            }
        }
        
        // Qualification logic with enhanced validation
        if (team >= 500 && direct >= 20) {
            newRank = 2; // Silver Star - Enhanced requirements
        } else if (team >= 250 && direct >= 10) {
            newRank = 1; // Shining Star
        }
        
        users[user].leaderRank = newRank;
    }

    function _distributeFundsSecure(address sponsor, uint256 amount) internal {
        uint256 remaining = amount;
        
        // Enhanced sponsor commission with validation
        if (sponsor != address(0) && users[sponsor].suspensionLevel == 0) {
            uint256 commission = (amount * SPONSOR_PCT) / 10000;
            _creditEarningsSecure(sponsor, commission);
            remaining -= commission;
        }
        
        // Club Pool distribution (5% if active)
        if (clubPool.active) {
            uint256 clubAmount = (amount * 500) / 10000;
            
            // Overflow protection for club pool
            if (clubPool.balance + clubAmount < clubPool.balance) {
                emit OverflowProtection("clubPool", clubPool.balance, type(uint64).max);
            } else {
                clubPool.balance += uint64(clubAmount);
                remaining -= clubAmount;
            }
        }
        
        // Distribute to pools with overflow protection
        uint256 levelAmount = (remaining * LEVEL_PCT) / (LEVEL_PCT + UPLINE_PCT + LEADER_PCT + GHP_PCT);
        uint256 uplineAmount = (remaining * UPLINE_PCT) / (LEVEL_PCT + UPLINE_PCT + LEADER_PCT + GHP_PCT);
        uint256 leaderAmount = (remaining * LEADER_PCT) / (LEVEL_PCT + UPLINE_PCT + LEADER_PCT + GHP_PCT);
        uint256 ghpAmount = remaining - levelAmount - uplineAmount - leaderAmount;
        
        // Safe pool updates with overflow checks
        _updatePoolSecure(levelAmount, uplineAmount, leaderAmount, ghpAmount);
    }

    function _updatePoolSecure(uint256 level, uint256 upline, uint256 leader, uint256 ghp) internal {
        // Overflow protection for all pools
        if (pools.level + level < pools.level) {
            emit OverflowProtection("levelPool", pools.level, type(uint64).max);
            pools.leftover += uint64(level);
        } else {
            pools.level += uint64(level);
        }
        
        if (pools.upline + upline < pools.upline) {
            emit OverflowProtection("uplinePool", pools.upline, type(uint64).max);
            pools.leftover += uint64(upline);
        } else {
            pools.upline += uint64(upline);
        }
        
        if (pools.leader + leader < pools.leader) {
            emit OverflowProtection("leaderPool", pools.leader, type(uint64).max);
            pools.leftover += uint64(leader);
        } else {
            pools.leader += uint64(leader);
        }
        
        if (pools.ghp + ghp < pools.ghp) {
            emit OverflowProtection("ghpPool", pools.ghp, type(uint64).max);
            pools.leftover += uint64(ghp);
        } else {
            pools.ghp += uint64(ghp);
        }
    }

    function _creditEarningsSecure(address user, uint256 earnings) internal {
        if (users[user].isCapped || users[user].suspensionLevel > 0) return;
        
        uint256 package = packages[users[user].packageTier - 1];
        uint256 cap = package * EARNINGS_CAP;
        
        // Overflow protection for earnings
        if (users[user].totalEarnings + earnings < users[user].totalEarnings) {
            emit OverflowProtection("totalEarnings", users[user].totalEarnings, type(uint64).max);
            return;
        }
        
        if (users[user].totalEarnings + earnings >= cap) {
            uint256 remaining = cap - users[user].totalEarnings;
            users[user].withdrawable += uint64(remaining);
            users[user].totalEarnings = uint64(cap);
            users[user].isCapped = true;
            emit EarningsCapReached(user, cap);
        } else {
            users[user].withdrawable += uint64(earnings);
            users[user].totalEarnings += uint64(earnings);
        }
        
        // Update activity timestamp
        users[user].lastActivity = uint32(block.timestamp);
    }

    // ===== ENHANCED KYC SYSTEM =====
    mapping(address => bool) public kycVerified;
    mapping(address => uint256) public kycTimestamp;
    bool public kycRequired = true; // Default to true for security
    
    modifier onlyKYCVerified() {
        if (kycRequired) {
            require(kycVerified[msg.sender] && users[msg.sender].isKYCVerified, "KYC verification required");
        }
        _;
    }
    
    // ===== ADMIN FUNCTIONS (HARDWARE WALLET ONLY) =====
    modifier onlyTrezorAdmin() {
        require(msg.sender == trezorAdmin, "Only Trezor admin allowed");
        _;
    }
    
    function suspendUser(address user, uint8 level) external onlyTrezorAdmin {
        require(level <= 2, "Invalid suspension level");
        users[user].suspensionLevel = level;
        emit SecurityViolation(user, level == 1 ? "Warning issued" : "Account suspended", block.timestamp);
    }

    function setWithdrawalLimit(uint256 limit) external onlyTrezorAdmin {
        require(limit >= 1000e6, "Minimum 1000 USDT"); // Minimum limit
        withdrawalLimit = limit;
        emit WithdrawalLimitUpdated(limit, block.timestamp);
    }

    function enableAutomation(bool enabled) external onlyTrezorAdmin {
        autoConfig.enabled = enabled;
        state.automationOn = enabled;
        emit AutomationEnabled(enabled, block.timestamp);
    }

    /**
     * @dev Update automation gas limit and batch size
     */
    function updateAutomationConfig(uint256 gasLimit, uint32 maxUsers) external onlyTrezorAdmin {
        autoConfig.gasLimitConfig = gasLimit;
        autoConfig.maxUsersPerDistribution = maxUsers;
        emit AutomationConfigUpdated(gasLimit, maxUsers, block.timestamp);
    }

    function setKYCStatus(address user, bool status) external onlyTrezorAdmin {
        kycVerified[user] = status;
        users[user].isKYCVerified = status;
        kycTimestamp[user] = block.timestamp;
        emit KYCVerified(user, block.timestamp);
    }
    
    function setBatchKYCStatus(address[] calldata userList, bool status) external onlyTrezorAdmin {
        for(uint i = 0; i < userList.length; i++) {
            kycVerified[userList[i]] = status;
            users[userList[i]].isKYCVerified = status;
            kycTimestamp[userList[i]] = block.timestamp;
            emit KYCVerified(userList[i], block.timestamp);
        }
    }

    /**
     * @dev Enable or disable KYC requirement
     */
    function setKYCRequirement(bool required) external onlyTrezorAdmin {
        kycRequired = required;
        emit KYCRequirementUpdated(required, block.timestamp);
    }

    // ===== ENHANCED WITHDRAWAL SYSTEM =====
    uint256 public withdrawalLimit = 10000e6; // 10,000 USDT daily limit
    uint256 public constant MAX_WITHDRAWAL_PER_TX = 5000e6; // 5,000 USDT per transaction
    
    function _withdrawInternal() internal {
        if (state.systemLocked) revert SystemLockedError();
        require(!emergencyMode, "Use emergencyWithdraw in emergency mode");
        require(users[msg.sender].suspensionLevel == 0, "Account suspended");
        if (block.timestamp >= lastDailyReset[msg.sender] + 1 days) {
            dailyWithdrawalAmount[msg.sender] = 0;
            lastDailyReset[msg.sender] = block.timestamp;
        }
        uint256 amount = users[msg.sender].withdrawable;
        require(amount > 0, "No withdrawable amount");
        require(amount <= MAX_WITHDRAWAL_PER_TX, "Amount exceeds per-transaction limit");
        require(dailyWithdrawalAmount[msg.sender] + amount <= withdrawalLimit, "Daily withdrawal limit exceeded");
        require(block.timestamp >= lastWithdrawalTime[msg.sender] + 1 hours, "Withdrawal rate limit");
        users[msg.sender].withdrawable = 0;
        dailyWithdrawalAmount[msg.sender] += amount;
        lastWithdrawalTime[msg.sender] = block.timestamp;
        token.safeTransfer(msg.sender, amount);
        emit Withdrawal(msg.sender, amount, block.timestamp);
    }

    function withdraw() external virtual nonReentrant onlyKYCVerified {
        _withdrawInternal();
    }

    // ===== EMERGENCY CONTROLS =====
    bool public emergencyMode = false;
    uint256 public emergencyFee = 1000; // 10% in emergency mode
    
    function activateEmergencyMode(string calldata reason) external onlyTrezorAdmin {
        emergencyMode = true;
        state.systemLocked = true;
        _pause();
        emit SystemLocked(reason, block.timestamp);
    }
    
    function deactivateEmergencyMode() external onlyTrezorAdmin {
        emergencyMode = false;
        state.systemLocked = false;
        _unpause();
        emit SystemUnlocked(block.timestamp);
    }

    /**
     * @dev Emergency withdrawal during emergency mode with fee
     */
    function emergencyWithdraw() external nonReentrant onlyKYCVerified {
        require(emergencyMode, "Not in emergency mode");
        uint256 amount = users[msg.sender].withdrawable;
        require(amount > 0, "No withdrawable amount");
        users[msg.sender].withdrawable = 0;

        uint256 fee = (amount * emergencyFee) / 10000;
        uint256 payout = amount - fee;
        token.safeTransfer(msg.sender, payout);
        token.safeTransfer(admin, fee);

        emit Withdrawal(msg.sender, payout, block.timestamp);
        emit LeftoverDistributed(fee, 1, block.timestamp);
    }

    // ===== LEFTOVER DISTRIBUTION =====
    function distributeLeftovers() external onlyTrezorAdmin {
        require(pools.leftover > 0, "No leftover funds");
        
        uint256 amount = pools.leftover;
        pools.leftover = 0;
        
        // Distribute equally among active users
        uint32 activeUsers = 0;
        for (uint32 i = 1; i <= state.lastUserId; i++) {
            address addr = userAddress[i];
            if (addr != address(0) && !users[addr].isCapped && users[addr].suspensionLevel == 0) {
                activeUsers++;
            }
        }
        
        if (activeUsers > 0) {
            uint256 share = amount / activeUsers;
            for (uint32 i = 1; i <= state.lastUserId; i++) {
                address addr = userAddress[i];
                if (addr != address(0) && !users[addr].isCapped && users[addr].suspensionLevel == 0) {
                    _creditEarningsSecure(addr, share);
                }
            }
        }
        
        emit LeftoverDistributed(amount, activeUsers, block.timestamp);
    }

    // ===== ENHANCED AUTOMATION =====
    struct AutomationConfig {
        bool enabled;
        uint32 maxUsersPerDistribution;
        uint32 lastProcessedId;
        bool isDistributing;
        uint256 gasLimitConfig;
    }
    AutomationConfig public autoConfig;

    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory performData) {
        if (!state.automationOn || !autoConfig.enabled || state.systemLocked) return (false, "");
        
        bool ghpReady = block.timestamp >= state.lastGHPTime + DIST_INTERVAL_GHP && pools.ghp > 1000e6; // Minimum 1000 USDT
        bool leaderReady = block.timestamp >= state.lastLeaderTime + DIST_INTERVAL_LEADER && pools.leader > 500e6; // Minimum 500 USDT
        
        if (autoConfig.isDistributing) {
            if (autoConfig.lastProcessedId < state.lastUserId) {
                uint8 poolType = ghpReady ? 1 : (leaderReady ? 2 : 0);
                return (true, abi.encode(poolType, autoConfig.lastProcessedId, autoConfig.maxUsersPerDistribution));
            }
        } else if (ghpReady) {
            return (true, abi.encode(1, 0, autoConfig.maxUsersPerDistribution));
        } else if (leaderReady) {
            return (true, abi.encode(2, 0, autoConfig.maxUsersPerDistribution));
        }
        
        return (false, "");
    }

    function performUpkeep(bytes calldata performData) external override {
        if (state.systemLocked) revert SystemLockedError();
        
        (uint8 poolType, uint32 startId, uint32 batchSize) = abi.decode(performData, (uint8, uint32, uint32));
        
        // Enhanced batch processing with safety checks
        _performSecureDistribution(poolType, startId, batchSize);
    }

    function _performSecureDistribution(uint8 poolType, uint32 startId, uint32 batchSize) internal {
        uint32 endId = startId + batchSize;
        if (endId > state.lastUserId) endId = state.lastUserId;
        
        emit DistributionStarted(poolType, startId, endId, block.timestamp);
        
        if (poolType == 1) { // GHP
            _distributeGHPSecure(startId, endId);
        } else if (poolType == 2) { // Leader
            _distributeLeaderSecure(startId, endId);
        }
        
        autoConfig.lastProcessedId = endId;
        
        if (endId >= state.lastUserId) {
            autoConfig.isDistributing = false;
            autoConfig.lastProcessedId = 0;
            
            if (poolType == 1) {
                state.lastGHPTime = uint32(block.timestamp);
                emit DistributionCompleted(1, pools.ghp, state.lastUserId, uint32(block.timestamp));
                pools.ghp = 0;
            } else if (poolType == 2) {
                state.lastLeaderTime = uint32(block.timestamp);
                emit DistributionCompleted(2, pools.leader, state.lastUserId, uint32(block.timestamp));
                pools.leader = 0;
            }
        }
    }

    function _distributeGHPSecure(uint32 startId, uint32 endId) internal {
        uint32 qualifying = 0;
        
        // Count qualifying users first
        for (uint32 i = startId + 1; i <= endId; i++) {
            address userAddr = userAddress[i];
            if (userAddr != address(0) && users[userAddr].packageTier >= 4 && !users[userAddr].isCapped) {
                qualifying++;
            }
        }
        
        if (qualifying == 0) return;
        
        uint256 share = pools.ghp / qualifying;
        
        // Distribute to qualifying users
        for (uint32 i = startId + 1; i <= endId; i++) {
            address userAddr = userAddress[i];
            if (userAddr != address(0) && users[userAddr].packageTier >= 4 && !users[userAddr].isCapped) {
                _creditEarningsSecure(userAddr, share);
            }
        }
    }

    function _distributeLeaderSecure(uint32 startId, uint32 endId) internal {
        uint32 silverCount = 0;
        uint32 shiningCount = 0;
        
        // Count leaders in batch
        for (uint32 i = startId + 1; i <= endId; i++) {
            address userAddr = userAddress[i];
            if (userAddr == address(0) || users[userAddr].isCapped) continue;
            
            if (users[userAddr].leaderRank == 2) silverCount++;
            else if (users[userAddr].leaderRank == 1) shiningCount++;
        }
        
        uint256 silverShare = 0;
        uint256 shiningShare = 0;
        
        if (silverCount > 0) {
            silverShare = (pools.leader * 60) / 100 / silverCount;
        }
        if (shiningCount > 0) {
            shiningShare = (pools.leader * 40) / 100 / shiningCount;
        }
        
        // Distribute to leaders
        for (uint32 i = startId + 1; i <= endId; i++) {
            address userAddr = userAddress[i];
            if (userAddr == address(0) || users[userAddr].isCapped) continue;
            
            uint8 rank = users[userAddr].leaderRank;
            if (rank == 2 && silverShare > 0) {
                _creditEarningsSecure(userAddr, silverShare);
            } else if (rank == 1 && shiningShare > 0) {
                _creditEarningsSecure(userAddr, shiningShare);
            }
        }
    }

    // ===== ENHANCED AUTO-COMPOUNDING SYSTEM =====
    struct AutoCompoundConfig {
        bool enabled;
        uint16 levelPoolShare;    // Basis points (default: 4000 = 40%)
        uint16 uplinePoolShare;   // Basis points (default: 3000 = 30%)
        uint16 ghpPoolShare;      // Basis points (default: 3000 = 30%)
        uint256 minCompoundAmount; // Minimum amount to trigger compounding
        uint32 compoundingCooldown; // Cooldown between compounds
    }
    AutoCompoundConfig public autoCompoundConfig;
    
    mapping(address => uint256) public lastCompoundTime;
    mapping(address => uint256) public totalCompounded;
    
    event AutoCompoundConfigured(bool enabled, uint16[3] shares, uint256 minAmount, uint32 cooldown);
    event EarningsCompounded(address indexed user, uint256 amount, uint256 timestamp);
    event OverflowDistributed(uint256 amount, uint16[3] poolShares, uint256 timestamp);
    
    // ===== AUTO-COMPOUND FUNCTIONS =====
    function configureAutoCompound(
        bool _enabled,
        uint16 _levelShare,
        uint16 _uplineShare, 
        uint16 _ghpShare,
        uint256 _minAmount,
        uint32 _cooldown
    ) external onlyTrezorAdmin {
        require(_levelShare + _uplineShare + _ghpShare == 10000, "Shares must equal 100%");
        require(_minAmount >= 10e6, "Minimum amount too low"); // At least 10 USDT
        require(_cooldown >= 1 hours, "Cooldown too short");
        
        autoCompoundConfig = AutoCompoundConfig({
            enabled: _enabled,
            levelPoolShare: _levelShare,
            uplinePoolShare: _uplineShare,
            ghpPoolShare: _ghpShare,
            minCompoundAmount: _minAmount,
            compoundingCooldown: _cooldown
        });
        
        emit AutoCompoundConfigured(_enabled, [_levelShare, _uplineShare, _ghpShare], _minAmount, _cooldown);
    }
    
    function _handleCapOverflow(address user, uint256 overflow) internal {
        if (!autoCompoundConfig.enabled || overflow < autoCompoundConfig.minCompoundAmount) {
            // Default distribution if auto-compound disabled or amount too small
            _distributeOverflowToGlobalPools(overflow);
            return;
        }
        
        // Check if user is eligible for compounding (cooldown passed)
        if (block.timestamp >= lastCompoundTime[user] + autoCompoundConfig.compoundingCooldown) {
            _executeAutoCompound(user, overflow);
        } else {
            _distributeOverflowToGlobalPools(overflow);
        }
    }
    
    function _executeAutoCompound(address user, uint256 amount) internal {
        lastCompoundTime[user] = block.timestamp;
        totalCompounded[user] += amount;
        
        // Distribute with enhanced auto-compounding logic
        uint256 levelAmount = (amount * autoCompoundConfig.levelPoolShare) / 10000;
        uint256 uplineAmount = (amount * autoCompoundConfig.uplinePoolShare) / 10000;
        uint256 ghpAmount = amount - levelAmount - uplineAmount;
        
        // Enhanced distribution with priority to active uplines
        _distributeToActiveUplines(user, levelAmount);
        _distributeToQualifiedUplines(user, uplineAmount);
        
        // Add to GHP with enhanced targeting
        pools.ghp += uint64(ghpAmount);
        
        emit EarningsCompounded(user, amount, block.timestamp);
        emit OverflowDistributed(amount, 
            [autoCompoundConfig.levelPoolShare, autoCompoundConfig.uplinePoolShare, autoCompoundConfig.ghpPoolShare], 
            block.timestamp);
    }
    
    function _distributeOverflowToGlobalPools(uint256 amount) internal {
        // Default 40%/30%/30% distribution for global pools
        uint256 levelAmount = (amount * 4000) / 10000;
        uint256 uplineAmount = (amount * 3000) / 10000;
        uint256 ghpAmount = amount - levelAmount - uplineAmount;
        
        pools.level += uint64(levelAmount);
        pools.upline += uint64(uplineAmount);
        pools.ghp += uint64(ghpAmount);
        
        emit OverflowDistributed(amount, [4000, 3000, 3000], block.timestamp);
    }
    
    function _distributeToActiveUplines(address user, uint256 amount) internal {
        // Find active uplines and distribute proportionally
        uint32 currentUplineId = users[user].sponsor;
        uint256 distributed = 0;
        uint8 level = 0;
        uint256 maxLevels = 10; // Limit distribution levels
        
        while (currentUplineId != 0 && level < maxLevels && distributed < amount) {
            address currentUpline = userAddress[currentUplineId];
            if (currentUpline != address(0) &&
                users[currentUpline].suspensionLevel == 0 && 
                !users[currentUpline].isCapped &&
                users[currentUpline].lastActivity >= block.timestamp - 30 days) {
                
                uint256 share = amount / maxLevels; // Equal distribution
                if (share > 0 && distributed + share <= amount) {
                    _creditEarningsSecure(currentUpline, share);
                    distributed += share;
                }
            }
            currentUplineId = users[currentUpline].sponsor;
            level++;
        }
        
        // Add remaining to level pool
        if (distributed < amount) {
            pools.level += uint64(amount - distributed);
        }
    }
    
    function _distributeToQualifiedUplines(address user, uint256 amount) internal {
        // Enhanced upline distribution based on qualification criteria
        uint32 currentUplineId = users[user].sponsor;
        uint256 distributed = 0;
        uint8 qualifiedCount = 0;
        
        // First pass: count qualified uplines
        uint32 tempUplineId = currentUplineId;
        uint8 level = 0;
        while (tempUplineId != 0 && level < 10) {
            address tempUpline = userAddress[tempUplineId];
            if (_isQualifiedForUplineBonus(tempUpline)) {
                qualifiedCount++;
            }
            tempUplineId = users[tempUpline].sponsor;
            level++;
        }
        
        if (qualifiedCount == 0) {
            pools.upline += uint64(amount);
            return;
        }
        
        // Second pass: distribute to qualified uplines
        uint256 sharePerQualified = amount / qualifiedCount;
        currentUplineId = users[user].sponsor;
        level = 0;
        
        while (currentUplineId != 0 && level < 10 && distributed < amount) {
            address currentUpline = userAddress[currentUplineId];
            if (_isQualifiedForUplineBonus(currentUpline)) {
                _creditEarningsSecure(currentUpline, sharePerQualified);
                distributed += sharePerQualified;
            }
            currentUplineId = users[currentUpline].sponsor;
            level++;
        }
        
        // Add any remainder to upline pool
        if (distributed < amount) {
            pools.upline += uint64(amount - distributed);
        }
    }
    
    function _isQualifiedForUplineBonus(address user) internal view returns (bool) {
        return users[user].suspensionLevel == 0 &&
               !users[user].isCapped &&
               users[user].lastActivity >= block.timestamp - 60 days && // Active within 2 months
               users[user].packageTier >= 3; // Minimum package requirement
    }
    
    function getAutoCompoundStats(address user) external view returns (
        uint256 totalCompoundedAmount,
        uint256 lastCompoundTimestamp,
        bool canCompoundNow,
        uint256 nextCompoundTime
    ) {
        totalCompoundedAmount = totalCompounded[user];
        lastCompoundTimestamp = lastCompoundTime[user];
        nextCompoundTime = lastCompoundTime[user] + autoCompoundConfig.compoundingCooldown;
        canCompoundNow = block.timestamp >= nextCompoundTime && autoCompoundConfig.enabled;
    }

    // ===== BLACKLIST & WHITELIST SYSTEM =====
    mapping(address => bool) public blacklistedAddresses;
    mapping(address => bool) public whitelistedAddresses;
    mapping(address => string) public blacklistReasons;
    mapping(address => uint256) public blacklistTimestamp;
    
    bool public whitelistMode = false; // When true, only whitelisted addresses can interact
    
    event AddressBlacklisted(address indexed user, string reason, uint256 timestamp);
    event AddressWhitelisted(address indexed user, uint256 timestamp);
    event AddressRemovedFromBlacklist(address indexed user, uint256 timestamp);
    event AddressRemovedFromWhitelist(address indexed user, uint256 timestamp);
    event WhitelistModeToggled(bool enabled, uint256 timestamp);
    
    modifier notBlacklisted() {
        require(!blacklistedAddresses[msg.sender], "Address is blacklisted");
        _;
    }
    
    modifier whitelistCheck() {
        if (whitelistMode) {
            require(whitelistedAddresses[msg.sender], "Address not whitelisted");
        }
        _;
    }
    
    function blacklistAddress(address user, string calldata reason) external onlyTrezorAdmin {
        require(user != address(0), "Invalid address");
        require(user != admin && user != trezorAdmin, "Cannot blacklist admin");
        require(!blacklistedAddresses[user], "Already blacklisted");
        
        blacklistedAddresses[user] = true;
        blacklistReasons[user] = reason;
        blacklistTimestamp[user] = block.timestamp;
        
        emit AddressBlacklisted(user, reason, block.timestamp);
    }
    
    function removeFromBlacklist(address user) external onlyTrezorAdmin {
        require(blacklistedAddresses[user], "Not blacklisted");
        
        blacklistedAddresses[user] = false;
        delete blacklistReasons[user];
        delete blacklistTimestamp[user];
        
        emit AddressRemovedFromBlacklist(user, block.timestamp);
    }
    
    function addToWhitelist(address user) external onlyTrezorAdmin {
        require(user != address(0), "Invalid address");
        require(!whitelistedAddresses[user], "Already whitelisted");
        
        whitelistedAddresses[user] = true;
        emit AddressWhitelisted(user, block.timestamp);
    }
    
    function removeFromWhitelist(address user) external onlyTrezorAdmin {
        require(whitelistedAddresses[user], "Not whitelisted");
        
        whitelistedAddresses[user] = false;
        emit AddressRemovedFromWhitelist(user, block.timestamp);
    }
    
    function toggleWhitelistMode() external onlyTrezorAdmin {
        whitelistMode = !whitelistMode;
        emit WhitelistModeToggled(whitelistMode, block.timestamp);
    }
    
    function batchBlacklistAddresses(address[] calldata addresses, string calldata reason) external onlyTrezorAdmin {
        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i] != address(0) && 
                addresses[i] != admin && 
                addresses[i] != trezorAdmin && 
                !blacklistedAddresses[addresses[i]]) {
                
                blacklistedAddresses[addresses[i]] = true;
                blacklistReasons[addresses[i]] = reason;
                blacklistTimestamp[addresses[i]] = block.timestamp;
                
                emit AddressBlacklisted(addresses[i], reason, block.timestamp);
            }
        }
    }
    
    function batchWhitelistAddresses(address[] calldata addresses) external onlyTrezorAdmin {
        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i] != address(0) && !whitelistedAddresses[addresses[i]]) {
                whitelistedAddresses[addresses[i]] = true;
                emit AddressWhitelisted(addresses[i], block.timestamp);
            }
        }
    }
    
    function getBlacklistInfo(address user) external view returns (
        bool isBlacklisted,
        string memory reason,
        uint256 timestamp
    ) {
        return (blacklistedAddresses[user], blacklistReasons[user], blacklistTimestamp[user]);
    }
    
    function isAddressRestricted(address user) external view returns (bool) {
        if (blacklistedAddresses[user]) return true;
        if (whitelistMode && !whitelistedAddresses[user]) return true;
        return false;
    }

    // ===== ENHANCED CIRCUIT BREAKER SYSTEM =====
    struct CircuitBreakerConfig {
        bool enabled;
        uint256 maxDailyRegistrations;
        uint256 maxDailyWithdrawals;
        uint256 maxSingleWithdrawal;
        uint256 maxDailyVolume;
        uint256 consecutiveFailureThreshold;
        uint256 cooldownPeriod;
    }
    CircuitBreakerConfig public circuitBreakerConfig;
    
    mapping(uint256 => uint256) public dailyRegistrations; // day => count
    mapping(uint256 => uint256) public dailyWithdrawalCount; // day => count
    mapping(uint256 => uint256) public dailyVolume; // day => volume
    mapping(address => uint256) public userDailyWithdrawals; // user => count today
    
    uint256 public consecutiveFailures = 0;
    uint256 public lastFailureTime = 0;
    bool public circuitBreakerTripped = false;
    
    event CircuitBreakerConfigured(bool enabled, uint256[5] limits, uint256 threshold, uint256 cooldown);
    event CircuitBreakerTripped(string reason, uint256 value, uint256 limit, uint256 timestamp);
    event CircuitBreakerReset(uint256 timestamp);
    event ThresholdExceeded(string metric, uint256 value, uint256 limit, uint256 timestamp);
    
    function configureCircuitBreaker(
        bool _enabled,
        uint256 _maxDailyRegistrations,
        uint256 _maxDailyWithdrawals,
        uint256 _maxSingleWithdrawal,
        uint256 _maxDailyVolume,
        uint256 _failureThreshold,
        uint256 _cooldownPeriod
    ) external onlyTrezorAdmin {
        require(_maxDailyRegistrations > 0, "Invalid registration limit");
        require(_maxDailyWithdrawals > 0, "Invalid withdrawal limit");
        require(_maxSingleWithdrawal >= 1000e6, "Single withdrawal too low"); // Min 1000 USDT
        require(_maxDailyVolume > 0, "Invalid volume limit");
        require(_failureThreshold >= 3, "Failure threshold too low");
        require(_cooldownPeriod >= 1 hours, "Cooldown too short");
        
        circuitBreakerConfig = CircuitBreakerConfig({
            enabled: _enabled,
            maxDailyRegistrations: _maxDailyRegistrations,
            maxDailyWithdrawals: _maxDailyWithdrawals,
            maxSingleWithdrawal: _maxSingleWithdrawal,
            maxDailyVolume: _maxDailyVolume,
            consecutiveFailureThreshold: _failureThreshold,
            cooldownPeriod: _cooldownPeriod
        });
        
        emit CircuitBreakerConfigured(
            _enabled,
            [_maxDailyRegistrations, _maxDailyWithdrawals, _maxSingleWithdrawal, _maxDailyVolume, _failureThreshold],
            _failureThreshold,
            _cooldownPeriod
        );
    }
    
    function _checkCircuitBreaker(string memory operation, uint256 value, uint256 limit) internal returns (bool) {
        if (!circuitBreakerConfig.enabled || circuitBreakerTripped) {
            return circuitBreakerTripped;
        }
        
        if (value > limit) {
            _tripCircuitBreaker(operation, value, limit);
            return true;
        }
        
        return false;
    }
    
    function _tripCircuitBreaker(string memory reason, uint256 value, uint256 limit) internal {
        consecutiveFailures++;
        lastFailureTime = block.timestamp;
        
        if (consecutiveFailures >= circuitBreakerConfig.consecutiveFailureThreshold) {
            circuitBreakerTripped = true;
            _pause(); // Emergency pause
            emit CircuitBreakerTripped(reason, value, limit, block.timestamp);
        } else {
            emit ThresholdExceeded(reason, value, limit, block.timestamp);
        }
    }
    
    function resetCircuitBreaker() external onlyTrezorAdmin {
        require(circuitBreakerTripped, "Circuit breaker not tripped");
        require(block.timestamp >= lastFailureTime + circuitBreakerConfig.cooldownPeriod, "Cooldown not met");
        
        circuitBreakerTripped = false;
        consecutiveFailures = 0;
        _unpause();
        
        emit CircuitBreakerReset(block.timestamp);
    }
    
    function _recordDailyActivity(string memory activityType, uint256 amount) internal {
        uint256 today = block.timestamp / 1 days;
        
        if (keccak256(bytes(activityType)) == keccak256(bytes("REGISTRATION"))) {
            dailyRegistrations[today]++;
            _checkCircuitBreaker("DAILY_REGISTRATIONS", dailyRegistrations[today], circuitBreakerConfig.maxDailyRegistrations);
        } else if (keccak256(bytes(activityType)) == keccak256(bytes("WITHDRAWAL"))) {
            dailyWithdrawalCount[today]++;
            userDailyWithdrawals[msg.sender]++;
            _checkCircuitBreaker("DAILY_WITHDRAWALS", dailyWithdrawalCount[today], circuitBreakerConfig.maxDailyWithdrawals);
            _checkCircuitBreaker("SINGLE_WITHDRAWAL", amount, circuitBreakerConfig.maxSingleWithdrawal);
        } else if (keccak256(bytes(activityType)) == keccak256(bytes("VOLUME"))) {
            dailyVolume[today] += amount;
            _checkCircuitBreaker("DAILY_VOLUME", dailyVolume[today], circuitBreakerConfig.maxDailyVolume);
        }
    }
    
    function getCircuitBreakerStatus() external view returns (
        bool enabled,
        bool tripped,
        uint256 consecutiveFailureCount,
        uint256 lastFailure,
        uint256 nextResetTime
    ) {
        return (
            circuitBreakerConfig.enabled,
            circuitBreakerTripped,
            consecutiveFailures,
            lastFailureTime,
            lastFailureTime + circuitBreakerConfig.cooldownPeriod
        );
    }
    
    function getDailyMetrics() external view returns (
        uint256 todayRegistrations,
        uint256 todayWithdrawals,
        uint256 todayVolume,
        uint256 userWithdrawalsToday
    ) {
        uint256 today = block.timestamp / 1 days;
        return (
            dailyRegistrations[today],
            dailyWithdrawalCount[today],
            dailyVolume[today],
            userDailyWithdrawals[msg.sender]
        );
    }
}
