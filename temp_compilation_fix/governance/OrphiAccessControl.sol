// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title OrphiAccessControl
 * @dev Advanced role-based access control for Orphi CrowdFund system
 * @notice Provides granular permissions and role management
 */
contract OrphiAccessControl is AccessControlEnumerable, Pausable {

    // ===== ROLES =====
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");
    bytes32 public constant AUTOMATION_ROLE = keccak256("AUTOMATION_ROLE");

    // ===== STATE VARIABLES =====
    mapping(bytes32 => uint256) public roleQuorums; // Role => required signatures
    mapping(bytes32 => bool) public pendingRoleGrants; // proposalId => granted
    mapping(bytes32 => uint256) public proposalExpiry; // proposalId => expiry time
    mapping(address => uint256) public lastActivityTime;
    
    uint256 public constant PROPOSAL_DURATION = 7 days;
    uint256 public constant MAX_INACTIVE_PERIOD = 90 days;

    // ===== EVENTS =====
    event RoleGrantProposed(bytes32 indexed role, address indexed account, bytes32 proposalId, uint256 expiry);
    event RoleGrantApproved(bytes32 indexed role, address indexed account, bytes32 proposalId);
    event RoleRevokedForInactivity(bytes32 indexed role, address indexed account, uint256 lastActivity);
    event QuorumUpdated(bytes32 indexed role, uint256 oldQuorum, uint256 newQuorum);
    event ActivityRecorded(address indexed account, uint256 timestamp);

    // ===== MODIFIERS =====
    modifier onlyActiveRole(bytes32 _role) {
        require(hasRole(_role, msg.sender), "AccessControl: missing role");
        require(
            lastActivityTime[msg.sender] >= block.timestamp - MAX_INACTIVE_PERIOD,
            "AccessControl: account inactive"
        );
        _recordActivity(msg.sender);
        _;
    }

    modifier validRole(bytes32 _role) {
        require(
            _role == ADMIN_ROLE || 
            _role == OPERATOR_ROLE || 
            _role == DISTRIBUTOR_ROLE || 
            _role == AUDITOR_ROLE || 
            _role == EMERGENCY_ROLE || 
            _role == AUTOMATION_ROLE,
            "AccessControl: invalid role"
        );
        _;
    }

    // ===== CONSTRUCTOR =====
    constructor(address _defaultAdmin) {
        require(_defaultAdmin != address(0), "Invalid admin address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, _defaultAdmin);
        _grantRole(ADMIN_ROLE, _defaultAdmin);
        
        // Set initial quorums
        roleQuorums[ADMIN_ROLE] = 1;
        roleQuorums[OPERATOR_ROLE] = 1;
        roleQuorums[DISTRIBUTOR_ROLE] = 1;
        roleQuorums[AUDITOR_ROLE] = 1;
        roleQuorums[EMERGENCY_ROLE] = 2; // Requires 2 signatures
        roleQuorums[AUTOMATION_ROLE] = 1;
        
        _recordActivity(_defaultAdmin);
    }

    // ===== ROLE MANAGEMENT =====
    function proposeRoleGrant(
        bytes32 _role,
        address _account
    ) external onlyActiveRole(ADMIN_ROLE) validRole(_role) whenNotPaused {
        require(_account != address(0), "Invalid account");
        require(!hasRole(_role, _account), "Account already has role");
        
        bytes32 proposalId = keccak256(abi.encodePacked(_role, _account, block.timestamp));
        
        pendingRoleGrants[proposalId] = true;
        proposalExpiry[proposalId] = block.timestamp + PROPOSAL_DURATION;
        
        emit RoleGrantProposed(_role, _account, proposalId, proposalExpiry[proposalId]);
        
        // If quorum is 1, approve immediately
        if (roleQuorums[_role] <= 1) {
            _approveRoleGrant(_role, _account, proposalId);
        }
    }

    function approveRoleGrant(
        bytes32 _role,
        address _account,
        bytes32 _proposalId
    ) external onlyActiveRole(ADMIN_ROLE) validRole(_role) whenNotPaused {
        require(pendingRoleGrants[_proposalId], "Invalid or expired proposal");
        require(block.timestamp <= proposalExpiry[_proposalId], "Proposal expired");
        require(!hasRole(_role, _account), "Account already has role");
        
        _approveRoleGrant(_role, _account, _proposalId);
    }

    function revokeRoleForInactivity(
        bytes32 _role,
        address _account
    ) external onlyActiveRole(ADMIN_ROLE) validRole(_role) {
        require(hasRole(_role, _account), "Account does not have role");
        require(
            lastActivityTime[_account] < block.timestamp - MAX_INACTIVE_PERIOD,
            "Account is still active"
        );
        
        _revokeRole(_role, _account);
        emit RoleRevokedForInactivity(_role, _account, lastActivityTime[_account]);
    }

    function updateQuorum(
        bytes32 _role,
        uint256 _newQuorum
    ) external onlyRole(DEFAULT_ADMIN_ROLE) validRole(_role) {
        require(_newQuorum > 0 && _newQuorum <= 10, "Invalid quorum");
        
        uint256 oldQuorum = roleQuorums[_role];
        roleQuorums[_role] = _newQuorum;
        
        emit QuorumUpdated(_role, oldQuorum, _newQuorum);
    }

    // ===== ACTIVITY TRACKING =====
    function recordActivity() external {
        _recordActivity(msg.sender);
    }

    function batchRecordActivity(address[] calldata _accounts) external onlyActiveRole(ADMIN_ROLE) {
        for (uint256 i = 0; i < _accounts.length; i++) {
            _recordActivity(_accounts[i]);
        }
    }

    // ===== EMERGENCY FUNCTIONS =====
    function emergencyPause() external onlyActiveRole(EMERGENCY_ROLE) {
        _pause();
    }

    function emergencyUnpause() external onlyActiveRole(ADMIN_ROLE) {
        _unpause();
    }

    function emergencyRevokeRole(
        bytes32 _role,
        address _account
    ) external onlyActiveRole(EMERGENCY_ROLE) {
        require(_role != DEFAULT_ADMIN_ROLE, "Cannot revoke default admin");
        _revokeRole(_role, _account);
    }

    // ===== VIEW FUNCTIONS =====
    function hasActiveRole(bytes32 _role, address _account) external view returns (bool) {
        return hasRole(_role, _account) && 
               lastActivityTime[_account] >= block.timestamp - MAX_INACTIVE_PERIOD;
    }

    function getRoleMembers(bytes32 _role) public view override returns (address[] memory) {
        uint256 count = getRoleMemberCount(_role);
        address[] memory members = new address[](count);
        
        for (uint256 i = 0; i < count; i++) {
            members[i] = getRoleMember(_role, i);
        }
        
        return members;
    }

    function getActiveRoleMembers(bytes32 _role) external view returns (address[] memory) {
        uint256 count = getRoleMemberCount(_role);
        address[] memory activeMembers = new address[](count);
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < count; i++) {
            address member = getRoleMember(_role, i);
            if (lastActivityTime[member] >= block.timestamp - MAX_INACTIVE_PERIOD) {
                activeMembers[activeCount] = member;
                activeCount++;
            }
        }
        
        // Resize array to actual active count
        address[] memory result = new address[](activeCount);
        for (uint256 i = 0; i < activeCount; i++) {
            result[i] = activeMembers[i];
        }
        
        return result;
    }

    function getAccountInfo(address _account) external view returns (
        bytes32[] memory roles,
        uint256 lastActivity,
        bool isActive
    ) {
        // Get all roles for account
        bytes32[] memory allRoles = new bytes32[](6);
        allRoles[0] = ADMIN_ROLE;
        allRoles[1] = OPERATOR_ROLE;
        allRoles[2] = DISTRIBUTOR_ROLE;
        allRoles[3] = AUDITOR_ROLE;
        allRoles[4] = EMERGENCY_ROLE;
        allRoles[5] = AUTOMATION_ROLE;
        
        bytes32[] memory accountRoles = new bytes32[](6);
        uint256 roleCount = 0;
        
        for (uint256 i = 0; i < allRoles.length; i++) {
            if (hasRole(allRoles[i], _account)) {
                accountRoles[roleCount] = allRoles[i];
                roleCount++;
            }
        }
        
        // Resize to actual role count
        bytes32[] memory result = new bytes32[](roleCount);
        for (uint256 i = 0; i < roleCount; i++) {
            result[i] = accountRoles[i];
        }
        
        return (
            result,
            lastActivityTime[_account],
            lastActivityTime[_account] >= block.timestamp - MAX_INACTIVE_PERIOD
        );
    }

    function getSystemStats() external view returns (
        uint256 totalAdmins,
        uint256 totalOperators,
        uint256 totalDistributors,
        uint256 totalAuditors,
        uint256 totalEmergencyRoles,
        uint256 totalAutomationRoles
    ) {
        return (
            getRoleMemberCount(ADMIN_ROLE),
            getRoleMemberCount(OPERATOR_ROLE),
            getRoleMemberCount(DISTRIBUTOR_ROLE),
            getRoleMemberCount(AUDITOR_ROLE),
            getRoleMemberCount(EMERGENCY_ROLE),
            getRoleMemberCount(AUTOMATION_ROLE)
        );
    }

    // ===== INTERNAL FUNCTIONS =====
    function _approveRoleGrant(
        bytes32 _role,
        address _account,
        bytes32 _proposalId
    ) internal {
        delete pendingRoleGrants[_proposalId];
        delete proposalExpiry[_proposalId];
        
        _grantRole(_role, _account);
        _recordActivity(_account);
        
        emit RoleGrantApproved(_role, _account, _proposalId);
    }

    function _recordActivity(address _account) internal {
        lastActivityTime[_account] = block.timestamp;
        emit ActivityRecorded(_account, block.timestamp);
    }

    // ===== OVERRIDES =====
    function grantRole(
        bytes32 _role,
        address _account
    ) public override(AccessControl, IAccessControl) onlyRole(getRoleAdmin(_role)) validRole(_role) {
        super.grantRole(_role, _account);
        _recordActivity(_account);
    }

    function revokeRole(
        bytes32 _role,
        address _account
    ) public override(AccessControl, IAccessControl) onlyRole(getRoleAdmin(_role)) validRole(_role) {
        super.revokeRole(_role, _account);
    }
}
