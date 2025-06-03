// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PoolDistribution
 * @dev Library for handling all pool distribution logic
 * This library extracts pool distribution functionality to reduce main contract size
 */
library PoolDistribution {
    using SafeERC20 for IERC20;

    // Events
    event GlobalHelpPoolDistributed(uint256 totalDistributed, uint256 perUserAmount, uint256 eligibleUsers);
    event LeaderBonusDistributed(uint256 shiningStarAmount, uint256 silverStarAmount);
    event PoolReserveTransferred(uint256 amount, address adminReserve);

    // Pool distribution intervals
    uint256 constant GHP_DISTRIBUTION_INTERVAL = 7 days;
    uint256 constant LEADER_BONUS_INTERVAL = 14 days;

    struct PoolState {
        uint128[5] poolBalances;
        uint256 lastGHPDistribution;
        uint256 lastLeaderDistribution;
        uint32 totalMembers;
    }

    struct User {
        uint256 id;
        address sponsor;
        address leftChild;
        address rightChild;
        uint256 matrixPosition;
        uint256 packageLevel;
        uint256 directSponsors;
        uint256 leftTeamSize;
        uint256 rightTeamSize;
        uint256 totalEarnings;
        uint256 totalWithdrawn;
        uint256 lastActivity;
        bool isActive;
        bool hasReachedCap;
        uint8 leadershipLevel; // 0=None, 1=Silver, 2=Shining
    }

    /**
     * @dev Distribute Global Help Pool to eligible users
     */
    function distributeGlobalHelpPool(
        PoolState storage poolState,
        mapping(address => User) storage users,
        mapping(uint256 => address) storage userIdToAddress,
        IERC20 paymentToken,
        address adminReserve
    ) external returns (uint256 distributed) {
        require(block.timestamp >= poolState.lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL, "Too early for GHP distribution");
        require(poolState.poolBalances[4] > 0, "No GHP balance");

        uint256 totalBalance = poolState.poolBalances[4];
        uint256[] memory eligibleUsers = _getEligibleGHPUsers(users, userIdToAddress, poolState.totalMembers);
        
        if (eligibleUsers.length == 0) {
            // Transfer to admin reserve if no eligible users
            paymentToken.safeTransfer(adminReserve, totalBalance);
            poolState.poolBalances[4] = 0;
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
            users[userAddr].totalEarnings += perUserAmount;
        }

        // Transfer remainder to admin reserve
        if (remainder > 0) {
            paymentToken.safeTransfer(adminReserve, remainder);
        }

        poolState.poolBalances[4] = 0;
        poolState.lastGHPDistribution = block.timestamp;

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
        PoolState storage poolState,
        mapping(address => User) storage users,
        mapping(uint256 => address) storage userIdToAddress,
        IERC20 paymentToken,
        address adminReserve
    ) external returns (uint256 distributed) {
        require(block.timestamp >= poolState.lastLeaderDistribution + LEADER_BONUS_INTERVAL, "Too early for leader distribution");
        require(poolState.poolBalances[3] > 0, "No leader bonus balance");

        uint256 totalBalance = poolState.poolBalances[3];
        
        // Get eligible leaders by type
        uint256[] memory shiningStars = _getLeadersByLevel(users, userIdToAddress, poolState.totalMembers, 2);
        uint256[] memory silverStars = _getLeadersByLevel(users, userIdToAddress, poolState.totalMembers, 1);

        uint256 shiningStarAmount = totalBalance / 2; // 50%
        uint256 silverStarAmount = totalBalance - shiningStarAmount; // 50%

        distributed = _distributeToLeaders(shiningStars, shiningStarAmount, userIdToAddress, users, paymentToken, adminReserve);
        distributed += _distributeToLeaders(silverStars, silverStarAmount, userIdToAddress, users, paymentToken, adminReserve);

        poolState.poolBalances[3] = 0;
        poolState.lastLeaderDistribution = block.timestamp;

        emit LeaderBonusDistributed(shiningStarAmount, silverStarAmount);

        return distributed;
    }

    /**
     * @dev Check if enough time has passed for GHP distribution
     */
    function canDistributeGHP(PoolState storage poolState) external view returns (bool) {
        return block.timestamp >= poolState.lastGHPDistribution + GHP_DISTRIBUTION_INTERVAL;
    }

    /**
     * @dev Check if enough time has passed for Leader Bonus distribution
     */
    function canDistributeLeaderBonus(PoolState storage poolState) external view returns (bool) {
        return block.timestamp >= poolState.lastLeaderDistribution + LEADER_BONUS_INTERVAL;
    }

    /**
     * @dev Get users eligible for GHP distribution
     */
    function _getEligibleGHPUsers(
        mapping(address => User) storage users,
        mapping(uint256 => address) storage userIdToAddress,
        uint32 totalMembers
    ) private view returns (uint256[] memory) {
        uint256[] memory tempEligible = new uint256[](totalMembers);
        uint256 count = 0;

        for (uint256 i = 1; i <= totalMembers; i++) {
            address userAddr = userIdToAddress[i];
            if (userAddr != address(0) && 
                users[userAddr].isActive && 
                !users[userAddr].hasReachedCap &&
                block.timestamp - users[userAddr].lastActivity <= 30 days) {
                tempEligible[count] = i;
                count++;
            }
        }

        // Create properly sized array
        uint256[] memory eligible = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            eligible[i] = tempEligible[i];
        }

        return eligible;
    }

    /**
     * @dev Get leaders by leadership level
     */
    function _getLeadersByLevel(
        mapping(address => User) storage users,
        mapping(uint256 => address) storage userIdToAddress,
        uint32 totalMembers,
        uint8 level
    ) private view returns (uint256[] memory) {
        uint256[] memory tempLeaders = new uint256[](totalMembers);
        uint256 count = 0;

        for (uint256 i = 1; i <= totalMembers; i++) {
            address userAddr = userIdToAddress[i];
            if (userAddr != address(0) && 
                users[userAddr].isActive && 
                users[userAddr].leadershipLevel == level) {
                tempLeaders[count] = i;
                count++;
            }
        }

        // Create properly sized array
        uint256[] memory leaders = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            leaders[i] = tempLeaders[i];
        }

        return leaders;
    }

    /**
     * @dev Distribute to a group of leaders
     */
    function _distributeToLeaders(
        uint256[] memory leaders,
        uint256 totalAmount,
        mapping(uint256 => address) storage userIdToAddress,
        mapping(address => User) storage users,
        IERC20 paymentToken,
        address adminReserve
    ) private returns (uint256 distributed) {
        if (leaders.length == 0) {
            // Transfer to admin reserve if no eligible leaders
            paymentToken.safeTransfer(adminReserve, totalAmount);
            emit PoolReserveTransferred(totalAmount, adminReserve);
            return 0;
        }

        uint256 perLeaderAmount = totalAmount / leaders.length;
        distributed = perLeaderAmount * leaders.length;
        uint256 remainder = totalAmount - distributed;

        // Distribute to leaders
        for (uint256 i = 0; i < leaders.length; i++) {
            address leaderAddr = userIdToAddress[leaders[i]];
            paymentToken.safeTransfer(leaderAddr, perLeaderAmount);
            users[leaderAddr].totalEarnings += perLeaderAmount;
        }

        // Transfer remainder to admin reserve
        if (remainder > 0) {
            paymentToken.safeTransfer(adminReserve, remainder);
            emit PoolReserveTransferred(remainder, adminReserve);
        }

        return distributed;
    }
}
