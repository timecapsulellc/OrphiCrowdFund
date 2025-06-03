// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IOrphiPools
 * @dev Interface for Orphi pool management contracts (Global Help Pool and Leader Pool)
 */
interface IOrphiPools {
    // ===== STRUCTS =====
    struct PoolInfo {
        uint256 balance;
        uint256 totalDistributed;
        uint256 participantCount;
        uint256 lastDistribution;
        uint256 distributionInterval;
        bool isActive;
    }

    struct ParticipantInfo {
        bool isEligible;
        uint256 contribution;
        uint256 lastReceived;
        uint256 totalReceived;
        uint256 eligibilityScore;
        uint256 joinTime;
    }

    struct DistributionRecord {
        uint256 timestamp;
        uint256 totalAmount;
        uint256 participantCount;
        uint256 averageAmount;
        bytes32 distributionId;
    }

    struct LeaderInfo {
        uint8 rank; // 0 = None, 1 = Shining Star, 2 = Silver Star
        uint256 qualificationTime;
        uint256 teamSize;
        uint256 teamVolume;
        uint256 directSponsors;
        bool isQualified;
        uint256 lastBonusReceived;
    }

    // ===== EVENTS =====
    event PoolFunded(
        string indexed poolType,
        uint256 amount,
        address indexed contributor,
        uint256 newBalance,
        uint256 timestamp
    );

    event PoolDistributed(
        string indexed poolType,
        bytes32 indexed distributionId,
        uint256 totalAmount,
        uint256 participantCount,
        uint256 timestamp
    );

    event ParticipantAdded(
        string indexed poolType,
        address indexed participant,
        uint256 contribution,
        uint256 eligibilityScore,
        uint256 timestamp
    );

    event ParticipantRemoved(
        string indexed poolType,
        address indexed participant,
        string reason,
        uint256 timestamp
    );

    event EligibilityUpdated(
        address indexed participant,
        string indexed poolType,
        bool oldEligibility,
        bool newEligibility,
        uint256 newScore,
        uint256 timestamp
    );

    event LeaderRankUpdated(
        address indexed leader,
        uint8 oldRank,
        uint8 newRank,
        uint256 teamSize,
        uint256 teamVolume,
        uint256 timestamp
    );

    event DistributionThresholdUpdated(
        string indexed poolType,
        uint256 oldThreshold,
        uint256 newThreshold,
        uint256 timestamp
    );

    // ===== POOL MANAGEMENT =====
    function addToPool(string calldata _poolType, uint256 _amount) external;
    
    function distributePool(string calldata _poolType) external returns (bytes32 distributionId);
    
    function scheduleDistribution(string calldata _poolType, uint256 _scheduledTime) external;
    
    function emergencyWithdrawPool(string calldata _poolType, uint256 _amount, address _recipient) external;

    // ===== PARTICIPANT MANAGEMENT =====
    function addParticipant(
        string calldata _poolType,
        address _participant,
        uint256 _contribution
    ) external;

    function removeParticipant(string calldata _poolType, address _participant, string calldata _reason) external;
    
    function updateEligibility(string calldata _poolType, address _participant) external;
    
    function batchUpdateEligibility(string calldata _poolType, address[] calldata _participants) external;

    // ===== GLOBAL HELP POOL (GHP) =====
    function addToGHP(uint256 _amount) external;
    
    function distributeGHP() external returns (bytes32);
    
    function getGHPEligibleParticipants() external view returns (address[] memory, uint256[] memory);
    
    function isGHPEligible(address _participant) external view returns (bool);
    
    function calculateGHPShare(address _participant) external view returns (uint256);

    // ===== LEADER POOL =====
    function addToLeaderPool(uint256 _amount) external;
    
    function distributeLeaderBonus() external returns (bytes32);
    
    function updateLeaderRank(address _leader, uint256 _teamSize, uint256 _teamVolume, uint256 _directSponsors) external;
    
    function getQualifiedLeaders() external view returns (address[] memory, uint8[] memory);
    
    function isLeaderQualified(address _leader) external view returns (bool, uint8 rank);
    
    function calculateLeaderBonus(address _leader) external view returns (uint256);

    // ===== QUERY FUNCTIONS =====
    function getPoolInfo(string calldata _poolType) external view returns (PoolInfo memory);
    
    function getParticipantInfo(string calldata _poolType, address _participant) external view returns (ParticipantInfo memory);
    
    function getDistributionHistory(string calldata _poolType, uint256 _limit) external view returns (DistributionRecord[] memory);
    
    function getLeaderInfo(address _leader) external view returns (LeaderInfo memory);

    // ===== POOL ANALYTICS =====
    function getPoolBalance(string calldata _poolType) external view returns (uint256);
    
    function getTotalParticipants(string calldata _poolType) external view returns (uint256);
    
    function getActiveParticipants(string calldata _poolType) external view returns (uint256);
    
    function getPoolStatistics(string calldata _poolType) external view returns (
        uint256 totalFunded,
        uint256 totalDistributed,
        uint256 averageDistribution,
        uint256 distributionCount,
        uint256 participantCount
    );

    // ===== CONFIGURATION =====
    function setDistributionInterval(string calldata _poolType, uint256 _interval) external;
    
    function setDistributionThreshold(string calldata _poolType, uint256 _threshold) external;
    
    function setEligibilityRequirements(
        string calldata _poolType,
        uint256 _minContribution,
        uint256 _minActivityDays,
        bool _requiresKYC
    ) external;

    // ===== AUTOMATION SUPPORT =====
    function canDistribute(string calldata _poolType) external view returns (bool);
    
    function getNextDistributionTime(string calldata _poolType) external view returns (uint256);
    
    function getDistributionAmount(string calldata _poolType) external view returns (uint256);
    
    function needsEligibilityUpdate() external view returns (address[] memory participants, string[] memory poolTypes);

    // ===== EMERGENCY FUNCTIONS =====
    function pausePool(string calldata _poolType) external;
    
    function unpausePool(string calldata _poolType) external;
    
    function isPoolPaused(string calldata _poolType) external view returns (bool);
    
    function emergencyFreeze() external;
    
    function emergencyUnfreeze() external;
}
