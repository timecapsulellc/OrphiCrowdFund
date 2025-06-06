// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "./libraries/PoolDistributionLib.sol";
import "./libraries/AutomationLib.sol";

/**
 * @title OrphiCrowdFundV4Lib
 * @dev Library-optimized V4 implementation for automated pool distributions
 * @author Orphi Team
 * @notice 2×∞ Forced Matrix MLM system with Chainlink automation
 */
contract OrphiCrowdFundV4Lib is Ownable, ReentrancyGuard, Pausable, AutomationCompatibleInterface {
    using SafeERC20 for IERC20;

    // ===== CONSTANTS =====
    uint256 constant EARNINGS_CAP_MULTIPLIER = 4;
    uint16 constant SPONSOR_COMMISSION = 4000; // 40%
    uint16 constant LEVEL_BONUS = 1000; // 10%
    uint16 constant GLOBAL_UPLINE_BONUS = 1000; // 10%
    uint16 constant LEADER_BONUS = 1000; // 10%
    uint16 constant GLOBAL_HELP_POOL = 3000; // 30%
    uint16 constant BASIS_POINTS = 10000; // 100%

    // Package prices
    uint256[10] public PACKAGE_PRICES = [
        100e6, 200e6, 400e6, 800e6, 1600e6,
        3200e6, 6400e6, 12800e6, 25600e6, 51200e6
    ];

    // Level bonus percentages
    uint16[10] LEVEL_BONUS_PERCENTAGES = [300, 100, 100, 100, 100, 100, 50, 50, 50, 50];

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
        uint8 leadershipLevel;
    }

    // ===== MAPPINGS =====
    mapping(address => User) public users;
    mapping(uint256 => address) public userIdToAddress;
    mapping(address => uint256[]) public userSponsees;

    // Optimized mappings for library access
    mapping(address => bool) public isActive;
    mapping(address => bool) public hasReachedCap;
    mapping(address => uint256) public lastActivity;
    mapping(address => uint256) public totalEarnings;
    mapping(address => uint8) public leadershipLevel;

    // ===== EVENTS =====
    event UserRegistered(address indexed user, address indexed sponsor, uint256 userId, uint256 packageLevel);
    event PackageUpgraded(address indexed user, uint256 newLevel, uint256 amount);
    event CommissionDistributed(address indexed user, uint256 amount, string commissionType);
    event WithdrawalProcessed(address indexed user, uint256 amount, uint256 reinvestment);
    event EarningsCapReached(address indexed user, uint256 totalEarnings);
    event AutomationExecuted(string actionType, uint256 amount);

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
        return AutomationLib.checkUpkeep(
            automationEnabled,
            poolBalances,
            lastGHPDistribution,
            lastLeaderDistribution
        );
    }

    function performUpkeep(bytes calldata performData) external override {
        (string memory actionType, bool success) = AutomationLib.processAutomation(
            automationEnabled,
            lastUpkeepTimestamp,
            performanceCounter,
            performData
        );
        
        if (!success) return;

        if (keccak256(bytes(actionType)) == keccak256(bytes("GHP_DISTRIBUTION"))) {
            uint256 distributed = PoolDistributionLib.distributeGlobalHelpPool(
                poolBalances,
                lastGHPDistribution,
                totalMembers,
                userIdToAddress,
                isActive,
                hasReachedCap,
                lastActivity,
                totalEarnings,
                paymentToken,
                adminReserve
            );
            emit AutomationExecuted("GHP_DISTRIBUTION", distributed);
        } else if (keccak256(bytes(actionType)) == keccak256(bytes("LEADER_DISTRIBUTION"))) {
            uint256 distributed = PoolDistributionLib.distributeLeaderBonus(
                poolBalances,
                lastLeaderDistribution,
                totalMembers,
                userIdToAddress,
                isActive,
                leadershipLevel,
                totalEarnings,
                paymentToken,
                adminReserve
            );
            emit AutomationExecuted("LEADER_DISTRIBUTION", distributed);
        }
    }

    // ===== PUBLIC FUNCTIONS =====
    function register(address sponsor, uint256 packageLevel) external nonReentrant whenNotPaused {
        require(packageLevel >= 1 && packageLevel <= 10, "Invalid package level");
        require(users[msg.sender].id == 0, "User already registered");
        require(users[sponsor].id > 0 || sponsor == owner(), "Invalid sponsor");

        uint256 packagePrice = PACKAGE_PRICES[packageLevel - 1];
        paymentToken.safeTransferFrom(msg.sender, address(this), packagePrice);

        totalMembers++;
        totalVolume += packagePrice;

        users[msg.sender] = User({
            id: totalMembers,
            sponsor: sponsor,
            leftChild: address(0),
            rightChild: address(0),
            matrixPosition: 0,
            packageLevel: packageLevel,
            directSponsors: 0,
            leftTeamSize: 0,
            rightTeamSize: 0,
            totalEarnings: 0,
            totalWithdrawn: 0,
            lastActivity: block.timestamp,
            isActive: true,
            hasReachedCap: false,
            leadershipLevel: 0
        });

        // Update optimized mappings
        isActive[msg.sender] = true;
        hasReachedCap[msg.sender] = false;
        lastActivity[msg.sender] = block.timestamp;
        totalEarnings[msg.sender] = 0;
        leadershipLevel[msg.sender] = 0;

        userIdToAddress[totalMembers] = msg.sender;
        userSponsees[sponsor].push(totalMembers);
        users[sponsor].directSponsors++;

        // Place in matrix
        _placeInMatrix(msg.sender);

        // Distribute commissions
        _distributeCommissions(packagePrice, msg.sender);

        // Update leadership levels
        _updateLeadershipLevel(sponsor);

        emit UserRegistered(msg.sender, sponsor, totalMembers, packageLevel);
    }

    function upgradePackage(uint256 newPackageLevel) external nonReentrant whenNotPaused {
        require(users[msg.sender].id > 0, "User not registered");
        require(newPackageLevel > users[msg.sender].packageLevel, "Invalid upgrade");
        require(newPackageLevel <= 10, "Maximum package level exceeded");

        uint256 currentPrice = PACKAGE_PRICES[users[msg.sender].packageLevel - 1];
        uint256 newPrice = PACKAGE_PRICES[newPackageLevel - 1];
        uint256 upgradeCost = newPrice - currentPrice;

        paymentToken.safeTransferFrom(msg.sender, address(this), upgradeCost);

        users[msg.sender].packageLevel = newPackageLevel;
        users[msg.sender].lastActivity = block.timestamp;
        lastActivity[msg.sender] = block.timestamp;
        totalVolume += upgradeCost;

        _distributeCommissions(upgradeCost, msg.sender);

        emit PackageUpgraded(msg.sender, newPackageLevel, upgradeCost);
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

    // ===== ADMIN FUNCTIONS =====
    function setAutomationEnabled(bool enabled) external onlyOwner {
        automationEnabled = enabled;
    }

    function setAutomationGasLimit(uint256 _gasLimit) external onlyOwner {
        require(_gasLimit >= 100000 && _gasLimit <= 2500000, "Invalid gas limit");
        gasLimit = _gasLimit;
    }

    function manualDistributeGHP() external onlyOwner {
        require(PoolDistributionLib.canDistributeGHP(lastGHPDistribution), "GHP distribution not due");
        PoolDistributionLib.distributeGlobalHelpPool(
            poolBalances,
            lastGHPDistribution,
            totalMembers,
            userIdToAddress,
            isActive,
            hasReachedCap,
            lastActivity,
            totalEarnings,
            paymentToken,
            adminReserve
        );
    }

    function manualDistributeLeaderBonus() external onlyOwner {
        require(PoolDistributionLib.canDistributeLeaderBonus(lastLeaderDistribution), "Leader distribution not due");
        PoolDistributionLib.distributeLeaderBonus(
            poolBalances,
            lastLeaderDistribution,
            totalMembers,
            userIdToAddress,
            isActive,
            leadershipLevel,
            totalEarnings,
            paymentToken,
            adminReserve
        );
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

    // ===== INTERNAL FUNCTIONS =====
    function _placeInMatrix(address user) internal {
        if (totalMembers == 1) {
            users[user].matrixPosition = 1;
            return;
        }

        uint256 position = _findOptimalPlacement();
        users[user].matrixPosition = position;

        address parent = _getParentAddress(position);
        if (position % 2 == 0) {
            users[parent].leftChild = user;
        } else {
            users[parent].rightChild = user;
        }

        _updateTeamSizes(parent);
    }

    function _findOptimalPlacement() internal view returns (uint256) {
        uint256[] memory queue = new uint256[](totalMembers);
        uint256 front = 0;
        uint256 rear = 0;

        queue[rear++] = 1;

        while (front < rear) {
            uint256 currentPos = queue[front++];
            uint256 leftPos = currentPos * 2;
            uint256 rightPos = leftPos + 1;

            if (_isPositionEmpty(leftPos)) {
                return leftPos;
            }
            if (_isPositionEmpty(rightPos)) {
                return rightPos;
            }

            if (leftPos <= totalMembers) queue[rear++] = leftPos;
            if (rightPos <= totalMembers) queue[rear++] = rightPos;
        }

        return totalMembers + 1;
    }

    function _isPositionEmpty(uint256 position) internal view returns (bool) {
        for (uint256 i = 1; i <= totalMembers; i++) {
            if (users[userIdToAddress[i]].matrixPosition == position) {
                return false;
            }
        }
        return true;
    }

    function _getParentAddress(uint256 position) internal view returns (address) {
        uint256 parentPosition = position / 2;
        for (uint256 i = 1; i <= totalMembers; i++) {
            if (users[userIdToAddress[i]].matrixPosition == parentPosition) {
                return userIdToAddress[i];
            }
        }
        return address(0);
    }

    function _updateTeamSizes(address user) internal {
        while (user != address(0) && users[user].id > 0) {
            User storage currentUser = users[user];
            
            uint256 leftTeamSize = _calculateTeamSize(currentUser.leftChild);
            uint256 rightTeamSize = _calculateTeamSize(currentUser.rightChild);
            
            currentUser.leftTeamSize = leftTeamSize;
            currentUser.rightTeamSize = rightTeamSize;
            
            user = currentUser.sponsor;
        }
    }

    function _calculateTeamSize(address user) internal view returns (uint256) {
        if (user == address(0) || users[user].id == 0) return 0;
        
        uint256 size = 1;
        size += _calculateTeamSize(users[user].leftChild);
        size += _calculateTeamSize(users[user].rightChild);
        
        return size;
    }

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

        // Level Bonus (10% total)
        uint256 levelBonus = (amount * LEVEL_BONUS) / BASIS_POINTS;
        _distributeLevelBonus(levelBonus, user);

        // Global Upline Bonus (10%)
        uint256 globalUplineBonus = (amount * GLOBAL_UPLINE_BONUS) / BASIS_POINTS;
        poolBalances[1] += uint128(globalUplineBonus);

        // Leader Bonus (10%)
        uint256 leaderBonus = (amount * LEADER_BONUS) / BASIS_POINTS;
        poolBalances[3] += uint128(leaderBonus);

        // Global Help Pool (30%)
        uint256 globalHelpPool = (amount * GLOBAL_HELP_POOL) / BASIS_POINTS;
        poolBalances[4] += uint128(globalHelpPool);
    }

    function _distributeLevelBonus(uint256 totalAmount, address user) internal {
        address currentUpline = users[user].sponsor;
        
        for (uint256 level = 0; level < 10 && currentUpline != address(0); level++) {
            if (users[currentUpline].isActive && !users[currentUpline].hasReachedCap) {
                uint256 levelCommission = (totalAmount * LEVEL_BONUS_PERCENTAGES[level]) / BASIS_POINTS;
                _creditEarnings(currentUpline, levelCommission);
                emit CommissionDistributed(currentUpline, levelCommission, "LEVEL");
            }
            currentUpline = users[currentUpline].sponsor;
        }
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
            emit EarningsCapReached(user, userAccount.totalEarnings);
        }
    }

    function _distributeReinvestment(uint256 amount) internal {
        uint256 levelPoolAmount = (amount * 4000) / BASIS_POINTS; // 40%
        uint256 globalUplineAmount = (amount * 3000) / BASIS_POINTS; // 30%
        uint256 ghpAmount = amount - levelPoolAmount - globalUplineAmount; // 30%

        poolBalances[0] += uint128(levelPoolAmount);
        poolBalances[1] += uint128(globalUplineAmount);
        poolBalances[4] += uint128(ghpAmount);
    }

    function _updateLeadershipLevel(address user) internal {
        if (users[user].directSponsors >= 50) {
            users[user].leadershipLevel = 2; // Shining Star
            leadershipLevel[user] = 2;
        } else if (users[user].directSponsors >= 20) {
            users[user].leadershipLevel = 1; // Silver Star
            leadershipLevel[user] = 1;
        }
    }

    // ===== VIEW FUNCTIONS =====
    function getUserInfo(address user) external view returns (User memory) {
        return users[user];
    }

    function getPoolBalances() external view returns (uint128[5] memory) {
        return poolBalances;
    }

    function getAutomationStats() external view returns (bool, uint256, uint256, uint256) {
        return AutomationLib.getAutomationStats(
            automationEnabled,
            lastUpkeepTimestamp,
            performanceCounter,
            gasLimit
        );
    }

    function getNextDistributionTimes() external view returns (uint256 ghpNext, uint256 leaderNext) {
        return (
            AutomationLib.getNextGHPDistribution(lastGHPDistribution),
            AutomationLib.getNextLeaderDistribution(lastLeaderDistribution)
        );
    }
}
