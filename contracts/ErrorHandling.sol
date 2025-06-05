// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title ErrorHandling
 * @dev Comprehensive error handling system with runtime recovery mechanisms
 * @notice Provides centralized error management for production deployment
 */
contract ErrorHandling {
    
    // Error categories for systematic handling
    enum ErrorCategory {
        VALIDATION,      // Input validation errors
        AUTHORIZATION,   // Access control errors
        BUSINESS_LOGIC,  // Business rule violations
        EXTERNAL_CALL,   // External contract call failures
        STATE_CORRUPTION,// Unexpected state errors
        CIRCUIT_BREAKER  // Emergency stopping conditions
    }

    // Error severity levels
    enum ErrorSeverity {
        INFO,     // Informational, no action needed
        WARNING,  // Warning, monitor situation
        ERROR,    // Error, needs attention
        CRITICAL  // Critical, immediate action required
    }

    // Comprehensive error structure
    struct ErrorLog {
        uint256 timestamp;
        ErrorCategory category;
        ErrorSeverity severity;
        string functionName;
        string errorMessage;
        bytes32 errorHash;
        address user;
        uint256 value;
        bool resolved;
    }

    // Error tracking storage
    ErrorLog[] public errorLogs;
    mapping(bytes32 => uint256) public errorCounts;
    mapping(bytes32 => uint256) public lastErrorTime;
    
    // Circuit breaker state
    mapping(string => bool) public functionPaused;
    mapping(string => uint256) public errorThresholds;
    mapping(string => uint256) public cooldownPeriods;
    
    // Recovery mechanisms
    mapping(address => uint256) public failedTransactions;
    mapping(address => uint256) public retryQueues;
    
    // Admin control
    address public errorAdmin;
    bool public globalPause;
    
    // Events for comprehensive monitoring
    event ErrorLogged(
        uint256 indexed errorId,
        ErrorCategory category,
        ErrorSeverity severity,
        string functionName,
        address indexed user
    );
    
    event ErrorResolved(uint256 indexed errorId, address indexed resolver);
    event CircuitBreakerTriggered(string functionName, uint256 errorCount);
    event FunctionPaused(string functionName, uint256 duration);
    event RetryQueued(address indexed user, uint256 retryTime);
    
    modifier onlyErrorAdmin() {
        require(msg.sender == errorAdmin, "Only error admin");
        _;
    }
    
    modifier notGloballyPaused() {
        require(!globalPause, "System globally paused");
        _;
    }
    
    modifier functionNotPaused(string memory functionName) {
        require(!functionPaused[functionName], "Function temporarily paused");
        _;
    }
    
    constructor(address _errorAdmin) {
        errorAdmin = _errorAdmin;
        
        // Set default error thresholds
        errorThresholds["registerUser"] = 10;      // 10 errors in window
        errorThresholds["withdraw"] = 5;           // 5 errors in window
        errorThresholds["distributeGHP"] = 3;      // 3 errors in window
        errorThresholds["distributeLeader"] = 3;   // 3 errors in window
        
        // Set default cooldown periods (in seconds)
        cooldownPeriods["registerUser"] = 300;     // 5 minutes
        cooldownPeriods["withdraw"] = 600;         // 10 minutes
        cooldownPeriods["distributeGHP"] = 1800;   // 30 minutes
        cooldownPeriods["distributeLeader"] = 1800; // 30 minutes
    }
    
    /**
     * @dev Log comprehensive error with context
     * @param category Error category
     * @param severity Error severity level
     * @param functionName Function where error occurred
     * @param errorMessage Detailed error message
     * @param user Address involved in error
     * @param value Value involved in error
     */
    function logError(
        ErrorCategory category,
        ErrorSeverity severity,
        string calldata functionName,
        string calldata errorMessage,
        address user,
        uint256 value
    ) external returns (uint256 errorId) {
        bytes32 errorHash = keccak256(abi.encodePacked(functionName, errorMessage));
        
        ErrorLog memory newError = ErrorLog({
            timestamp: block.timestamp,
            category: category,
            severity: severity,
            functionName: functionName,
            errorMessage: errorMessage,
            errorHash: errorHash,
            user: user,
            value: value,
            resolved: false
        });
        
        errorLogs.push(newError);
        errorId = errorLogs.length - 1;
        
        // Update error tracking
        errorCounts[errorHash]++;
        lastErrorTime[errorHash] = block.timestamp;
        
        emit ErrorLogged(errorId, category, severity, functionName, user);
        
        // Check circuit breaker conditions
        _checkCircuitBreaker(functionName, errorHash);
        
        // Handle critical errors immediately
        if (severity == ErrorSeverity.CRITICAL) {
            _handleCriticalError(functionName, errorMessage, user);
        }
        
        return errorId;
    }
    
    /**
     * @dev Mark error as resolved
     * @param errorId ID of the error to resolve
     */
    function resolveError(uint256 errorId) external onlyErrorAdmin {
        require(errorId < errorLogs.length, "Invalid error ID");
        require(!errorLogs[errorId].resolved, "Error already resolved");
        
        errorLogs[errorId].resolved = true;
        emit ErrorResolved(errorId, msg.sender);
    }
    
    /**
     * @dev Queue failed transaction for retry
     * @param user User who experienced the failure
     * @param retryDelay Delay before retry attempt
     */
    function queueRetry(address user, uint256 retryDelay) external {
        failedTransactions[user]++;
        retryQueues[user] = block.timestamp + retryDelay;
        
        emit RetryQueued(user, retryQueues[user]);
    }
    
    /**
     * @dev Check if user can retry after failure
     * @param user User address to check
     * @return canRetry Whether retry is allowed
     * @return waitTime Seconds to wait before retry
     */
    function canRetry(address user) external view returns (bool canRetry, uint256 waitTime) {
        if (retryQueues[user] == 0) {
            return (true, 0);
        }
        
        if (block.timestamp >= retryQueues[user]) {
            return (true, 0);
        } else {
            return (false, retryQueues[user] - block.timestamp);
        }
    }
    
    /**
     * @dev Get error statistics for monitoring
     * @param functionName Function to get stats for
     * @return errorCount Total errors for function
     * @return lastError Timestamp of last error
     * @return isPaused Whether function is paused
     */
    function getErrorStats(string calldata functionName) 
        external 
        view 
        returns (uint256 errorCount, uint256 lastError, bool isPaused) 
    {
        bytes32 functionHash = keccak256(abi.encodePacked(functionName));
        return (errorCounts[functionHash], lastErrorTime[functionHash], functionPaused[functionName]);
    }
    
    /**
     * @dev Get recent errors for analysis
     * @param count Number of recent errors to retrieve
     * @return recentErrors Array of recent error logs
     */
    function getRecentErrors(uint256 count) 
        external 
        view 
        returns (ErrorLog[] memory recentErrors) 
    {
        uint256 totalErrors = errorLogs.length;
        uint256 startIndex = totalErrors > count ? totalErrors - count : 0;
        uint256 actualCount = totalErrors - startIndex;
        
        recentErrors = new ErrorLog[](actualCount);
        for (uint256 i = 0; i < actualCount; i++) {
            recentErrors[i] = errorLogs[startIndex + i];
        }
        
        return recentErrors;
    }
    
    /**
     * @dev Emergency functions for admin control
     */
    function emergencyPauseGlobal() external onlyErrorAdmin {
        globalPause = true;
    }
    
    function emergencyUnpauseGlobal() external onlyErrorAdmin {
        globalPause = false;
    }
    
    function pauseFunction(string calldata functionName, uint256 duration) external onlyErrorAdmin {
        functionPaused[functionName] = true;
        emit FunctionPaused(functionName, duration);
        
        // Auto-unpause after duration (if duration > 0)
        if (duration > 0) {
            // Note: In production, use a timer mechanism like Chainlink Automation
            // For now, manual unpausing is required
        }
    }
    
    function unpauseFunction(string calldata functionName) external onlyErrorAdmin {
        functionPaused[functionName] = false;
    }
    
    /**
     * @dev Internal circuit breaker logic
     */
    function _checkCircuitBreaker(string memory functionName, bytes32 errorHash) internal {
        uint256 threshold = errorThresholds[functionName];
        if (threshold == 0) threshold = 5; // Default threshold
        
        // Check if error count exceeds threshold in time window
        if (errorCounts[errorHash] >= threshold) {
            uint256 timeWindow = 300; // 5 minutes
            if (block.timestamp - lastErrorTime[errorHash] < timeWindow) {
                // Trigger circuit breaker
                functionPaused[functionName] = true;
                emit CircuitBreakerTriggered(functionName, errorCounts[errorHash]);
            }
        }
    }
    
    /**
     * @dev Handle critical errors immediately
     */
    function _handleCriticalError(
        string memory functionName, 
        string memory errorMessage, 
        address user
    ) internal {
        // Pause the function immediately
        functionPaused[functionName] = true;
        
        // If it's a withdrawal error, queue for manual review
        if (keccak256(abi.encodePacked(functionName)) == keccak256(abi.encodePacked("withdraw"))) {
            failedTransactions[user]++;
        }
        
        // Additional critical error handling can be added here
    }
    
    /**
     * @dev Update error thresholds and cooldowns
     */
    function updateErrorThreshold(string calldata functionName, uint256 threshold) external onlyErrorAdmin {
        errorThresholds[functionName] = threshold;
    }
    
    function updateCooldownPeriod(string calldata functionName, uint256 period) external onlyErrorAdmin {
        cooldownPeriods[functionName] = period;
    }
    
    /**
     * @dev Transfer error admin role
     */
    function transferErrorAdmin(address newAdmin) external onlyErrorAdmin {
        require(newAdmin != address(0), "Invalid admin address");
        errorAdmin = newAdmin;
    }
}
