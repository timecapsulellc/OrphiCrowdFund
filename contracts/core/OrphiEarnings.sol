// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IOrphiCommissions.sol";

/**
 * @title OrphiEarnings
 * @dev Handles earnings tracking, caps, and withdrawal management
 * @notice Focused contract for earnings and withdrawal functionality
 */
contract OrphiEarnings is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ===== STRUCTS =====
    struct UserEarnings {
        uint256 totalWithdrawn;
        uint256 withdrawableAmount;
        uint256 reinvestedAmount;
        uint256 lastWithdrawalTime;
        uint256 withdrawalCount;
        bool isEligibleForWithdrawal;
    }

    struct WithdrawalSettings {
        uint256 minWithdrawalAmount;
        uint256 maxWithdrawalAmount;
        uint256 withdrawalCooldown;
        uint256 maxDailyWithdrawals;
        bool withdrawalsEnabled;
    }

    // ===== CONSTANTS =====
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant DEFAULT_MIN_WITHDRAWAL = 1e18; // 1 USDT
    uint256 public constant DEFAULT_MAX_WITHDRAWAL = 100000e18; // 100k USDT
    uint256 public constant DEFAULT_COOLDOWN = 24 hours;
    uint256 public constant MAX_DAILY_WITHDRAWALS_DEFAULT = 3;

    // ===== STATE VARIABLES =====
    IERC20 public paymentToken;
    address public adminReserve;
    address public commissionContract;
    address public poolContract;

    WithdrawalSettings public withdrawalSettings;
    
    // Daily withdrawal tracking
    mapping(uint256 => mapping(address => uint256)) public dailyWithdrawals; // date => user => count
    mapping(address => UserEarnings) public userEarnings;
    
    // ===== EVENTS =====
    event WithdrawalMade(
        address indexed user,
        uint256 withdrawAmount,
        uint256 reinvestAmount,
        uint256 withdrawalRate,
        uint256 timestamp
    );
    event ReinvestmentProcessed(
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );
    event EarningsUpdated(
        address indexed user,
        uint256 amount,
        uint256 newWithdrawableAmount,
        uint256 timestamp
    );
    event WithdrawalSettingsUpdated(
        uint256 minAmount,
        uint256 maxAmount,
        uint256 cooldown,
        uint256 maxDaily,
        bool enabled
    );

    // ===== MODIFIERS =====
    modifier onlyCommissionContract() {
        require(msg.sender == commissionContract, "Only commission contract");
        _;
    }

    modifier withdrawalsEnabled() {
        require(withdrawalSettings.withdrawalsEnabled, "Withdrawals disabled");
        _;
    }

    modifier validWithdrawalAmount(uint256 _amount) {
        require(_amount >= withdrawalSettings.minWithdrawalAmount, "Below minimum");
        require(_amount <= withdrawalSettings.maxWithdrawalAmount, "Above maximum");
        _;
    }

    modifier cooldownPassed(address _user) {
        require(
            block.timestamp >= userEarnings[_user].lastWithdrawalTime + withdrawalSettings.withdrawalCooldown,
            "Cooldown not passed"
        );
        _;
    }

    modifier dailyLimitNotExceeded(address _user) {
        uint256 today = block.timestamp / 1 days;
        require(
            dailyWithdrawals[today][_user] < withdrawalSettings.maxDailyWithdrawals,
            "Daily withdrawal limit exceeded"
        );
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
        
        // Set default withdrawal settings
        withdrawalSettings = WithdrawalSettings({
            minWithdrawalAmount: DEFAULT_MIN_WITHDRAWAL,
            maxWithdrawalAmount: DEFAULT_MAX_WITHDRAWAL,
            withdrawalCooldown: DEFAULT_COOLDOWN,
            maxDailyWithdrawals: MAX_DAILY_WITHDRAWALS_DEFAULT,
            withdrawalsEnabled: true
        });
    }

    // ===== CONFIGURATION FUNCTIONS =====
    function setCommissionContract(address _commissionContract) external onlyOwner {
        require(_commissionContract != address(0), "Invalid commission contract");
        commissionContract = _commissionContract;
    }

    function setPoolContract(address _poolContract) external onlyOwner {
        require(_poolContract != address(0), "Invalid pool contract");
        poolContract = _poolContract;
    }

    function updateWithdrawalSettings(
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _cooldown,
        uint256 _maxDaily,
        bool _enabled
    ) external onlyOwner {
        require(_minAmount <= _maxAmount, "Invalid amount range");
        require(_cooldown <= 7 days, "Cooldown too long");
        require(_maxDaily > 0 && _maxDaily <= 10, "Invalid daily limit");

        withdrawalSettings = WithdrawalSettings({
            minWithdrawalAmount: _minAmount,
            maxWithdrawalAmount: _maxAmount,
            withdrawalCooldown: _cooldown,
            maxDailyWithdrawals: _maxDaily,
            withdrawalsEnabled: _enabled
        });

        emit WithdrawalSettingsUpdated(_minAmount, _maxAmount, _cooldown, _maxDaily, _enabled);
    }

    // ===== EARNINGS MANAGEMENT =====
    function creditEarnings(
        address _user,
        uint256 _amount
    ) external onlyCommissionContract {
        require(_user != address(0), "Invalid user");
        require(_amount > 0, "Invalid amount");

        UserEarnings storage earnings = userEarnings[_user];
        earnings.withdrawableAmount += _amount;
        earnings.isEligibleForWithdrawal = true;

        emit EarningsUpdated(_user, _amount, earnings.withdrawableAmount, block.timestamp);
    }

    // ===== WITHDRAWAL FUNCTIONS =====
    function withdraw(uint256 _amount) external 
        nonReentrant 
        withdrawalsEnabled
        validWithdrawalAmount(_amount)
        cooldownPassed(msg.sender)
        dailyLimitNotExceeded(msg.sender)
    {
        UserEarnings storage earnings = userEarnings[msg.sender];
        require(earnings.isEligibleForWithdrawal, "Not eligible for withdrawal");
        require(earnings.withdrawableAmount >= _amount, "Insufficient withdrawable amount");

        // Get withdrawal rate from commission contract
        uint256 withdrawalRate = _getWithdrawalRate(msg.sender);
        
        uint256 withdrawAmount = (_amount * withdrawalRate) / BASIS_POINTS;
        uint256 reinvestAmount = _amount - withdrawAmount;

        // Update user earnings
        earnings.withdrawableAmount -= _amount;
        earnings.totalWithdrawn += withdrawAmount;
        earnings.reinvestedAmount += reinvestAmount;
        earnings.lastWithdrawalTime = block.timestamp;
        earnings.withdrawalCount++;

        // Update daily withdrawal count
        uint256 today = block.timestamp / 1 days;
        dailyWithdrawals[today][msg.sender]++;

        // Transfer withdrawal amount
        require(paymentToken.balanceOf(address(this)) >= withdrawAmount, "Insufficient contract balance");
        paymentToken.safeTransfer(msg.sender, withdrawAmount);

        // Process reinvestment
        if (reinvestAmount > 0) {
            _processReinvestment(msg.sender, reinvestAmount);
        }

        emit WithdrawalMade(msg.sender, withdrawAmount, reinvestAmount, withdrawalRate, block.timestamp);
    }

    function withdrawAll() external 
        nonReentrant 
        withdrawalsEnabled
        cooldownPassed(msg.sender)
        dailyLimitNotExceeded(msg.sender)
    {
        UserEarnings storage earnings = userEarnings[msg.sender];
        uint256 amount = earnings.withdrawableAmount;
        require(amount > 0, "No withdrawable amount");
        require(earnings.isEligibleForWithdrawal, "Not eligible for withdrawal");

        // Get withdrawal rate from commission contract
        uint256 withdrawalRate = _getWithdrawalRate(msg.sender);
        
        uint256 withdrawAmount = (amount * withdrawalRate) / BASIS_POINTS;
        uint256 reinvestAmount = amount - withdrawAmount;

        // Update user earnings
        earnings.withdrawableAmount = 0;
        earnings.totalWithdrawn += withdrawAmount;
        earnings.reinvestedAmount += reinvestAmount;
        earnings.lastWithdrawalTime = block.timestamp;
        earnings.withdrawalCount++;

        // Update daily withdrawal count
        uint256 today = block.timestamp / 1 days;
        dailyWithdrawals[today][msg.sender]++;

        // Transfer withdrawal amount
        require(paymentToken.balanceOf(address(this)) >= withdrawAmount, "Insufficient contract balance");
        paymentToken.safeTransfer(msg.sender, withdrawAmount);

        // Process reinvestment
        if (reinvestAmount > 0) {
            _processReinvestment(msg.sender, reinvestAmount);
        }

        emit WithdrawalMade(msg.sender, withdrawAmount, reinvestAmount, withdrawalRate, block.timestamp);
    }

    // ===== INTERNAL FUNCTIONS =====
    function _getWithdrawalRate(address _user) internal view returns (uint256) {
        if (commissionContract != address(0)) {
            // Try to get withdrawal rate from commission contract
            try IOrphiCommissions(commissionContract).getWithdrawalRate(_user) returns (uint256 rate) {
                return rate;
            } catch {
                return 7000; // Default 70%
            }
        }
        return 7000; // Default 70%
    }

    function _processReinvestment(address _user, uint256 _amount) internal {
        if (poolContract != address(0)) {
            // Send reinvestment to pool contract for distribution
            paymentToken.safeTransfer(poolContract, _amount);
        } else {
            // Fallback: send to admin reserve
            paymentToken.safeTransfer(adminReserve, _amount);
        }

        emit ReinvestmentProcessed(_user, _amount, block.timestamp);
    }

    // ===== VIEW FUNCTIONS =====
    function getUserEarningsInfo(address _user) external view returns (
        uint256 totalWithdrawn,
        uint256 withdrawableAmount,
        uint256 reinvestedAmount,
        uint256 lastWithdrawalTime,
        uint256 withdrawalCount,
        bool isEligibleForWithdrawal
    ) {
        UserEarnings storage earnings = userEarnings[_user];
        return (
            earnings.totalWithdrawn,
            earnings.withdrawableAmount,
            earnings.reinvestedAmount,
            earnings.lastWithdrawalTime,
            earnings.withdrawalCount,
            earnings.isEligibleForWithdrawal
        );
    }

    function getWithdrawalSettings() external view returns (
        uint256 minAmount,
        uint256 maxAmount,
        uint256 cooldown,
        uint256 maxDaily,
        bool enabled
    ) {
        return (
            withdrawalSettings.minWithdrawalAmount,
            withdrawalSettings.maxWithdrawalAmount,
            withdrawalSettings.withdrawalCooldown,
            withdrawalSettings.maxDailyWithdrawals,
            withdrawalSettings.withdrawalsEnabled
        );
    }

    function getDailyWithdrawalCount(address _user) external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        return dailyWithdrawals[today][_user];
    }

    function getRemainingDailyWithdrawals(address _user) external view returns (uint256) {
        uint256 today = block.timestamp / 1 days;
        uint256 used = dailyWithdrawals[today][_user];
        return used >= withdrawalSettings.maxDailyWithdrawals ? 0 : withdrawalSettings.maxDailyWithdrawals - used;
    }

    function getNextWithdrawalTime(address _user) external view returns (uint256) {
        return userEarnings[_user].lastWithdrawalTime + withdrawalSettings.withdrawalCooldown;
    }

    function canWithdraw(address _user, uint256 _amount) external view returns (bool, string memory) {
        if (!withdrawalSettings.withdrawalsEnabled) {
            return (false, "Withdrawals disabled");
        }

        UserEarnings storage earnings = userEarnings[_user];
        if (!earnings.isEligibleForWithdrawal) {
            return (false, "Not eligible for withdrawal");
        }

        if (earnings.withdrawableAmount < _amount) {
            return (false, "Insufficient withdrawable amount");
        }

        if (_amount < withdrawalSettings.minWithdrawalAmount) {
            return (false, "Below minimum withdrawal amount");
        }

        if (_amount > withdrawalSettings.maxWithdrawalAmount) {
            return (false, "Above maximum withdrawal amount");
        }

        if (block.timestamp < earnings.lastWithdrawalTime + withdrawalSettings.withdrawalCooldown) {
            return (false, "Cooldown period not passed");
        }

        uint256 today = block.timestamp / 1 days;
        if (dailyWithdrawals[today][_user] >= withdrawalSettings.maxDailyWithdrawals) {
            return (false, "Daily withdrawal limit exceeded");
        }

        return (true, "Can withdraw");
    }

    // ===== EMERGENCY FUNCTIONS =====
    function toggleWithdrawals() external onlyOwner {
        withdrawalSettings.withdrawalsEnabled = !withdrawalSettings.withdrawalsEnabled;
    }

    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(adminReserve, _amount);
    }

    // ===== FUNDING FUNCTIONS =====
    function addFunds(uint256 _amount) external {
        paymentToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function getContractBalance() external view returns (uint256) {
        return paymentToken.balanceOf(address(this));
    }
}
