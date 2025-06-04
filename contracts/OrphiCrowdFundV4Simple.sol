// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./OrphiCrowdFundV2.sol";
import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title OrphiCrowdFundV4Simple
 * @dev Simplified version with essential automation features
 * 
 * Key Features:
 * - Automated pool distribution using Chainlink Keepers
 * - Enhanced earnings cap enforcement
 * - Circuit breakers for automation safety
 */
contract OrphiCrowdFundV4Simple is OrphiCrowdFundV2, AutomationCompatibleInterface {
    using SafeERC20 for IERC20;
    
    // Automation constants
    uint256 public constant GHP_AUTOMATION_INTERVAL = 7 days;
    uint256 public constant LEADER_AUTOMATION_INTERVAL = 14 days;
    uint256 public constant AUTOMATION_SAFETY_BUFFER = 1 hours;
    
    // Automation state
    bool public automationEnabled;
    uint256 public lastAutomationCheck;
    uint256 public automationGasLimit;
    
    // Circuit breaker
    uint256 public automationFailureCount;
    uint256 public constant MAX_AUTOMATION_FAILURES = 3;
    uint256 public automationCooldownPeriod;
    uint256 public lastAutomationFailure;
    
    // Enhanced cap enforcement
    mapping(address => uint256) private userEarningsTotal;
    
    // Events
    event AutomationStatusChanged(bool enabled, uint256 timestamp);
    event AutomationExecuted(string poolType, uint256 amount, uint256 gasUsed, uint256 timestamp);
    event AutomationFailed(string reason, uint256 timestamp);
    event CircuitBreakerTriggered(string reason, uint256 timestamp);
    event CapEnforcementApplied(address indexed user, uint256 attemptedAmount, uint256 allowedAmount, uint256 timestamp);
    
    // Modifiers
    modifier onlyWhenAutomationEnabled() {
        require(automationEnabled, "Automation disabled");
        _;
    }
    
    modifier withCapEnforcement(address user, uint256 amount) {
        uint256 allowedAmount = _enforceEarningsCap(user, amount);
        if (allowedAmount < amount) {
            emit CapEnforcementApplied(user, amount, allowedAmount, block.timestamp);
        }
        _;
    }
    
    /**
     * @dev Initialize V4 enhancements
     */
    function initializeV4() external onlyRole(ADMIN_ROLE) {
        require(!automationEnabled, "Already initialized");
        automationEnabled = true;
        lastAutomationCheck = block.timestamp;
        automationGasLimit = 500000;
        automationCooldownPeriod = 24 hours;
        emit AutomationStatusChanged(true, block.timestamp);
    }
    
    /**
     * @dev Chainlink Automation: Check if upkeep is needed
     */
    function checkUpkeep(bytes calldata /* checkData */) 
        external 
        view 
        override 
        returns (bool upkeepNeeded, bytes memory performData) 
    {
        if (!automationEnabled) {
            return (false, "");
        }
        
        // Check cooldown period
        if (automationFailureCount >= MAX_AUTOMATION_FAILURES && 
            block.timestamp < lastAutomationFailure + automationCooldownPeriod) {
            return (false, "");
        }
        
        bool ghpReady = _isGHPDistributionReady();
        bool leaderReady = _isLeaderDistributionReady();
        
        if (ghpReady) {
            return (true, abi.encode("GHP"));
        } else if (leaderReady) {
            return (true, abi.encode("LEADER"));
        }
        
        return (false, "");
    }
    
    /**
     * @dev Chainlink Automation: Perform upkeep
     */
    function performUpkeep(bytes calldata performData) external override {
        require(automationEnabled, "Automation disabled");
        
        string memory poolType = abi.decode(performData, (string));
        uint256 gasStart = gasleft();
        
        try this._performDistribution(poolType) {
            uint256 gasUsed = gasStart - gasleft();
            emit AutomationExecuted(poolType, 0, gasUsed, block.timestamp);
            
            // Reset failure count on success
            automationFailureCount = 0;
            lastAutomationCheck = block.timestamp;
            
        } catch Error(string memory reason) {
            _handleAutomationFailure(reason);
        } catch {
            _handleAutomationFailure("Unknown error");
        }
    }
    
    /**
     * @dev Internal function to perform distribution
     */
    function _performDistribution(string memory poolType) external {
        require(msg.sender == address(this), "Internal function only");
        
        if (keccak256(bytes(poolType)) == keccak256(bytes("GHP"))) {
            require(_isGHPDistributionReady(), "GHP not ready");
            _distributeGlobalHelpPoolAutomated();
        } else if (keccak256(bytes(poolType)) == keccak256(bytes("LEADER"))) {
            require(_isLeaderDistributionReady(), "Leader not ready");
            _distributeLeaderBonusAutomated();
        } else {
            revert("Invalid pool type");
        }
    }
    
    /**
     * @dev Check if GHP distribution is ready
     */
    function _isGHPDistributionReady() internal view returns (bool) {
        return poolBalances[4] > 0 && 
               block.timestamp >= lastGHPDistribution + GHP_AUTOMATION_INTERVAL + AUTOMATION_SAFETY_BUFFER;
    }
    
    /**
     * @dev Check if Leader distribution is ready
     */
    function _isLeaderDistributionReady() internal view returns (bool) {
        return poolBalances[3] > 0 && 
               block.timestamp >= lastLeaderDistribution + LEADER_AUTOMATION_INTERVAL + AUTOMATION_SAFETY_BUFFER;
    }
    
    /**
     * @dev Automated GHP distribution
     */
    function _distributeGlobalHelpPoolAutomated() internal {
        uint256 totalPool = poolBalances[4];
        uint256 totalEligibleVolume = 0;
        uint256 eligibleCount = 0;
        
        // Count eligible users and calculate total volume
        for (uint256 i = 1; i <= totalMembers; i++) {
            address user = userIdToAddress[i];
            if (_isEligibleForGHP(user)) {
                eligibleCount++;
                uint256 userVolume = users[user].totalInvested + (users[user].teamSize * 30 ether);
                totalEligibleVolume += userVolume;
            }
        }
        
        if (eligibleCount > 0 && totalEligibleVolume > 0) {
            // Distribute to eligible users
            for (uint256 i = 1; i <= totalMembers; i++) {
                address user = userIdToAddress[i];
                if (_isEligibleForGHP(user)) {
                    uint256 userVolume = users[user].totalInvested + (users[user].teamSize * 30 ether);
                    uint256 userShare = (totalPool * userVolume) / totalEligibleVolume;
                    
                    if (userShare > 0) {
                        _creditEarningsEnhanced(user, userShare, 4);
                    }
                }
            }
            
            poolBalances[4] = 0;
            lastGHPDistribution = block.timestamp;
            emit GlobalHelpPoolDistributed(totalPool, eligibleCount, block.timestamp);
        } else {
            // Send to admin reserve if no eligible users
            paymentToken.safeTransfer(adminReserve, totalPool);
            poolBalances[4] = 0;
            lastGHPDistribution = block.timestamp;
            emit GlobalHelpPoolDistributed(totalPool, 0, block.timestamp);
        }
    }
    
    /**
     * @dev Automated Leader Bonus distribution
     */
    function _distributeLeaderBonusAutomated() internal {
        uint256 totalPool = poolBalances[3];
        uint256 shiningStarPool = totalPool / 2;
        uint256 silverStarPool = totalPool - shiningStarPool;
        
        (uint256 shiningStarCount, uint256 silverStarCount) = _countQualifiedLeaders();
        
        // Distribute to Shining Stars
        if (shiningStarCount > 0) {
            uint256 perShiningShare = shiningStarPool / shiningStarCount;
            _distributeToLeaderRank(LeaderRank.SHINING_STAR, perShiningShare);
        } else {
            paymentToken.safeTransfer(adminReserve, shiningStarPool);
        }
        
        // Distribute to Silver Stars
        if (silverStarCount > 0) {
            uint256 perSilverShare = silverStarPool / silverStarCount;
            _distributeToLeaderRank(LeaderRank.SILVER_STAR, perSilverShare);
        } else {
            paymentToken.safeTransfer(adminReserve, silverStarPool);
        }
        
        poolBalances[3] = 0;
        lastLeaderDistribution = block.timestamp;
        
        emit LeaderBonusDistributed(shiningStarPool, silverStarPool, shiningStarCount, silverStarCount, block.timestamp);
    }
    
    /**
     * @dev Centralized earnings cap enforcement
     */
    function _enforceEarningsCap(address user, uint256 amount) internal returns (uint256) {
        uint256 totalInvested = users[user].totalInvested;
        uint256 maxEarnings = totalInvested * EARNINGS_CAP_MULTIPLIER;
        uint256 currentEarnings = userEarningsTotal[user];
        
        if (currentEarnings >= maxEarnings) {
            users[user].isCapped = true;
            return 0;
        }
        
        uint256 remainingCap = maxEarnings - currentEarnings;
        uint256 allowedAmount = amount > remainingCap ? remainingCap : amount;
        
        userEarningsTotal[user] += allowedAmount;
        
        if (userEarningsTotal[user] >= maxEarnings) {
            users[user].isCapped = true;
        }
        
        return allowedAmount;
    }
    
    /**
     * @dev Enhanced credit earnings with cap enforcement
     */
    function _creditEarningsEnhanced(address user, uint256 amount, uint8 poolType) internal override {
        uint256 allowedAmount = _enforceEarningsCap(user, amount);
        
        if (allowedAmount > 0) {
            users[user].withdrawableAmount += uint128(allowedAmount);
            users[user].poolEarnings[poolType] += uint128(allowedAmount);
            users[user].lastActivity = uint64(block.timestamp);
            
            emit CommissionPaidV2(user, allowedAmount, poolType, msg.sender, block.timestamp, _getPoolName(poolType));
        }
        
        // Handle overflow (reinvestment)
        uint256 overflow = amount - allowedAmount;
        if (overflow > 0) {
            _handleCapOverflow(overflow);
        }
    }
    
    // Helper functions
    function _isEligibleForGHP(address user) internal view returns (bool) {
        return !users[user].isCapped && 
               users[user].lastActivity >= block.timestamp - 30 days &&
               users[user].totalInvested > 0;
    }
    
    function _countQualifiedLeaders() internal view returns (uint256, uint256) {
        uint256 shiningStarCount = 0;
        uint256 silverStarCount = 0;
        
        for (uint256 i = 1; i <= totalMembers; i++) {
            address user = userIdToAddress[i];
            if (users[user].leaderRank == LeaderRank.SHINING_STAR) {
                shiningStarCount++;
            } else if (users[user].leaderRank == LeaderRank.SILVER_STAR) {
                silverStarCount++;
            }
        }
        
        return (shiningStarCount, silverStarCount);
    }
    
    function _distributeToLeaderRank(LeaderRank rank, uint256 perShare) internal {
        for (uint256 i = 1; i <= totalMembers; i++) {
            address user = userIdToAddress[i];
            if (users[user].leaderRank == rank) {
                _creditEarningsEnhanced(user, perShare, 3);
            }
        }
    }
    
    function _handleCapOverflow(uint256 overflow) internal {
        uint256 levelPoolShare = (overflow * 4000) / 10000; // 40%
        uint256 uplinePoolShare = (overflow * 3000) / 10000; // 30%
        uint256 ghpShare = (overflow * 3000) / 10000; // 30%
        
        poolBalances[1] += uint128(levelPoolShare);
        poolBalances[2] += uint128(uplinePoolShare);
        poolBalances[4] += uint128(ghpShare);
    }
    
    function _getPoolName(uint8 poolType) internal pure returns (string memory) {
        if (poolType == 0) return "Sponsor";
        if (poolType == 1) return "Level";
        if (poolType == 2) return "Upline";
        if (poolType == 3) return "Leader";
        if (poolType == 4) return "GHP";
        return "Unknown";
    }
    
    /**
     * @dev Handle automation failures with circuit breaker
     */
    function _handleAutomationFailure(string memory reason) internal {
        automationFailureCount++;
        lastAutomationFailure = block.timestamp;
        
        emit AutomationFailed(reason, block.timestamp);
        
        if (automationFailureCount >= MAX_AUTOMATION_FAILURES) {
            emit CircuitBreakerTriggered("Max automation failures reached", block.timestamp);
        }
    }
    
    /**
     * @dev Admin function to enable/disable automation
     */
    function setAutomationEnabled(bool _enabled) external onlyRole(ADMIN_ROLE) {
        automationEnabled = _enabled;
        emit AutomationStatusChanged(_enabled, block.timestamp);
    }
    
    /**
     * @dev Admin function to reset automation failures
     */
    function resetAutomationFailures() external onlyRole(ADMIN_ROLE) {
        automationFailureCount = 0;
        lastAutomationFailure = 0;
    }
    
    /**
     * @dev Admin function to set gas limit for automation
     */
    function setAutomationGasLimit(uint256 _gasLimit) external onlyRole(ADMIN_ROLE) {
        require(_gasLimit >= 100000 && _gasLimit <= 1000000, "Invalid gas limit");
        automationGasLimit = _gasLimit;
    }
    
    // Emergency functions
    function emergencyDistributePool(uint8 poolType) external onlyRole(ADMIN_ROLE) {
        require(poolType < 5, "Invalid pool type");
        require(!automationEnabled, "Disable automation first");
        
        if (poolType == 3) {
            _distributeLeaderBonusAutomated();
        } else if (poolType == 4) {
            _distributeGlobalHelpPoolAutomated();
        }
    }
    
    function emergencyWithdrawPool(uint8 poolType) external onlyRole(ADMIN_ROLE) {
        require(poolType < 5, "Invalid pool type");
        require(poolBalances[poolType] > 0, "No balance");
        
        uint256 amount = poolBalances[poolType];
        poolBalances[poolType] = 0;
        paymentToken.safeTransfer(adminReserve, amount);
    }
    
    // View functions for monitoring
    function getAutomationStatus() external view returns (
        bool enabled,
        uint256 failureCount,
        uint256 lastFailure,
        uint256 lastCheck,
        uint256 gasLimit
    ) {
        return (
            automationEnabled,
            automationFailureCount,
            lastAutomationFailure,
            lastAutomationCheck,
            automationGasLimit
        );
    }
    
    function getUpkeepStatus() external view returns (
        bool ghpReady,
        bool leaderReady,
        uint256 ghpAmount,
        uint256 leaderAmount,
        uint256 timeToNextGHP,
        uint256 timeToNextLeader
    ) {
        ghpReady = _isGHPDistributionReady();
        leaderReady = _isLeaderDistributionReady();
        ghpAmount = poolBalances[4];
        leaderAmount = poolBalances[3];
        
        uint256 nextGHP = lastGHPDistribution + GHP_AUTOMATION_INTERVAL + AUTOMATION_SAFETY_BUFFER;
        uint256 nextLeader = lastLeaderDistribution + LEADER_AUTOMATION_INTERVAL + AUTOMATION_SAFETY_BUFFER;
        
        timeToNextGHP = nextGHP > block.timestamp ? nextGHP - block.timestamp : 0;
        timeToNextLeader = nextLeader > block.timestamp ? nextLeader - block.timestamp : 0;
    }
    
    function getUserCapStatus(address user) external view returns (
        uint256 totalEarnings,
        uint256 maxEarnings,
        uint256 remainingCap,
        bool isCapped
    ) {
        totalEarnings = userEarningsTotal[user];
        maxEarnings = users[user].totalInvested * EARNINGS_CAP_MULTIPLIER;
        remainingCap = maxEarnings > totalEarnings ? maxEarnings - totalEarnings : 0;
        isCapped = users[user].isCapped;
    }
}
