// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IOrphiCommissions.sol";

/**
 * @title OrphiGlobalHelpPool
 * @dev Manages Global Help Pool distributions and eligibility
 * @notice Focused contract for GHP functionality only
 */
contract OrphiGlobalHelpPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ===== STRUCTS =====
    struct PoolSettings {
        uint256 distributionInterval;  // Default: 7 days
        uint256 minimumBalance;        // Minimum balance to trigger distribution
        uint256 eligibilityPeriod;     // Activity requirement: 30 days
        bool autoDistributionEnabled;
        uint256 maxParticipants;       // Gas optimization limit
    }

    struct UserEligibility {
        uint256 lastActivity;
        uint256 totalInvested;
        uint256 teamSize;
        bool isCapped;
        bool isActive;
        uint256 lastGHPClaim;
    }

    struct DistributionRound {
        uint256 totalAmount;
        uint256 participantCount;
        uint256 timestamp;
        uint256 eligibleVolume;
        bool completed;
    }

    // ===== CONSTANTS =====
    uint256 public constant DEFAULT_DISTRIBUTION_INTERVAL = 7 days;
    uint256 public constant DEFAULT_ELIGIBILITY_PERIOD = 30 days;
    uint256 public constant DEFAULT_MIN_BALANCE = 100e18; // 100 USDT
    uint256 public constant MAX_PARTICIPANTS_DEFAULT = 10000;
    uint256 public constant PACKAGE_30_EQUIVALENT = 30e18;

    // ===== STATE VARIABLES =====
    IERC20 public paymentToken;
    address public adminReserve;
    address public matrixContract;
    address public commissionContract;

    PoolSettings public poolSettings;
    uint256 public poolBalance;
    uint256 public lastDistributionTime;
    uint256 public distributionRoundCounter;
    uint256 public totalDistributedAllTime;

    // ===== MAPPINGS =====
    mapping(address => UserEligibility) public userEligibility;
    mapping(uint256 => DistributionRound) public distributionRounds;
    mapping(address => uint256) public userTotalGHPEarned;
    mapping(address => uint256) public userLastDistributionClaim;

    // ===== EVENTS =====
    event PoolFunded(
        address indexed funder,
        uint256 amount,
        uint256 newBalance,
        uint256 timestamp
    );
    event GHPDistributed(
        uint256 indexed roundId,
        uint256 totalAmount,
        uint256 participantCount,
        uint256 eligibleVolume,
        uint256 timestamp
    );
    event UserGHPClaim(
        address indexed user,
        uint256 amount,
        uint256 roundId,
        uint256 userVolume,
        uint256 timestamp
    );
    event EligibilityUpdated(
        address indexed user,
        uint256 lastActivity,
        uint256 totalInvested,
        uint256 teamSize,
        bool isCapped
    );
    event PoolSettingsUpdated(
        uint256 distributionInterval,
        uint256 minimumBalance,
        uint256 eligibilityPeriod,
        bool autoDistributionEnabled,
        uint256 maxParticipants
    );
    event EmergencyDistribution(
        uint256 amount,
        address recipient,
        string reason,
        uint256 timestamp
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
            block.timestamp >= lastDistributionTime + poolSettings.distributionInterval,
            "Distribution not due yet"
        );
        _;
    }

    modifier sufficientBalance() {
        require(poolBalance >= poolSettings.minimumBalance, "Insufficient pool balance");
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

        // Set default pool settings
        poolSettings = PoolSettings({
            distributionInterval: DEFAULT_DISTRIBUTION_INTERVAL,
            minimumBalance: DEFAULT_MIN_BALANCE,
            eligibilityPeriod: DEFAULT_ELIGIBILITY_PERIOD,
            autoDistributionEnabled: true,
            maxParticipants: MAX_PARTICIPANTS_DEFAULT
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

    function updatePoolSettings(
        uint256 _distributionInterval,
        uint256 _minimumBalance,
        uint256 _eligibilityPeriod,
        bool _autoDistributionEnabled,
        uint256 _maxParticipants
    ) external onlyOwner {
        require(_distributionInterval >= 1 days && _distributionInterval <= 30 days, "Invalid interval");
        require(_eligibilityPeriod >= 1 days && _eligibilityPeriod <= 90 days, "Invalid eligibility period");
        require(_maxParticipants >= 100 && _maxParticipants <= 50000, "Invalid max participants");

        poolSettings = PoolSettings({
            distributionInterval: _distributionInterval,
            minimumBalance: _minimumBalance,
            eligibilityPeriod: _eligibilityPeriod,
            autoDistributionEnabled: _autoDistributionEnabled,
            maxParticipants: _maxParticipants
        });

        emit PoolSettingsUpdated(
            _distributionInterval,
            _minimumBalance,
            _eligibilityPeriod,
            _autoDistributionEnabled,
            _maxParticipants
        );
    }

    // ===== FUNDING FUNCTIONS =====
    function fundPool(uint256 _amount) external {
        require(_amount > 0, "Invalid amount");
        
        paymentToken.safeTransferFrom(msg.sender, address(this), _amount);
        poolBalance += _amount;

        emit PoolFunded(msg.sender, _amount, poolBalance, block.timestamp);

        // Auto-distribute if enabled and conditions met
        if (poolSettings.autoDistributionEnabled && canDistribute()) {
            _distributeGHP();
        }
    }

    function addToPool(uint256 _amount) external onlyCommissionContract {
        require(_amount > 0, "Invalid amount");
        poolBalance += _amount;

        emit PoolFunded(msg.sender, _amount, poolBalance, block.timestamp);

        // Auto-distribute if enabled and conditions met
        if (poolSettings.autoDistributionEnabled && canDistribute()) {
            _distributeGHP();
        }
    }

    // ===== USER MANAGEMENT =====
    function updateUserEligibility(
        address _user,
        uint256 _totalInvested,
        uint256 _teamSize,
        bool _isCapped
    ) external onlyMatrixContract {
        require(_user != address(0), "Invalid user");

        UserEligibility storage eligibility = userEligibility[_user];
        eligibility.lastActivity = block.timestamp;
        eligibility.totalInvested = _totalInvested;
        eligibility.teamSize = _teamSize;
        eligibility.isCapped = _isCapped;
        eligibility.isActive = true;

        emit EligibilityUpdated(_user, block.timestamp, _totalInvested, _teamSize, _isCapped);
    }

    function markUserActivity(address _user) external onlyCommissionContract {
        require(_user != address(0), "Invalid user");
        userEligibility[_user].lastActivity = block.timestamp;
    }

    // ===== DISTRIBUTION FUNCTIONS =====
    function distributeGHP() external onlyOwner distributionDue sufficientBalance nonReentrant {
        _distributeGHP();
    }

    function forceDistributeGHP() external onlyOwner nonReentrant {
        require(poolBalance > 0, "No balance to distribute");
        _distributeGHP();
    }

    function _distributeGHP() internal {
        uint256 currentBalance = poolBalance;
        require(currentBalance > 0, "No balance to distribute");

        distributionRoundCounter++;
        uint256 roundId = distributionRoundCounter;

        // Calculate eligible participants and total volume
        (address[] memory eligibleUsers, uint256 totalEligibleVolume) = _calculateEligibleUsers();
        
        if (eligibleUsers.length == 0 || totalEligibleVolume == 0) {
            // No eligible users, send to admin reserve
            paymentToken.safeTransfer(adminReserve, currentBalance);
            poolBalance = 0;
            
            emit EmergencyDistribution(
                currentBalance,
                adminReserve,
                "No eligible users",
                block.timestamp
            );
            return;
        }

        // Create distribution round
        distributionRounds[roundId] = DistributionRound({
            totalAmount: currentBalance,
            participantCount: eligibleUsers.length,
            timestamp: block.timestamp,
            eligibleVolume: totalEligibleVolume,
            completed: false
        });

        // Distribute to eligible users
        uint256 totalDistributed = 0;
        for (uint256 i = 0; i < eligibleUsers.length; i++) {
            address user = eligibleUsers[i];
            uint256 userVolume = _calculateUserVolume(user);
            uint256 userShare = (currentBalance * userVolume) / totalEligibleVolume;
            
            if (userShare > 0) {
                // Credit earnings through commission contract
                if (commissionContract != address(0)) {
                    paymentToken.safeTransfer(commissionContract, userShare);
                    IOrphiCommissions(commissionContract).creditEarnings(user, userShare);
                } else {
                    // Fallback: send directly to user
                    paymentToken.safeTransfer(user, userShare);
                }

                userTotalGHPEarned[user] += userShare;
                userLastDistributionClaim[user] = roundId;
                totalDistributed += userShare;

                emit UserGHPClaim(user, userShare, roundId, userVolume, block.timestamp);
            }
        }

        // Update state
        poolBalance = 0;
        lastDistributionTime = block.timestamp;
        totalDistributedAllTime += totalDistributed;
        distributionRounds[roundId].completed = true;

        emit GHPDistributed(
            roundId,
            currentBalance,
            eligibleUsers.length,
            totalEligibleVolume,
            block.timestamp
        );
    }

    // ===== INTERNAL HELPER FUNCTIONS =====
    function _calculateEligibleUsers() internal view returns (address[] memory, uint256) {
        // This is a simplified version - in production, you'd need to iterate through all registered users
        // For now, return empty arrays as this would need integration with the matrix contract
        address[] memory eligibleUsers = new address[](0);
        uint256 totalVolume = 0;
        return (eligibleUsers, totalVolume);
    }

    function _calculateUserVolume(address _user) internal view returns (uint256) {
        UserEligibility storage eligibility = userEligibility[_user];
        return eligibility.totalInvested + (eligibility.teamSize * PACKAGE_30_EQUIVALENT);
    }

    function _isUserEligible(address _user) internal view returns (bool) {
        UserEligibility storage eligibility = userEligibility[_user];
        
        return eligibility.isActive &&
               !eligibility.isCapped &&
               (block.timestamp - eligibility.lastActivity) <= poolSettings.eligibilityPeriod;
    }

    // ===== VIEW FUNCTIONS =====
    function canDistribute() public view returns (bool) {
        return block.timestamp >= lastDistributionTime + poolSettings.distributionInterval &&
               poolBalance >= poolSettings.minimumBalance;
    }

    function getNextDistributionTime() external view returns (uint256) {
        return lastDistributionTime + poolSettings.distributionInterval;
    }

    function getTimeUntilNextDistribution() external view returns (uint256) {
        uint256 nextTime = lastDistributionTime + poolSettings.distributionInterval;
        return block.timestamp >= nextTime ? 0 : nextTime - block.timestamp;
    }

    function getUserEligibilityInfo(address _user) external view returns (
        uint256 lastActivity,
        uint256 totalInvested,
        uint256 teamSize,
        bool isCapped,
        bool isActive,
        uint256 lastGHPClaim,
        bool isEligible
    ) {
        UserEligibility storage eligibility = userEligibility[_user];
        return (
            eligibility.lastActivity,
            eligibility.totalInvested,
            eligibility.teamSize,
            eligibility.isCapped,
            eligibility.isActive,
            eligibility.lastGHPClaim,
            _isUserEligible(_user)
        );
    }

    function getDistributionRoundInfo(uint256 _roundId) external view returns (
        uint256 totalAmount,
        uint256 participantCount,
        uint256 timestamp,
        uint256 eligibleVolume,
        bool completed
    ) {
        DistributionRound storage round = distributionRounds[_roundId];
        return (
            round.totalAmount,
            round.participantCount,
            round.timestamp,
            round.eligibleVolume,
            round.completed
        );
    }

    function getPoolStats() external view returns (
        uint256 currentBalance,
        uint256 lastDistribution,
        uint256 roundCounter,
        uint256 totalDistributed,
        uint256 nextDistribution,
        bool canDistributeNow
    ) {
        return (
            poolBalance,
            lastDistributionTime,
            distributionRoundCounter,
            totalDistributedAllTime,
            lastDistributionTime + poolSettings.distributionInterval,
            canDistribute()
        );
    }

    function estimateUserShare(address _user) external view returns (uint256) {
        if (!_isUserEligible(_user) || poolBalance == 0) {
            return 0;
        }

        uint256 userVolume = _calculateUserVolume(_user);
        // This is a simplified estimation - actual calculation would need all users
        return (poolBalance * userVolume) / (userVolume * 100); // Rough estimate
    }

    // ===== EMERGENCY FUNCTIONS =====
    function emergencyDistribute(address _recipient, uint256 _amount, string memory _reason) external onlyOwner {
        require(_recipient != address(0), "Invalid recipient");
        require(_amount <= poolBalance, "Insufficient balance");
        require(bytes(_reason).length > 0, "Reason required");

        paymentToken.safeTransfer(_recipient, _amount);
        poolBalance -= _amount;

        emit EmergencyDistribution(_amount, _recipient, _reason, block.timestamp);
    }

    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(adminReserve, _amount);
        if (_token == address(paymentToken)) {
            poolBalance = 0;
        }
    }

    function pauseAutoDistribution() external onlyOwner {
        poolSettings.autoDistributionEnabled = false;
    }

    function resumeAutoDistribution() external onlyOwner {
        poolSettings.autoDistributionEnabled = true;
    }
}
