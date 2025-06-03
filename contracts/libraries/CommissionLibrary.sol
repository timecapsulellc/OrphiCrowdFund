// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title CommissionLibrary
 * @dev Pure computational functions for commission calculations
 * @notice Handles all percentage-based calculations for pool distributions
 */
library CommissionLibrary {
    
    // Commission percentages in basis points (10000 = 100%)
    uint16 constant SPONSOR_COMMISSION = 4000; // 40%
    uint16 constant LEVEL_BONUS = 1000; // 10%
    uint16 constant GLOBAL_UPLINE_BONUS = 1000; // 10%
    uint16 constant LEADER_BONUS = 1000; // 10%
    uint16 constant GLOBAL_HELP_POOL = 3000; // 30%
    uint16 constant BASIS_POINTS = 10000; // 100%
    
    /**
     * @dev Get level percentage for specific level
     * @param level Level index (0-9)
     * @return percentage Percentage in basis points
     */
    function getLevelPercentage(uint256 level) internal pure returns (uint16 percentage) {
        if (level == 0) return 300; // 3%
        if (level >= 1 && level <= 5) return 100; // 1%
        if (level >= 6 && level <= 9) return 50; // 0.5%
        return 0;
    }
    
    /**
     * @dev Calculate commission breakdown for package purchase
     * @param amount Total package amount
     * @return sponsorAmount Amount for sponsor commission
     * @return levelAmount Amount for level bonus pool
     * @return uplineAmount Amount for global upline pool
     * @return leaderAmount Amount for leader bonus pool
     * @return ghpAmount Amount for global help pool
     */
    function calculateCommissionBreakdown(uint256 amount) 
        external 
        pure 
        returns (
            uint256 sponsorAmount,
            uint256 levelAmount,
            uint256 uplineAmount,
            uint256 leaderAmount,
            uint256 ghpAmount
        ) 
    {
        sponsorAmount = (amount * SPONSOR_COMMISSION) / BASIS_POINTS;
        levelAmount = (amount * LEVEL_BONUS) / BASIS_POINTS;
        uplineAmount = (amount * GLOBAL_UPLINE_BONUS) / BASIS_POINTS;
        leaderAmount = (amount * LEADER_BONUS) / BASIS_POINTS;
        ghpAmount = (amount * GLOBAL_HELP_POOL) / BASIS_POINTS;
        
        // Ensure total equals input amount
        uint256 total = sponsorAmount + levelAmount + uplineAmount + leaderAmount + ghpAmount;
        require(total == amount, "Commission breakdown mismatch");
    }
    
    /**
     * @dev Calculate level bonus distribution for 10 levels
     * @param totalAmount Total amount to distribute
     * @return amounts Array of amounts for each level
     */
    function calculateLevelBonus(uint256 totalAmount) 
        external 
        pure 
        returns (uint256[10] memory amounts) 
    {
        for (uint8 i = 0; i < 10; i++) {
            amounts[i] = (totalAmount * getLevelPercentage(i)) / BASIS_POINTS;
        }
        
        // Verify total distribution
        uint256 total = 0;
        for (uint8 i = 0; i < 10; i++) {
            total += amounts[i];
        }
        require(total == totalAmount, "Level bonus distribution mismatch");
    }
    
    /**
     * @dev Calculate withdrawal percentages based on direct sponsors
     * @param directSponsors Number of direct sponsors
     * @return withdrawalPercentage Percentage user can withdraw
     * @return reinvestmentPercentage Percentage that gets reinvested
     */
    function calculateWithdrawalRates(uint256 directSponsors) 
        external 
        pure 
        returns (uint256 withdrawalPercentage, uint256 reinvestmentPercentage) 
    {
        if (directSponsors >= 20) {
            withdrawalPercentage = 8000; // 80%
        } else if (directSponsors >= 5) {
            withdrawalPercentage = 7500; // 75%
        } else {
            withdrawalPercentage = 7000; // 70%
        }
        
        reinvestmentPercentage = BASIS_POINTS - withdrawalPercentage;
    }
    
    /**
     * @dev Calculate reinvestment distribution
     * @param amount Total reinvestment amount
     * @return levelPool Amount for level bonus pool (40%)
     * @return uplinePool Amount for global upline pool (30%)
     * @return ghpPool Amount for global help pool (30%)
     */
    function calculateReinvestmentDistribution(uint256 amount) 
        external 
        pure 
        returns (uint256 levelPool, uint256 uplinePool, uint256 ghpPool) 
    {
        levelPool = (amount * 4000) / BASIS_POINTS; // 40%
        uplinePool = (amount * 3000) / BASIS_POINTS; // 30%
        ghpPool = amount - levelPool - uplinePool; // 30% (ensures exact distribution)
    }
    
    /**
     * @dev Calculate earnings cap for user
     * @param investment Total user investment
     * @param multiplier Cap multiplier (typically 4x)
     * @return cap Maximum earnings allowed
     */
    function calculateEarningsCap(uint256 investment, uint256 multiplier) 
        external 
        pure 
        returns (uint256 cap) 
    {
        return investment * multiplier;
    }
    
    /**
     * @dev Check if user has reached earnings cap
     * @param totalEarnings User's total earnings
     * @param totalInvestment User's total investment
     * @param multiplier Cap multiplier
     * @return hasReachedCap True if user has reached cap
     */
    function hasReachedEarningsCap(
        uint256 totalEarnings,
        uint256 totalInvestment,
        uint256 multiplier
    ) external pure returns (bool hasReachedCap) {
        uint256 cap = totalInvestment * multiplier;
        return totalEarnings >= cap;
    }
    
    /**
     * @dev Calculate proportional GHP share
     * @param totalPool Total GHP pool amount
     * @param userWeight User's weight in distribution
     * @param totalWeight Total weight of all eligible users
     * @return userShare User's proportional share
     */
    function calculateGHPShare(
        uint256 totalPool,
        uint256 userWeight,
        uint256 totalWeight
    ) external pure returns (uint256 userShare) {
        if (totalWeight == 0) return 0;
        return (totalPool * userWeight) / totalWeight;
    }
    
    /**
     * @dev Calculate user weight for GHP distribution
     * @param packageLevel User's package level
     * @param teamSize User's team size
     * @param basePackagePrice Base package price for calculations
     * @return weight User's weight in GHP distribution
     */
    function calculateUserWeight(
        uint256 packageLevel,
        uint256 teamSize,
        uint256 basePackagePrice
    ) external pure returns (uint256 weight) {
        uint256 packageValue = getPackageValue(packageLevel, basePackagePrice);
        uint256 teamValue = teamSize * basePackagePrice;
        return packageValue + teamValue;
    }
    
    /**
     * @dev Get package value based on level
     * @param level Package level (1-5)
     * @param basePrice Base package price
     * @return value Package value
     */
    function getPackageValue(uint256 level, uint256 basePrice) 
        public 
        pure 
        returns (uint256 value) 
    {
        if (level == 1) return basePrice; // 100 USDT
        if (level == 2) return basePrice * 2; // 200 USDT
        if (level == 3) return basePrice * 5; // 500 USDT
        if (level == 4) return basePrice * 10; // 1000 USDT
        if (level == 5) return basePrice * 20; // 2000 USDT
        return basePrice; // Default to level 1
    }
    
    /**
     * @dev Validate commission percentages sum to 100%
     * @return isValid True if percentages are valid
     */
    function validateCommissionPercentages() external pure returns (bool isValid) {
        uint256 total = SPONSOR_COMMISSION + LEVEL_BONUS + GLOBAL_UPLINE_BONUS + LEADER_BONUS + GLOBAL_HELP_POOL;
        return total == BASIS_POINTS;
    }
}
