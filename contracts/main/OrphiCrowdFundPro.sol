// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./OrphiCrowdFundCore.sol";
import "../governance/OrphiAccessControl.sol";
import "../governance/OrphiEmergency.sol";

/**
 * @title OrphiCrowdFundPro
 * @dev Enhanced version with advanced security, analytics, and governance features
 * @notice Professional-grade implementation with comprehensive risk management
 */
contract OrphiCrowdFundPro is OrphiCrowdFundCore {
    using SafeERC20 for IERC20;

    // ===== ADDITIONAL STATE VARIABLES =====
    OrphiAccessControl public accessControl;
    OrphiEmergency public emergencyContract;
    
    // Advanced tracking
    mapping(address => uint256[]) public userEarningsHistory;
    mapping(address => uint256) public userLastWithdrawal;
    mapping(uint256 => uint256) public dailyVolume; // day => volume
    mapping(uint256 => uint256) public dailyRegistrations; // day => count
    
    // Risk management
    uint256 public maxDailyVolume = 1000000e18; // 1M USDT
    uint256 public maxDailyRegistrations = 500;
    uint256 public withdrawalCooldown = 24 hours;
    
    // Advanced features
    bool public advancedAnalyticsEnabled = true;
    bool public dynamicCapsEnabled = false;
    uint256 public globalEarningsCap = 4; // 4x multiplier
    
    // ===== EVENTS =====
    event AdvancedAnalyticsToggled(bool enabled, uint256 timestamp);
    event DynamicCapsToggled(bool enabled, uint256 timestamp);
    event GlobalEarningsCapUpdated(uint256 oldCap, uint256 newCap, uint256 timestamp);
    event RiskLimitsUpdated(uint256 maxVolume, uint256 maxRegistrations, uint256 timestamp);
    event WithdrawalCooldownUpdated(uint256 oldCooldown, uint256 newCooldown, uint256 timestamp);
    event UserEarningsRecorded(address indexed user, uint256 amount, uint256 timestamp);
    event DailyLimitsChecked(uint256 day, uint256 volume, uint256 registrations, uint256 timestamp);

    // ===== MODIFIERS =====
    modifier onlyAccessControlled() {
        require(address(accessControl) != address(0), "Access control not set");
        require(accessControl.hasRole(accessControl.OPERATOR_ROLE(), msg.sender), "Access denied");
        _;
    }

    modifier notInEmergency() {
        if (address(emergencyContract) != address(0)) {
            require(!emergencyContract.isEmergencyActive(), "Emergency mode active");
        }
        _;
    }

    modifier withinRiskLimits() {
        _checkDailyLimits();
        _;
    }

    modifier cooldownPassed(address _user) {
        require(
            block.timestamp >= userLastWithdrawal[_user] + withdrawalCooldown,
            "Withdrawal cooldown not passed"
        );
        _;
    }

    // ===== CONSTRUCTOR =====
    constructor(
        address _paymentToken,
        address _adminReserve,
        address _matrixRoot,
        address _initialOwner
    ) OrphiCrowdFundCore(_paymentToken, _adminReserve, _matrixRoot, _initialOwner) {
        // Pro version initialization
    }

    // ===== GOVERNANCE CONTRACT DEPLOYMENT =====
    function deployGovernanceContracts() external onlyOwner {
        require(address(accessControl) == address(0), "Governance contracts already deployed");
        
        // Deploy Access Control
        accessControl = new OrphiAccessControl(owner());
        
        // Deploy Emergency Management
        emergencyContract = new OrphiEmergency(address(this), owner());
        
        emit GovernanceContractsDeployed(
            address(accessControl),
            address(emergencyContract),
            block.timestamp
        );
    }

    // ===== ENHANCED REGISTRATION =====
    function registerUserPro(
        address _sponsor,
        PackageTier _packageTier
    ) external payable nonReentrant whenNotPaused validPackageTier(_packageTier) 
      contractsInitialized notInEmergency withinRiskLimits {
        require(!isRegistered[msg.sender], "User already registered");
        require(isRegistered[_sponsor], "Sponsor not registered");
        require(msg.sender != _sponsor, "Cannot sponsor yourself");

        uint256 packageAmount = getPackageAmount(_packageTier);
        require(packageAmount > 0, "Invalid package amount");

        // Enhanced validation
        _validateAdvancedRegistration(msg.sender, _sponsor, packageAmount);

        // Record daily metrics
        _recordDailyMetrics(packageAmount, true);

        // Call parent registration
        _performRegistration(msg.sender, _sponsor, _packageTier, packageAmount);

        // Record advanced analytics
        if (advancedAnalyticsEnabled) {
            _recordAdvancedAnalytics(msg.sender, packageAmount, "registration");
        }
    }

    // ===== ENHANCED WITHDRAWAL =====
    function withdrawPro(uint256 _amount) external nonReentrant whenNotPaused 
      onlyRegistered(msg.sender) notInEmergency cooldownPassed(msg.sender) {
        require(address(earningsContract) != address(0), "Earnings contract not set");
        require(_amount > 0, "Invalid amount");

        // Update withdrawal tracking
        userLastWithdrawal[msg.sender] = block.timestamp;
        
        // Update user activity
        users[msg.sender].lastActivity = block.timestamp;
        
        // Record analytics
        if (advancedAnalyticsEnabled) {
            _recordAdvancedAnalytics(msg.sender, _amount, "withdrawal");
        }
        
        // Delegate to earnings contract
        earningsContract.withdraw(_amount);
    }

    function withdrawAllPro() external nonReentrant whenNotPaused 
      onlyRegistered(msg.sender) notInEmergency cooldownPassed(msg.sender) {
        require(address(earningsContract) != address(0), "Earnings contract not set");
        
        // Update withdrawal tracking
        userLastWithdrawal[msg.sender] = block.timestamp;
        
        // Update user activity
        users[msg.sender].lastActivity = block.timestamp;
        
        // Delegate to earnings contract
        earningsContract.withdrawAll();
    }

    // ===== ADVANCED ANALYTICS =====
    function getUserEarningsHistory(address _user) external view returns (uint256[] memory) {
        return userEarningsHistory[_user];
    }

    function getDailyMetrics(uint256 _day) external view returns (uint256 volume, uint256 registrations) {
        return (dailyVolume[_day], dailyRegistrations[_day]);
    }

    function getAdvancedUserStats(address _user) external view returns (
        uint256 totalEarnings,
        uint256 withdrawableAmount,
        uint256 lastWithdrawal,
        uint256 earningsCount,
        bool isCapped
    ) {
        // Get data from earnings contract
        if (address(earningsContract) != address(0)) {
            (totalEarnings, withdrawableAmount, isCapped) = earningsContract.getUserEarningsInfo(_user);
        }
        
        return (
            totalEarnings,
            withdrawableAmount,
            userLastWithdrawal[_user],
            userEarningsHistory[_user].length,
            isCapped
        );
    }

    function getSystemRiskMetrics() external view returns (
        uint256 currentDayVolume,
        uint256 currentDayRegistrations,
        uint256 maxDailyVolumeLimit,
        uint256 maxDailyRegistrationsLimit,
        bool emergencyActive
    ) {
        uint256 today = block.timestamp / 1 days;
        return (
            dailyVolume[today],
            dailyRegistrations[today],
            maxDailyVolume,
            maxDailyRegistrations,
            address(emergencyContract) != address(0) ? emergencyContract.isEmergencyActive() : false
        );
    }

    // ===== ADVANCED CONFIGURATION =====
    function toggleAdvancedAnalytics() external onlyOwner {
        advancedAnalyticsEnabled = !advancedAnalyticsEnabled;
        emit AdvancedAnalyticsToggled(advancedAnalyticsEnabled, block.timestamp);
    }

    function toggleDynamicCaps() external onlyOwner {
        dynamicCapsEnabled = !dynamicCapsEnabled;
        emit DynamicCapsToggled(dynamicCapsEnabled, block.timestamp);
    }

    function updateGlobalEarningsCap(uint256 _newCap) external onlyOwner {
        require(_newCap >= 2 && _newCap <= 10, "Cap must be between 2x and 10x");
        uint256 oldCap = globalEarningsCap;
        globalEarningsCap = _newCap;
        emit GlobalEarningsCapUpdated(oldCap, _newCap, block.timestamp);
    }

    function updateRiskLimits(uint256 _maxVolume, uint256 _maxRegistrations) external onlyOwner {
        require(_maxVolume > 0 && _maxRegistrations > 0, "Invalid limits");
        maxDailyVolume = _maxVolume;
        maxDailyRegistrations = _maxRegistrations;
        emit RiskLimitsUpdated(_maxVolume, _maxRegistrations, block.timestamp);
    }

    function updateWithdrawalCooldown(uint256 _newCooldown) external onlyOwner {
        require(_newCooldown <= 7 days, "Cooldown too long");
        uint256 oldCooldown = withdrawalCooldown;
        withdrawalCooldown = _newCooldown;
        emit WithdrawalCooldownUpdated(oldCooldown, _newCooldown, block.timestamp);
    }

    // ===== INTERNAL FUNCTIONS =====
    function _validateAdvancedRegistration(address _user, address _sponsor, uint256 _amount) internal view {
        // Additional validation logic
        require(_amount >= 30e18, "Minimum package amount not met");
        
        // Check sponsor activity (must be active in last 90 days)
        require(
            users[_sponsor].lastActivity >= block.timestamp - 90 days,
            "Sponsor not recently active"
        );
    }

    function _recordDailyMetrics(uint256 _amount, bool _isRegistration) internal {
        uint256 today = block.timestamp / 1 days;
        dailyVolume[today] += _amount;
        
        if (_isRegistration) {
            dailyRegistrations[today]++;
        }
        
        emit DailyLimitsChecked(today, dailyVolume[today], dailyRegistrations[today], block.timestamp);
    }

    function _checkDailyLimits() internal view {
        uint256 today = block.timestamp / 1 days;
        require(dailyVolume[today] <= maxDailyVolume, "Daily volume limit exceeded");
        require(dailyRegistrations[today] <= maxDailyRegistrations, "Daily registration limit exceeded");
    }

    function _recordAdvancedAnalytics(address _user, uint256 _amount, string memory _action) internal {
        userEarningsHistory[_user].push(_amount);
        emit UserEarningsRecorded(_user, _amount, block.timestamp);
    }

    function _performRegistration(
        address _user,
        address _sponsor,
        PackageTier _packageTier,
        uint256 _amount
    ) internal {
        // Transfer payment
        paymentToken.safeTransferFrom(_user, address(this), _amount);

        // Register user internally
        _registerUserInternal(_user, _sponsor, _packageTier, _amount);

        // Place in matrix
        matrixContract.addUser(_user, _sponsor);

        // Register with commission contract
        commissionContract.registerUser(_user, _sponsor, uint256(_packageTier), _amount);

        // Distribute commissions
        paymentToken.safeTransfer(address(commissionContract), _amount);
        commissionContract.distributeCommissions(_user, _amount);

        // Update tracking
        totalVolumeProcessed += _amount;

        emit UserRegistered(_user, _sponsor, _packageTier, totalMembers, _amount, block.timestamp);
    }

    // ===== EVENTS =====
    event GovernanceContractsDeployed(
        address accessControl,
        address emergencyContract,
        uint256 timestamp
    );
}
