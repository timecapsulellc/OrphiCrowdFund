// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

/**
 * @title OrphiChainlinkAutomation
 * @dev Handles Chainlink Keeper automation for pool distributions
 * @notice Focused contract for automation functionality only
 */
contract OrphiChainlinkAutomation is Ownable, ReentrancyGuard, AutomationCompatibleInterface {
    
    // ===== CONSTANTS =====
    uint256 constant GHP_DISTRIBUTION_INTERVAL = 7 days; // Weekly
    uint256 constant LEADER_DISTRIBUTION_INTERVAL = 14 days; // Bi-weekly
    uint256 constant MIN_POOL_BALANCE = 1000e6; // Minimum 1000 USDT to trigger
    
    // ===== STATE VARIABLES =====
    bool public automationEnabled;
    uint256 public gasLimit;
    uint256 public lastUpkeepTimestamp;
    uint256 public performanceCounter;
    uint256 public failureCounter;
    
    // Distribution timestamps
    uint256 public lastGHPDistribution;
    uint256 public lastLeaderDistribution;
    
    // Pool balance tracking
    mapping(string => uint256) public poolBalances; // "GHP", "LEADER"
    
    // External contract references
    address public poolDistributor; // Contract that handles actual distributions
    
    // ===== EVENTS =====
    event AutomationTriggered(string actionType, uint256 timestamp, uint256 gasUsed);
    event AutomationFailed(string actionType, uint256 timestamp, string reason);
    event AutomationConfigUpdated(bool enabled, uint256 gasLimit);
    event UpkeepPerformed(bytes performData, uint256 timestamp);
    event DistributionScheduled(string poolType, uint256 scheduledTime);
    
    // ===== CONSTRUCTOR =====
    constructor(
        address _poolDistributor,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_poolDistributor != address(0), "Invalid pool distributor");
        
        poolDistributor = _poolDistributor;
        automationEnabled = true;
        gasLimit = 500000;
        lastUpkeepTimestamp = block.timestamp;
        lastGHPDistribution = block.timestamp;
        lastLeaderDistribution = block.timestamp;
    }
    
    // ===== CHAINLINK AUTOMATION INTERFACE =====
    
    /**
     * @dev Chainlink Keeper checkUpkeep function
     * @param checkData Optional check data (unused)
     * @return upkeepNeeded True if upkeep is needed
     * @return performData Data to pass to performUpkeep
     */
    function checkUpkeep(bytes calldata checkData) 
        external 
        view 
        override 
        returns (bool upkeepNeeded, bytes memory performData) 
    {
        checkData; // Silence unused parameter warning
        
        if (!automationEnabled) {
            return (false, "");
        }
        
        // Check GHP distribution
        if (_shouldDistributeGHP()) {
            return (true, abi.encode("GHP_DISTRIBUTION", block.timestamp));
        }
        
        // Check Leader distribution
        if (_shouldDistributeLeader()) {
            return (true, abi.encode("LEADER_DISTRIBUTION", block.timestamp));
        }
        
        return (false, "");
    }
    
    /**
     * @dev Chainlink Keeper performUpkeep function
     * @param performData Data from checkUpkeep
     */
    function performUpkeep(bytes calldata performData) external override {
        uint256 gasStart = gasleft();
        
        (string memory actionType, uint256 triggerTime) = abi.decode(performData, (string, uint256));
        
        // Verify upkeep is still needed
        bool shouldPerform = false;
        if (keccak256(bytes(actionType)) == keccak256(bytes("GHP_DISTRIBUTION"))) {
            shouldPerform = _shouldDistributeGHP();
        } else if (keccak256(bytes(actionType)) == keccak256(bytes("LEADER_DISTRIBUTION"))) {
            shouldPerform = _shouldDistributeLeader();
        }
        
        if (!shouldPerform) {
            emit AutomationFailed(actionType, block.timestamp, "Upkeep no longer needed");
            return;
        }
        
        // Update counters
        lastUpkeepTimestamp = block.timestamp;
        performanceCounter++;
        
        // Execute the distribution
        bool success = _executeDistribution(actionType);
        
        uint256 gasUsed = gasStart - gasleft();
        
        if (success) {
            emit AutomationTriggered(actionType, block.timestamp, gasUsed);
        } else {
            failureCounter++;
            emit AutomationFailed(actionType, block.timestamp, "Distribution execution failed");
        }
        
        emit UpkeepPerformed(performData, block.timestamp);
    }
    
    // ===== ADMIN FUNCTIONS =====
    
    /**
     * @dev Enable/disable automation
     * @param enabled New automation status
     */
    function setAutomationEnabled(bool enabled) external onlyOwner {
        automationEnabled = enabled;
        emit AutomationConfigUpdated(enabled, gasLimit);
    }
    
    /**
     * @dev Set gas limit for automation
     * @param _gasLimit New gas limit
     */
    function setGasLimit(uint256 _gasLimit) external onlyOwner {
        require(_gasLimit >= 100000 && _gasLimit <= 2500000, "Invalid gas limit");
        gasLimit = _gasLimit;
        emit AutomationConfigUpdated(automationEnabled, _gasLimit);
    }
    
    /**
     * @dev Update pool distributor address
     * @param _poolDistributor New pool distributor address
     */
    function setPoolDistributor(address _poolDistributor) external onlyOwner {
        require(_poolDistributor != address(0), "Invalid pool distributor");
        poolDistributor = _poolDistributor;
    }
    
    /**
     * @dev Update pool balance for tracking
     * @param poolType Pool type ("GHP" or "LEADER")
     * @param balance New balance
     */
    function updatePoolBalance(string calldata poolType, uint256 balance) external {
        require(msg.sender == poolDistributor || msg.sender == owner(), "Unauthorized");
        poolBalances[poolType] = balance;
    }
    
    /**
     * @dev Manual trigger for distribution (emergency use)
     * @param actionType Type of distribution to trigger
     */
    function manualTrigger(string calldata actionType) external onlyOwner {
        bool success = _executeDistribution(actionType);
        require(success, "Manual trigger failed");
        
        emit AutomationTriggered(actionType, block.timestamp, 0);
    }
    
    /**
     * @dev Reset failure counter
     */
    function resetFailureCounter() external onlyOwner {
        failureCounter = 0;
    }
    
    // ===== INTERNAL FUNCTIONS =====
    
    /**
     * @dev Check if GHP distribution should be triggered
     * @return shouldDistribute True if distribution should happen
     */
    function _shouldDistributeGHP() internal view returns (bool shouldDistribute) {
        if (!automationEnabled) return false;
        if (poolBalances["GHP"] < MIN_POOL_BALANCE) return false;
        if (block.timestamp < lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL) return false;
        return true;
    }
    
    /**
     * @dev Check if Leader distribution should be triggered
     * @return shouldDistribute True if distribution should happen
     */
    function _shouldDistributeLeader() internal view returns (bool shouldDistribute) {
        if (!automationEnabled) return false;
        if (poolBalances["LEADER"] < MIN_POOL_BALANCE) return false;
        if (block.timestamp < lastLeaderDistribution + LEADER_DISTRIBUTION_INTERVAL) return false;
        return true;
    }
    
    /**
     * @dev Execute distribution by calling external contract
     * @param actionType Type of distribution
     * @return success True if execution succeeded
     */
    function _executeDistribution(string memory actionType) internal returns (bool success) {
        try this._callDistribution(actionType) {
            // Update distribution timestamps
            if (keccak256(bytes(actionType)) == keccak256(bytes("GHP_DISTRIBUTION"))) {
                lastGHPDistribution = block.timestamp;
            } else if (keccak256(bytes(actionType)) == keccak256(bytes("LEADER_DISTRIBUTION"))) {
                lastLeaderDistribution = block.timestamp;
            }
            return true;
        } catch Error(string memory reason) {
            emit AutomationFailed(actionType, block.timestamp, reason);
            return false;
        } catch {
            emit AutomationFailed(actionType, block.timestamp, "Unknown error");
            return false;
        }
    }
    
    /**
     * @dev Call distribution function on external contract
     * @param actionType Type of distribution
     */
    function _callDistribution(string memory actionType) external {
        require(msg.sender == address(this), "Internal call only");
        
        bytes memory callData;
        if (keccak256(bytes(actionType)) == keccak256(bytes("GHP_DISTRIBUTION"))) {
            callData = abi.encodeWithSignature("distributeGlobalHelpPool()");
        } else if (keccak256(bytes(actionType)) == keccak256(bytes("LEADER_DISTRIBUTION"))) {
            callData = abi.encodeWithSignature("distributeLeaderBonus()");
        } else {
            revert("Invalid action type");
        }
        
        (bool success, ) = poolDistributor.call(callData);
        require(success, "Distribution call failed");
    }
    
    // ===== VIEW FUNCTIONS =====
    
    /**
     * @dev Get automation statistics
     * @return enabled Current automation status
     * @return gasLimit_ Current gas limit
     * @return performanceCount Total successful performances
     * @return failureCount Total failures
     * @return lastUpkeep Last upkeep timestamp
     */
    function getAutomationStats() external view returns (
        bool enabled,
        uint256 gasLimit_,
        uint256 performanceCount,
        uint256 failureCount,
        uint256 lastUpkeep
    ) {
        return (
            automationEnabled,
            gasLimit,
            performanceCounter,
            failureCounter,
            lastUpkeepTimestamp
        );
    }
    
    /**
     * @dev Get next distribution times
     * @return ghpNext Next GHP distribution time
     * @return leaderNext Next Leader distribution time
     */
    function getNextDistributionTimes() external view returns (
        uint256 ghpNext,
        uint256 leaderNext
    ) {
        ghpNext = lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL;
        leaderNext = lastLeaderDistribution + LEADER_DISTRIBUTION_INTERVAL;
    }
    
    /**
     * @dev Check if distributions are ready
     * @return ghpReady True if GHP distribution is ready
     * @return leaderReady True if Leader distribution is ready
     */
    function getDistributionReadiness() external view returns (
        bool ghpReady,
        bool leaderReady
    ) {
        ghpReady = _shouldDistributeGHP();
        leaderReady = _shouldDistributeLeader();
    }
    
    /**
     * @dev Get pool balances
     * @param poolType Pool type to check
     * @return balance Pool balance
     */
    function getPoolBalance(string calldata poolType) external view returns (uint256 balance) {
        return poolBalances[poolType];
    }
    
    /**
     * @dev Get time until next distribution
     * @param poolType Pool type ("GHP" or "LEADER")
     * @return timeRemaining Seconds until next distribution
     */
    function getTimeUntilNextDistribution(string calldata poolType) external view returns (uint256 timeRemaining) {
        if (keccak256(bytes(poolType)) == keccak256(bytes("GHP"))) {
            uint256 nextTime = lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL;
            return block.timestamp >= nextTime ? 0 : nextTime - block.timestamp;
        } else if (keccak256(bytes(poolType)) == keccak256(bytes("LEADER"))) {
            uint256 nextTime = lastLeaderDistribution + LEADER_DISTRIBUTION_INTERVAL;
            return block.timestamp >= nextTime ? 0 : nextTime - block.timestamp;
        }
        return 0;
    }
}
