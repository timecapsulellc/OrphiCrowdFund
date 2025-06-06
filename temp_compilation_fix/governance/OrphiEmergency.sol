// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title OrphiEmergency
 * @dev Emergency management and circuit breaker system for Orphi CrowdFund
 * @notice Provides emergency controls, circuit breakers, and emergency fund recovery
 */
contract OrphiEmergency is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ===== STATE VARIABLES =====
    address public immutable mainContract;
    bool public emergencyActive = false;
    bool public emergencyPauseActive = false;
    bool public withdrawalsDisabled = false;
    bool public registrationsDisabled = false;
    
    // Emergency thresholds
    uint256 public maxDailyWithdrawals = 1000000e18; // 1M USDT
    uint256 public maxSingleWithdrawal = 100000e18; // 100k USDT
    uint256 public emergencyFundThreshold = 50000e18; // 50k USDT
    
    // Emergency tracking
    mapping(uint256 => uint256) public dailyWithdrawals; // day => amount
    mapping(address => uint256) public userDailyWithdrawals; // user => amount for current day
    mapping(address => bool) public emergencyOperators;
    mapping(address => bool) public blacklistedAddresses;
    
    // Emergency fund
    address public emergencyFund;
    uint256 public emergencyFundBalance;
    
    // Circuit breaker tracking
    struct CircuitBreaker {
        bool triggered;
        uint256 triggerTime;
        string reason;
        uint256 threshold;
        uint256 currentValue;
    }
    
    mapping(string => CircuitBreaker) public circuitBreakers;
    string[] public circuitBreakerNames;
    
    // Emergency actions log
    struct EmergencyAction {
        address operator;
        string action;
        uint256 timestamp;
        string reason;
        bytes data;
    }
    
    EmergencyAction[] public emergencyActions;

    // ===== EVENTS =====
    event EmergencyActivated(address indexed operator, string reason, uint256 timestamp);
    event EmergencyDeactivated(address indexed operator, uint256 timestamp);
    event EmergencyPauseToggled(bool active, address indexed operator, uint256 timestamp);
    event WithdrawalsToggled(bool disabled, address indexed operator, string reason, uint256 timestamp);
    event RegistrationsToggled(bool disabled, address indexed operator, string reason, uint256 timestamp);
    event CircuitBreakerTriggered(string indexed name, uint256 threshold, uint256 currentValue, string reason, uint256 timestamp);
    event CircuitBreakerReset(string indexed name, address indexed operator, uint256 timestamp);
    event EmergencyOperatorAdded(address indexed operator, address indexed by, uint256 timestamp);
    event EmergencyOperatorRemoved(address indexed operator, address indexed by, uint256 timestamp);
    event AddressBlacklisted(address indexed account, address indexed by, string reason, uint256 timestamp);
    event AddressWhitelisted(address indexed account, address indexed by, uint256 timestamp);
    event EmergencyFundDeposited(uint256 amount, address indexed from, uint256 timestamp);
    event EmergencyFundWithdrawn(uint256 amount, address indexed to, string reason, uint256 timestamp);
    event ThresholdUpdated(string parameter, uint256 oldValue, uint256 newValue, uint256 timestamp);
    event EmergencyActionLogged(address indexed operator, string action, string reason, uint256 timestamp);

    // ===== MODIFIERS =====
    modifier onlyEmergencyOperator() {
        require(
            msg.sender == owner() || emergencyOperators[msg.sender],
            "Emergency: not authorized"
        );
        _;
    }

    modifier notBlacklisted(address _account) {
        require(!blacklistedAddresses[_account], "Emergency: address blacklisted");
        _;
    }

    modifier emergencyCheck() {
        require(!emergencyActive, "Emergency: system in emergency mode");
        require(!emergencyPauseActive, "Emergency: system paused");
        _;
    }

    modifier withdrawalCheck(address _user, uint256 _amount) {
        require(!withdrawalsDisabled, "Emergency: withdrawals disabled");
        require(_amount <= maxSingleWithdrawal, "Emergency: amount exceeds limit");
        
        uint256 today = block.timestamp / 1 days;
        require(
            dailyWithdrawals[today] + _amount <= maxDailyWithdrawals,
            "Emergency: daily limit exceeded"
        );
        
        _recordWithdrawal(_user, _amount, today);
        _;
    }

    modifier registrationCheck() {
        require(!registrationsDisabled, "Emergency: registrations disabled");
        _;
    }

    // ===== CONSTRUCTOR =====
    constructor(address _mainContract, address _initialOwner) Ownable(_initialOwner) {
        require(_mainContract != address(0), "Invalid main contract");
        mainContract = _mainContract;
        emergencyFund = _initialOwner;
        
        // Initialize default circuit breakers
        _initializeCircuitBreakers();
    }

    // ===== EMERGENCY CONTROLS =====
    function activateEmergency(string calldata _reason) external onlyEmergencyOperator {
        require(!emergencyActive, "Emergency already active");
        
        emergencyActive = true;
        emergencyPauseActive = true;
        withdrawalsDisabled = true;
        registrationsDisabled = true;
        
        _logEmergencyAction("EMERGENCY_ACTIVATED", _reason, "");
        
        emit EmergencyActivated(msg.sender, _reason, block.timestamp);
    }

    function deactivateEmergency() external onlyOwner {
        require(emergencyActive, "Emergency not active");
        
        emergencyActive = false;
        emergencyPauseActive = false;
        withdrawalsDisabled = false;
        registrationsDisabled = false;
        
        // Reset all circuit breakers
        for (uint256 i = 0; i < circuitBreakerNames.length; i++) {
            circuitBreakers[circuitBreakerNames[i]].triggered = false;
        }
        
        _logEmergencyAction("EMERGENCY_DEACTIVATED", "Manual deactivation", "");
        
        emit EmergencyDeactivated(msg.sender, block.timestamp);
    }

    function toggleEmergencyPause() external onlyEmergencyOperator {
        emergencyPauseActive = !emergencyPauseActive;
        
        _logEmergencyAction(
            emergencyPauseActive ? "PAUSE_ACTIVATED" : "PAUSE_DEACTIVATED",
            "Manual toggle",
            ""
        );
        
        emit EmergencyPauseToggled(emergencyPauseActive, msg.sender, block.timestamp);
    }

    function toggleWithdrawals(string calldata _reason) external onlyEmergencyOperator {
        withdrawalsDisabled = !withdrawalsDisabled;
        
        _logEmergencyAction(
            withdrawalsDisabled ? "WITHDRAWALS_DISABLED" : "WITHDRAWALS_ENABLED",
            _reason,
            ""
        );
        
        emit WithdrawalsToggled(withdrawalsDisabled, msg.sender, _reason, block.timestamp);
    }

    function toggleRegistrations(string calldata _reason) external onlyEmergencyOperator {
        registrationsDisabled = !registrationsDisabled;
        
        _logEmergencyAction(
            registrationsDisabled ? "REGISTRATIONS_DISABLED" : "REGISTRATIONS_ENABLED",
            _reason,
            ""
        );
        
        emit RegistrationsToggled(registrationsDisabled, msg.sender, _reason, block.timestamp);
    }

    // ===== CIRCUIT BREAKERS =====
    function triggerCircuitBreaker(
        string calldata _name,
        uint256 _currentValue,
        string calldata _reason
    ) external onlyEmergencyOperator {
        require(bytes(_name).length > 0, "Invalid circuit breaker name");
        
        CircuitBreaker storage breaker = circuitBreakers[_name];
        
        if (!breaker.triggered) {
            breaker.triggered = true;
            breaker.triggerTime = block.timestamp;
            breaker.reason = _reason;
            breaker.currentValue = _currentValue;
            
            // Add to names array if new
            bool exists = false;
            for (uint256 i = 0; i < circuitBreakerNames.length; i++) {
                if (keccak256(bytes(circuitBreakerNames[i])) == keccak256(bytes(_name))) {
                    exists = true;
                    break;
                }
            }
            if (!exists) {
                circuitBreakerNames.push(_name);
            }
            
            _logEmergencyAction("CIRCUIT_BREAKER_TRIGGERED", _reason, abi.encode(_name, _currentValue));
            
            emit CircuitBreakerTriggered(_name, breaker.threshold, _currentValue, _reason, block.timestamp);
        }
    }

    function resetCircuitBreaker(string calldata _name) external onlyEmergencyOperator {
        CircuitBreaker storage breaker = circuitBreakers[_name];
        require(breaker.triggered, "Circuit breaker not triggered");
        
        breaker.triggered = false;
        breaker.triggerTime = 0;
        breaker.reason = "";
        breaker.currentValue = 0;
        
        _logEmergencyAction("CIRCUIT_BREAKER_RESET", "Manual reset", abi.encode(_name));
        
        emit CircuitBreakerReset(_name, msg.sender, block.timestamp);
    }

    function setCircuitBreakerThreshold(
        string calldata _name,
        uint256 _threshold
    ) external onlyOwner {
        require(_threshold > 0, "Invalid threshold");
        
        circuitBreakers[_name].threshold = _threshold;
        
        // Add to names array if new
        bool exists = false;
        for (uint256 i = 0; i < circuitBreakerNames.length; i++) {
            if (keccak256(bytes(circuitBreakerNames[i])) == keccak256(bytes(_name))) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            circuitBreakerNames.push(_name);
        }
    }

    // ===== OPERATOR MANAGEMENT =====
    function addEmergencyOperator(address _operator) external onlyOwner {
        require(_operator != address(0), "Invalid operator");
        require(!emergencyOperators[_operator], "Already an operator");
        
        emergencyOperators[_operator] = true;
        
        emit EmergencyOperatorAdded(_operator, msg.sender, block.timestamp);
    }

    function removeEmergencyOperator(address _operator) external onlyOwner {
        require(emergencyOperators[_operator], "Not an operator");
        
        emergencyOperators[_operator] = false;
        
        emit EmergencyOperatorRemoved(_operator, msg.sender, block.timestamp);
    }

    // ===== BLACKLIST MANAGEMENT =====
    function blacklistAddress(address _account, string calldata _reason) external onlyEmergencyOperator {
        require(_account != address(0), "Invalid address");
        require(_account != owner(), "Cannot blacklist owner");
        require(!blacklistedAddresses[_account], "Already blacklisted");
        
        blacklistedAddresses[_account] = true;
        
        _logEmergencyAction("ADDRESS_BLACKLISTED", _reason, abi.encode(_account));
        
        emit AddressBlacklisted(_account, msg.sender, _reason, block.timestamp);
    }

    function whitelistAddress(address _account) external onlyEmergencyOperator {
        require(blacklistedAddresses[_account], "Not blacklisted");
        
        blacklistedAddresses[_account] = false;
        
        _logEmergencyAction("ADDRESS_WHITELISTED", "Manual whitelist", abi.encode(_account));
        
        emit AddressWhitelisted(_account, msg.sender, block.timestamp);
    }

    // ===== EMERGENCY FUND MANAGEMENT =====
    function depositEmergencyFund(uint256 _amount, address _token) external nonReentrant {
        require(_amount > 0, "Invalid amount");
        
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        emergencyFundBalance += _amount;
        
        emit EmergencyFundDeposited(_amount, msg.sender, block.timestamp);
    }

    function withdrawEmergencyFund(
        uint256 _amount,
        address _to,
        address _token,
        string calldata _reason
    ) external onlyOwner nonReentrant {
        require(_amount > 0 && _amount <= emergencyFundBalance, "Invalid amount");
        require(_to != address(0), "Invalid recipient");
        
        emergencyFundBalance -= _amount;
        IERC20(_token).safeTransfer(_to, _amount);
        
        _logEmergencyAction("EMERGENCY_FUND_WITHDRAWN", _reason, abi.encode(_amount, _to));
        
        emit EmergencyFundWithdrawn(_amount, _to, _reason, block.timestamp);
    }

    // ===== THRESHOLD MANAGEMENT =====
    function updateThresholds(
        uint256 _maxDailyWithdrawals,
        uint256 _maxSingleWithdrawal,
        uint256 _emergencyFundThreshold
    ) external onlyOwner {
        require(_maxDailyWithdrawals > 0, "Invalid daily limit");
        require(_maxSingleWithdrawal > 0, "Invalid single limit");
        require(_emergencyFundThreshold > 0, "Invalid fund threshold");
        
        emit ThresholdUpdated("maxDailyWithdrawals", maxDailyWithdrawals, _maxDailyWithdrawals, block.timestamp);
        emit ThresholdUpdated("maxSingleWithdrawal", maxSingleWithdrawal, _maxSingleWithdrawal, block.timestamp);
        emit ThresholdUpdated("emergencyFundThreshold", emergencyFundThreshold, _emergencyFundThreshold, block.timestamp);
        
        maxDailyWithdrawals = _maxDailyWithdrawals;
        maxSingleWithdrawal = _maxSingleWithdrawal;
        emergencyFundThreshold = _emergencyFundThreshold;
    }

    function updateEmergencyFund(address _newFund) external onlyOwner {
        require(_newFund != address(0), "Invalid fund address");
        emergencyFund = _newFund;
    }

    // ===== VIEW FUNCTIONS =====
    function isEmergencyActive() external view returns (bool) {
        return emergencyActive;
    }

    function getEmergencyStatus() external view returns (
        bool emergency,
        bool paused,
        bool withdrawalsDisabledFlag,
        bool registrationsDisabledFlag,
        uint256 emergencyFundBalanceAmount
    ) {
        return (
            emergencyActive,
            emergencyPauseActive,
            withdrawalsDisabled,
            registrationsDisabled,
            emergencyFundBalance
        );
    }

    function getCircuitBreaker(string calldata _name) external view returns (
        bool triggered,
        uint256 triggerTime,
        string memory reason,
        uint256 threshold,
        uint256 currentValue
    ) {
        CircuitBreaker memory breaker = circuitBreakers[_name];
        return (
            breaker.triggered,
            breaker.triggerTime,
            breaker.reason,
            breaker.threshold,
            breaker.currentValue
        );
    }

    function getAllCircuitBreakers() external view returns (string[] memory) {
        return circuitBreakerNames;
    }

    function getEmergencyActions(uint256 _start, uint256 _count) external view returns (
        EmergencyAction[] memory actions
    ) {
        require(_start < emergencyActions.length, "Invalid start index");
        
        uint256 end = _start + _count;
        if (end > emergencyActions.length) {
            end = emergencyActions.length;
        }
        
        actions = new EmergencyAction[](end - _start);
        for (uint256 i = _start; i < end; i++) {
            actions[i - _start] = emergencyActions[i];
        }
    }

    function getDailyWithdrawals(uint256 _day) external view returns (uint256) {
        return dailyWithdrawals[_day];
    }

    function getUserDailyWithdrawals(address _user) external view returns (uint256) {
        return userDailyWithdrawals[_user];
    }

    // ===== INTERNAL FUNCTIONS =====
    function _initializeCircuitBreakers() internal {
        // Initialize common circuit breakers
        circuitBreakers["DAILY_VOLUME"].threshold = 5000000e18; // 5M USDT
        circuitBreakers["HOURLY_REGISTRATIONS"].threshold = 100;
        circuitBreakers["LARGE_WITHDRAWAL"].threshold = 50000e18; // 50k USDT
        circuitBreakers["RAPID_WITHDRAWALS"].threshold = 10; // 10 withdrawals per hour per user
        
        circuitBreakerNames.push("DAILY_VOLUME");
        circuitBreakerNames.push("HOURLY_REGISTRATIONS");
        circuitBreakerNames.push("LARGE_WITHDRAWAL");
        circuitBreakerNames.push("RAPID_WITHDRAWALS");
    }

    function _recordWithdrawal(address _user, uint256 _amount, uint256 _day) internal {
        dailyWithdrawals[_day] += _amount;
        userDailyWithdrawals[_user] += _amount;
    }

    function _logEmergencyAction(
        string memory _action,
        string memory _reason,
        bytes memory _data
    ) internal {
        emergencyActions.push(EmergencyAction({
            operator: msg.sender,
            action: _action,
            timestamp: block.timestamp,
            reason: _reason,
            data: _data
        }));
        
        emit EmergencyActionLogged(msg.sender, _action, _reason, block.timestamp);
    }
}
