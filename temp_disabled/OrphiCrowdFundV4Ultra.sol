// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

/**
 * @title OrphiCrowdFundV4Ultra
 * @dev Ultra-optimized V4 with inline logic - Target: Under 24KB
 * @notice 2×∞ Forced Matrix MLM system with Chainlink automation
 */
contract OrphiCrowdFundV4Ultra is Ownable, ReentrancyGuard, Pausable, AutomationCompatibleInterface {
    using SafeERC20 for IERC20;

    // ===== PACKED CONSTANTS =====
    uint256 constant EARNINGS_CAP = 4;
    uint256 constant DIST_INTERVAL_GHP = 7 days;
    uint256 constant DIST_INTERVAL_LEADER = 14 days;
    
    // Distribution percentages in basis points (optimized storage)
    uint16 constant SPONSOR_PCT = 4000; // 40%
    uint16 constant LEVEL_PCT = 1000;   // 10%
    uint16 constant UPLINE_PCT = 1000;  // 10%
    uint16 constant LEADER_PCT = 1000;  // 10%
    uint16 constant GHP_PCT = 3000;     // 30%

    // ===== IMMUTABLE STATE =====
    IERC20 public immutable token;
    address public immutable admin;
    
    // ===== PACKED STATE =====
    struct GlobalState {
        uint32 totalUsers;
        uint32 lastUserId;
        uint32 lastGHPTime;
        uint32 lastLeaderTime;
        bool automationOn;
        uint96 totalVolume; // Supports up to ~79B tokens with 6 decimals
    }
    GlobalState public state;

    // Pool balances (packed)
    struct Pools {
        uint64 sponsor;
        uint64 level;
        uint64 upline;
        uint64 leader;
        uint64 ghp;
    }
    Pools public pools;

    // ===== USER DATA =====
    struct User {
        uint32 id;
        uint32 teamSize;
        uint16 directCount;
        uint16 packageTier;
        uint32 matrixPos;
        uint64 totalEarnings;
        uint64 withdrawable;
        uint32 sponsor;
        bool isCapped;
        uint8 leaderRank; // 0=None, 1=Shining, 2=Silver
    }
    
    mapping(address => User) public users;
    mapping(uint32 => address) public userAddress;
    mapping(uint32 => uint32[2]) public matrix; // left, right children
    
    // Package amounts (5 tiers)
    uint64[5] public packages = [100e6, 200e6, 500e6, 1000e6, 2000e6];

    // ===== EVENTS =====
    event UserRegistered(address indexed user, uint32 indexed id, address indexed sponsor, uint16 tier);
    event PoolDistributed(uint8 indexed poolType, uint256 amount, uint32 timestamp);
    event EarningsCapReached(address indexed user, uint256 totalEarnings);

    // ===== CONSTRUCTOR =====
    constructor(address _token, address _admin) Ownable(msg.sender) {
        token = IERC20(_token);
        admin = _admin;
        
        // Initialize root user
        _createUser(address(0), 0, 0);
        state.totalUsers = 1;
        state.lastUserId = 1;
    }

    // ===== REGISTRATION =====
    function register(address sponsor, uint16 tier) external nonReentrant whenNotPaused onlyKYCVerified {
        require(tier > 0 && tier <= 5, "Invalid tier");
        require(users[msg.sender].id == 0, "Already registered");
        require(users[sponsor].id > 0 || sponsor == address(0), "Invalid sponsor");
        
        uint256 amount = packages[tier - 1];
        token.safeTransferFrom(msg.sender, address(this), amount);
        
        // Create user
        uint32 newId = ++state.lastUserId;
        _createUser(msg.sender, users[sponsor].id, tier);
        users[msg.sender].id = newId;
        userAddress[newId] = msg.sender;
        state.totalUsers++;
        state.totalVolume += uint96(amount);
        
        // Place in matrix
        uint32 matrixPos = _findMatrixPosition();
        users[msg.sender].matrixPos = matrixPos;
        
        // Update upline's matrix
        uint32 parentPos = matrixPos / 2;
        address parentAddr = address(0);
        
        for (uint32 i = 1; i <= state.lastUserId; i++) {
            address addr = userAddress[i];
            if (addr == address(0)) continue;
            
            if (users[addr].matrixPos == parentPos) {
                parentAddr = addr;
                break;
            }
        }
        
        if (parentAddr != address(0)) {
            // Add to parent's matrix
            if (matrixPos % 2 == 0) {
                matrix[parentPos][0] = users[msg.sender].id;
            } else {
                matrix[parentPos][1] = users[msg.sender].id;
            }
        }
        
        // Update sponsor team
        if (sponsor != address(0)) {
            users[sponsor].directCount++;
            _updateTeamSizes(sponsor);
        }
        
        // Distribute funds
        _distributeFunds(sponsor, amount);
        
        emit UserRegistered(msg.sender, newId, sponsor, tier);
        emit MatrixPlacement(msg.sender, newId, matrixPos, parentAddr);
        emit TransactionActivity("register", msg.sender, amount, block.timestamp);
    }
    
    event MatrixPlacement(address indexed user, uint32 indexed userId, uint32 matrixPosition, address indexed parent);
    event TransactionActivity(string activityType, address indexed user, uint256 amount, uint256 timestamp);

    // ===== INTERNAL FUNCTIONS =====
    function _createUser(address addr, uint32 sponsorId, uint16 tier) internal {
        users[addr] = User({
            id: 0, // Set externally
            teamSize: 0,
            directCount: 0,
            packageTier: tier,
            matrixPos: 0,
            totalEarnings: 0,
            withdrawable: 0,
            sponsor: sponsorId,
            isCapped: false,
            leaderRank: 0
        });
    }

    function _findMatrixPosition() internal view returns (uint32) {
        // Simple BFS to find next available position
        uint32 pos = 1;
        while (pos < type(uint32).max) {
            uint32 left = pos * 2;
            uint32 right = pos * 2 + 1;
            
            if (matrix[pos][0] == 0) return left;
            if (matrix[pos][1] == 0) return right;
            pos++;
        }
        return pos;
    }

    function _updateTeamSizes(address user) internal {
        uint32 sponsorId = users[user].sponsor;
        while (sponsorId > 0) {
            address sponsorAddr = userAddress[sponsorId];
            users[sponsorAddr].teamSize++;
            _checkLeaderRank(sponsorAddr);
            sponsorId = users[sponsorAddr].sponsor;
        }
    }

    function _checkLeaderRank(address user) internal {
        uint32 team = users[user].teamSize;
        uint16 direct = users[user].directCount;
        uint8 newRank = 0;
        
        if (team >= 500) newRank = 2; // Silver Star
        else if (team >= 250 && direct >= 10) newRank = 1; // Shining Star
        
        users[user].leaderRank = newRank;
    }

    function _distributeFunds(address sponsor, uint256 amount) internal {
        uint256 remaining = amount;
        
        // Sponsor commission
        if (sponsor != address(0)) {
            uint256 commission = (amount * SPONSOR_PCT) / 10000;
            _creditEarnings(sponsor, commission);
            remaining -= commission;
        }
        
        // Club Pool (5% if active)
        if (clubPool.active) {
            uint256 clubAmount = (amount * 500) / 10000; // 5%
            clubPool.balance += uint64(clubAmount);
            remaining -= clubAmount;
        }
        
        // Adjust percentages for remaining pools based on remaining amount
        uint256 levelAmount = (remaining * LEVEL_PCT) / (LEVEL_PCT + UPLINE_PCT + LEADER_PCT + GHP_PCT);
        uint256 uplineAmount = (remaining * UPLINE_PCT) / (LEVEL_PCT + UPLINE_PCT + LEADER_PCT + GHP_PCT);
        uint256 leaderAmount = (remaining * LEADER_PCT) / (LEVEL_PCT + UPLINE_PCT + LEADER_PCT + GHP_PCT);
        uint256 ghpAmount = remaining - levelAmount - uplineAmount - leaderAmount;
        
        // Update pools
        pools.level += uint64(levelAmount);
        pools.upline += uint64(uplineAmount);
        pools.leader += uint64(leaderAmount);
        pools.ghp += uint64(ghpAmount);
    }

    function _creditEarnings(address user, uint256 earnings) internal {
        if (users[user].isCapped) return;
        
        uint256 package = packages[users[user].packageTier - 1];
        uint256 cap = package * EARNINGS_CAP;
        
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
    }

    // ===== CHAINLINK AUTOMATION CONFIGURATION =====
    uint256 public gasLimitConfig = 3000000; // Default gas limit
    
    // Chainlink Automation Variables
    struct AutomationConfig {
        bool enabled;
        uint32 maxUsersPerDistribution;
        uint32 lastProcessedId;
        bool isDistributing;
    }
    AutomationConfig public autoConfig;
    
    // Distribution cache for gas optimization
    struct DistributionCache {
        uint256 ghpTotalQualifying;
        uint256 ghpSharePerUser;
        uint256 leaderSilverCount;
        uint256 leaderShiningCount;
        uint256 leaderSilverShare;
        uint256 leaderShiningShare;
        bool isInitialized;
        uint8 poolType; // 1=GHP, 2=Leader
    }
    DistributionCache private distCache;
    
    event AutomationEnabled(bool enabled, uint256 timestamp);
    event AutomationConfigUpdated(uint256 gasLimit, uint32 maxUsers, uint256 timestamp);
    event DistributionStarted(uint8 poolType, uint32 startId, uint32 endId, uint256 timestamp);
    event DistributionCompleted(uint8 poolType, uint256 amount, uint32 usersProcessed, uint256 timestamp);

    function updateAutomationConfig(uint256 _gasLimit, uint32 _maxUsers) external onlyOwner {
        gasLimitConfig = _gasLimit;
        autoConfig.maxUsersPerDistribution = _maxUsers;
        emit AutomationConfigUpdated(_gasLimit, _maxUsers, block.timestamp);
    }

    function enableAutomation(bool enabled) external onlyOwner {
        autoConfig.enabled = enabled;
        state.automationOn = enabled;
        emit AutomationEnabled(enabled, block.timestamp);
    }

    // Enhanced Chainlink Automation functionality
    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory performData) {
        if (!state.automationOn || !autoConfig.enabled) return (false, "");
        
        bool ghpReady = block.timestamp >= state.lastGHPTime + DIST_INTERVAL_GHP && pools.ghp > 0;
        bool leaderReady = block.timestamp >= state.lastLeaderTime + DIST_INTERVAL_LEADER && pools.leader > 0;
        
        // Check if there's an incomplete distribution
        if (autoConfig.isDistributing) {
            if (autoConfig.lastProcessedId < state.lastUserId) {
                uint8 poolType = ghpReady ? 1 : (leaderReady ? 2 : 0);
                return (true, abi.encode(poolType, autoConfig.lastProcessedId, autoConfig.maxUsersPerDistribution));
            }
        } else if (ghpReady) {
            return (true, abi.encode(1, 0, autoConfig.maxUsersPerDistribution)); // GHP distribution
        } else if (leaderReady) {
            return (true, abi.encode(2, 0, autoConfig.maxUsersPerDistribution)); // Leader distribution
        }
        
        return (false, "");
    }

    function performUpkeep(bytes calldata performData) external override {
        (uint8 poolType, uint32 startId, uint32 batchSize) = abi.decode(performData, (uint8, uint32, uint32));
        
        uint32 endId = startId + batchSize;
        if (endId > state.lastUserId) {
            endId = state.lastUserId;
        }
        
        emit DistributionStarted(poolType, startId, endId, block.timestamp);
        
        // Initialize distribution cache on first batch
        if (startId == 0) {
            autoConfig.isDistributing = true;
            _initializeDistributionCache(poolType);
        }
        
        // Process batch
        if (poolType == 1) {
            _distributeGHPBatch(startId, endId);
        } else if (poolType == 2) {
            _distributeLeaderBatch(startId, endId);
        }
        
        autoConfig.lastProcessedId = endId;
        
        // Check if distribution is complete
        if (endId >= state.lastUserId) {
            autoConfig.isDistributing = false;
            autoConfig.lastProcessedId = 0;
            
            // Final update based on pool type
            if (poolType == 1) {
                state.lastGHPTime = uint32(block.timestamp);
                emit DistributionCompleted(1, pools.ghp, state.lastUserId, uint32(block.timestamp));
                pools.ghp = 0;
            } else if (poolType == 2) {
                state.lastLeaderTime = uint32(block.timestamp);
                emit DistributionCompleted(2, pools.leader, state.lastUserId, uint32(block.timestamp));
                pools.leader = 0;
            }
            
            // Clear cache
            _clearDistributionCache();
        }
    }

    // Initialize distribution calculations once per full distribution
    function _initializeDistributionCache(uint8 poolType) internal {
        distCache.poolType = poolType;
        distCache.isInitialized = true;
        
        if (poolType == 1) {
            // GHP Distribution
            uint32 qualifying = 0;
            for (uint32 i = 1; i <= state.lastUserId; i++) {
                address userAddr = userAddress[i];
                if (userAddr != address(0) && users[userAddr].packageTier >= 4) {
                    qualifying++;
                }
            }
            
            distCache.ghpTotalQualifying = qualifying;
            distCache.ghpSharePerUser = qualifying > 0 ? pools.ghp / qualifying : 0;
            
        } else if (poolType == 2) {
            // Leader Distribution
            uint32 silverCount = 0;
            uint32 shiningCount = 0;
            
            for (uint32 i = 1; i <= state.lastUserId; i++) {
                address userAddr = userAddress[i];
                if (userAddr == address(0)) continue;
                
                if (users[userAddr].leaderRank == 2) silverCount++;
                else if (users[userAddr].leaderRank == 1) shiningCount++;
            }
            
            distCache.leaderSilverCount = silverCount;
            distCache.leaderShiningCount = shiningCount;
            
            // Calculate shares with proper distribution
            if (silverCount > 0) {
                distCache.leaderSilverShare = (pools.leader * 60) / 100 / silverCount;
            }
            if (shiningCount > 0) {
                distCache.leaderShiningShare = (pools.leader * 40) / 100 / shiningCount;
            }
        }
    }
    
    function _clearDistributionCache() internal {
        delete distCache;
    }

    // Optimized batch distributions with caching
    function _distributeGHPBatch(uint32 startId, uint32 endId) internal {
        require(distCache.isInitialized && distCache.poolType == 1, "Cache not initialized for GHP");
        
        // Early exit if no qualifying users or no share
        if (distCache.ghpTotalQualifying == 0 || distCache.ghpSharePerUser == 0) {
            return;
        }
        
        // Single loop to distribute to qualifying users in batch
        for (uint32 i = startId + 1; i <= endId; i++) {
            address userAddr = userAddress[i];
            if (userAddr == address(0)) continue;
            
            // Only check tier and distribute - no calculations needed
            if (users[userAddr].packageTier >= 4) {
                _creditEarnings(userAddr, distCache.ghpSharePerUser);
            }
        }
    }

    function _distributeLeaderBatch(uint32 startId, uint32 endId) internal {
        require(distCache.isInitialized && distCache.poolType == 2, "Cache not initialized for Leader");
        
        // Early exit if no leaders or no shares
        if (distCache.leaderSilverCount == 0 && distCache.leaderShiningCount == 0) {
            return;
        }
        
        // Single loop to distribute to leaders in batch
        for (uint32 i = startId + 1; i <= endId; i++) {
            address userAddr = userAddress[i];
            if (userAddr == address(0)) continue;
            
            uint8 rank = users[userAddr].leaderRank;
            if (rank == 2 && distCache.leaderSilverShare > 0) {
                _creditEarnings(userAddr, distCache.leaderSilverShare);
            } else if (rank == 1 && distCache.leaderShiningShare > 0) {
                _creditEarnings(userAddr, distCache.leaderShiningShare);
            }
        }
    }

    // ===== KYC INTEGRATION =====
    mapping(address => bool) public kycVerified;
    bool public kycRequired = false;
    
    event KYCVerified(address indexed user, uint256 timestamp);
    event KYCRequirementUpdated(bool required, uint256 timestamp);
    
    modifier onlyKYCVerified() {
        if (kycRequired) {
            require(kycVerified[msg.sender], "KYC verification required");
        }
        _;
    }
    
    function setKYCStatus(address user, bool status) external onlyOwner {
        kycVerified[user] = status;
        emit KYCVerified(user, block.timestamp);
    }
    
    function setKYCRequired(bool required) external onlyOwner {
        kycRequired = required;
        emit KYCRequirementUpdated(required, block.timestamp);
    }
    
    function setBatchKYCStatus(address[] calldata userList, bool status) external onlyOwner {
        for(uint i = 0; i < userList.length; i++) {
            kycVerified[userList[i]] = status;
            emit KYCVerified(userList[i], block.timestamp);
        }
    }
    
    // ===== ENHANCED SECURITY =====
    uint256 private constant MAX_EMERGENCY_FEE = 1000; // 10% max in basis points
    uint256 public emergencyFee = 0; // Default 0%
    bool public emergencyMode = false;
    
    event EmergencyModeActivated(uint256 fee, uint256 timestamp);
    event EmergencyModeDeactivated(uint256 timestamp);
    event EmergencyWithdrawal(address indexed user, uint256 amount, uint256 fee, uint256 timestamp);
    
    function activateEmergencyMode(uint256 fee) external onlyOwner {
        require(fee <= MAX_EMERGENCY_FEE, "Fee too high");
        emergencyFee = fee;
        emergencyMode = true;
        _pause();
        emit EmergencyModeActivated(fee, block.timestamp);
    }
    
    function deactivateEmergencyMode() external onlyOwner {
        emergencyMode = false;
        _unpause();
        emit EmergencyModeDeactivated(block.timestamp);
    }
    
    function emergencyWithdraw() external nonReentrant {
        require(emergencyMode, "Emergency mode not active");
        
        uint256 amount = users[msg.sender].withdrawable;
        require(amount > 0, "No withdrawable amount");
        
        users[msg.sender].withdrawable = 0;
        
        uint256 feeAmount = (amount * emergencyFee) / 10000;
        uint256 netAmount = amount - feeAmount;
        
        if (feeAmount > 0) {
            token.safeTransfer(admin, feeAmount);
        }
        
        token.safeTransfer(msg.sender, netAmount);
        emit EmergencyWithdrawal(msg.sender, amount, feeAmount, block.timestamp);
    }
    
    // Circuit breaker mechanism
    uint256 public withdrawalLimit = type(uint256).max;
    uint256 public dailyWithdrawalTotal = 0;
    uint256 public lastWithdrawalReset = 0;
    
    event WithdrawalLimitUpdated(uint256 limit, uint256 timestamp);
    event WithdrawalLimitReset(uint256 timestamp);
    
    function setWithdrawalLimit(uint256 limit) external onlyOwner {
        withdrawalLimit = limit;
        emit WithdrawalLimitUpdated(limit, block.timestamp);
    }
    
    function resetDailyWithdrawalTotal() external onlyOwner {
        dailyWithdrawalTotal = 0;
        lastWithdrawalReset = block.timestamp;
        emit WithdrawalLimitReset(block.timestamp);
    }
    
    // ===== ADMIN FUNCTIONS =====
    function withdraw() external nonReentrant onlyKYCVerified {
        require(!emergencyMode, "Use emergencyWithdraw in emergency mode");
        
        // Reset daily withdrawal limit if 24 hours passed
        if (block.timestamp >= lastWithdrawalReset + 1 days) {
            dailyWithdrawalTotal = 0;
            lastWithdrawalReset = block.timestamp;
        }
        
        uint256 amount = users[msg.sender].withdrawable;
        require(amount > 0, "No withdrawable amount");
        
        // Check withdrawal limit
        require(dailyWithdrawalTotal + amount <= withdrawalLimit, "Daily withdrawal limit exceeded");
        
        users[msg.sender].withdrawable = 0;
        dailyWithdrawalTotal += amount;
        
        token.safeTransfer(msg.sender, amount);
        
        emit Withdrawal(msg.sender, amount, block.timestamp);
    }
    
    event Withdrawal(address indexed user, uint256 amount, uint256 timestamp);

    // Emergency functions
    function emergencyPause() external onlyOwner {
        _pause();
    }

    function emergencyUnpause() external onlyOwner {
        _unpause();
    }

    function emergencyWithdraw(uint256 amount) external onlyOwner {
        token.safeTransfer(owner(), amount);
    }

    // ===== VIEW FUNCTIONS =====
    function getUserInfo(address user) external view returns (User memory) {
        return users[user];
    }

    function getPoolBalances() external view returns (uint256[5] memory) {
        return [pools.sponsor, pools.level, pools.upline, pools.leader, pools.ghp];
    }

    function getGlobalStats() external view returns (uint32, uint96, bool) {
        return (state.totalUsers, state.totalVolume, state.automationOn);
    }
    
    // ===== CLUB POOL IMPLEMENTATION =====
    struct ClubPool {
        uint64 balance;
        uint32 lastDistributionTime;
        uint32 distributionInterval;
        uint16 memberCount;
        bool active;
    }
    
    ClubPool public clubPool;
    mapping(address => bool) public clubMembers;
    
    event ClubPoolCreated(uint32 distributionInterval, uint256 timestamp);
    event ClubPoolDistributed(uint256 amount, uint16 members, uint256 timestamp);
    event ClubMemberAdded(address indexed member, uint256 timestamp);
    event ClubMemberRemoved(address indexed member, uint256 timestamp);
    
    function createClubPool(uint32 distributionInterval) external onlyOwner {
        require(!clubPool.active, "Club pool already exists");
        
        clubPool = ClubPool({
            balance: 0,
            lastDistributionTime: uint32(block.timestamp),
            distributionInterval: distributionInterval,
            memberCount: 0,
            active: true
        });
        
        emit ClubPoolCreated(distributionInterval, block.timestamp);
    }
    
    function addToClubPool() external nonReentrant onlyKYCVerified {
        require(clubPool.active, "Club pool not active");
        require(!clubMembers[msg.sender], "Already club member");
        require(users[msg.sender].id > 0, "Not registered");
        require(users[msg.sender].packageTier >= 3, "Minimum tier 3 required");
        
        // Add to club pool
        clubMembers[msg.sender] = true;
        clubPool.memberCount++;
        
        emit ClubMemberAdded(msg.sender, block.timestamp);
    }
    
    function removeFromClubPool(address member) external onlyOwner {
        require(clubMembers[member], "Not a club member");
        
        clubMembers[member] = false;
        clubPool.memberCount--;
        
        emit ClubMemberRemoved(member, block.timestamp);
    }
    
    function distributeClubPool() external nonReentrant {
        require(clubPool.active, "Club pool not active");
        require(block.timestamp >= clubPool.lastDistributionTime + clubPool.distributionInterval, "Too early");
        require(clubPool.balance > 0, "No club pool balance");
        require(clubPool.memberCount > 0, "No club members");
        
        uint256 amount = clubPool.balance;
        clubPool.balance = 0;
        clubPool.lastDistributionTime = uint32(block.timestamp);
        
        uint256 share = amount / clubPool.memberCount;
        uint256 distributed = 0;
        
        // Distribute to club members
        for (uint32 i = 1; i <= state.lastUserId; i++) {
            address userAddr = userAddress[i];
            if (userAddr == address(0)) continue;
            
            if (clubMembers[userAddr]) {
                _creditEarnings(userAddr, share);
                distributed += share;
            }
        }
        
        // Send any remaining dust amount to admin
        if (amount > distributed) {
            token.safeTransfer(admin, amount - distributed);
        }
        
        emit ClubPoolDistributed(amount, clubPool.memberCount, block.timestamp);
    }
}
