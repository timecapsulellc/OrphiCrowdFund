// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IOrphiAutomation
 * @dev Interface for Orphi automation contracts
 */
interface IOrphiAutomation {
    // ===== STRUCTS =====
    struct AutomationConfig {
        bool enabled;
        uint256 interval;
        uint256 lastRun;
        uint256 gasLimit;
        address operator;
    }

    struct DistributionTask {
        string taskType; // "GHP", "LEADER", "CUSTOM"
        uint256 scheduledTime;
        uint256 amount;
        bool executed;
        bytes32 taskId;
    }

    // ===== EVENTS =====
    event AutomationConfigured(
        string indexed taskType,
        bool enabled,
        uint256 interval,
        uint256 gasLimit,
        address operator,
        uint256 timestamp
    );

    event TaskScheduled(
        bytes32 indexed taskId,
        string taskType,
        uint256 scheduledTime,
        uint256 amount,
        uint256 timestamp
    );

    event TaskExecuted(
        bytes32 indexed taskId,
        string taskType,
        uint256 amount,
        uint256 gasUsed,
        bool success,
        uint256 timestamp
    );

    event AutomationTriggered(
        string indexed action,
        uint256 amount,
        uint256 gasUsed,
        address triggeredBy,
        uint256 timestamp
    );

    // ===== AUTOMATION MANAGEMENT =====
    function configureAutomation(
        string calldata taskType,
        bool enabled,
        uint256 interval,
        uint256 gasLimit
    ) external;

    function scheduleTask(
        string calldata taskType,
        uint256 scheduledTime,
        uint256 amount
    ) external returns (bytes32 taskId);

    function executeTask(bytes32 taskId) external returns (bool success);

    function cancelTask(bytes32 taskId) external;

    // ===== CHAINLINK AUTOMATION =====
    function checkUpkeep(bytes calldata checkData) external view returns (bool upkeepNeeded, bytes memory performData);
    
    function performUpkeep(bytes calldata performData) external;

    // ===== VIEW FUNCTIONS =====
    function getAutomationConfig(string calldata taskType) external view returns (AutomationConfig memory);
    
    function getTask(bytes32 taskId) external view returns (DistributionTask memory);
    
    function getPendingTasks() external view returns (bytes32[] memory);
    
    function isAutomationEnabled(string calldata taskType) external view returns (bool);
    
    function getNextExecutionTime(string calldata taskType) external view returns (uint256);
}
