// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PoolDistributionLib
 * @dev Simplified library for pool distribution logic to reduce contract size
 */
library PoolDistributionLib {
    using SafeERC20 for IERC20;

    // Events
    event GlobalHelpPoolDistributed(uint256 totalDistributed, uint256 perUserAmount, uint256 eligibleUsers);
    event LeaderBonusDistributed(uint256 shiningStarAmount, uint256 silverStarAmount);
    event PoolReserveTransferred(uint256 amount, address adminReserve);

    // Pool distribution intervals
    uint256 constant GHP_DISTRIBUTION_INTERVAL = 7 days;
    uint256 constant LEADER_BONUS_INTERVAL = 14 days;

    /**
     * @dev Distribute Global Help Pool to eligible users
     */
    function distributeGlobalHelpPool(
        uint128[5] memory poolBalances,
        uint256 lastGHPDistribution,
        uint32 totalMembers,
        mapping(uint256 => address) storage userIdToAddress,
        mapping(address => bool) storage isActive,
        mapping(address => bool) storage hasReachedCap,
        mapping(address => uint256) storage lastActivity,
        mapping(address => uint256) storage totalEarnings,
        IERC20 paymentToken,
        address adminReserve
    ) external returns (uint256 distributed) {
        require(block.timestamp >= lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL, "Too early for GHP distribution");
        require(poolBalances[4] > 0, "No GHP balance");

        uint256 totalBalance = poolBalances[4];
        uint256[] memory eligibleUsers = _getEligibleGHPUsers(
            totalMembers,
            userIdToAddress,
            isActive,
            hasReachedCap,
            lastActivity
        );
        
        if (eligibleUsers.length == 0) {
            paymentToken.safeTransfer(adminReserve, totalBalance);
            poolBalances[4] = 0;
            emit PoolReserveTransferred(totalBalance, adminReserve);
            return 0;
        }

        uint256 perUserAmount = totalBalance / eligibleUsers.length;
        distributed = perUserAmount * eligibleUsers.length;
        uint256 remainder = totalBalance - distributed;

        // Distribute to eligible users
        for (uint256 i = 0; i < eligibleUsers.length; i++) {
            address userAddr = userIdToAddress[eligibleUsers[i]];
            paymentToken.safeTransfer(userAddr, perUserAmount);
            totalEarnings[userAddr] += perUserAmount;
        }

        if (remainder > 0) {
            paymentToken.safeTransfer(adminReserve, remainder);
        }

        poolBalances[4] = 0;
        lastGHPDistribution = block.timestamp;

        emit GlobalHelpPoolDistributed(distributed, perUserAmount, eligibleUsers.length);
        if (remainder > 0) {
            emit PoolReserveTransferred(remainder, adminReserve);
        }

        return distributed;
    }

    /**
     * @dev Distribute Leader Bonus Pool
     */
    function distributeLeaderBonus(
        uint128[5] memory poolBalances,
        uint256 lastLeaderDistribution,
        uint32 totalMembers,
        mapping(uint256 => address) storage userIdToAddress,
        mapping(address => bool) storage isActive,
        mapping(address => uint8) storage leadershipLevel,
        mapping(address => uint256) storage totalEarnings,
        IERC20 paymentToken,
        address adminReserve
    ) external returns (uint256 distributed) {
        require(block.timestamp >= lastLeaderDistribution + LEADER_BONUS_INTERVAL, "Too early for leader distribution");
        require(poolBalances[3] > 0, "No leader bonus balance");

        uint256 totalBalance = poolBalances[3];
        
        uint256[] memory shiningStars = _getLeadersByLevel(totalMembers, userIdToAddress, isActive, leadershipLevel, 2);
        uint256[] memory silverStars = _getLeadersByLevel(totalMembers, userIdToAddress, isActive, leadershipLevel, 1);

        uint256 shiningStarAmount = totalBalance / 2;
        uint256 silverStarAmount = totalBalance - shiningStarAmount;

        distributed = _distributeToLeaders(shiningStars, shiningStarAmount, userIdToAddress, totalEarnings, paymentToken, adminReserve);
        distributed += _distributeToLeaders(silverStars, silverStarAmount, userIdToAddress, totalEarnings, paymentToken, adminReserve);

        poolBalances[3] = 0;
        lastLeaderDistribution = block.timestamp;

        emit LeaderBonusDistributed(shiningStarAmount, silverStarAmount);
        return distributed;
    }

    /**
     * @dev Check if enough time has passed for GHP distribution
     */
    function canDistributeGHP(uint256 lastGHPDistribution) external view returns (bool) {
        return block.timestamp >= lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL;
    }

    /**
     * @dev Check if enough time has passed for Leader Bonus distribution
     */
    function canDistributeLeaderBonus(uint256 lastLeaderDistribution) external view returns (bool) {
        return block.timestamp >= lastLeaderDistribution + LEADER_BONUS_INTERVAL;
    }

    // Internal helper functions
    function _getEligibleGHPUsers(
        uint32 totalMembers,
        mapping(uint256 => address) storage userIdToAddress,
        mapping(address => bool) storage isActive,
        mapping(address => bool) storage hasReachedCap,
        mapping(address => uint256) storage lastActivity
    ) private view returns (uint256[] memory) {
        uint256[] memory tempEligible = new uint256[](totalMembers);
        uint256 count = 0;

        for (uint256 i = 1; i <= totalMembers; i++) {
            address userAddr = userIdToAddress[i];
            if (userAddr != address(0) && 
                isActive[userAddr] && 
                !hasReachedCap[userAddr] &&
                block.timestamp - lastActivity[userAddr] <= 30 days) {
                tempEligible[count] = i;
                count++;
            }
        }

        uint256[] memory eligible = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            eligible[i] = tempEligible[i];
        }
        return eligible;
    }

    function _getLeadersByLevel(
        uint32 totalMembers,
        mapping(uint256 => address) storage userIdToAddress,
        mapping(address => bool) storage isActive,
        mapping(address => uint8) storage leadershipLevel,
        uint8 level
    ) private view returns (uint256[] memory) {
        uint256[] memory tempLeaders = new uint256[](totalMembers);
        uint256 count = 0;

        for (uint256 i = 1; i <= totalMembers; i++) {
            address userAddr = userIdToAddress[i];
            if (userAddr != address(0) && 
                isActive[userAddr] && 
                leadershipLevel[userAddr] == level) {
                tempLeaders[count] = i;
                count++;
            }
        }

        uint256[] memory leaders = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            leaders[i] = tempLeaders[i];
        }
        return leaders;
    }

    function _distributeToLeaders(
        uint256[] memory leaders,
        uint256 totalAmount,
        mapping(uint256 => address) storage userIdToAddress,
        mapping(address => uint256) storage totalEarnings,
        IERC20 paymentToken,
        address adminReserve
    ) private returns (uint256 distributed) {
        if (leaders.length == 0) {
            paymentToken.safeTransfer(adminReserve, totalAmount);
            emit PoolReserveTransferred(totalAmount, adminReserve);
            return 0;
        }

        uint256 perLeaderAmount = totalAmount / leaders.length;
        distributed = perLeaderAmount * leaders.length;
        uint256 remainder = totalAmount - distributed;

        for (uint256 i = 0; i < leaders.length; i++) {
            address leaderAddr = userIdToAddress[leaders[i]];
            paymentToken.safeTransfer(leaderAddr, perLeaderAmount);
            totalEarnings[leaderAddr] += perLeaderAmount;
        }

        if (remainder > 0) {
            paymentToken.safeTransfer(adminReserve, remainder);
            emit PoolReserveTransferred(remainder, adminReserve);
        }

        return distributed;
    }
}
