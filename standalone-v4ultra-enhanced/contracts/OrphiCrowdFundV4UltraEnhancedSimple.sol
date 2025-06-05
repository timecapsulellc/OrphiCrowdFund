// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title OrphiCrowdFundV4UltraEnhanced - Simplified Version for Testing
 * @dev Simplified version focusing on gas optimization, circuit breaker, and real-time events
 */
contract OrphiCrowdFundV4UltraEnhancedSimple is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Core configuration constants
    uint256 public constant REGISTRATION_FEE = 5 ether;
    uint256 public constant MAX_USERS_PER_BATCH = 50;
    uint256 public constant MAX_GAS_PER_BATCH = 8000000;
    uint256 public constant CIRCUIT_BREAKER_THRESHOLD = 5;
    uint256 public constant CIRCUIT_BREAKER_COOLDOWN = 2 hours;
    uint256 public constant HEALTH_CHECK_INTERVAL = 6 hours;

    // System state
    struct User {
        bool isRegistered;
        uint256 registrationTime;
        uint256 totalEarned;
        uint256 referralCount;
        address sponsor;
    }

    struct SystemHealth {
        uint256 score;          // Health score 0-100
        uint256 lastHealthCheck;
        uint256 totalGasUsed;
        bool emergencyMode;
    }

    struct DistributionCache {
        uint256 batchSize;
        uint256 gasUsed;
        uint256 timestamp;
        bool completed;
    }

    // State variables
    mapping(address => User) public users;
    address[] public userAddresses;
    SystemHealth public systemHealth;
    DistributionCache public distCache;
    
    uint256 public totalUsers;
    uint256 public automationFailures;
    uint256 public lastFailureTime;
    bool public circuitBreakerOpen;
    bool public emergencyMode;

    // Events for real-time tracking
    event RealTimeEvent(
        string eventType,
        address indexed user,
        uint256 amount,
        uint256 timestamp,
        bytes32 indexed eventHash
    );

    event UserRegistered(address indexed user, address indexed sponsor, uint256 timestamp);
    event DistributionExecuted(uint256 userCount, uint256 gasUsed, uint256 timestamp);
    event CircuitBreakerTriggered(uint256 failures, uint256 timestamp);
    event EmergencyModeActivated(bool active, uint256 timestamp);
    event SystemHealthUpdated(uint256 score, uint256 timestamp);

    constructor() Ownable(msg.sender) {
        systemHealth = SystemHealth({
            score: 100,
            lastHealthCheck: block.timestamp,
            totalGasUsed: 0,
            emergencyMode: false
        });
    }

    /**
     * @dev Register a new user with sponsor
     */
    function registerUser(address sponsor) external payable nonReentrant whenNotPaused {
        require(msg.value >= REGISTRATION_FEE, "Insufficient registration fee");
        require(!users[msg.sender].isRegistered, "User already registered");
        require(sponsor != msg.sender, "Cannot sponsor yourself");
        
        if (sponsor != address(0)) {
            require(users[sponsor].isRegistered, "Invalid sponsor");
        }

        users[msg.sender] = User({
            isRegistered: true,
            registrationTime: block.timestamp,
            totalEarned: 0,
            referralCount: 0,
            sponsor: sponsor
        });

        userAddresses.push(msg.sender);
        totalUsers++;

        if (sponsor != address(0)) {
            users[sponsor].referralCount++;
        }

        emit UserRegistered(msg.sender, sponsor, block.timestamp);
        emit RealTimeEvent(
            "USER_REGISTERED",
            msg.sender,
            msg.value,
            block.timestamp,
            keccak256(abi.encodePacked(msg.sender, sponsor, block.timestamp))
        );

        // Auto health check every 100 registrations
        if (totalUsers % 100 == 0) {
            _updateSystemHealth();
        }
    }

    /**
     * @dev Execute global help distribution with gas optimization
     */
    function executeGlobalHelp() external onlyOwner nonReentrant {
        require(!circuitBreakerOpen, "Circuit breaker is open");
        require(!emergencyMode, "Emergency mode active");
        require(totalUsers > 0, "No users to distribute");

        uint256 startGas = gasleft();
        uint256 batchSize = _calculateOptimalBatchSize();
        uint256 processed = 0;

        try this._executeBatchDistribution(batchSize) {
            processed = batchSize;
            automationFailures = 0; // Reset on success
        } catch {
            automationFailures++;
            lastFailureTime = block.timestamp;
            
            if (automationFailures >= CIRCUIT_BREAKER_THRESHOLD) {
                circuitBreakerOpen = true;
                emit CircuitBreakerTriggered(automationFailures, block.timestamp);
            }
            
            emit RealTimeEvent(
                "DISTRIBUTION_FAILED",
                address(0),
                0,
                block.timestamp,
                keccak256(abi.encodePacked("FAILED", block.timestamp))
            );
            revert("Distribution failed");
        }

        uint256 gasUsed = startGas - gasleft();
        systemHealth.totalGasUsed += gasUsed;

        distCache = DistributionCache({
            batchSize: processed,
            gasUsed: gasUsed,
            timestamp: block.timestamp,
            completed: true
        });

        emit DistributionExecuted(processed, gasUsed, block.timestamp);
        emit RealTimeEvent(
            "DISTRIBUTION_EXECUTED",
            address(0),
            processed,
            block.timestamp,
            keccak256(abi.encodePacked("DISTRIBUTED", processed, block.timestamp))
        );

        _updateSystemHealth();
    }

    /**
     * @dev Internal batch distribution function
     */
    function _executeBatchDistribution(uint256 batchSize) external {
        require(msg.sender == address(this), "Internal function");
        
        uint256 amount = address(this).balance / totalUsers;
        require(amount > 0, "No funds to distribute");

        for (uint256 i = 0; i < batchSize && i < totalUsers; i++) {
            address user = userAddresses[i];
            if (users[user].isRegistered) {
                payable(user).transfer(amount);
                users[user].totalEarned += amount;
            }
        }
    }

    /**
     * @dev Calculate optimal batch size based on gas and user count
     */
    function _calculateOptimalBatchSize() internal view returns (uint256) {
        if (totalUsers <= MAX_USERS_PER_BATCH) {
            return totalUsers;
        }
        
        // Adaptive batch sizing based on gas usage history
        if (distCache.gasUsed > 0 && distCache.gasUsed < MAX_GAS_PER_BATCH) {
            uint256 gasPerUser = distCache.gasUsed / distCache.batchSize;
            return MAX_GAS_PER_BATCH / gasPerUser;
        }
        
        return MAX_USERS_PER_BATCH;
    }

    /**
     * @dev Update system health metrics
     */
    function _updateSystemHealth() internal {
        uint256 score = 100;
        
        // Reduce score based on failures
        if (automationFailures > 0) {
            score -= (automationFailures * 20);
        }
        
        // Reduce score if gas usage is high
        if (systemHealth.totalGasUsed > 1e8) {
            score -= 10;
        }
        
        // Reduce score if circuit breaker is open
        if (circuitBreakerOpen) {
            score -= 30;
        }
        
        score = score < 0 ? 0 : score;
        
        systemHealth.score = score;
        systemHealth.lastHealthCheck = block.timestamp;
        
        emit SystemHealthUpdated(score, block.timestamp);
        emit RealTimeEvent(
            "HEALTH_UPDATED",
            address(0),
            score,
            block.timestamp,
            keccak256(abi.encodePacked("HEALTH", score, block.timestamp))
        );
    }

    /**
     * @dev Reset circuit breaker (admin function)
     */
    function resetCircuitBreaker() external onlyOwner {
        require(circuitBreakerOpen, "Circuit breaker not open");
        require(
            block.timestamp >= lastFailureTime + CIRCUIT_BREAKER_COOLDOWN,
            "Cooldown period not met"
        );
        
        circuitBreakerOpen = false;
        automationFailures = 0;
        
        emit RealTimeEvent(
            "CIRCUIT_BREAKER_RESET",
            address(0),
            0,
            block.timestamp,
            keccak256(abi.encodePacked("CB_RESET", block.timestamp))
        );
    }

    /**
     * @dev Activate/deactivate emergency mode
     */
    function setEmergencyMode(bool active) external onlyOwner {
        emergencyMode = active;
        systemHealth.emergencyMode = active;
        
        emit EmergencyModeActivated(active, block.timestamp);
        emit RealTimeEvent(
            active ? "EMERGENCY_ACTIVATED" : "EMERGENCY_DEACTIVATED",
            address(0),
            0,
            block.timestamp,
            keccak256(abi.encodePacked("EMERGENCY", active, block.timestamp))
        );
    }

    /**
     * @dev Get system health information
     */
    function getSystemHealth() external view returns (SystemHealth memory) {
        return systemHealth;
    }

    /**
     * @dev Get user information
     */
    function getUserInfo(address user) external view returns (User memory) {
        return users[user];
    }

    /**
     * @dev Get distribution cache
     */
    function getDistributionCache() external view returns (DistributionCache memory) {
        return distCache;
    }

    /**
     * @dev Check if circuit breaker should be closed automatically
     */
    function canResetCircuitBreaker() external view returns (bool) {
        return circuitBreakerOpen && 
               block.timestamp >= lastFailureTime + CIRCUIT_BREAKER_COOLDOWN;
    }

    /**
     * @dev Get contract statistics
     */
    function getStats() external view returns (
        uint256 totalUsersCount,
        uint256 contractBalance,
        uint256 healthScore,
        bool cbOpen,
        bool emergency
    ) {
        return (
            totalUsers,
            address(this).balance,
            systemHealth.score,
            circuitBreakerOpen,
            emergencyMode
        );
    }

    /**
     * @dev Emergency withdraw (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        require(emergencyMode, "Emergency mode not active");
        payable(owner()).transfer(address(this).balance);
        
        emit RealTimeEvent(
            "EMERGENCY_WITHDRAWAL",
            owner(),
            address(this).balance,
            block.timestamp,
            keccak256(abi.encodePacked("EMERGENCY_WITHDRAW", block.timestamp))
        );
    }

    /**
     * @dev Receive function for contract funding
     */
    receive() external payable {
        emit RealTimeEvent(
            "FUNDS_RECEIVED",
            msg.sender,
            msg.value,
            block.timestamp,
            keccak256(abi.encodePacked("RECEIVED", msg.sender, msg.value, block.timestamp))
        );
    }
}
