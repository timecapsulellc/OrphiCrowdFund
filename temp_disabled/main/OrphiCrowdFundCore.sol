// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Import modular contracts
import "../core/OrphiMatrix.sol";
import "../core/OrphiCommissions.sol";
import "../core/OrphiEarnings.sol";
import "../pools/OrphiGlobalHelpPool.sol";
import "../pools/OrphiLeaderPool.sol";
import "../automation/OrphiChainlinkAutomation.sol";

/**
 * @title OrphiCrowdFundCore
 * @dev Core implementation with basic functionality - modular architecture
 * @notice Clean, professional implementation focused on core crowdfunding features
 */
contract OrphiCrowdFundCore is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ===== ENUMS =====
    enum PackageTier { NONE, PACKAGE_30, PACKAGE_50, PACKAGE_100, PACKAGE_200 }

    // ===== STRUCTS =====
    struct UserInfo {
        address sponsor;
        PackageTier packageTier;
        uint256 totalInvested;
        uint256 registrationTime;
        uint256 lastActivity;
        bool isRegistered;
    }

    struct SystemStats {
        uint256 totalMembers;
        uint256 totalVolume;
        uint256 totalWithdrawn;
        uint256 contractBalance;
        uint256 lastGHPDistribution;
        uint256 lastLeaderDistribution;
    }

    // ===== CONSTANTS =====
    uint256 public constant PACKAGE_30_AMOUNT = 30e18;
    uint256 public constant PACKAGE_50_AMOUNT = 50e18;
    uint256 public constant PACKAGE_100_AMOUNT = 100e18;
    uint256 public constant PACKAGE_200_AMOUNT = 200e18;

    // ===== STATE VARIABLES =====
    IERC20 public paymentToken;
    address public adminReserve;
    address public matrixRoot;
    
    // Modular contracts
    OrphiMatrix public matrixContract;
    OrphiCommissions public commissionContract;
    OrphiEarnings public earningsContract;
    OrphiGlobalHelpPool public ghpContract;
    OrphiLeaderPool public leaderPoolContract;
    OrphiChainlinkAutomation public automationContract;

    // System tracking
    uint256 public totalMembers;
    uint256 public totalVolumeProcessed;

    // ===== MAPPINGS =====
    mapping(address => UserInfo) public users;
    mapping(address => bool) public isRegistered;
    mapping(uint256 => address) public userIdToAddress;
    mapping(address => uint256) public addressToUserId;

    // ===== EVENTS =====
    event UserRegistered(
        address indexed user,
        address indexed sponsor,
        PackageTier packageTier,
        uint256 userId,
        uint256 amount,
        uint256 timestamp
    );
    event SystemInitialized(
        address indexed matrixRoot,
        address paymentToken,
        address adminReserve,
        uint256 timestamp
    );
    event ModularContractsDeployed(
        address matrixContract,
        address commissionContract,
        address earningsContract,
        address ghpContract,
        address leaderPoolContract,
        uint256 timestamp
    );
    event PackageUpgrade(
        address indexed user,
        PackageTier oldTier,
        PackageTier newTier,
        uint256 additionalInvestment,
        uint256 timestamp
    );
    event EmergencyAction(
        string action,
        address indexed by,
        uint256 timestamp
    );

    // ===== MODIFIERS =====
    modifier validPackageTier(PackageTier _tier) {
        require(_tier >= PackageTier.PACKAGE_30 && _tier <= PackageTier.PACKAGE_200, "Invalid package tier");
        _;
    }

    modifier onlyRegistered(address _user) {
        require(isRegistered[_user], "User not registered");
        _;
    }

    modifier contractsInitialized() {
        require(address(matrixContract) != address(0), "Matrix contract not set");
        require(address(commissionContract) != address(0), "Commission contract not set");
        require(address(earningsContract) != address(0), "Earnings contract not set");
        _;
    }

    // ===== CONSTRUCTOR =====
    constructor(
        address _paymentToken,
        address _adminReserve,
        address _matrixRoot,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_paymentToken != address(0), "Invalid payment token");
        require(_adminReserve != address(0), "Invalid admin reserve");
        require(_matrixRoot != address(0), "Invalid matrix root");

        paymentToken = IERC20(_paymentToken);
        adminReserve = _adminReserve;
        matrixRoot = _matrixRoot;

        // Register matrix root
        _registerMatrixRoot();

        emit SystemInitialized(_matrixRoot, _paymentToken, _adminReserve, block.timestamp);
    }

    // ===== INITIALIZATION FUNCTIONS =====
    function deployModularContracts() external onlyOwner {
        require(address(matrixContract) == address(0), "Contracts already deployed");

        // Deploy Matrix contract
        matrixContract = new OrphiMatrix(matrixRoot, address(this));

        // Deploy Commission contract
        commissionContract = new OrphiCommissions(address(paymentToken), adminReserve, address(this));

        // Deploy Earnings contract
        earningsContract = new OrphiEarnings(address(paymentToken), adminReserve, address(this));

        // Deploy GHP contract
        ghpContract = new OrphiGlobalHelpPool(address(paymentToken), adminReserve, address(this));

        // Deploy Leader Pool contract
        leaderPoolContract = new OrphiLeaderPool(address(paymentToken), adminReserve, address(this));

        // Set contract references
        _setupContractReferences();

        emit ModularContractsDeployed(
            address(matrixContract),
            address(commissionContract),
            address(earningsContract),
            address(ghpContract),
            address(leaderPoolContract),
            block.timestamp
        );
    }

    function _setupContractReferences() internal {
        // Set matrix contract in commission contract
        commissionContract.setMatrixContract(address(matrixContract));
        commissionContract.setPoolContract(address(ghpContract));

        // Set commission contract in earnings contract
        earningsContract.setCommissionContract(address(commissionContract));
        earningsContract.setPoolContract(address(ghpContract));

        // Set contracts in GHP
        ghpContract.setMatrixContract(address(matrixContract));
        ghpContract.setCommissionContract(address(commissionContract));

        // Set contracts in Leader Pool
        leaderPoolContract.setMatrixContract(address(matrixContract));
        leaderPoolContract.setCommissionContract(address(commissionContract));
    }

    function deployAutomationContract() external onlyOwner {
        require(address(automationContract) == address(0), "Automation already deployed");
        require(address(ghpContract) != address(0), "GHP contract not deployed");
        require(address(leaderPoolContract) != address(0), "Leader pool not deployed");

        automationContract = new OrphiChainlinkAutomation(
            address(ghpContract),
            address(leaderPoolContract),
            address(this)
        );
    }

    // ===== REGISTRATION FUNCTIONS =====
    function registerUser(
        address _sponsor,
        PackageTier _packageTier
    ) external payable nonReentrant whenNotPaused validPackageTier(_packageTier) contractsInitialized {
        require(!isRegistered[msg.sender], "User already registered");
        require(isRegistered[_sponsor], "Sponsor not registered");
        require(msg.sender != _sponsor, "Cannot sponsor yourself");

        uint256 packageAmount = getPackageAmount(_packageTier);
        require(packageAmount > 0, "Invalid package amount");

        // Transfer payment
        paymentToken.safeTransferFrom(msg.sender, address(this), packageAmount);

        // Register user internally
        _registerUserInternal(msg.sender, _sponsor, _packageTier, packageAmount);

        // Place in matrix
        matrixContract.addUser(msg.sender, _sponsor);

        // Register with commission contract
        commissionContract.registerUser(msg.sender, _sponsor, uint256(_packageTier), packageAmount);

        // Distribute commissions
        paymentToken.safeTransfer(address(commissionContract), packageAmount);
        commissionContract.distributeCommissions(msg.sender, packageAmount);

        // Update tracking
        totalVolumeProcessed += packageAmount;

        emit UserRegistered(
            msg.sender,
            _sponsor,
            _packageTier,
            totalMembers,
            packageAmount,
            block.timestamp
        );
    }

    function _registerUserInternal(
        address _user,
        address _sponsor,
        PackageTier _packageTier,
        uint256 _amount
    ) internal {
        totalMembers++;
        uint256 userId = totalMembers;

        users[_user] = UserInfo({
            sponsor: _sponsor,
            packageTier: _packageTier,
            totalInvested: _amount,
            registrationTime: block.timestamp,
            lastActivity: block.timestamp,
            isRegistered: true
        });

        isRegistered[_user] = true;
        userIdToAddress[userId] = _user;
        addressToUserId[_user] = userId;
    }

    function _registerMatrixRoot() internal {
        totalMembers = 1;
        users[matrixRoot] = UserInfo({
            sponsor: address(0),
            packageTier: PackageTier.PACKAGE_200,
            totalInvested: PACKAGE_200_AMOUNT,
            registrationTime: block.timestamp,
            lastActivity: block.timestamp,
            isRegistered: true
        });

        isRegistered[matrixRoot] = true;
        userIdToAddress[1] = matrixRoot;
        addressToUserId[matrixRoot] = 1;
    }

    // ===== PACKAGE UPGRADE FUNCTIONS =====
    function upgradePackage(PackageTier _newTier) external payable nonReentrant whenNotPaused onlyRegistered(msg.sender) {
        UserInfo storage user = users[msg.sender];
        require(_newTier > user.packageTier, "Can only upgrade to higher tier");

        uint256 currentAmount = getPackageAmount(user.packageTier);
        uint256 newAmount = getPackageAmount(_newTier);
        uint256 upgradeAmount = newAmount - currentAmount;

        // Transfer additional payment
        paymentToken.safeTransferFrom(msg.sender, address(this), upgradeAmount);

        // Update user info
        PackageTier oldTier = user.packageTier;
        user.packageTier = _newTier;
        user.totalInvested += upgradeAmount;
        user.lastActivity = block.timestamp;

        // Process upgrade through commission system
        paymentToken.safeTransfer(address(commissionContract), upgradeAmount);
        commissionContract.distributeCommissions(msg.sender, upgradeAmount);

        // Update tracking
        totalVolumeProcessed += upgradeAmount;

        emit PackageUpgrade(msg.sender, oldTier, _newTier, upgradeAmount, block.timestamp);
    }

    // ===== WITHDRAWAL FUNCTIONS =====
    function withdraw(uint256 _amount) external nonReentrant whenNotPaused onlyRegistered(msg.sender) {
        require(address(earningsContract) != address(0), "Earnings contract not set");
        
        // Update user activity
        users[msg.sender].lastActivity = block.timestamp;
        
        // Delegate to earnings contract
        earningsContract.withdraw(_amount);
    }

    function withdrawAll() external nonReentrant whenNotPaused onlyRegistered(msg.sender) {
        require(address(earningsContract) != address(0), "Earnings contract not set");
        
        // Update user activity
        users[msg.sender].lastActivity = block.timestamp;
        
        // Delegate to earnings contract
        earningsContract.withdrawAll();
    }

    // ===== DISTRIBUTION FUNCTIONS =====
    function distributeGlobalHelpPool() external onlyOwner {
        require(address(ghpContract) != address(0), "GHP contract not set");
        ghpContract.distributeGHP();
    }

    function distributeLeaderBonus() external onlyOwner {
        require(address(leaderPoolContract) != address(0), "Leader pool contract not set");
        leaderPoolContract.distributeLeaderBonus();
    }

    // ===== VIEW FUNCTIONS =====
    function getPackageAmount(PackageTier _tier) public pure returns (uint256) {
        if (_tier == PackageTier.PACKAGE_30) return PACKAGE_30_AMOUNT;
        if (_tier == PackageTier.PACKAGE_50) return PACKAGE_50_AMOUNT;
        if (_tier == PackageTier.PACKAGE_100) return PACKAGE_100_AMOUNT;
        if (_tier == PackageTier.PACKAGE_200) return PACKAGE_200_AMOUNT;
        return 0;
    }

    function getUserInfo(address _user) external view returns (
        address sponsor,
        PackageTier packageTier,
        uint256 totalInvested,
        uint256 registrationTime,
        uint256 lastActivity,
        bool registered
    ) {
        UserInfo storage user = users[_user];
        return (
            user.sponsor,
            user.packageTier,
            user.totalInvested,
            user.registrationTime,
            user.lastActivity,
            user.isRegistered
        );
    }

    function getSystemStats() external view returns (SystemStats memory) {
        uint256 contractBalance = paymentToken.balanceOf(address(this));
        
        return SystemStats({
            totalMembers: totalMembers,
            totalVolume: totalVolumeProcessed,
            totalWithdrawn: 0, // Would be tracked by earnings contract
            contractBalance: contractBalance,
            lastGHPDistribution: address(ghpContract) != address(0) ? 
                ghpContract.lastDistributionTime() : 0,
            lastLeaderDistribution: address(leaderPoolContract) != address(0) ? 
                leaderPoolContract.lastDistributionTime() : 0
        });
    }

    function getModularContracts() external view returns (
        address matrix,
        address commission,
        address earnings,
        address ghp,
        address leaderPool,
        address automation
    ) {
        return (
            address(matrixContract),
            address(commissionContract),
            address(earningsContract),
            address(ghpContract),
            address(leaderPoolContract),
            address(automationContract)
        );
    }

    // ===== ADMIN FUNCTIONS =====
    function pause() external onlyOwner {
        _pause();
        emit EmergencyAction("Pause", msg.sender, block.timestamp);
    }

    function unpause() external onlyOwner {
        _unpause();
        emit EmergencyAction("Unpause", msg.sender, block.timestamp);
    }

    function updateAdminReserve(address _newAdminReserve) external onlyOwner {
        require(_newAdminReserve != address(0), "Invalid admin reserve");
        adminReserve = _newAdminReserve;
    }

    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(adminReserve, _amount);
        emit EmergencyAction("Emergency Withdraw", msg.sender, block.timestamp);
    }

    // ===== FUNDING FUNCTIONS =====
    function fundContract(uint256 _amount) external {
        paymentToken.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function fundGHP(uint256 _amount) external {
        require(address(ghpContract) != address(0), "GHP contract not set");
        paymentToken.safeTransferFrom(msg.sender, address(ghpContract), _amount);
        ghpContract.fundPool(_amount);
    }

    function fundLeaderPool(uint256 _amount) external {
        require(address(leaderPoolContract) != address(0), "Leader pool contract not set");
        paymentToken.safeTransferFrom(msg.sender, address(leaderPoolContract), _amount);
        leaderPoolContract.fundPool(_amount);
    }

    // ===== INTERFACE FUNCTIONS FOR EXTERNAL CONTRACTS =====
    function isUserRegistered(address _user) external view returns (bool) {
        return isRegistered[_user];
    }

    function getUserPackageTier(address _user) external view returns (PackageTier) {
        return users[_user].packageTier;
    }

    function getUserSponsor(address _user) external view returns (address) {
        return users[_user].sponsor;
    }

    function getUserTotalInvested(address _user) external view returns (uint256) {
        return users[_user].totalInvested;
    }

    function updateUserActivity(address _user) external {
        require(
            msg.sender == address(matrixContract) ||
            msg.sender == address(commissionContract) ||
            msg.sender == address(earningsContract),
            "Only modular contracts can update activity"
        );
        users[_user].lastActivity = block.timestamp;
    }

    // ===== INTEGRATION HELPERS =====
    function getAllUserAddresses() external view returns (address[] memory) {
        address[] memory userAddresses = new address[](totalMembers);
        for (uint256 i = 1; i <= totalMembers; i++) {
            userAddresses[i - 1] = userIdToAddress[i];
        }
        return userAddresses;
    }

    function batchUpdateMatrixInfo(address[] calldata _users) external onlyOwner {
        require(address(matrixContract) != address(0), "Matrix contract not set");
        
        for (uint256 i = 0; i < _users.length; i++) {
            if (isRegistered[_users[i]]) {
                // This would update matrix placement for existing users
                // Implementation depends on matrix contract interface
            }
        }
    }

    receive() external payable {
        revert("Direct payments not accepted");
    }
}
