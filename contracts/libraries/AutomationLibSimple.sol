// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title AutomationLibSimple
 * @dev Pure computational library for Chainlink automation calculations
 */
library AutomationLibSimple {

    // Pool distribution intervals
    uint256 constant GHP_DISTRIBUTION_INTERVAL = 7 days;
    uint256 constant LEADER_BONUS_INTERVAL = 14 days;
    uint256 constant MIN_POOL_BALANCE = 1000e6; // 1000 USDT minimum

    /**
     * @dev Check if automation upkeep is needed
     */
    function checkUpkeep(
        bool automationEnabled,
        uint128[5] memory poolBalances,
        uint256 lastGHPDistribution,
        uint256 lastLeaderDistribution
    ) external view returns (bool upkeepNeeded, bytes memory performData) {
        if (!automationEnabled) {
            return (false, "");
        }

        // Check GHP distribution
        if (poolBalances[4] >= MIN_POOL_BALANCE && 
            block.timestamp >= lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL) {
            return (true, abi.encode("GHP_DISTRIBUTION"));
        }

        // Check Leader Bonus distribution
        if (poolBalances[3] >= MIN_POOL_BALANCE && 
            block.timestamp >= lastLeaderDistribution + LEADER_BONUS_INTERVAL) {
            return (true, abi.encode("LEADER_DISTRIBUTION"));
        }

        return (false, "");
    }

    /**
     * @dev Process automation action
     */
    function processAutomation(
        bool automationEnabled,
        uint256 lastUpkeepTimestamp,
        uint256 /* performanceCounter */,
        bytes memory performData
    ) external view returns (string memory actionType, bool success) {
        if (!automationEnabled) {
            return ("", false);
        }

        // Prevent spam (minimum 1 hour between upkeeps)
        if (block.timestamp < lastUpkeepTimestamp + 1 hours) {
            return ("", false);
        }

        string memory action = abi.decode(performData, (string));
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
    ) external pure returns (bool, uint256, uint256, uint256) {
        return (automationEnabled, lastUpkeepTimestamp, performanceCounter, gasLimit);
    }

    /**
     * @dev Calculate next GHP distribution time
     */
    function getNextGHPDistribution(uint256 lastGHPDistribution) external pure returns (uint256) {
        return lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL;
    }

    /**
     * @dev Calculate next Leader distribution time
     */
    function getNextLeaderDistribution(uint256 lastLeaderDistribution) external pure returns (uint256) {
        return lastLeaderDistribution + LEADER_BONUS_INTERVAL;
    }
}
