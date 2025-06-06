// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./OrphiCrowdFundV4UltraSecure.sol";
import "../temp_compilation_fix/governance/OrphiAccessControl.sol";
import "../temp_compilation_fix/governance/OrphiEmergency.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title OrphiCrowdFundV4UltraGovernance
 * @dev Enhanced V4Ultra with integrated governance contracts and multi-signature treasury
 * @notice Complete governance framework with role-based access control and emergency management
 */
contract OrphiCrowdFundV4UltraGovernance is OrphiCrowdFundV4UltraSecure {
    using SafeERC20 for IERC20;
    
    // ===== GOVERNANCE CONTRACTS =====
    OrphiAccessControl public accessControl;
    OrphiEmergency public emergencyContract;
    
    // ===== MULTI-SIGNATURE TREASURY =====
    struct MultiSigConfig {
        address[] signers;
        uint256 requiredSignatures;
        uint256 proposalDuration;
        bool enabled;
    }
    
    struct TreasuryProposal {
        bytes32 id;
        address proposer;
        address token;
        address to;
        uint256 amount;
        string reason;
        uint256 deadline;
        uint256 approvals;
        bool executed;
        bool cancelled;
        mapping(address => bool) hasApproved;
    }
    
    MultiSigConfig public multiSigConfig;
    mapping(bytes32 => TreasuryProposal) public treasuryProposals;
    mapping(address => bool) public isTreasurySigner;
    bytes32[] public activeProposals;
    
    uint256 public constant MIN_PROPOSAL_DURATION = 1 days;
    uint256 public constant MAX_PROPOSAL_DURATION = 30 days;
    uint256 public constant EMERGENCY_PROPOSAL_DURATION = 6 hours;
    
    // ===== GOVERNANCE EVENTS =====
    event GovernanceContractsInitialized(
        address indexed accessControl,
        address indexed emergencyContract,
        uint256 timestamp
    );
    
    event MultiSigConfigured(
        address[] signers,
        uint256 requiredSignatures,
        uint256 proposalDuration
    );
    
    event TreasuryProposalCreated(
        bytes32 indexed proposalId,
        address indexed proposer,
        address indexed token,
        address to,
        uint256 amount,
        string reason,
        uint256 deadline
    );
    
    event TreasuryProposalApproved(
        bytes32 indexed proposalId,
        address indexed signer,
        uint256 approvals,
        uint256 required
    );
    
    event TreasuryProposalExecuted(
        bytes32 indexed proposalId,
        address indexed token,
        address indexed to,
        uint256 amount
    );
    
    event TreasuryProposalCancelled(
        bytes32 indexed proposalId,
        address indexed canceller,
        string reason
    );
    
    event EmergencyProposalExecuted(
        bytes32 indexed proposalId,
        string reason,
        uint256 timestamp
    );
    
    // ===== ENHANCED MODIFIERS =====
    modifier onlyGovernance() {
        require(
            address(accessControl) != address(0) &&
            accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender),
            "Governance: unauthorized"
        );
        _;
    }
    
    modifier onlyEmergencyRole() {
        require(
            address(accessControl) != address(0) &&
            accessControl.hasRole(accessControl.EMERGENCY_ROLE(), msg.sender),
            "Governance: emergency role required"
        );
        _;
    }
    
    modifier notInEmergency() {
        if (address(emergencyContract) != address(0)) {
            require(!emergencyContract.emergencyActive(), "Emergency: system in emergency mode");
            require(!emergencyContract.emergencyPauseActive(), "Emergency: system paused");
        }
        _;
    }
    
    modifier onlyTreasurySigner() {
        require(isTreasurySigner[msg.sender], "MultiSig: not a signer");
        _;
    }
    
    modifier validProposal(bytes32 _proposalId) {
        TreasuryProposal storage proposal = treasuryProposals[_proposalId];
        require(proposal.id == _proposalId, "MultiSig: invalid proposal");
        require(block.timestamp <= proposal.deadline, "MultiSig: proposal expired");
        require(!proposal.executed, "MultiSig: already executed");
        require(!proposal.cancelled, "MultiSig: proposal cancelled");
        _;
    }
    
    // ===== ENHANCED CONSTRUCTOR =====
    constructor(
        address _token,
        address _trezorAdmin,
        address[] memory _initialSigners,
        uint256 _requiredSignatures
    ) OrphiCrowdFundV4UltraSecure(_token, _trezorAdmin) {
        require(_initialSigners.length >= _requiredSignatures, "MultiSig: invalid config");
        require(_requiredSignatures > 0, "MultiSig: required signatures must be > 0");
        
        // Initialize multi-signature configuration
        multiSigConfig = MultiSigConfig({
            signers: _initialSigners,
            requiredSignatures: _requiredSignatures,
            proposalDuration: 7 days,
            enabled: true
        });
        
        // Set treasury signers
        for (uint256 i = 0; i < _initialSigners.length; i++) {
            isTreasurySigner[_initialSigners[i]] = true;
        }
    }
    
    // ===== GOVERNANCE INTEGRATION =====
    function initializeGovernance() external onlyOwner {
        require(address(accessControl) == address(0), "Governance: already initialized");
        
        // Deploy governance contracts
        accessControl = new OrphiAccessControl(owner());
        emergencyContract = new OrphiEmergency(address(this), owner());
        
        // Grant initial roles to contract owner
        accessControl.grantRole(accessControl.ADMIN_ROLE(), owner());
        accessControl.grantRole(accessControl.EMERGENCY_ROLE(), owner());
        
        // Grant emergency operator role to contract
        emergencyContract.addEmergencyOperator(address(this));
        
        emit GovernanceContractsInitialized(
            address(accessControl),
            address(emergencyContract),
            block.timestamp
        );
    }
    
    function setGovernanceContracts(
        address _accessControl,
        address _emergencyContract
    ) external onlyOwner {
        require(_accessControl != address(0), "Governance: invalid access control");
        require(_emergencyContract != address(0), "Governance: invalid emergency contract");
        
        accessControl = OrphiAccessControl(_accessControl);
        emergencyContract = OrphiEmergency(_emergencyContract);
        
        emit GovernanceContractsInitialized(_accessControl, _emergencyContract, block.timestamp);
    }
    
    // ===== ENHANCED ACCESS CONTROL =====
    function grantOperatorRole(address _operator) external onlyGovernance {
        accessControl.grantRole(accessControl.OPERATOR_ROLE(), _operator);
    }
    
    function revokeOperatorRole(address _operator) external onlyGovernance {
        accessControl.revokeRole(accessControl.OPERATOR_ROLE(), _operator);
    }
    
    function grantDistributorRole(address _distributor) external onlyGovernance {
        accessControl.grantRole(accessControl.DISTRIBUTOR_ROLE(), _distributor);
    }
    
    function emergencyPauseSystem(string calldata _reason) external onlyEmergencyRole {
        _pause();
        if (address(emergencyContract) != address(0)) {
            emergencyContract.activateEmergency(_reason);
        }
        emit SystemLocked(_reason, block.timestamp);
    }
    
    function emergencyUnpauseSystem() external onlyGovernance {
        _unpause();
        if (address(emergencyContract) != address(0)) {
            emergencyContract.deactivateEmergency();
        }
        emit SystemUnlocked(block.timestamp);
    }
    
    // ===== MULTI-SIGNATURE TREASURY MANAGEMENT =====
    function configureMultiSig(
        address[] calldata _signers,
        uint256 _requiredSignatures,
        uint256 _proposalDuration
    ) external onlyGovernance {
        require(_signers.length >= _requiredSignatures, "MultiSig: invalid config");
        require(_requiredSignatures > 0, "MultiSig: required signatures must be > 0");
        require(
            _proposalDuration >= MIN_PROPOSAL_DURATION && 
            _proposalDuration <= MAX_PROPOSAL_DURATION,
            "MultiSig: invalid proposal duration"
        );
        
        // Clear existing signers
        for (uint256 i = 0; i < multiSigConfig.signers.length; i++) {
            isTreasurySigner[multiSigConfig.signers[i]] = false;
        }
        
        // Set new configuration
        multiSigConfig.signers = _signers;
        multiSigConfig.requiredSignatures = _requiredSignatures;
        multiSigConfig.proposalDuration = _proposalDuration;
        
        // Set new signers
        for (uint256 i = 0; i < _signers.length; i++) {
            isTreasurySigner[_signers[i]] = true;
        }
        
        emit MultiSigConfigured(_signers, _requiredSignatures, _proposalDuration);
    }
    
    function createTreasuryProposal(
        address _token,
        address _to,
        uint256 _amount,
        string calldata _reason,
        bool _isEmergency
    ) external onlyTreasurySigner returns (bytes32) {
        require(_token != address(0), "MultiSig: invalid token");
        require(_to != address(0), "MultiSig: invalid recipient");
        require(_amount > 0, "MultiSig: invalid amount");
        require(bytes(_reason).length > 0, "MultiSig: reason required");
        
        uint256 deadline = block.timestamp + 
            (_isEmergency ? EMERGENCY_PROPOSAL_DURATION : multiSigConfig.proposalDuration);
        
        bytes32 proposalId = keccak256(abi.encodePacked(
            _token,
            _to,
            _amount,
            _reason,
            block.timestamp,
            msg.sender
        ));
        
        TreasuryProposal storage proposal = treasuryProposals[proposalId];
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.token = _token;
        proposal.to = _to;
        proposal.amount = _amount;
        proposal.reason = _reason;
        proposal.deadline = deadline;
        
        activeProposals.push(proposalId);
        
        emit TreasuryProposalCreated(
            proposalId,
            msg.sender,
            _token,
            _to,
            _amount,
            _reason,
            deadline
        );
        
        return proposalId;
    }
    
    function approveTreasuryProposal(bytes32 _proposalId) 
        external 
        onlyTreasurySigner 
        validProposal(_proposalId) 
    {
        TreasuryProposal storage proposal = treasuryProposals[_proposalId];
        require(!proposal.hasApproved[msg.sender], "MultiSig: already approved");
        
        proposal.hasApproved[msg.sender] = true;
        proposal.approvals++;
        
        emit TreasuryProposalApproved(
            _proposalId,
            msg.sender,
            proposal.approvals,
            multiSigConfig.requiredSignatures
        );
        
        // Auto-execute if threshold reached
        if (proposal.approvals >= multiSigConfig.requiredSignatures) {
            _executeTreasuryProposal(_proposalId);
        }
    }
    
    function executeTreasuryProposal(bytes32 _proposalId) 
        external 
        onlyTreasurySigner 
        validProposal(_proposalId) 
    {
        TreasuryProposal storage proposal = treasuryProposals[_proposalId];
        require(proposal.approvals >= multiSigConfig.requiredSignatures, "MultiSig: insufficient approvals");
        
        _executeTreasuryProposal(_proposalId);
    }
    
    function _executeTreasuryProposal(bytes32 _proposalId) internal {
        TreasuryProposal storage proposal = treasuryProposals[_proposalId];
        proposal.executed = true;
        
        // Execute the transfer using SafeERC20
        IERC20(proposal.token).safeTransfer(proposal.to, proposal.amount);
        
        // Remove from active proposals
        _removeActiveProposal(_proposalId);
        
        emit TreasuryProposalExecuted(_proposalId, proposal.token, proposal.to, proposal.amount);
    }
    
    function cancelTreasuryProposal(bytes32 _proposalId, string calldata _reason) 
        external 
        validProposal(_proposalId) 
    {
        TreasuryProposal storage proposal = treasuryProposals[_proposalId];
        require(
            msg.sender == proposal.proposer || 
            (address(accessControl) != address(0) && 
             accessControl.hasRole(accessControl.ADMIN_ROLE(), msg.sender)),
            "MultiSig: unauthorized cancellation"
        );
        
        proposal.cancelled = true;
        _removeActiveProposal(_proposalId);
        
        emit TreasuryProposalCancelled(_proposalId, msg.sender, _reason);
    }
    
    function _removeActiveProposal(bytes32 _proposalId) internal {
        for (uint256 i = 0; i < activeProposals.length; i++) {
            if (activeProposals[i] == _proposalId) {
                activeProposals[i] = activeProposals[activeProposals.length - 1];
                activeProposals.pop();
                break;
            }
        }
    }
    
    // ===== EMERGENCY TREASURY FUNCTIONS =====
    function emergencyTreasuryAction(
        address _token,
        address _to,
        uint256 _amount,
        string calldata _reason
    ) external onlyEmergencyRole nonReentrant {
        require(_token != address(0), "Emergency: invalid token");
        require(_to != address(0), "Emergency: invalid recipient");
        require(_amount > 0, "Emergency: invalid amount");
        
        // Create emergency proposal that executes immediately
        bytes32 proposalId = keccak256(abi.encodePacked(
            "EMERGENCY",
            _token,
            _to,
            _amount,
            block.timestamp,
            msg.sender
        ));
        
        IERC20(_token).safeTransfer(_to, _amount);
        
        emit EmergencyProposalExecuted(proposalId, _reason, block.timestamp);
    }
    
    // ===== ENHANCED WITHDRAWAL WITH GOVERNANCE =====
    function withdraw() external override nonReentrant whenNotPaused onlyKYCVerified notInEmergency {
        // Check emergency contract restrictions
        if (address(emergencyContract) != address(0)) {
            require(!emergencyContract.withdrawalsDisabled(), "Emergency: withdrawals disabled");
            require(
                !emergencyContract.blacklistedAddresses(msg.sender),
                "Emergency: address blacklisted"
            );
        }
        
        // Call parent withdraw function using the base implementation
        super._withdrawInternal();
    }
    // ===== ENHANCED REGISTRATION WITH GOVERNANCE =====
    function register(address sponsor, uint16 tier) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        onlyKYCVerified 
        notInEmergency 
    {
        // Check emergency contract restrictions
        if (address(emergencyContract) != address(0)) {
            require(!emergencyContract.registrationsDisabled(), "Emergency: registrations disabled");
            require(
                !emergencyContract.blacklistedAddresses(msg.sender),
                "Emergency: address blacklisted"
            );
        }
        
        // Call parent register function using the base implementation
        super._registerInternal(sponsor, tier);
    }
    
    // ===== VIEW FUNCTIONS =====
    function getTreasuryProposal(bytes32 _proposalId) external view returns (
        address proposer,
        address token,
        address to,
        uint256 amount,
        string memory reason,
        uint256 deadline,
        uint256 approvals,
        bool executed,
        bool cancelled
    ) {
        TreasuryProposal storage proposal = treasuryProposals[_proposalId];
        return (
            proposal.proposer,
            proposal.token,
            proposal.to,
            proposal.amount,
            proposal.reason,
            proposal.deadline,
            proposal.approvals,
            proposal.executed,
            proposal.cancelled
        );
    }
    
    function hasApprovedProposal(bytes32 _proposalId, address _signer) 
        external 
        view 
        returns (bool) 
    {
        return treasuryProposals[_proposalId].hasApproved[_signer];
    }
    
    function getActiveProposals() external view returns (bytes32[] memory) {
        return activeProposals;
    }
    
    function getMultiSigConfig() external view returns (
        address[] memory signers,
        uint256 requiredSignatures,
        uint256 proposalDuration,
        bool enabled
    ) {
        return (
            multiSigConfig.signers,
            multiSigConfig.requiredSignatures,
            multiSigConfig.proposalDuration,
            multiSigConfig.enabled
        );
    }
    
    function isGovernanceInitialized() external view returns (bool) {
        return address(accessControl) != address(0) && address(emergencyContract) != address(0);
    }
    
    function getGovernanceAddresses() external view returns (
        address accessControlAddress,
        address emergencyContractAddress
    ) {
        return (address(accessControl), address(emergencyContract));
    }
    
    // ===== CLEANUP FUNCTIONS =====
    function cleanupExpiredProposals() external {
        uint256 cleaned = 0;
        for (uint256 i = activeProposals.length; i > 0; i--) {
            bytes32 proposalId = activeProposals[i - 1];
            TreasuryProposal storage proposal = treasuryProposals[proposalId];
            
            if (block.timestamp > proposal.deadline && !proposal.executed) {
                proposal.cancelled = true;
                activeProposals[i - 1] = activeProposals[activeProposals.length - 1];
                activeProposals.pop();
                cleaned++;
                
                emit TreasuryProposalCancelled(proposalId, address(this), "Expired");
            }
        }
    }
}
