// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IOrphiCommissions
 * @dev Interface for Orphi commission calculation and distribution contracts
 */
interface IOrphiCommissions {
    // ===== STRUCTS =====
    struct CommissionInfo {
        uint256 sponsorCommission;
        uint256 levelBonus;
        uint256 uplineBonus;
        uint256 leaderBonus;
        uint256 globalHelpPool;
        uint256 totalDistributed;
        uint256 lastUpdate;
    }

    struct EarningsBreakdown {
        uint256 directEarnings;
        uint256 indirectEarnings;
        uint256 bonusEarnings;
        uint256 poolEarnings;
        uint256 totalEarnings;
        uint256 withdrawnAmount;
        uint256 availableAmount;
    }

    struct CommissionRate {
        uint256 sponsorRate;      // 40% = 4000 basis points
        uint256 levelRate;        // 10% = 1000 basis points
        uint256 uplineRate;       // 10% = 1000 basis points
        uint256 leaderRate;       // 10% = 1000 basis points
        uint256 globalHelpRate;   // 30% = 3000 basis points
    }

    // ===== EVENTS =====
    event CommissionsDistributed(
        address indexed user,
        uint256 totalAmount,
        uint256 sponsorAmount,
        uint256 levelAmount,
        uint256 uplineAmount,
        uint256 timestamp
    );

    event SponsorCommissionPaid(
        address indexed sponsor,
        address indexed user,
        uint256 amount,
        uint256 packageTier,
        uint256 timestamp
    );

    event LevelBonusPaid(
        address indexed recipient,
        address indexed from,
        uint256 level,
        uint256 amount,
        uint256 timestamp
    );

    event UplineBonusPaid(
        address indexed recipient,
        address indexed from,
        uint256 amount,
        uint256 uplineLevel,
        uint256 timestamp
    );

    event CommissionRatesUpdated(
        uint256 sponsorRate,
        uint256 levelRate,
        uint256 uplineRate,
        uint256 leaderRate,
        uint256 globalHelpRate,
        uint256 timestamp
    );

    event EarningsCapReached(
        address indexed user,
        uint256 totalEarnings,
        uint256 capLimit,
        uint256 timestamp
    );

    // ===== COMMISSION CALCULATION =====
    function calculateCommissions(
        address _user,
        uint256 _amount,
        uint256 _packageTier
    ) external view returns (CommissionInfo memory);

    function calculateSponsorCommission(
        address _sponsor,
        uint256 _amount,
        uint256 _packageTier
    ) external view returns (uint256);

    function calculateLevelBonus(
        address _user,
        uint256 _amount,
        uint256 _levels
    ) external view returns (uint256[] memory amounts, address[] memory recipients);

    function calculateUplineBonus(
        address _user,
        uint256 _amount,
        uint256 _levels
    ) external view returns (uint256[] memory amounts, address[] memory recipients);

    // ===== COMMISSION DISTRIBUTION =====
    function distributeCommissions(address _user, uint256 _amount) external;
    
    function paySponsorCommission(address _user, address _sponsor, uint256 _amount) external;
    
    function distributeLevelBonus(address _user, uint256 _amount) external;
    
    function distributeUplineBonus(address _user, uint256 _amount) external;

    // ===== USER MANAGEMENT =====
    function registerUser(
        address _user,
        address _sponsor,
        uint256 _packageTier,
        uint256 _amount
    ) external;

    function updateUserEarnings(address _user, uint256 _amount, uint8 _poolType) external;
    
    function setUserCapped(address _user, bool _capped) external;

    // ===== EARNINGS TRACKING =====
    function getUserEarnings(address _user) external view returns (EarningsBreakdown memory);
    
    function getTotalEarnings(address _user) external view returns (uint256);
    
    function getWithdrawableAmount(address _user) external view returns (uint256);
    
    function isUserCapped(address _user) external view returns (bool);
    
    function getUserEarningsCap(address _user) external view returns (uint256);

    // ===== COMMISSION RATES =====
    function getCommissionRates() external view returns (CommissionRate memory);
    
    function updateCommissionRates(
        uint256 _sponsorRate,
        uint256 _levelRate,
        uint256 _uplineRate,
        uint256 _leaderRate,
        uint256 _globalHelpRate
    ) external;

    // ===== ANALYTICS =====
    function getCommissionStats() external view returns (
        uint256 totalCommissionsPaid,
        uint256 totalSponsorCommissions,
        uint256 totalLevelBonuses,
        uint256 totalUplineBonuses,
        uint256 averageEarningsPerUser
    );

    function getUserCommissionHistory(address _user, uint256 _days) external view returns (
        uint256[] memory dailyEarnings,
        uint256[] memory timestamps
    );

    function getTopEarners(uint256 _limit) external view returns (
        address[] memory users,
        uint256[] memory earnings
    );

    // ===== VALIDATION =====
    function validateCommissionDistribution(
        uint256 _totalAmount,
        uint256 _distributedAmount
    ) external pure returns (bool);

    function canReceiveCommission(address _user) external view returns (bool);
    
    function getMaxCommissionForPackage(uint256 _packageTier) external view returns (uint256);

    // ===== ADDITIONAL METHODS =====
    function creditEarnings(address _user, uint256 _amount) external;
    
    function getWithdrawalRate(address _user) external view returns (uint256);
}
