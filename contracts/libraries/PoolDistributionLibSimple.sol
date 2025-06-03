// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title PoolDistributionLibSimple
 * @dev Pure computational library for pool distribution calculations
 */
library PoolDistributionLibSimple {
    
    // Pool distribution intervals
    uint256 constant GHP_DISTRIBUTION_INTERVAL = 7 days;
    uint256 constant LEADER_BONUS_INTERVAL = 14 days;

    /**
     * @dev Check if GHP distribution is due
     */
    function canDistributeGHP(uint256 lastGHPDistribution) external view returns (bool) {
        return block.timestamp >= lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL;
    }

    /**
     * @dev Check if Leader Bonus distribution is due  
     */
    function canDistributeLeaderBonus(uint256 lastLeaderDistribution) external view returns (bool) {
        return block.timestamp >= lastLeaderDistribution + LEADER_BONUS_INTERVAL;
    }

    /**
     * @dev Calculate eligible GHP users count
     */
    function getEligibleGHPCount(
        uint32 totalMembers,
        mapping(uint256 => address) storage userIdToAddress,
        mapping(address => bool) storage isActive,
        mapping(address => bool) storage hasReachedCap,
        mapping(address => uint256) storage lastActivity
    ) external view returns (uint256 count) {
        for (uint256 i = 1; i <= totalMembers; i++) {
            address userAddr = userIdToAddress[i];
            if (userAddr != address(0) && 
                isActive[userAddr] && 
                !hasReachedCap[userAddr] &&
                lastActivity[userAddr] >= block.timestamp - 30 days) {
                count++;
            }
        }
    }

    /**
     * @dev Calculate eligible leader count by level
     */
    function getLeaderCountByLevel(
        uint32 totalMembers,
        mapping(uint256 => address) storage userIdToAddress,
        mapping(address => bool) storage isActive,
        mapping(address => uint8) storage leadershipLevel,
        uint8 level
    ) external view returns (uint256 count) {
        for (uint256 i = 1; i <= totalMembers; i++) {
            address userAddr = userIdToAddress[i];
            if (userAddr != address(0) && 
                isActive[userAddr] && 
                leadershipLevel[userAddr] == level) {
                count++;
            }
        }
    }

    /**
     * @dev Calculate per-user GHP amount
     */
    function calculateGHPShare(uint256 totalPool, uint256 eligibleCount) external pure returns (uint256) {
        if (eligibleCount == 0) return 0;
        return totalPool / eligibleCount;
    }

    /**
     * @dev Calculate per-leader bonus amount
     */
    function calculateLeaderShare(uint256 totalPool, uint256 leaderCount) external pure returns (uint256) {
        if (leaderCount == 0) return 0;
        return totalPool / leaderCount;
    }
}
