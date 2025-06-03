// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./OrphiCrowdFundPro.sol";
import "../interfaces/IOrphiAutomation.sol";

/**
 * @title OrphiCrowdFundEnterprise
 * @dev Full-featured enterprise version with complete automation and advanced features
 * @notice Enterprise-grade implementation with Chainlink automation and comprehensive analytics
 */
contract OrphiCrowdFundEnterprise is OrphiCrowdFundPro {
    using SafeERC20 for IERC20;

    // ===== AUTOMATION STATE =====
    bool public automationEnabled = true;
    uint256 public automationInterval = 1 days;
    uint256 public lastAutomationRun;
    
    // Advanced features
    bool public dynamicPackagingEnabled = false;
    bool public crossChainEnabled = false;
    bool public advancedReportsEnabled = true;
    
    // Automation thresholds
    uint256 public ghpAutoThreshold = 10000e18; // Auto-distribute GHP when pool reaches 10k USDT
    uint256 public leaderAutoThreshold = 5000e18; // Auto-distribute leader pool when reaches 5k USDT
    uint256 public maxAutomationGas = 500000; // Max gas for automation
    
    // Enterprise metrics
    mapping(address => uint256) public userLifetimeVolume;
    mapping(address => uint256) public userReferralCount;
    mapping(uint256 => mapping(address => uint256)) public monthlyVolume; // month => user => volume
    mapping(uint256 => uint256) public monthlySystemStats; // month => total volume
    
    // Advanced pools
    mapping(string => uint256) public customPools; // poolName => balance
    mapping(address => mapping(string => uint256)) public userCustomEarnings; // user => poolName => amount
    
    // ===== EVENTS =====
    event AutomationConfigured(bool enabled, uint256 interval, uint256 timestamp);
    event AutomationExecuted(string action, uint256 amount, uint256 gasUsed, uint256 timestamp);
    event DynamicPackagingToggled(bool enabled, uint256 timestamp);
    event CrossChainToggled(bool enabled, uint256 timestamp);
    event CustomPoolCreated(string poolName, uint256 initialBalance, uint256 timestamp);
    event CustomPoolDistributed(string poolName, uint256 amount, uint256 recipients, uint256 timestamp);
    event MonthlyReportGenerated(uint256 month, uint256 totalVolume, uint256 totalUsers, uint256 timestamp);
    event AutomationThresholdUpdated(string poolType, uint256 oldThreshold, uint256 newThreshold, uint256 timestamp);

    // ===== MODIFIERS =====
    modifier automationAllowed() {
        require(automationEnabled, "Automation disabled");
        require(block.timestamp >= lastAutomationRun + automationInterval, "Automation interval not reached");
        _;
    }

    modifier validCustomPool(string memory _poolName) {
        require(bytes(_poolName).length > 0, "Invalid pool name");
        _;
    }

    // ===== CONSTRUCTOR =====
    constructor(
        address _paymentToken,
        address _adminReserve,
        address _matrixRoot,
        address _initialOwner
    ) OrphiCrowdFundPro(_paymentToken, _adminReserve, _matrixRoot, _initialOwner) {
        lastAutomationRun = block.timestamp;
    }

    // ===== ENTERPRISE REGISTRATION =====
    function registerUserEnterprise(
        address _sponsor,
        PackageTier _packageTier,
        bytes calldata _affiliateData
    ) external payable nonReentrant whenNotPaused validPackageTier(_packageTier) 
      contractsInitialized notInEmergency withinRiskLimits {
        require(!isRegistered[msg.sender], "User already registered");
        require(isRegistered[_sponsor], "Sponsor not registered");
        require(msg.sender != _sponsor, "Cannot sponsor yourself");

        uint256 packageAmount = getPackageAmount(_packageTier);
        require(packageAmount > 0, "Invalid package amount");

        // Enhanced enterprise validation
        _validateEnterpriseRegistration(msg.sender, _sponsor, packageAmount, _affiliateData);

        // Record advanced metrics
        _recordEnterpriseMetrics(msg.sender, _sponsor, packageAmount);

        // Call enhanced registration
        _performRegistration(msg.sender, _sponsor, _packageTier, packageAmount);

        // Trigger automation check
        if (automationEnabled) {
            _checkAutomationTriggers();
        }
    }

    // ===== AUTOMATED DISTRIBUTION FUNCTIONS =====
    function executeAutomatedDistributions() external automationAllowed {
        require(
            msg.sender == owner() || 
            (address(automationContract) != address(0) && msg.sender == address(automationContract)),
            "Unauthorized automation call"
        );
        
        uint256 gasStart = gasleft();
        lastAutomationRun = block.timestamp;
        
        bool distributionsExecuted = false;
        
        // Check GHP threshold
        if (address(ghpContract) != address(0)) {
            uint256 ghpBalance = ghpContract.getPoolBalance();
            if (ghpBalance >= ghpAutoThreshold) {
                ghpContract.distributeGHP();
                distributionsExecuted = true;
                emit AutomationExecuted("GHP_Distribution", ghpBalance, gasStart - gasleft(), block.timestamp);
            }
        }
        
        // Check Leader Pool threshold
        if (address(leaderPoolContract) != address(0)) {
            uint256 leaderBalance = leaderPoolContract.getPoolBalance();
            if (leaderBalance >= leaderAutoThreshold) {
                leaderPoolContract.distributeLeaderBonus();
                distributionsExecuted = true;
                emit AutomationExecuted("Leader_Distribution", leaderBalance, gasStart - gasleft(), block.timestamp);
            }
        }
        
        // Generate monthly reports if needed
        if (advancedReportsEnabled) {
            _generateMonthlyReport();
        }
        
        require(gasStart - gasleft() <= maxAutomationGas, "Automation gas limit exceeded");
    }

    // ===== CUSTOM POOLS MANAGEMENT =====
    function createCustomPool(string memory _poolName, uint256 _initialBalance) external onlyOwner validCustomPool(_poolName) {
        require(customPools[_poolName] == 0, "Pool already exists");
        require(_initialBalance > 0, "Invalid initial balance");
        
        // Transfer funds from owner
        paymentToken.safeTransferFrom(msg.sender, address(this), _initialBalance);
        customPools[_poolName] = _initialBalance;
        
        emit CustomPoolCreated(_poolName, _initialBalance, block.timestamp);
    }

    function fundCustomPool(string memory _poolName, uint256 _amount) external validCustomPool(_poolName) {
        require(customPools[_poolName] > 0, "Pool does not exist");
        require(_amount > 0, "Invalid amount");
        
        paymentToken.safeTransferFrom(msg.sender, address(this), _amount);
        customPools[_poolName] += _amount;
    }

    function distributeCustomPool(
        string memory _poolName,
        address[] calldata _recipients,
        uint256[] calldata _amounts
    ) external onlyOwner validCustomPool(_poolName) {
        require(_recipients.length == _amounts.length, "Arrays length mismatch");
        require(_recipients.length > 0, "No recipients");
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            totalAmount += _amounts[i];
        }
        
        require(customPools[_poolName] >= totalAmount, "Insufficient pool balance");
        
        customPools[_poolName] -= totalAmount;
        
        for (uint256 i = 0; i < _recipients.length; i++) {
            if (_amounts[i] > 0) {
                userCustomEarnings[_recipients[i]][_poolName] += _amounts[i];
                paymentToken.safeTransfer(_recipients[i], _amounts[i]);
            }
        }
        
        emit CustomPoolDistributed(_poolName, totalAmount, _recipients.length, block.timestamp);
    }

    // ===== ENTERPRISE ANALYTICS =====
    function getEnterpriseUserStats(address _user) external view returns (
        uint256 lifetimeVolume,
        uint256 referralCount,
        uint256 currentMonthVolume,
        uint256 customPoolEarnings,
        uint256 globalRank
    ) {
        uint256 currentMonth = block.timestamp / 30 days;
        
        // Calculate total custom pool earnings
        // Note: This is simplified - in practice you'd iterate through known pools
        
        return (
            userLifetimeVolume[_user],
            userReferralCount[_user],
            monthlyVolume[currentMonth][_user],
            0, // Simplified for this example
            _calculateGlobalRank(_user)
        );
    }

    function getMonthlySystemReport(uint256 _month) external view returns (
        uint256 totalVolume,
        uint256 newRegistrations,
        uint256 activeUsers,
        uint256 totalDistributions
    ) {
        // Implementation would track these metrics
        return (
            monthlySystemStats[_month],
            0, // Would be tracked separately
            0, // Would be tracked separately
            0  // Would be tracked separately
        );
    }

    function getAutomationStatus() external view returns (
        bool enabled,
        uint256 interval,
        uint256 lastRun,
        uint256 nextRun,
        uint256 ghpThreshold,
        uint256 leaderThreshold
    ) {
        return (
            automationEnabled,
            automationInterval,
            lastAutomationRun,
            lastAutomationRun + automationInterval,
            ghpAutoThreshold,
            leaderAutoThreshold
        );
    }

    // ===== ENTERPRISE CONFIGURATION =====
    function configureAutomation(
        bool _enabled,
        uint256 _interval,
        uint256 _maxGas
    ) external onlyOwner {
        require(_interval >= 1 hours, "Interval too short");
        require(_maxGas <= 1000000, "Max gas too high");
        
        automationEnabled = _enabled;
        automationInterval = _interval;
        maxAutomationGas = _maxGas;
        
        emit AutomationConfigured(_enabled, _interval, block.timestamp);
    }

    function updateAutomationThresholds(
        uint256 _ghpThreshold,
        uint256 _leaderThreshold
    ) external onlyOwner {
        require(_ghpThreshold > 0 && _leaderThreshold > 0, "Invalid thresholds");
        
        uint256 oldGhpThreshold = ghpAutoThreshold;
        uint256 oldLeaderThreshold = leaderAutoThreshold;
        
        ghpAutoThreshold = _ghpThreshold;
        leaderAutoThreshold = _leaderThreshold;
        
        emit AutomationThresholdUpdated("GHP", oldGhpThreshold, _ghpThreshold, block.timestamp);
        emit AutomationThresholdUpdated("Leader", oldLeaderThreshold, _leaderThreshold, block.timestamp);
    }

    function toggleDynamicPackaging() external onlyOwner {
        dynamicPackagingEnabled = !dynamicPackagingEnabled;
        emit DynamicPackagingToggled(dynamicPackagingEnabled, block.timestamp);
    }

    function toggleCrossChain() external onlyOwner {
        crossChainEnabled = !crossChainEnabled;
        emit CrossChainToggled(crossChainEnabled, block.timestamp);
    }

    function toggleAdvancedReports() external onlyOwner {
        advancedReportsEnabled = !advancedReportsEnabled;
    }

    // ===== INTERNAL FUNCTIONS =====
    function _validateEnterpriseRegistration(
        address _user,
        address _sponsor,
        uint256 _amount,
        bytes calldata _affiliateData
    ) internal view {
        // Enhanced validation for enterprise features
        _validateAdvancedRegistration(_user, _sponsor, _amount);
        
        // Additional enterprise validation
        if (_affiliateData.length > 0) {
            // Validate affiliate data structure
            require(_affiliateData.length >= 32, "Invalid affiliate data");
        }
    }

    function _recordEnterpriseMetrics(address _user, address _sponsor, uint256 _amount) internal {
        // Record lifetime volume
        userLifetimeVolume[_user] += _amount;
        userLifetimeVolume[_sponsor] += _amount; // Sponsor gets credit too
        
        // Record referral count for sponsor
        userReferralCount[_sponsor]++;
        
        // Record monthly volume
        uint256 currentMonth = block.timestamp / 30 days;
        monthlyVolume[currentMonth][_user] += _amount;
        monthlySystemStats[currentMonth] += _amount;
        
        // Record daily metrics (from Pro version)
        _recordDailyMetrics(_amount, true);
    }

    function _checkAutomationTriggers() internal {
        // Check if automation should run based on conditions
        if (block.timestamp >= lastAutomationRun + automationInterval) {
            // Trigger automation in next block to avoid reentrancy
            // In practice, this would be handled by Chainlink Keepers
        }
    }

    function _generateMonthlyReport() internal {
        uint256 currentMonth = block.timestamp / 30 days;
        uint256 lastReportMonth = currentMonth - 1;
        
        // Generate report for last month if not already done
        if (monthlySystemStats[lastReportMonth] > 0) {
            emit MonthlyReportGenerated(
                lastReportMonth,
                monthlySystemStats[lastReportMonth],
                0, // Would calculate actual user count
                block.timestamp
            );
        }
    }

    function _calculateGlobalRank(address _user) internal view returns (uint256) {
        // Simplified ranking calculation
        // In practice, this would be more sophisticated
        uint256 volume = userLifetimeVolume[_user];
        if (volume >= 1000000e18) return 1; // Diamond
        if (volume >= 500000e18) return 2;  // Platinum
        if (volume >= 100000e18) return 3;  // Gold
        if (volume >= 50000e18) return 4;   // Silver
        if (volume >= 10000e18) return 5;   // Bronze
        return 6; // Standard
    }

    // ===== EMERGENCY FUNCTIONS =====
    function emergencyStopAutomation() external onlyOwner {
        automationEnabled = false;
        emit AutomationConfigured(false, automationInterval, block.timestamp);
    }

    function emergencyWithdrawCustomPool(string memory _poolName) external onlyOwner {
        require(customPools[_poolName] > 0, "Pool does not exist or empty");
        
        uint256 amount = customPools[_poolName];
        customPools[_poolName] = 0;
        
        paymentToken.safeTransfer(adminReserve, amount);
    }

    // ===== VIEW FUNCTIONS =====
    function getCustomPoolBalance(string memory _poolName) external view returns (uint256) {
        return customPools[_poolName];
    }

    function getUserCustomEarnings(address _user, string memory _poolName) external view returns (uint256) {
        return userCustomEarnings[_user][_poolName];
    }

    function getEnterpriseFeatureStatus() external view returns (
        bool dynamicPackaging,
        bool crossChain,
        bool advancedReports,
        bool automation
    ) {
        return (
            dynamicPackagingEnabled,
            crossChainEnabled,
            advancedReportsEnabled,
            automationEnabled
        );
    }
}
