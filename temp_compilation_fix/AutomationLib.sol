// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

/**
 * @title AutomationLib
 * @dev Simplified library for Chainlink Automation logic
 */
library AutomationLib {

    // Events
    event AutomationTriggered(string triggerType, uint256 timestamp);
    event AutomationPerformed(string actionType, uint256 amount, uint256 timestamp);

    // Pool distribution intervals
    uint256 constant GHP_DISTRIBUTION_INTERVAL = 7 days;
    uint256 constant LEADER_BONUS_INTERVAL = 14 days;
    uint256 constant MIN_POOL_BALANCE = 1000e6; // 1000 USDT minimum

    /**
     * @dev Check if upkeep is needed (Chainlink Automation)
     */
    function checkUpkeep(
        bool automationEnabled,
        uint128[5] storage poolBalances,
        uint256 lastGHPDistribution,
        uint256 lastLeaderDistribution
    ) external view returns (bool upkeepNeeded, bytes memory performData) {
        
        if (!automationEnabled) {
            return (false, "");
        }

        // Check if GHP distribution is due
        bool ghpReady = block.timestamp >= lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL;
        
        // Check if Leader Bonus distribution is due
        bool leaderReady = block.timestamp >= lastLeaderDistribution + LEADER_BONUS_INTERVAL;

        if (ghpReady && poolBalances[4] >= MIN_POOL_BALANCE) {
            upkeepNeeded = true;
            performData = abi.encode("GHP_DISTRIBUTION", poolBalances[4]);
        } else if (leaderReady && poolBalances[3] >= MIN_POOL_BALANCE) {
            upkeepNeeded = true;
            performData = abi.encode("LEADER_DISTRIBUTION", poolBalances[3]);
        } else {
            upkeepNeeded = false;
            performData = "";
        }

        return (upkeepNeeded, performData);
    }

    /**
     * @dev Process the automation action (stubbed: no state update)
     */
    function processAutomation(
        bool automationEnabled,
        uint256 lastUpkeepTimestamp,
        uint256 performanceCounter,
        bytes calldata performData
    ) external pure returns (string memory actionType, bool success) {
        if (!automationEnabled || performData.length == 0) {
            return ("NONE", false);
        }
        (string memory action, ) = abi.decode(performData, (string, uint256));
        return (action, true);
    }

    /**
     * @dev Get automation statistics
     */
    function getAutomationStats(
        bool automationEnabled,
        uint256 lastUpkeepTimestamp,
        uint256 performanceCounter,
        uint256 gasLimit
    ) external pure returns (
        bool enabled,
        uint256 lastUpkeep,
        uint256 performanceCount,
        uint256 gasLimitValue
    ) {
        return (
            automationEnabled,
            lastUpkeepTimestamp,
            performanceCounter,
            gasLimit
        );
    }

    /**
     * @dev Calculate next distribution time for GHP
     */
    function getNextGHPDistribution(uint256 lastGHPDistribution) external pure returns (uint256) {
        return lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL;
    }

    /**
     * @dev Calculate next distribution time for Leader Bonus
     */
    function getNextLeaderDistribution(uint256 lastLeaderDistribution) external pure returns (uint256) {
        return lastLeaderDistribution + LEADER_BONUS_INTERVAL;
    }

    /**
     * @dev Get time until next GHP distribution
     */
    function getTimeUntilGHPDistribution(uint256 lastGHPDistribution) external view returns (uint256) {
        uint256 nextTime = lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL;
        if (block.timestamp >= nextTime) {
            return 0;
        }
        return nextTime - block.timestamp;
    }

    /**
     * @dev Get time until next Leader distribution
     */
    function getTimeUntilLeaderDistribution(uint256 lastLeaderDistribution) external view returns (uint256) {
        uint256 nextTime = lastLeaderDistribution + LEADER_BONUS_INTERVAL;
        if (block.timestamp >= nextTime) {
            return 0;
        }
        return nextTime - block.timestamp;
    }
}
