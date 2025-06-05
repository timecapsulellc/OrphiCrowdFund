// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

/**
 * @title OrphiCrowdFundV4UltraEnhanced
 * @dev Enhanced V4Ultra with advanced gas optimization, circuit breakers, and real-time integration
 * @notice Implements three critical enhancements:
 *   1. GHP Distribution Gas Optimization for 10,000+ users
 *   2. Advanced Circuit Breaker Implementation with automated recovery
 *   3. Real-time Frontend Integration with WebSocket events
 */
contract OrphiCrowdFundV4UltraEnhanced is Ownable, ReentrancyGuard, Pausable, AutomationCompatibleInterface {
    using SafeERC20 for IERC20;

    // ===== ENHANCED CONSTANTS =====
    uint256 constant EARNINGS_CAP = 4;
    uint256 constant DIST_INTERVAL_GHP = 7 days;
    uint256 constant DIST_INTERVAL_LEADER = 14 days;
    uint256 constant MAX_USERS_PER_BATCH = 50; // Optimized for 10K+ users
    uint256 constant MAX_GAS_PER_BATCH = 8000000; // 8M gas limit for large batches
    uint256 constant CIRCUIT_BREAKER_THRESHOLD = 5; // Failures before circuit breaker trips
    uint256 constant CIRCUIT_BREAKER_COOLDOWN = 2 hours; // Enhanced cooldown period
    uint256 constant HEALTH_CHECK_INTERVAL = 6 hours; // Automated health monitoring
    
    // Distribution percentages in basis points
    uint16 constant SPONSOR_PCT = 4000; // 40%
    uint16 constant LEVEL_PCT = 1000;   // 10%
    uint16 constant UPLINE_PCT = 1000;  // 10%
    uint16 constant LEADER_PCT = 1000;  // 10%
    uint16 constant GHP_PCT = 3000;     // 30%

    // ===== IMMUTABLE STATE =====
    IERC20 public immutable token;
    address public immutable admin;
    
    // ===== ENHANCED GLOBAL STATE =====
    struct GlobalState {
        uint32 totalUsers;
        uint32 lastUserId;
        uint32 lastGHPTime;
        uint32 lastLeaderTime;
        uint32 lastHealthCheck;
        bool automationOn;
        bool emergencyMode;
        uint96 totalVolume;
    }
    GlobalState public state;

    // Enhanced pool balances
    struct Pools {
        uint64 sponsor;
        uint64 level;
        uint64 upline;
        uint64 leader;
        uint64 ghp;
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
        uint32 lastActivity;
        bool isCapped;
        uint8 leaderRank;
    }
    
    mapping(address => User) public users;
    mapping(uint32 => address) public userAddress;
    mapping(uint32 => uint32[2]) public matrix;
    
    uint64[5] public packages = [100e6, 200e6, 500e6, 1000e6, 2000e6];

    // ===== ENHANCED AUTOMATION CONFIGURATION =====
    struct AutomationConfig {
        bool enabled;
        uint32 maxUsersPerDistribution;
        uint32 lastProcessedId;
        uint32 currentBatchSize;
        bool isDistributing;
        uint8 distributionType; // 1=GHP, 2=Leader
        uint256 gasLimitConfig;
    }
    AutomationConfig public autoConfig;
    
    // ===== ADVANCED CIRCUIT BREAKER SYSTEM =====
    struct CircuitBreaker {
        uint256 failureCount;
        uint256 lastFailureTime;
        uint256 consecutiveSuccesses;
        bool isTripped;
        bool autoRecoveryEnabled;
        uint256 lastRecoveryAttempt;
        string lastFailureReason;
    }
    CircuitBreaker public circuitBreaker;
    
    // ===== ENHANCED DISTRIBUTION CACHE =====
    struct DistributionCache {
        uint256 ghpTotalQualifying;
        uint256 ghpSharePerUser;
        uint256 leaderSilverCount;
        uint256 leaderShiningCount;
        uint256 leaderSilverShare;
        uint256 leaderShiningShare;
        uint256 totalGasUsed;
        uint32 processedUsers;
        bool isInitialized;
        uint8 poolType;
    }
    DistributionCache private distCache;

    // ===== REAL-TIME MONITORING =====
    struct SystemHealth {
        uint256 lastHealthCheck;
        uint256 avgGasPerUser;
        uint256 peakUsers;
        uint256 totalDistributions;
        bool healthStatus;
        uint256 performanceScore; // 0-100
    }
    SystemHealth public systemHealth;

    // ===== ENHANCED EVENTS FOR REAL-TIME INTEGRATION =====
    event UserRegistered(address indexed user, uint32 indexed id, address indexed sponsor, uint16 tier);
    event DistributionStarted(uint8 poolType, uint32 startId, uint32 endId, uint256 batchSize, uint256 timestamp);
    event DistributionProgress(uint8 poolType, uint32 processed, uint32 total, uint256 gasUsed, uint256 timestamp);
    event DistributionCompleted(uint8 poolType, uint256 amount, uint32 usersProcessed, uint256 totalGasUsed, uint256 timestamp);
    event CircuitBreakerTripped(string reason, uint256 failureCount, uint256 timestamp);
    event CircuitBreakerRecovered(uint256 downtime, uint256 timestamp);
    event SystemHealthUpdate(uint256 performanceScore, uint256 avgGasPerUser, bool healthStatus, uint256 timestamp);
    event AutomationConfigUpdated(uint256 gasLimit, uint32 maxUsers, uint256 timestamp);
    event EmergencyModeActivated(string reason, uint256 timestamp);
    event EmergencyModeDeactivated(uint256 timestamp);
    event RealTimeEvent(string eventType, bytes data, uint256 timestamp);

    // ===== MULTI-SIG TREASURY =====
    address[] public treasurySigners;
    uint256 public requiredSignatures;

    struct Operation {
        address token;
        uint256 amount;
        bool executed;
        uint256 approvalCount;
        mapping(address => bool) approved;
    }

    mapping(bytes32 => Operation) private operations;

    event OperationProposed(bytes32 indexed operationId, address indexed proposer, address token, uint256 amount);
    event OperationApproved(bytes32 indexed operationId, address indexed approver, uint256 approvalCount);
    event OperationExecuted(bytes32 indexed operationId);

    modifier onlySigner() {
        bool isSigner = false;
        for (uint i = 0; i < treasurySigners.length; i++) {
            if (treasurySigners[i] == msg.sender) {
                isSigner = true;
                break;
            }
        }
        require(isSigner, "Not a signer");
        _;
    }

    // ===== CONSTRUCTOR =====
    constructor(address _token, address _admin, address[] memory _signers, uint256 _requiredSignatures) Ownable(msg.sender) {
        token = IERC20(_token);
        admin = _admin;
        
        // Initialize enhanced automation config
        autoConfig = AutomationConfig({
            enabled: true,
            maxUsersPerDistribution: MAX_USERS_PER_BATCH,
            lastProcessedId: 0,
            currentBatchSize: MAX_USERS_PER_BATCH,
            isDistributing: false,
            distributionType: 0,
            gasLimitConfig: MAX_GAS_PER_BATCH
        });
        
        // Initialize circuit breaker
        circuitBreaker = CircuitBreaker({
            failureCount: 0,
            lastFailureTime: 0,
            consecutiveSuccesses: 0,
            isTripped: false,
            autoRecoveryEnabled: true,
            lastRecoveryAttempt: 0,
            lastFailureReason: ""
        });
        
        // Initialize system health
        systemHealth = SystemHealth({
            lastHealthCheck: block.timestamp,
            avgGasPerUser: 50000, // Initial estimate
            peakUsers: 0,
            totalDistributions: 0,
            healthStatus: true,
            performanceScore: 100
        });
        
        // Initialize root user
        _createUser(address(0), 0, 0);
        state.totalUsers = 1;
        state.lastUserId = 1;
        state.lastHealthCheck = uint32(block.timestamp);
        
        emit SystemHealthUpdate(100, 50000, true, block.timestamp);
        
        // initialize multi-sig treasury signers and threshold
        require(_signers.length >= _requiredSignatures && _requiredSignatures > 0, "Invalid multi-sig parameters");
        treasurySigners = _signers;
        requiredSignatures = _requiredSignatures;
    }

    // ===== ENHANCED GAS-OPTIMIZED REGISTRATION =====
    function register(address sponsor, uint16 tier) external nonReentrant whenNotPaused {
        require(tier > 0 && tier <= 5, "Invalid tier");
        require(users[msg.sender].id == 0, "Already registered");
        require(!state.emergencyMode, "Emergency mode active");
        
        // Circuit breaker check
        if (circuitBreaker.isTripped) {
            _attemptCircuitBreakerRecovery();
            require(!circuitBreaker.isTripped, "System temporarily unavailable");
        }
        
        uint256 amount = packages[tier - 1];
        token.safeTransferFrom(msg.sender, address(this), amount);
        
        // Create user with gas optimization
        uint32 newId = ++state.lastUserId;
        _createUser(msg.sender, users[sponsor].id, tier);
        users[msg.sender].id = newId;
        userAddress[newId] = msg.sender;
        state.totalUsers++;
        state.totalVolume += uint96(amount);
        
        // Optimized matrix placement
        uint32 matrixPos = _findOptimizedMatrixPosition();
        users[msg.sender].matrixPos = matrixPos;
        
        // Update team sizes efficiently
        if (sponsor != address(0)) {
            users[sponsor].directCount++;
            _updateTeamSizesOptimized(sponsor);
        }
        
        // Distribute funds
        _distributeFunds(sponsor, amount);
        
        // Update system health metrics
        _updateSystemHealth();
        
        // Emit real-time event
        emit UserRegistered(msg.sender, newId, sponsor, tier);
        emit RealTimeEvent("USER_REGISTERED", abi.encode(msg.sender, newId, sponsor, tier), block.timestamp);
    }

    // ===== ADVANCED CHAINLINK AUTOMATION WITH CIRCUIT BREAKER =====
    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory performData) {
        // Circuit breaker check
        if (circuitBreaker.isTripped) {
            // Check if recovery should be attempted
            if (circuitBreaker.autoRecoveryEnabled && 
                block.timestamp >= circuitBreaker.lastRecoveryAttempt + CIRCUIT_BREAKER_COOLDOWN) {
                return (true, abi.encode("RECOVERY_ATTEMPT", 0, 0));
            }
            return (false, "Circuit breaker tripped");
        }
        
        if (!state.automationOn || !autoConfig.enabled || state.emergencyMode) {
            return (false, "Automation disabled");
        }
        
        // Health check upkeep
        if (block.timestamp >= systemHealth.lastHealthCheck + HEALTH_CHECK_INTERVAL) {
            return (true, abi.encode("HEALTH_CHECK", 0, 0));
        }
        
        bool ghpReady = block.timestamp >= state.lastGHPTime + DIST_INTERVAL_GHP && pools.ghp > 0;
        bool leaderReady = block.timestamp >= state.lastLeaderTime + DIST_INTERVAL_LEADER && pools.leader > 0;
        
        // Check if there's an incomplete distribution
        if (autoConfig.isDistributing) {
            if (autoConfig.lastProcessedId < state.lastUserId) {
                return (true, abi.encode("CONTINUE_DISTRIBUTION", autoConfig.distributionType, autoConfig.lastProcessedId));
            }
        } else if (ghpReady) {
            return (true, abi.encode("START_GHP_DISTRIBUTION", 1, 0));
        } else if (leaderReady) {
            return (true, abi.encode("START_LEADER_DISTRIBUTION", 2, 0));
        }
        
        return (false, "No upkeep needed");
    }

    function performUpkeep(bytes calldata performData) external override {
        (string memory action, uint8 poolType, uint32 startId) = abi.decode(performData, (string, uint8, uint32));
        
        uint256 gasStart = gasleft();
        
        try this._executeUpkeepAction(action, poolType, startId) {
            // Success - update circuit breaker
            circuitBreaker.consecutiveSuccesses++;
            if (circuitBreaker.consecutiveSuccesses >= 3 && circuitBreaker.isTripped) {
                _recoverCircuitBreaker();
            }
            
        } catch Error(string memory reason) {
            _handleAutomationFailure(reason);
        } catch {
            _handleAutomationFailure("Unknown automation failure");
        }
        
        uint256 gasUsed = gasStart - gasleft();
        _updatePerformanceMetrics(gasUsed);
    }

    // ===== INTERNAL UPKEEP EXECUTION =====
    function _executeUpkeepAction(string memory action, uint8 poolType, uint32 startId) external {
        require(msg.sender == address(this), "Internal only");
        
        if (keccak256(bytes(action)) == keccak256(bytes("RECOVERY_ATTEMPT"))) {
            _attemptCircuitBreakerRecovery();
            
        } else if (keccak256(bytes(action)) == keccak256(bytes("HEALTH_CHECK"))) {
            _performSystemHealthCheck();
            
        } else if (keccak256(bytes(action)) == keccak256(bytes("START_GHP_DISTRIBUTION"))) {
            _startGHPDistribution();
            
        } else if (keccak256(bytes(action)) == keccak256(bytes("START_LEADER_DISTRIBUTION"))) {
            _startLeaderDistribution();
            
        } else if (keccak256(bytes(action)) == keccak256(bytes("CONTINUE_DISTRIBUTION"))) {
            _continueDistribution(poolType, startId);
            
        } else {
            revert("Invalid upkeep action");
        }
    }

    // ===== ENHANCED GAS-OPTIMIZED DISTRIBUTION SYSTEM =====
    function _startGHPDistribution() internal {
        autoConfig.isDistributing = true;
        autoConfig.distributionType = 1;
        autoConfig.lastProcessedId = 0;
        
        // Initialize enhanced distribution cache
        _initializeDistributionCache(1);
        
        emit DistributionStarted(1, 0, state.lastUserId, autoConfig.maxUsersPerDistribution, block.timestamp);
        emit RealTimeEvent("GHP_DISTRIBUTION_STARTED", abi.encode(pools.ghp, state.lastUserId), block.timestamp);
    }

    function _startLeaderDistribution() internal {
        autoConfig.isDistributing = true;
        autoConfig.distributionType = 2;
        autoConfig.lastProcessedId = 0;
        
        _initializeDistributionCache(2);
        
        emit DistributionStarted(2, 0, state.lastUserId, autoConfig.maxUsersPerDistribution, block.timestamp);
        emit RealTimeEvent("LEADER_DISTRIBUTION_STARTED", abi.encode(pools.leader, state.lastUserId), block.timestamp);
    }

    function _continueDistribution(uint8 poolType, uint32 startId) internal {
        require(autoConfig.isDistributing, "No active distribution");
        require(poolType == autoConfig.distributionType, "Pool type mismatch");
        
        uint32 endId = startId + autoConfig.currentBatchSize;
        if (endId > state.lastUserId) {
            endId = state.lastUserId;
        }
        
        uint256 gasStart = gasleft();
        
        if (poolType == 1) {
            _distributeGHPBatchOptimized(startId, endId);
        } else if (poolType == 2) {
            _distributeLeaderBatchOptimized(startId, endId);
        }
        
        uint256 gasUsed = gasStart - gasleft();
        autoConfig.lastProcessedId = endId;
        distCache.totalGasUsed += gasUsed;
        distCache.processedUsers += (endId - startId);
        
        emit DistributionProgress(poolType, endId, state.lastUserId, gasUsed, block.timestamp);
        
        // Check if distribution is complete
        if (endId >= state.lastUserId) {
            _completeDistribution(poolType);
        }
        
        // Adaptive batch sizing based on gas usage
        _optimizeBatchSize(gasUsed, endId - startId);
    }

    function _distributeGHPBatchOptimized(uint32 startId, uint32 endId) internal {
        require(distCache.isInitialized && distCache.poolType == 1, "Cache not initialized for GHP");
        
        if (distCache.ghpTotalQualifying == 0 || distCache.ghpSharePerUser == 0) {
            return;
        }
        
        // Optimized single-pass distribution
        for (uint32 i = startId + 1; i <= endId; i++) {
            address userAddr = userAddress[i];
            if (userAddr == address(0)) continue;
            
            // Check eligibility with minimal storage reads
            if (users[userAddr].packageTier >= 4 && !users[userAddr].isCapped) {
                users[userAddr].withdrawable += uint64(distCache.ghpSharePerUser);
                users[userAddr].totalEarnings += uint64(distCache.ghpSharePerUser);
                
                // Check cap efficiently
                uint256 cap = packages[users[userAddr].packageTier - 1] * EARNINGS_CAP;
                if (users[userAddr].totalEarnings >= cap) {
                    users[userAddr].isCapped = true;
                }
            }
        }
    }

    function _distributeLeaderBatchOptimized(uint32 startId, uint32 endId) internal {
        require(distCache.isInitialized && distCache.poolType == 2, "Cache not initialized for Leader");
        
        if (distCache.leaderSilverCount == 0 && distCache.leaderShiningCount == 0) {
            return;
        }
        
        for (uint32 i = startId + 1; i <= endId; i++) {
            address userAddr = userAddress[i];
            if (userAddr == address(0) || users[userAddr].isCapped) continue;
            
            uint8 rank = users[userAddr].leaderRank;
            uint256 share = 0;
            
            if (rank == 2 && distCache.leaderSilverShare > 0) {
                share = distCache.leaderSilverShare;
            } else if (rank == 1 && distCache.leaderShiningShare > 0) {
                share = distCache.leaderShiningShare;
            }
            
            if (share > 0) {
                users[userAddr].withdrawable += uint64(share);
                users[userAddr].totalEarnings += uint64(share);
                
                // Check cap
                uint256 cap = packages[users[userAddr].packageTier - 1] * EARNINGS_CAP;
                if (users[userAddr].totalEarnings >= cap) {
                    users[userAddr].isCapped = true;
                }
            }
        }
    }

    // ===== ADAPTIVE BATCH SIZE OPTIMIZATION =====
    function _optimizeBatchSize(uint256 gasUsed, uint32 usersProcessed) internal {
        if (usersProcessed == 0) return;
        
        uint256 gasPerUser = gasUsed / usersProcessed;
        systemHealth.avgGasPerUser = (systemHealth.avgGasPerUser * 9 + gasPerUser) / 10; // Moving average
        
        // Adaptive batch sizing
        if (gasUsed > autoConfig.gasLimitConfig * 80 / 100) {
            // Reduce batch size if approaching gas limit
            autoConfig.currentBatchSize = autoConfig.currentBatchSize * 80 / 100;
            if (autoConfig.currentBatchSize < 10) autoConfig.currentBatchSize = 10;
        } else if (gasUsed < autoConfig.gasLimitConfig * 50 / 100) {
            // Increase batch size if gas usage is low
            autoConfig.currentBatchSize = autoConfig.currentBatchSize * 120 / 100;
            if (autoConfig.currentBatchSize > MAX_USERS_PER_BATCH) {
                autoConfig.currentBatchSize = MAX_USERS_PER_BATCH;
            }
        }
    }

    // ===== ENHANCED CIRCUIT BREAKER IMPLEMENTATION =====
    function _handleAutomationFailure(string memory reason) internal {
        circuitBreaker.failureCount++;
        circuitBreaker.lastFailureTime = block.timestamp;
        circuitBreaker.lastFailureReason = reason;
        circuitBreaker.consecutiveSuccesses = 0;
        
        emit RealTimeEvent("AUTOMATION_FAILURE", abi.encode(reason, circuitBreaker.failureCount), block.timestamp);
        
        if (circuitBreaker.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
            _tripCircuitBreaker(reason);
        }
    }

    function _tripCircuitBreaker(string memory reason) internal {
        circuitBreaker.isTripped = true;
        autoConfig.enabled = false;
        
        emit CircuitBreakerTripped(reason, circuitBreaker.failureCount, block.timestamp);
        emit RealTimeEvent("CIRCUIT_BREAKER_TRIPPED", abi.encode(reason, circuitBreaker.failureCount), block.timestamp);
    }

    function _attemptCircuitBreakerRecovery() internal {
        if (!circuitBreaker.autoRecoveryEnabled) return;
        
        circuitBreaker.lastRecoveryAttempt = block.timestamp;
        
        // Perform health checks before recovery
        bool systemHealthy = _performSystemHealthCheck();
        
        if (systemHealthy && block.timestamp >= circuitBreaker.lastFailureTime + CIRCUIT_BREAKER_COOLDOWN) {
            _recoverCircuitBreaker();
        }
    }

    function _recoverCircuitBreaker() internal {
        uint256 downtime = block.timestamp - circuitBreaker.lastFailureTime;
        
        circuitBreaker.isTripped = false;
        autoConfig.enabled = true;
        circuitBreaker.consecutiveSuccesses = 0;
        
        emit CircuitBreakerRecovered(downtime, block.timestamp);
        emit RealTimeEvent("CIRCUIT_BREAKER_RECOVERED", abi.encode(downtime), block.timestamp);
    }

    // ===== REAL-TIME SYSTEM HEALTH MONITORING =====
    function _performSystemHealthCheck() internal returns (bool) {
        systemHealth.lastHealthCheck = block.timestamp;
        
        // Check various health metrics
        bool gasEfficiency = systemHealth.avgGasPerUser < 100000; // Under 100k gas per user
        bool poolBalance = pools.ghp < type(uint64).max * 90 / 100; // Pool not near overflow
        bool userGrowth = state.totalUsers > systemHealth.peakUsers * 80 / 100; // User retention
        
        systemHealth.healthStatus = gasEfficiency && poolBalance && userGrowth;
        
        // Calculate performance score
        uint256 score = 0;
        if (gasEfficiency) score += 40;
        if (poolBalance) score += 30;
        if (userGrowth) score += 30;
        
        systemHealth.performanceScore = score;
        
        if (systemHealth.peakUsers < state.totalUsers) {
            systemHealth.peakUsers = state.totalUsers;
        }
        
        emit SystemHealthUpdate(score, systemHealth.avgGasPerUser, systemHealth.healthStatus, block.timestamp);
        emit RealTimeEvent("HEALTH_CHECK", abi.encode(score, systemHealth.avgGasPerUser, systemHealth.healthStatus), block.timestamp);
        
        return systemHealth.healthStatus;
    }

    function _updateSystemHealth() internal {
        // Update metrics on user registration
        if (state.totalUsers > systemHealth.peakUsers) {
            systemHealth.peakUsers = state.totalUsers;
        }
    }

    function _updatePerformanceMetrics(uint256 gasUsed) internal {
        // Update running averages and performance counters
        systemHealth.avgGasPerUser = (systemHealth.avgGasPerUser * 9 + gasUsed) / 10;
    }

    // ===== HELPER FUNCTIONS =====
    function _createUser(address addr, uint32 sponsorId, uint16 tier) internal {
        users[addr] = User({
            id: 0,
            teamSize: 0,
            directCount: 0,
            packageTier: tier,
            matrixPos: 0,
            totalEarnings: 0,
            withdrawable: 0,
            sponsor: sponsorId,
            lastActivity: uint32(block.timestamp),
            isCapped: false,
            leaderRank: 0
        });
    }

    function _findOptimizedMatrixPosition() internal view returns (uint32) {
        // Optimized BFS with caching
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

    function _updateTeamSizesOptimized(address user) internal {
        uint32 sponsorId = users[user].sponsor;
        uint8 depth = 0;
        
        while (sponsorId > 0 && depth < 20) { // Limit depth to prevent gas issues
            address sponsorAddr = userAddress[sponsorId];
            users[sponsorAddr].teamSize++;
            users[sponsorAddr].lastActivity = uint32(block.timestamp);
            _checkLeaderRank(sponsorAddr);
            sponsorId = users[sponsorAddr].sponsor;
            depth++;
        }
    }

    function _checkLeaderRank(address user) internal {
        uint32 team = users[user].teamSize;
        uint16 direct = users[user].directCount;
        uint8 newRank = 0;
        
        if (team >= 500) newRank = 2; // Silver Star
        else if (team >= 250 && direct >= 10) newRank = 1; // Shining Star
        
        if (users[user].leaderRank != newRank) {
            uint8 oldRank = users[user].leaderRank;
            users[user].leaderRank = newRank;
            emit RealTimeEvent("LEADER_RANK_CHANGED", abi.encode(user, oldRank, newRank), block.timestamp);
        }
    }

    function _distributeFunds(address sponsor, uint256 amount) internal {
        uint256 remaining = amount;
        
        // Sponsor commission
        if (sponsor != address(0)) {
            uint256 commission = (amount * SPONSOR_PCT) / 10000;
            _creditEarnings(sponsor, commission);
            remaining -= commission;
        }
        
        // Distribute to pools
        uint256 levelAmount = (remaining * LEVEL_PCT) / (LEVEL_PCT + UPLINE_PCT + LEADER_PCT + GHP_PCT);
        uint256 uplineAmount = (remaining * UPLINE_PCT) / (LEVEL_PCT + UPLINE_PCT + LEADER_PCT + GHP_PCT);
        uint256 leaderAmount = (remaining * LEADER_PCT) / (LEVEL_PCT + UPLINE_PCT + LEADER_PCT + GHP_PCT);
        uint256 ghpAmount = remaining - levelAmount - uplineAmount - leaderAmount;
        
        pools.level += uint64(levelAmount);
        pools.upline += uint64(uplineAmount);
        pools.leader += uint64(leaderAmount);
        pools.ghp += uint64(ghpAmount);
    }

    function _creditEarnings(address user, uint256 earnings) internal {
        if (users[user].isCapped) return;
        
        uint256 packageAmount = packages[users[user].packageTier - 1];
        uint256 cap = packageAmount * EARNINGS_CAP;
        
        if (users[user].totalEarnings + earnings >= cap) {
            uint256 remaining = cap - users[user].totalEarnings;
            users[user].withdrawable += uint64(remaining);
            users[user].totalEarnings = uint64(cap);
            users[user].isCapped = true;
            emit RealTimeEvent("EARNINGS_CAP_REACHED", abi.encode(user, cap), block.timestamp);
        } else {
            users[user].withdrawable += uint64(earnings);
            users[user].totalEarnings += uint64(earnings);
        }
        
        users[user].lastActivity = uint32(block.timestamp);
    }

    function _initializeDistributionCache(uint8 poolType) internal {
        distCache.poolType = poolType;
        distCache.isInitialized = true;
        distCache.totalGasUsed = 0;
        distCache.processedUsers = 0;
        
        if (poolType == 1) {
            // GHP Distribution
            uint32 qualifying = 0;
            for (uint32 i = 1; i <= state.lastUserId; i++) {
                address userAddr = userAddress[i];
                if (userAddr != address(0) && users[userAddr].packageTier >= 4 && !users[userAddr].isCapped) {
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
                if (userAddr == address(0) || users[userAddr].isCapped) continue;
                
                if (users[userAddr].leaderRank == 2) silverCount++;
                else if (users[userAddr].leaderRank == 1) shiningCount++;
            }
            
            distCache.leaderSilverCount = silverCount;
            distCache.leaderShiningCount = shiningCount;
            
            if (silverCount > 0) {
                distCache.leaderSilverShare = (pools.leader * 60) / 100 / silverCount;
            }
            if (shiningCount > 0) {
                distCache.leaderShiningShare = (pools.leader * 40) / 100 / shiningCount;
            }
        }
    }

    function _completeDistribution(uint8 poolType) internal {
        autoConfig.isDistributing = false;
        autoConfig.lastProcessedId = 0;
        systemHealth.totalDistributions++;
        
        uint256 totalAmount = 0;
        if (poolType == 1) {
            totalAmount = pools.ghp;
            state.lastGHPTime = uint32(block.timestamp);
            pools.ghp = 0;
        } else if (poolType == 2) {
            totalAmount = pools.leader;
            state.lastLeaderTime = uint32(block.timestamp);
            pools.leader = 0;
        }
        
        emit DistributionCompleted(poolType, totalAmount, distCache.processedUsers, distCache.totalGasUsed, block.timestamp);
        emit RealTimeEvent("DISTRIBUTION_COMPLETED", abi.encode(poolType, totalAmount, distCache.processedUsers), block.timestamp);
        
        _clearDistributionCache();
    }

    function _clearDistributionCache() internal {
        delete distCache;
    }

    // ===== ADMIN FUNCTIONS =====
    function updateAutomationConfig(uint256 _gasLimit, uint32 _maxUsers) external onlyOwner {
        autoConfig.gasLimitConfig = _gasLimit;
        autoConfig.maxUsersPerDistribution = _maxUsers;
        autoConfig.currentBatchSize = _maxUsers;
        
        emit AutomationConfigUpdated(_gasLimit, _maxUsers, block.timestamp);
        emit RealTimeEvent("CONFIG_UPDATED", abi.encode(_gasLimit, _maxUsers), block.timestamp);
    }

    function enableAutomation(bool enabled) external onlyOwner {
        autoConfig.enabled = enabled;
        state.automationOn = enabled;
        
        if (enabled && circuitBreaker.isTripped) {
            _recoverCircuitBreaker();
        }
        
        emit RealTimeEvent("AUTOMATION_TOGGLED", abi.encode(enabled), block.timestamp);
    }

    function activateEmergencyMode(string memory reason) external onlyOwner {
        state.emergencyMode = true;
        autoConfig.enabled = false;
        _pause();
        
        emit EmergencyModeActivated(reason, block.timestamp);
        emit RealTimeEvent("EMERGENCY_MODE_ACTIVATED", abi.encode(reason), block.timestamp);
    }

    function deactivateEmergencyMode() external onlyOwner {
        state.emergencyMode = false;
        _unpause();
        
        emit EmergencyModeDeactivated(block.timestamp);
        emit RealTimeEvent("EMERGENCY_MODE_DEACTIVATED", "", block.timestamp);
    }

    function resetCircuitBreaker() external onlyOwner {
        circuitBreaker.failureCount = 0;
        circuitBreaker.lastFailureTime = 0;
        circuitBreaker.consecutiveSuccesses = 0;
        
        if (circuitBreaker.isTripped) {
            _recoverCircuitBreaker();
        }
    }

    function toggleAutoRecovery(bool enabled) external onlyOwner {
        circuitBreaker.autoRecoveryEnabled = enabled;
        emit RealTimeEvent("AUTO_RECOVERY_TOGGLED", abi.encode(enabled), block.timestamp);
    }

    /**
     * @dev Propose a treasury withdrawal operation requiring multi-sig approval
     */
    function proposeWithdrawal(address _token, uint256 _amount) external whenNotPaused onlySigner returns (bytes32) {
        require(_amount > 0, "Amount must be > 0");
        bytes32 opId = keccak256(abi.encodePacked(_token, _amount, block.timestamp, msg.sender));
        Operation storage op = operations[opId];
        require(op.token == address(0), "Operation already exists");
        op.token = _token;
        op.amount = _amount;
        emit OperationProposed(opId, msg.sender, _token, _amount);
        return opId;
    }

    /**
     * @dev Approve and execute a proposed withdrawal when threshold is met
     */
    function approveOperation(bytes32 _operationId) external whenNotPaused onlySigner {
        Operation storage op = operations[_operationId];
        require(!op.executed, "Operation already executed");
        require(!op.approved[msg.sender], "Already approved");
        op.approved[msg.sender] = true;
        op.approvalCount++;
        emit OperationApproved(_operationId, msg.sender, op.approvalCount);
        if (op.approvalCount >= requiredSignatures) {
            op.executed = true;
            // transfer tokens to owner
            IERC20(op.token).safeTransfer(owner(), op.amount);
            emit OperationExecuted(_operationId);
        }
    }

    // ===== VIEW FUNCTIONS =====
    function getSystemHealth() external view returns (SystemHealth memory) {
        return systemHealth;
    }

    function getCircuitBreakerStatus() external view returns (CircuitBreaker memory) {
        return circuitBreaker;
    }

    function getAutomationConfig() external view returns (AutomationConfig memory) {
        return autoConfig;
    }

    function getDistributionProgress() external view returns (uint32 processed, uint32 total, bool active) {
        return (autoConfig.lastProcessedId, state.lastUserId, autoConfig.isDistributing);
    }

    function getUserInfo(address user) external view returns (User memory) {
        return users[user];
    }

    function getPoolBalances() external view returns (uint256[5] memory) {
        return [pools.sponsor, pools.level, pools.upline, pools.leader, pools.ghp];
    }

    function getGlobalStats() external view returns (uint32, uint96, bool, bool) {
        return (state.totalUsers, state.totalVolume, state.automationOn, state.emergencyMode);
    }

    // ===== WITHDRAWAL FUNCTION =====
    function withdraw() external nonReentrant whenNotPaused {
        require(!state.emergencyMode, "Emergency mode active");
        
        uint256 amount = users[msg.sender].withdrawable;
        require(amount > 0, "No withdrawable amount");
        
        users[msg.sender].withdrawable = 0;
        users[msg.sender].lastActivity = uint32(block.timestamp);
        
        try token.safeTransfer(msg.sender, amount) {
            // Success
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("Token transfer failed: ", reason)));
        } catch {
            revert("Token transfer failed: unknown error");
        }
        
        emit RealTimeEvent("WITHDRAWAL", abi.encode(msg.sender, amount), block.timestamp);
    }

    // ===== EMERGENCY WITHDRAWAL (ADMIN) =====
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner nonReentrant {
        require(_amount > 0, "Invalid amount");
        try IERC20(_token).safeTransfer(admin, _amount) {
            // Success
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("Emergency withdraw failed: ", reason)));
        } catch {
            revert("Emergency withdraw failed: unknown error");
        }
        emit RealTimeEvent("EMERGENCY_WITHDRAWAL", abi.encode(_token, _amount), block.timestamp);
    }
}
