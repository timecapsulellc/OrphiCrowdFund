// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

/**
 * @title AutomationManager
 * @dev Library for handling Chainlink Automation logic
 * This library extracts automation functionality to reduce main contract size
 */
library AutomationManager {

    // Events
    event AutomationTriggered(string triggerType, uint256 timestamp);
    event AutomationPerformed(string actionType, uint256 amount, uint256 timestamp);

    struct AutomationState {
        bool automationEnabled;
        uint256 lastUpkeepTimestamp;
        uint256 gasLimit;
        uint256 performanceCounter;
    }

    // Pool distribution intervals (matching PoolDistribution library)
    uint256 constant GHP_DISTRIBUTION_INTERVAL = 7 days;
    uint256 constant LEADER_BONUS_INTERVAL = 14 days;
    uint256 constant MIN_POOL_BALANCE = 1000e6; // 1000 USDT minimum for distribution

    struct PoolState {
        uint128[5] poolBalances;
        uint256 lastGHPDistribution;
        uint256 lastLeaderDistribution;
        uint32 totalMembers;
    }

    /**
     * @dev Check if upkeep is needed (Chainlink Automation)
     * @param poolState Current pool state
     * @param automationState Current automation state
     * @return upkeepNeeded Whether upkeep is needed
     * @return performData Encoded data for performUpkeep
     */
    function checkUpkeep(
        PoolState storage poolState,
        AutomationState storage automationState
    ) external view returns (bool upkeepNeeded, bytes memory performData) {
        
        if (!automationState.automationEnabled) {
            return (false, "");
        }

        // Check if GHP distribution is due
        bool ghpReady = _isGHPDistributionDue(poolState);
        
        // Check if Leader Bonus distribution is due
        bool leaderReady = _isLeaderDistributionDue(poolState);

        if (ghpReady && poolState.poolBalances[4] >= MIN_POOL_BALANCE) {
            upkeepNeeded = true;
            performData = abi.encode("GHP_DISTRIBUTION", poolState.poolBalances[4]);
        } else if (leaderReady && poolState.poolBalances[3] >= MIN_POOL_BALANCE) {
            upkeepNeeded = true;
            performData = abi.encode("LEADER_DISTRIBUTION", poolState.poolBalances[3]);
        } else {
            upkeepNeeded = false;
            performData = "";
        }

        return (upkeepNeeded, performData);
    }

    /**
     * @dev Process the automation action
     * @param automationState Current automation state
     * @param performData Encoded data from checkUpkeep
     * @return actionType Type of action performed
     * @return success Whether the action was successful
     */
    function processAutomation(
        AutomationState storage automationState,
        bytes calldata performData
    ) external returns (string memory actionType, bool success) {
        require(automationState.automationEnabled, "Automation disabled");
        
        if (performData.length == 0) {
            return ("NONE", false);
        }

        (string memory action, uint256 amount) = abi.decode(performData, (string, uint256));
        
        // Update automation state
        automationState.lastUpkeepTimestamp = block.timestamp;
        automationState.performanceCounter++;

        emit AutomationTriggered(action, block.timestamp);

        return (action, true);
    }

    /**
     * @dev Enable/disable automation
     */
    function setAutomationEnabled(
        AutomationState storage automationState,
        bool enabled
    ) external {
        automationState.automationEnabled = enabled;
    }

    /**
     * @dev Set gas limit for automation
     */
    function setGasLimit(
        AutomationState storage automationState,
        uint256 gasLimit
    ) external {
        require(gasLimit >= 100000 && gasLimit <= 2500000, "Invalid gas limit");
        automationState.gasLimit = gasLimit;
    }

    /**
     * @dev Get automation statistics
     */
    function getAutomationStats(
        AutomationState storage automationState
    ) external view returns (
        bool enabled,
        uint256 lastUpkeep,
        uint256 performanceCount,
        uint256 gasLimit
    ) {
        return (
            automationState.automationEnabled,
            automationState.lastUpkeepTimestamp,
            automationState.performanceCounter,
            automationState.gasLimit
        );
    }

    /**
     * @dev Check if it's time for GHP distribution
     */
    function _isGHPDistributionDue(PoolState storage poolState) private view returns (bool) {
        return block.timestamp >= poolState.lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL;
    }

    /**
     * @dev Check if it's time for Leader Bonus distribution
     */
    function _isLeaderDistributionDue(PoolState storage poolState) private view returns (bool) {
        return block.timestamp >= poolState.lastLeaderDistribution + LEADER_BONUS_INTERVAL;
    }

    /**
     * @dev Calculate next distribution time for GHP
     */
    function getNextGHPDistribution(PoolState storage poolState) external view returns (uint256) {
        return poolState.lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL;
    }

    /**
     * @dev Calculate next distribution time for Leader Bonus
     */
    function getNextLeaderDistribution(PoolState storage poolState) external view returns (uint256) {
        return poolState.lastLeaderDistribution + LEADER_BONUS_INTERVAL;
    }

    /**
     * @dev Get time until next GHP distribution
     */
    function getTimeUntilGHPDistribution(PoolState storage poolState) external view returns (uint256) {
        uint256 nextTime = poolState.lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL;
        if (block.timestamp >= nextTime) {
            return 0;
        }
        return nextTime - block.timestamp;
    }

    /**
     * @dev Get time until next Leader distribution
     */
    function getTimeUntilLeaderDistribution(PoolState storage poolState) external view returns (uint256) {
        uint256 nextTime = poolState.lastLeaderDistribution + LEADER_BONUS_INTERVAL;
        if (block.timestamp >= nextTime) {
            return 0;
        }
        return nextTime - block.timestamp;
    }

    /**
     * @dev Initialize automation state
     */
    function initializeAutomation(
        AutomationState storage automationState,
        bool enabled,
        uint256 gasLimit
    ) external {
        automationState.automationEnabled = enabled;
        automationState.gasLimit = gasLimit;
        automationState.lastUpkeepTimestamp = block.timestamp;
        automationState.performanceCounter = 0;
    }
}
