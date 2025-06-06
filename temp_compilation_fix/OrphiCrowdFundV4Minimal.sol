// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./OrphiCrowdFundV2.sol";
import "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title OrphiCrowdFundV4Minimal
 * @dev Ultra-minimal automation version - only GHP automation
 */
contract OrphiCrowdFundV4Minimal is OrphiCrowdFundV2, AutomationCompatibleInterface, AccessControlUpgradeable {
    using SafeERC20 for IERC20;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    
    // Core state variables
    IERC20 public paymentToken;
    address public adminReserve;
    
    // Automation constants
    uint256 public constant GHP_AUTOMATION_INTERVAL = 7 days;
    uint256 public constant AUTOMATION_SAFETY_BUFFER = 1 hours;
    
    // Automation state
    bool public automationEnabled;
    uint256 public lastAutomationCheck;
    uint256 public automationFailureCount;
    uint256 public constant MAX_AUTOMATION_FAILURES = 3;
    
    // Events
    event AutomationStatusChanged(bool enabled, uint256 timestamp);
    event AutomationExecuted(string poolType, uint256 amount, uint256 timestamp);
    event AutomationFailed(string reason, uint256 timestamp);
    
    /**
     * @dev Initialize V4 minimal features
     */
    function initializeV4() external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
        require(!automationEnabled, "Already initialized");
        automationEnabled = true;
        lastAutomationCheck = block.timestamp;
        emit AutomationStatusChanged(true, block.timestamp);
    }
    
    /**
     * @dev Chainlink Automation: Check if upkeep is needed
     */
    function checkUpkeep(bytes calldata /* checkData */) 
        external 
        view 
        override 
        returns (bool upkeepNeeded, bytes memory performData) 
    {
        if (!automationEnabled || automationFailureCount >= MAX_AUTOMATION_FAILURES) {
            return (false, "");
        }
        
        if (poolBalances[4] > 0 && 
            block.timestamp >= lastGHPDistribution + GHP_AUTOMATION_INTERVAL + AUTOMATION_SAFETY_BUFFER) {
            return (true, abi.encode("GHP"));
        }
        
        return (false, "");
    }
    
    /**
     * @dev Chainlink Automation: Perform upkeep
     */
    function performUpkeep(bytes calldata performData) external override {
        require(automationEnabled, "Automation disabled");
        
        string memory poolType = abi.decode(performData, (string));
        
        try this._performGHPDistribution() {
            emit AutomationExecuted(poolType, poolBalances[4], block.timestamp);
            lastAutomationCheck = block.timestamp;
            automationFailureCount = 0;
        } catch Error(string memory reason) {
            automationFailureCount++;
            emit AutomationFailed(reason, block.timestamp);
        }
    }
    
    /**
     * @dev Internal function to perform GHP distribution
     */
    function _performGHPDistribution() external {
        require(msg.sender == address(this), "Internal function only");
        require(poolBalances[4] > 0, "No GHP balance");
        require(block.timestamp >= lastGHPDistribution + GHP_AUTOMATION_INTERVAL + AUTOMATION_SAFETY_BUFFER, "Too early");
        
        _distributeGlobalHelpPoolSimple();
    }
    
    /**
     * @dev Simplified GHP distribution
     */
    function _distributeGlobalHelpPoolSimple() internal {
        uint256 totalPool = poolBalances[4];
        uint256 eligibleCount = 0;
        
        // Count eligible users
        for (uint256 i = 1; i <= totalMembers && i <= 100; i++) { // Limit to first 100 users for gas efficiency
            address user = userIdToAddress[i];
            if (_isEligibleForGHP(user)) {
                eligibleCount++;
            }
        }
        
        if (eligibleCount > 0) {
            // Simple equal distribution
            uint256 sharePerUser = totalPool / eligibleCount;
            
            for (uint256 i = 1; i <= totalMembers && i <= 100; i++) {
                address user = userIdToAddress[i];
                if (_isEligibleForGHP(user)) {
                    _creditEarningsEnhanced(user, sharePerUser, 4);
                }
            }
        } else {
            // Send to admin reserve if no eligible users
            paymentToken.safeTransfer(adminReserve, totalPool);
        }
        
        poolBalances[4] = 0;
        lastGHPDistribution = block.timestamp;
        emit GlobalHelpPoolDistributed(totalPool, eligibleCount, block.timestamp);
    }
    
    // Admin functions
    function setAutomationEnabled(bool _enabled) external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
        automationEnabled = _enabled;
        emit AutomationStatusChanged(_enabled, block.timestamp);
    }
    
    function resetAutomationFailures() external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
        automationFailureCount = 0;
    }
    
    // Emergency function
    function emergencyDistributeGHP() external {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
        require(!automationEnabled, "Disable automation first");
        _distributeGlobalHelpPoolSimple();
    }
    
    // View functions
    function getAutomationStatus() external view returns (
        bool enabled,
        uint256 failureCount,
        uint256 lastCheck
    ) {
        return (automationEnabled, automationFailureCount, lastAutomationCheck);
    }
    
    function isGHPDistributionReady() external view returns (bool) {
        return poolBalances[4] > 0 && 
               block.timestamp >= lastGHPDistribution + GHP_AUTOMATION_INTERVAL + AUTOMATION_SAFETY_BUFFER;
    }
    
    // Helper functions
    function _isEligibleForGHP(address user) internal view returns (bool) {
        return !users[user].isCapped && 
               users[user].lastActivity >= block.timestamp - 30 days &&
               users[user].totalInvested > 0;
    }
}
