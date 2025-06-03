// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IOrphiCommissions.sol";

/**
 * @title OrphiLeaderPool
 * @dev Manages Leader Bonus Pool distributions for qualified leaders
 * @notice Focused contract for leader qualification and bonus distribution
 */
contract OrphiLeaderPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ===== ENUMS =====
    enum LeaderRank { NONE, SHINING_STAR, SILVER_STAR }

    // ===== STRUCTS =====
    struct LeaderRequirements {
        uint256 shiningStarTeamSize;     // Default: 250
        uint256 shiningStarDirects;      // Default: 10
        uint256 silverStarTeamSize;      // Default: 500
        uint256 silverStarDirects;       // Default: 0 (no requirement)
    }

    struct LeaderInfo {
        LeaderRank rank;
        uint256 teamSize;
        uint256 directSponsors;
        uint256 totalEarned;
        uint256 lastRankUpdate;
        bool isActive;
        bool isQualified;
    }

    struct DistributionSettings {
        uint256 distributionInterval;    // Default: 14 days
        uint256 minimumBalance;          // Minimum balance to trigger distribution
        uint256 shiningStarShare;        // Default: 50% (5000 basis points)
        uint256 silverStarShare;         // Default: 50% (5000 basis points)
        bool autoDistributionEnabled;
    }

    struct DistributionRound {
        uint256 totalAmount;
        uint256 shiningStarAmount;
        uint256 silverStarAmount;
        uint256 shiningStarCount;
        uint256 silverStarCount;
        uint256 timestamp;
        bool completed;
    }

    // ===== CONSTANTS =====
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant DEFAULT_DISTRIBUTION_INTERVAL = 14 days;
    uint256 public constant DEFAULT_MIN_BALANCE = 50e18; // 50 USDT
    uint256 public constant DEFAULT_SHINING_STAR_TEAM_SIZE = 250;
    uint256 public constant DEFAULT_SHINING_STAR_DIRECTS = 10;
    uint256 public constant DEFAULT_SILVER_STAR_TEAM_SIZE = 500;
    uint256 public constant DEFAULT_SILVER_STAR_DIRECTS = 0;

    // ===== STATE VARIABLES =====
    IERC20 public paymentToken;
    address public adminReserve;
    address public matrixContract;
    address public commissionContract;

    LeaderRequirements public leaderRequirements;
    DistributionSettings public distributionSettings;
    
    uint256 public poolBalance;
    uint256 public lastDistributionTime;
    uint256 public distributionRoundCounter;
    uint256 public totalDistributedAllTime;

    // ===== MAPPINGS =====
    mapping(address => LeaderInfo) public leaderInfo;
    mapping(LeaderRank => address[]) public leadersByRank;
    mapping(uint256 => DistributionRound) public distributionRounds;
    mapping(address => uint256) public userTotalLeaderEarned;
    mapping(address => uint256) public userLastDistributionClaim;

    // ===== EVENTS =====
    event PoolFunded(
        address indexed funder,
        uint256 amount,
        uint256 newBalance,
        uint256 timestamp
    );
    event LeaderRankUpdated(
        address indexed user,
        LeaderRank oldRank,
        LeaderRank newRank,
        uint256 teamSize,
        uint256 directSponsors,
        uint256 timestamp
    );
    event LeaderBonusDistributed(
        uint256 indexed roundId,
        uint256 totalAmount,
        uint256 shiningStarAmount,
        uint256 silverStarAmount,
        uint256 shiningStarCount,
        uint256 silverStarCount,
        uint256 timestamp
    );
    event LeaderBonusClaim(
        address indexed leader,
        LeaderRank rank,
        uint256 amount,
        uint256 roundId,
        uint256 timestamp
    );
    event LeaderRequirementsUpdated(
        uint256 shiningStarTeamSize,
        uint256 shiningStarDirects,
        uint256 silverStarTeamSize,
        uint256 silverStarDirects
    );
    event DistributionSettingsUpdated(
        uint256 distributionInterval,
        uint256 minimumBalance,
        uint256 shiningStarShare,
        uint256 silverStarShare,
        bool autoDistributionEnabled
    );

    // ===== MODIFIERS =====
    modifier onlyMatrixContract() {
        require(msg.sender == matrixContract, "Only matrix contract");
        _;
    }

    modifier onlyCommissionContract() {
        require(msg.sender == commissionContract, "Only commission contract");
        _;
    }

    modifier distributionDue() {
        require(
            block.timestamp >= lastDistributionTime + distributionSettings.distributionInterval,
            "Distribution not due yet"
        );
        _;
    }

    modifier sufficientBalance() {
        require(poolBalance >= distributionSettings.minimumBalance, "Insufficient pool balance");
        _;
    }

    // ===== CONSTRUCTOR =====
    constructor(
        address _paymentToken,
        address _adminReserve,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_paymentToken != address(0), "Invalid payment token");
        require(_adminReserve != address(0), "Invalid admin reserve");

        paymentToken = IERC20(_paymentToken);
        adminReserve = _adminReserve;
        lastDistributionTime = block.timestamp;

        // Set default leader requirements
        leaderRequirements = LeaderRequirements({
            shiningStarTeamSize: DEFAULT_SHINING_STAR_TEAM_SIZE,
            shiningStarDirects: DEFAULT_SHINING_STAR_DIRECTS,
            silverStarTeamSize: DEFAULT_SILVER_STAR_TEAM_SIZE,
            silverStarDirects: DEFAULT_SILVER_STAR_DIRECTS
        });

        // Set default distribution settings
        distributionSettings = DistributionSettings({
            distributionInterval: DEFAULT_DISTRIBUTION_INTERVAL,
            minimumBalance: DEFAULT_MIN_BALANCE,
            shiningStarShare: 5000,  // 50%
            silverStarShare: 5000,   // 50%
            autoDistributionEnabled: true
        });
    }

    // ===== CONFIGURATION FUNCTIONS =====
    function setMatrixContract(address _matrixContract) external onlyOwner {
        require(_matrixContract != address(0), "Invalid matrix contract");
        matrixContract = _matrixContract;
    }

    function setCommissionContract(address _commissionContract) external onlyOwner {
        require(_commissionContract != address(0), "Invalid commission contract");
        commissionContract = _commissionContract;
    }

    function updateLeaderRequirements(
        uint256 _shiningStarTeamSize,
        uint256 _shiningStarDirects,
        uint256 _silverStarTeamSize,
        uint256 _silverStarDirects
    ) external onlyOwner {
        require(_shiningStarTeamSize > 0, "Invalid shining star team size");
        require(_silverStarTeamSize > 0, "Invalid silver star team size");
        require(_silverStarTeamSize > _shiningStarTeamSize, "Silver star team size must be larger");

        leaderRequirements = LeaderRequirements({
            shiningStarTeamSize: _shiningStarTeamSize,
            shiningStarDirects: _shiningStarDirects,
            silverStarTeamSize: _silverStarTeamSize,
            silverStarDirects: _silverStarDirects
        });

        emit LeaderRequirementsUpdated(
            _shiningStarTeamSize,
            _shiningStarDirects,
            _silverStarTeamSize,
            _silverStarDirects
        );
    }

    function updateDistributionSettings(
        uint256 _distributionInterval,
        uint256 _minimumBalance,
        uint256 _shiningStarShare,
        uint256 _silverStarShare,
        bool _autoDistributionEnabled
    ) external onlyOwner {
        require(_distributionInterval >= 1 days && _distributionInterval <= 30 days, "Invalid interval");
        require(_shiningStarShare + _silverStarShare == BASIS_POINTS, "Invalid share distribution");

        distributionSettings = DistributionSettings({
            distributionInterval: _distributionInterval,
            minimumBalance: _minimumBalance,
            shiningStarShare: _shiningStarShare,
            silverStarShare: _silverStarShare,
            autoDistributionEnabled: _autoDistributionEnabled
        });

        emit DistributionSettingsUpdated(
            _distributionInterval,
            _minimumBalance,
            _shiningStarShare,
            _silverStarShare,
            _autoDistributionEnabled
        );
    }

    // ===== FUNDING FUNCTIONS =====
    function fundPool(uint256 _amount) external {
        require(_amount > 0, "Invalid amount");
        
        paymentToken.safeTransferFrom(msg.sender, address(this), _amount);
        poolBalance += _amount;

        emit PoolFunded(msg.sender, _amount, poolBalance, block.timestamp);

        // Auto-distribute if enabled and conditions met
        if (distributionSettings.autoDistributionEnabled && canDistribute()) {
            _distributeLeaderBonus();
        }
    }

    function addToPool(uint256 _amount) external onlyCommissionContract {
        require(_amount > 0, "Invalid amount");
        poolBalance += _amount;

        emit PoolFunded(msg.sender, _amount, poolBalance, block.timestamp);

        // Auto-distribute if enabled and conditions met
        if (distributionSettings.autoDistributionEnabled && canDistribute()) {
            _distributeLeaderBonus();
        }
    }

    // ===== LEADER MANAGEMENT =====
    function updateLeaderInfo(
        address _user,
        uint256 _teamSize,
        uint256 _directSponsors
    ) external onlyMatrixContract {
        require(_user != address(0), "Invalid user");

        LeaderInfo storage leader = leaderInfo[_user];
        LeaderRank oldRank = leader.rank;
        
        leader.teamSize = _teamSize;
        leader.directSponsors = _directSponsors;
        leader.lastRankUpdate = block.timestamp;
        leader.isActive = true;

        // Calculate new rank
        LeaderRank newRank = _calculateLeaderRank(_teamSize, _directSponsors);
        
        if (newRank != oldRank) {
            // Remove from old rank list
            if (oldRank != LeaderRank.NONE) {
                _removeFromRankList(_user, oldRank);
            }
            
            // Add to new rank list
            if (newRank != LeaderRank.NONE) {
                leadersByRank[newRank].push(_user);
                leader.isQualified = true;
            } else {
                leader.isQualified = false;
            }
            
            leader.rank = newRank;
            
            emit LeaderRankUpdated(
                _user,
                oldRank,
                newRank,
                _teamSize,
                _directSponsors,
                block.timestamp
            );
        }
    }

    function _calculateLeaderRank(uint256 _teamSize, uint256 _directSponsors) internal view returns (LeaderRank) {
        // Check for Silver Star first (higher requirement)
        if (_teamSize >= leaderRequirements.silverStarTeamSize &&
            _directSponsors >= leaderRequirements.silverStarDirects) {
            return LeaderRank.SILVER_STAR;
        }
        
        // Check for Shining Star
        if (_teamSize >= leaderRequirements.shiningStarTeamSize &&
            _directSponsors >= leaderRequirements.shiningStarDirects) {
            return LeaderRank.SHINING_STAR;
        }
        
        return LeaderRank.NONE;
    }

    function _removeFromRankList(address _user, LeaderRank _rank) internal {
        address[] storage rankList = leadersByRank[_rank];
        for (uint256 i = 0; i < rankList.length; i++) {
            if (rankList[i] == _user) {
                rankList[i] = rankList[rankList.length - 1];
                rankList.pop();
                break;
            }
        }
    }

    // ===== DISTRIBUTION FUNCTIONS =====
    function distributeLeaderBonus() external onlyOwner distributionDue sufficientBalance nonReentrant {
        _distributeLeaderBonus();
    }

    function forceDistributeLeaderBonus() external onlyOwner nonReentrant {
        require(poolBalance > 0, "No balance to distribute");
        _distributeLeaderBonus();
    }

    function _distributeLeaderBonus() internal {
        uint256 currentBalance = poolBalance;
        require(currentBalance > 0, "No balance to distribute");

        distributionRoundCounter++;
        uint256 roundId = distributionRoundCounter;

        address[] memory shiningStars = leadersByRank[LeaderRank.SHINING_STAR];
        address[] memory silverStars = leadersByRank[LeaderRank.SILVER_STAR];

        uint256 shiningStarAmount = (currentBalance * distributionSettings.shiningStarShare) / BASIS_POINTS;
        uint256 silverStarAmount = currentBalance - shiningStarAmount;

        // Create distribution round
        distributionRounds[roundId] = DistributionRound({
            totalAmount: currentBalance,
            shiningStarAmount: shiningStarAmount,
            silverStarAmount: silverStarAmount,
            shiningStarCount: shiningStars.length,
            silverStarCount: silverStars.length,
            timestamp: block.timestamp,
            completed: false
        });

        uint256 totalDistributed = 0;

        // Distribute to Shining Stars
        if (shiningStars.length > 0) {
            uint256 perShiningStarAmount = shiningStarAmount / shiningStars.length;
            for (uint256 i = 0; i < shiningStars.length; i++) {
                address leader = shiningStars[i];
                if (leaderInfo[leader].isActive) {
                    _creditLeaderEarnings(leader, perShiningStarAmount, LeaderRank.SHINING_STAR, roundId);
                    totalDistributed += perShiningStarAmount;
                }
            }
        } else {
            // No Shining Stars, add to Silver Star pool
            silverStarAmount += shiningStarAmount;
        }

        // Distribute to Silver Stars
        if (silverStars.length > 0) {
            uint256 perSilverStarAmount = silverStarAmount / silverStars.length;
            for (uint256 i = 0; i < silverStars.length; i++) {
                address leader = silverStars[i];
                if (leaderInfo[leader].isActive) {
                    _creditLeaderEarnings(leader, perSilverStarAmount, LeaderRank.SILVER_STAR, roundId);
                    totalDistributed += perSilverStarAmount;
                }
            }
        } else {
            // No Silver Stars, send to admin reserve
            if (shiningStars.length == 0) {
                paymentToken.safeTransfer(adminReserve, currentBalance);
                totalDistributed = currentBalance;
            }
        }

        // Update state
        poolBalance = 0;
        lastDistributionTime = block.timestamp;
        totalDistributedAllTime += totalDistributed;
        distributionRounds[roundId].completed = true;

        emit LeaderBonusDistributed(
            roundId,
            currentBalance,
            shiningStarAmount,
            silverStarAmount,
            shiningStars.length,
            silverStars.length,
            block.timestamp
        );
    }

    function _creditLeaderEarnings(
        address _leader,
        uint256 _amount,
        LeaderRank _rank,
        uint256 _roundId
    ) internal {
        // Credit earnings through commission contract if available
        if (commissionContract != address(0)) {
            paymentToken.safeTransfer(commissionContract, _amount);
            IOrphiCommissions(commissionContract).creditEarnings(_leader, _amount);
        } else {
            // Fallback: send directly to leader
            paymentToken.safeTransfer(_leader, _amount);
        }

        leaderInfo[_leader].totalEarned += _amount;
        userTotalLeaderEarned[_leader] += _amount;
        userLastDistributionClaim[_leader] = _roundId;

        emit LeaderBonusClaim(_leader, _rank, _amount, _roundId, block.timestamp);
    }

    // ===== VIEW FUNCTIONS =====
    function canDistribute() public view returns (bool) {
        return block.timestamp >= lastDistributionTime + distributionSettings.distributionInterval &&
               poolBalance >= distributionSettings.minimumBalance;
    }

    function getNextDistributionTime() external view returns (uint256) {
        return lastDistributionTime + distributionSettings.distributionInterval;
    }

    function getTimeUntilNextDistribution() external view returns (uint256) {
        uint256 nextTime = lastDistributionTime + distributionSettings.distributionInterval;
        return block.timestamp >= nextTime ? 0 : nextTime - block.timestamp;
    }

    function getLeadersByRank(LeaderRank _rank) external view returns (address[] memory) {
        return leadersByRank[_rank];
    }

    function getLeaderCount(LeaderRank _rank) external view returns (uint256) {
        return leadersByRank[_rank].length;
    }

    function getLeaderInfo(address _user) external view returns (
        LeaderRank rank,
        uint256 teamSize,
        uint256 directSponsors,
        uint256 totalEarned,
        uint256 lastRankUpdate,
        bool isActive,
        bool isQualified
    ) {
        LeaderInfo storage leader = leaderInfo[_user];
        return (
            leader.rank,
            leader.teamSize,
            leader.directSponsors,
            leader.totalEarned,
            leader.lastRankUpdate,
            leader.isActive,
            leader.isQualified
        );
    }

    function getDistributionRoundInfo(uint256 _roundId) external view returns (
        uint256 totalAmount,
        uint256 shiningStarAmount,
        uint256 silverStarAmount,
        uint256 shiningStarCount,
        uint256 silverStarCount,
        uint256 timestamp,
        bool completed
    ) {
        DistributionRound storage round = distributionRounds[_roundId];
        return (
            round.totalAmount,
            round.shiningStarAmount,
            round.silverStarAmount,
            round.shiningStarCount,
            round.silverStarCount,
            round.timestamp,
            round.completed
        );
    }

    function getPoolStats() external view returns (
        uint256 currentBalance,
        uint256 lastDistribution,
        uint256 roundCounter,
        uint256 totalDistributed,
        uint256 nextDistribution,
        bool canDistributeNow,
        uint256 shiningStarCount,
        uint256 silverStarCount
    ) {
        return (
            poolBalance,
            lastDistributionTime,
            distributionRoundCounter,
            totalDistributedAllTime,
            lastDistributionTime + distributionSettings.distributionInterval,
            canDistribute(),
            leadersByRank[LeaderRank.SHINING_STAR].length,
            leadersByRank[LeaderRank.SILVER_STAR].length
        );
    }

    function estimateLeaderShare(address _user) external view returns (uint256) {
        LeaderInfo storage leader = leaderInfo[_user];
        if (!leader.isQualified || !leader.isActive || poolBalance == 0) {
            return 0;
        }

        uint256 rankShare;
        uint256 rankCount;

        if (leader.rank == LeaderRank.SHINING_STAR) {
            rankShare = (poolBalance * distributionSettings.shiningStarShare) / BASIS_POINTS;
            rankCount = leadersByRank[LeaderRank.SHINING_STAR].length;
        } else if (leader.rank == LeaderRank.SILVER_STAR) {
            rankShare = (poolBalance * distributionSettings.silverStarShare) / BASIS_POINTS;
            rankCount = leadersByRank[LeaderRank.SILVER_STAR].length;
        } else {
            return 0;
        }

        return rankCount > 0 ? rankShare / rankCount : 0;
    }

    // ===== EMERGENCY FUNCTIONS =====
    function emergencyDistribute(address _recipient, uint256 _amount, string memory _reason) external onlyOwner {
        require(_recipient != address(0), "Invalid recipient");
        require(_amount <= poolBalance, "Insufficient balance");
        require(bytes(_reason).length > 0, "Reason required");

        paymentToken.safeTransfer(_recipient, _amount);
        poolBalance -= _amount;
    }

    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(adminReserve, _amount);
        if (_token == address(paymentToken)) {
            poolBalance = 0;
        }
    }

    function pauseAutoDistribution() external onlyOwner {
        distributionSettings.autoDistributionEnabled = false;
    }

    function resumeAutoDistribution() external onlyOwner {
        distributionSettings.autoDistributionEnabled = true;
    }

    function resetLeaderRank(address _user) external onlyOwner {
        LeaderInfo storage leader = leaderInfo[_user];
        LeaderRank oldRank = leader.rank;
        
        if (oldRank != LeaderRank.NONE) {
            _removeFromRankList(_user, oldRank);
        }
        
        leader.rank = LeaderRank.NONE;
        leader.isQualified = false;
        leader.isActive = false;

        emit LeaderRankUpdated(_user, oldRank, LeaderRank.NONE, 0, 0, block.timestamp);
    }
}
