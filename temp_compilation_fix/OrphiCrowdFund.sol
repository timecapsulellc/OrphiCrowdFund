// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "./libraries/PoolDistributionLibSimple.sol";
import "./libraries/AutomationLibSimple.sol";

/**
 * @title OrphiCrowdFund
 * @dev New optimized contract with Chainlink automation and library-based architecture
 * @notice 2×∞ Forced Matrix MLM system with Chainlink automation - Under 24KB
 */
contract OrphiCrowdFund is Ownable, ReentrancyGuard, Pausable, AutomationCompatibleInterface {
    using SafeERC20 for IERC20;

    // ===== CONSTANTS =====
    uint256 constant EARNINGS_CAP_MULTIPLIER = 4;
    uint16 constant SPONSOR_COMMISSION = 4000; // 40%
    uint16 constant LEVEL_BONUS = 1000; // 10%
    uint16 constant GLOBAL_UPLINE_BONUS = 1000; // 10%
    uint16 constant LEADER_BONUS = 1000; // 10%
    uint16 constant GLOBAL_HELP_POOL = 3000; // 30%
    uint16 constant BASIS_POINTS = 10000; // 100%

    // Package prices (simplified to 5 levels)
    uint256[5] public PACKAGE_PRICES = [100e6, 200e6, 500e6, 1000e6, 2000e6];

    // ===== STATE VARIABLES =====
    IERC20 public immutable paymentToken;
    address public adminReserve;
    uint32 public totalMembers;
    uint256 public totalVolume;

    // Pool state
    uint128[5] public poolBalances;
    uint256 public lastGHPDistribution;
    uint256 public lastLeaderDistribution;

    // Automation state
    bool public automationEnabled;
    uint256 public lastUpkeepTimestamp;
    uint256 public performanceCounter;
    uint256 public gasLimit;

    // ===== STRUCTS =====
    struct User {
        uint256 id;
        address sponsor;
        uint256 packageLevel;
        uint256 directSponsors;
        uint256 totalEarnings;
        uint256 totalWithdrawn;
        uint256 lastActivity;
        bool isActive;
        bool hasReachedCap;
        uint8 leadershipLevel;
    }

    // ===== MAPPINGS =====
    mapping(address => User) public users;
    mapping(uint256 => address) public userIdToAddress;

    // Optimized mappings for library compatibility
    mapping(address => bool) public isActive;
    mapping(address => bool) public hasReachedCap;
    mapping(address => uint256) public lastActivity;
    mapping(address => uint256) public totalEarnings;
    mapping(address => uint8) public leadershipLevel;

    // ===== EVENTS =====
    event UserRegistered(address indexed user, address indexed sponsor, uint256 userId, uint256 packageLevel);
    event CommissionDistributed(address indexed user, uint256 amount, string commissionType);
    event WithdrawalProcessed(address indexed user, uint256 amount, uint256 reinvestment);
    event AutomationExecuted(string actionType, uint256 amount);
    event PoolDistributed(string poolType, uint256 amount, uint256 recipients);

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
        
        // Initialize automation
        automationEnabled = true;
        gasLimit = 500000;
        lastUpkeepTimestamp = block.timestamp;
        
        // Initialize pool state
        lastGHPDistribution = block.timestamp;
        lastLeaderDistribution = block.timestamp;
    }

    // ===== CHAINLINK AUTOMATION =====
    function checkUpkeep(bytes calldata) external view override returns (bool, bytes memory) {
        return AutomationLibSimple.checkUpkeep(
            automationEnabled,
            poolBalances,
            lastGHPDistribution,
            lastLeaderDistribution
        );
    }

    function performUpkeep(bytes calldata performData) external override {
        (string memory actionType, bool success) = AutomationLibSimple.processAutomation(
            automationEnabled,
            lastUpkeepTimestamp,
            performanceCounter,
            performData
        );
        
        if (!success) return;

        lastUpkeepTimestamp = block.timestamp;
        performanceCounter++;

        if (keccak256(bytes(actionType)) == keccak256(bytes("GHP_DISTRIBUTION"))) {
            _distributeGlobalHelpPool();
        } else if (keccak256(bytes(actionType)) == keccak256(bytes("LEADER_DISTRIBUTION"))) {
            _distributeLeaderBonus();
        }
    }

    // ===== PUBLIC FUNCTIONS =====
    function register(address sponsor, uint256 packageLevel) external nonReentrant whenNotPaused {
        require(packageLevel >= 1 && packageLevel <= 5, "Invalid package level");
        require(users[msg.sender].id == 0, "User already registered");
        require(users[sponsor].id > 0 || sponsor == owner(), "Invalid sponsor");

        uint256 packagePrice = PACKAGE_PRICES[packageLevel - 1];
        paymentToken.safeTransferFrom(msg.sender, address(this), packagePrice);

        totalMembers++;
        totalVolume += packagePrice;

        users[msg.sender] = User({
            id: totalMembers,
            sponsor: sponsor,
            packageLevel: packageLevel,
            directSponsors: 0,
            totalEarnings: 0,
            totalWithdrawn: 0,
            lastActivity: block.timestamp,
            isActive: true,
            hasReachedCap: false,
            leadershipLevel: 0
        });

        // Update optimized mappings for library compatibility
        isActive[msg.sender] = true;
        lastActivity[msg.sender] = block.timestamp;
        userIdToAddress[totalMembers] = msg.sender;
        users[sponsor].directSponsors++;

        // Distribute commissions
        _distributeCommissions(packagePrice, msg.sender);

        emit UserRegistered(msg.sender, sponsor, totalMembers, packageLevel);
    }

    function withdraw() external nonReentrant whenNotPaused {
        User storage user = users[msg.sender];
        require(user.id > 0, "User not registered");
        require(user.totalEarnings > user.totalWithdrawn, "No earnings to withdraw");

        uint256 availableEarnings = user.totalEarnings - user.totalWithdrawn;
        uint256 directSponsors = user.directSponsors;

        uint256 withdrawalPercentage;
        if (directSponsors >= 20) {
            withdrawalPercentage = 8000; // 80%
        } else if (directSponsors >= 5) {
            withdrawalPercentage = 7500; // 75%
        } else {
            withdrawalPercentage = 7000; // 70%
        }

        uint256 withdrawalAmount = (availableEarnings * withdrawalPercentage) / BASIS_POINTS;
        uint256 reinvestmentAmount = availableEarnings - withdrawalAmount;

        user.totalWithdrawn = user.totalEarnings;
        paymentToken.safeTransfer(msg.sender, withdrawalAmount);

        if (reinvestmentAmount > 0) {
            _distributeReinvestment(reinvestmentAmount);
        }

        emit WithdrawalProcessed(msg.sender, withdrawalAmount, reinvestmentAmount);
    }

    // ===== INTERNAL FUNCTIONS =====
    function _distributeCommissions(uint256 amount, address user) internal {
        // Sponsor Commission (40%)
        uint256 sponsorCommission = (amount * SPONSOR_COMMISSION) / BASIS_POINTS;
        address sponsor = users[user].sponsor;
        if (sponsor != address(0) && users[sponsor].isActive) {
            _creditEarnings(sponsor, sponsorCommission);
            emit CommissionDistributed(sponsor, sponsorCommission, "SPONSOR");
        } else {
            poolBalances[4] += uint128(sponsorCommission);
        }

        // Level Bonus (10% total) - simplified to just add to pool
        uint256 levelBonus = (amount * LEVEL_BONUS) / BASIS_POINTS;
        poolBalances[1] += uint128(levelBonus);

        // Global Upline Bonus (10%)
        uint256 globalUplineBonus = (amount * GLOBAL_UPLINE_BONUS) / BASIS_POINTS;
        poolBalances[2] += uint128(globalUplineBonus);

        // Leader Bonus (10%)
        uint256 leaderBonus = (amount * LEADER_BONUS) / BASIS_POINTS;
        poolBalances[3] += uint128(leaderBonus);

        // Global Help Pool (30%)
        uint256 globalHelpPool = (amount * GLOBAL_HELP_POOL) / BASIS_POINTS;
        poolBalances[4] += uint128(globalHelpPool);
    }

    function _creditEarnings(address user, uint256 amount) internal {
        User storage userAccount = users[user];
        userAccount.totalEarnings += amount;
        totalEarnings[user] += amount;
        
        uint256 packagePrice = PACKAGE_PRICES[userAccount.packageLevel - 1];
        uint256 earningsCap = packagePrice * EARNINGS_CAP_MULTIPLIER;
        
        if (userAccount.totalEarnings >= earningsCap && !userAccount.hasReachedCap) {
            userAccount.hasReachedCap = true;
            hasReachedCap[user] = true;
        }
    }

    function _distributeGlobalHelpPool() internal {
        if (!PoolDistributionLibSimple.canDistributeGHP(lastGHPDistribution)) return;
        if (poolBalances[4] == 0) return;

        uint256 totalBalance = poolBalances[4];
        uint256 eligibleCount = PoolDistributionLibSimple.getEligibleGHPCount(
            totalMembers,
            userIdToAddress,
            isActive,
            hasReachedCap,
            lastActivity
        );

        if (eligibleCount == 0) {
            paymentToken.safeTransfer(adminReserve, totalBalance);
        } else {
            uint256 perUserAmount = PoolDistributionLibSimple.calculateGHPShare(totalBalance, eligibleCount);
            uint256 distributed = 0;

            for (uint256 i = 1; i <= totalMembers; i++) {
                address userAddr = userIdToAddress[i];
                if (userAddr != address(0) && 
                    isActive[userAddr] && 
                    !hasReachedCap[userAddr] &&
                    lastActivity[userAddr] >= block.timestamp - 30 days) {
                    
                    paymentToken.safeTransfer(userAddr, perUserAmount);
                    _creditEarnings(userAddr, perUserAmount);
                    distributed += perUserAmount;
                }
            }

            uint256 remainder = totalBalance - distributed;
            if (remainder > 0) {
                paymentToken.safeTransfer(adminReserve, remainder);
            }

            emit PoolDistributed("GHP", distributed, eligibleCount);
        }

        poolBalances[4] = 0;
        lastGHPDistribution = block.timestamp;
        emit AutomationExecuted("GHP_DISTRIBUTION", totalBalance);
    }

    function _distributeLeaderBonus() internal {
        if (!PoolDistributionLibSimple.canDistributeLeaderBonus(lastLeaderDistribution)) return;
        if (poolBalances[3] == 0) return;

        uint256 totalBalance = poolBalances[3];
        uint256 shiningStarPool = totalBalance / 2;
        uint256 silverStarPool = totalBalance - shiningStarPool;

        uint256 shiningStarCount = PoolDistributionLibSimple.getLeaderCountByLevel(
            totalMembers, userIdToAddress, isActive, leadershipLevel, 2
        );
        uint256 silverStarCount = PoolDistributionLibSimple.getLeaderCountByLevel(
            totalMembers, userIdToAddress, isActive, leadershipLevel, 1
        );

        uint256 totalDistributed = 0;

        // Distribute to Shining Stars
        if (shiningStarCount > 0) {
            uint256 perShiningAmount = PoolDistributionLibSimple.calculateLeaderShare(shiningStarPool, shiningStarCount);
            totalDistributed += _distributeToLeaderLevel(2, perShiningAmount, shiningStarCount);
        } else {
            paymentToken.safeTransfer(adminReserve, shiningStarPool);
        }

        // Distribute to Silver Stars
        if (silverStarCount > 0) {
            uint256 perSilverAmount = PoolDistributionLibSimple.calculateLeaderShare(silverStarPool, silverStarCount);
            totalDistributed += _distributeToLeaderLevel(1, perSilverAmount, silverStarCount);
        } else {
            paymentToken.safeTransfer(adminReserve, silverStarPool);
        }

        poolBalances[3] = 0;
        lastLeaderDistribution = block.timestamp;
        emit PoolDistributed("LEADER", totalDistributed, shiningStarCount + silverStarCount);
        emit AutomationExecuted("LEADER_DISTRIBUTION", totalBalance);
    }

    function _distributeToLeaderLevel(uint8 level, uint256 amount, uint256 /* count */) internal returns (uint256 distributed) {
        for (uint256 i = 1; i <= totalMembers; i++) {
            address userAddr = userIdToAddress[i];
            if (userAddr != address(0) && 
                isActive[userAddr] && 
                leadershipLevel[userAddr] == level) {
                
                paymentToken.safeTransfer(userAddr, amount);
                _creditEarnings(userAddr, amount);
                distributed += amount;
            }
        }
    }

    function _distributeReinvestment(uint256 amount) internal {
        uint256 levelPoolAmount = (amount * 4000) / BASIS_POINTS; // 40%
        uint256 globalUplineAmount = (amount * 3000) / BASIS_POINTS; // 30%
        uint256 ghpAmount = amount - levelPoolAmount - globalUplineAmount; // 30%

        poolBalances[1] += uint128(levelPoolAmount);
        poolBalances[2] += uint128(globalUplineAmount);
        poolBalances[4] += uint128(ghpAmount);
    }

    // ===== ADMIN FUNCTIONS =====
    function setAutomationEnabled(bool enabled) external onlyOwner {
        automationEnabled = enabled;
    }

    function setAutomationGasLimit(uint256 _gasLimit) external onlyOwner {
        require(_gasLimit >= 100000 && _gasLimit <= 2500000, "Invalid gas limit");
        gasLimit = _gasLimit;
    }

    function manualDistributeGHP() external onlyOwner {
        _distributeGlobalHelpPool();
    }

    function manualDistributeLeaderBonus() external onlyOwner {
        _distributeLeaderBonus();
    }

    function emergencyWithdraw(uint256 amount) external onlyOwner {
        paymentToken.safeTransfer(adminReserve, amount);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ===== VIEW FUNCTIONS =====
    function getUserInfo(address user) external view returns (User memory) {
        return users[user];
    }

    function getPoolBalances() external view returns (uint128[5] memory) {
        return poolBalances;
    }

    function getAutomationStats() external view returns (bool, uint256, uint256, uint256) {
        return AutomationLibSimple.getAutomationStats(
            automationEnabled,
            lastUpkeepTimestamp,
            performanceCounter,
            gasLimit
        );
    }

    function getNextDistributionTimes() external view returns (uint256 ghpNext, uint256 leaderNext) {
        return (
            AutomationLibSimple.getNextGHPDistribution(lastGHPDistribution),
            AutomationLibSimple.getNextLeaderDistribution(lastLeaderDistribution)
        );
    }
}
