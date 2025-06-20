// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;


/**
 * @title OrphiCrowdFund V2 - Multi-Admin & Free Registration Upgrade
 * @dev This upgrade adds the missing multi-admin system and free-tier admin registration
 * 
 * NEW FEATURES IN V2:
 * ✅ Free-tier admin registration (no payment required)
 * ✅ Multi-admin system with role management
 * ✅ Admin hierarchy and permissions
 * ✅ Self-registration for admins
 * ✅ Admin whitelist system
 * ✅ Enhanced admin management functions
 */
contract OrphiCrowdFundV2 is OrphiCrowdFund {
    
    // ==================== V2 STORAGE VARIABLES ====================
    
    /// @dev List of all admin addresses
    address[] public adminList;
    
    /// @dev Mapping to track admin status
    mapping(address => bool) public isAdmin;
    
    /// @dev Mapping to track free-tier admins
    mapping(address => bool) public isFreeAdmin;
    
    /// @dev Admin registration fee (can be 0 for free registration)
    uint256 public adminRegistrationFee;
    
    /// @dev Maximum number of admins allowed
    uint256 public maxAdmins;
    
    /// @dev Admin whitelist for controlled registration
    mapping(address => bool) public adminWhitelist;
    
    /// @dev Whether admin registration is open to public
    bool public publicAdminRegistration;
    
    /// @dev Admin metadata
    struct AdminInfo {
        bool isRegistered;
        bool isFreeAdmin;
        uint256 registrationTime;
        uint256 totalRegistered; // Users registered by this admin
        uint256 totalVolume;     // Volume generated by their users
        string contact;          // Contact info
        bool isActive;
    }
    
    mapping(address => AdminInfo) public adminInfo;
    
    // ==================== V2 EVENTS ====================
    
    event AdminRegistered(address indexed admin, bool isFree, uint256 timestamp);
    event AdminDeactivated(address indexed admin, uint256 timestamp);
    event AdminActivated(address indexed admin, uint256 timestamp);
    event AdminWhitelisted(address indexed admin, address indexed by);
    event AdminRegistrationFeeUpdated(uint256 oldFee, uint256 newFee);
    event PublicAdminRegistrationToggled(bool enabled);
    
    // ==================== V2 MODIFIERS ====================
    
    modifier onlyActiveAdmin() {
        require(isAdmin[msg.sender] && adminInfo[msg.sender].isActive, "Not an active admin");
        _;
    }
    
    modifier validAdminRegistration() {
        require(adminList.length < maxAdmins, "Max admins reached");
        require(!isAdmin[msg.sender], "Already an admin");
        if (!publicAdminRegistration) {
            require(adminWhitelist[msg.sender], "Not whitelisted for admin registration");
        }
        _;
    }
    
    // ==================== V2 INITIALIZATION ====================
    
    /**
     * @dev Initialize V2 upgrade
     */
    function initializeV2() public reinitializer(2) {
        adminRegistrationFee = 0; // Free by default
        maxAdmins = 100; // Allow up to 100 admins
        publicAdminRegistration = true; // Open registration
        
        // Add the current owner/deployer as the first admin
        if (!isAdmin[owner()]) {
            _addAdmin(owner(), true, "Platform Owner");
        }
    }
    
    // ==================== FREE ADMIN REGISTRATION ====================
    
    /**
     * @dev Register as a free admin (public function)
     */
    function registerFreeAdmin(string memory contact) external payable validAdminRegistration {
        require(msg.value >= adminRegistrationFee, "Insufficient registration fee");
        
        _addAdmin(msg.sender, adminRegistrationFee == 0, contact);
        
        // Refund excess payment
        if (msg.value > adminRegistrationFee) {
            payable(msg.sender).transfer(msg.value - adminRegistrationFee);
        }
        
        emit AdminRegistered(msg.sender, adminRegistrationFee == 0, block.timestamp);
    }
    
    /**
     * @dev Register as a paid admin with custom fee
     */
    function registerPaidAdmin(string memory contact) external payable validAdminRegistration {
        require(msg.value >= adminRegistrationFee, "Insufficient registration fee");
        require(adminRegistrationFee > 0, "Use registerFreeAdmin for free registration");
        
        _addAdmin(msg.sender, false, contact);
        
        // Send fee to treasury or owner
        if (adminRegistrationFee > 0) {
            payable(owner()).transfer(adminRegistrationFee);
        }
        
        // Refund excess payment
        if (msg.value > adminRegistrationFee) {
            payable(msg.sender).transfer(msg.value - adminRegistrationFee);
        }
        
        emit AdminRegistered(msg.sender, false, block.timestamp);
    }
    
    // ==================== ADMIN MANAGEMENT FUNCTIONS ====================
    
    /**
     * @dev Add admin (internal function)
     */
    function _addAdmin(address admin, bool isFree, string memory contact) internal {
        isAdmin[admin] = true;
        isFreeAdmin[admin] = isFree;
        adminList.push(admin);
        
        adminInfo[admin] = AdminInfo({
            isRegistered: true,
            isFreeAdmin: isFree,
            registrationTime: block.timestamp,
            totalRegistered: 0,
            totalVolume: 0,
            contact: contact,
            isActive: true
        });
        
        // Grant ADMIN_ROLE to the new admin
        _grantRole(ADMIN_ROLE, admin);
    }
    
    /**
     * @dev Whitelist an address for admin registration (owner only)
     */
    function whitelistAdmin(address admin) external onlyOwner {
        adminWhitelist[admin] = true;
        emit AdminWhitelisted(admin, msg.sender);
    }
    
    /**
     * @dev Batch whitelist admins (owner only)
     */
    function batchWhitelistAdmins(address[] memory admins) external onlyOwner {
        for (uint256 i = 0; i < admins.length; i++) {
            adminWhitelist[admins[i]] = true;
            emit AdminWhitelisted(admins[i], msg.sender);
        }
    }
    
    /**
     * @dev Remove admin whitelist
     */
    function removeAdminWhitelist(address admin) external onlyOwner {
        adminWhitelist[admin] = false;
    }
    
    /**
     * @dev Deactivate an admin (owner only)
     */
    function deactivateAdmin(address admin) external onlyOwner {
        require(isAdmin[admin], "Not an admin");
        adminInfo[admin].isActive = false;
        _revokeRole(ADMIN_ROLE, admin);
        emit AdminDeactivated(admin, block.timestamp);
    }
    
    /**
     * @dev Reactivate an admin (owner only)
     */
    function reactivateAdmin(address admin) external onlyOwner {
        require(isAdmin[admin], "Not an admin");
        adminInfo[admin].isActive = true;
        _grantRole(ADMIN_ROLE, admin);
        emit AdminActivated(admin, block.timestamp);
    }
    
    /**
     * @dev Update admin registration fee (owner only)
     */
    function setAdminRegistrationFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = adminRegistrationFee;
        adminRegistrationFee = newFee;
        emit AdminRegistrationFeeUpdated(oldFee, newFee);
    }
    
    /**
     * @dev Toggle public admin registration (owner only)
     */
    function setPublicAdminRegistration(bool enabled) external onlyOwner {
        publicAdminRegistration = enabled;
        emit PublicAdminRegistrationToggled(enabled);
    }
    
    /**
     * @dev Set maximum number of admins (owner only)
     */
    function setMaxAdmins(uint256 newMax) external onlyOwner {
        require(newMax >= adminList.length, "Cannot be less than current admin count");
        maxAdmins = newMax;
    }
    
    // ==================== ENHANCED USER REGISTRATION ====================
    
    /**
     * @dev Register user with admin tracking
     */
    function registerUserAsAdmin(
        address _user,
        address _sponsor,
        DataStructures.PackageTier _tier
    ) external payable onlyActiveAdmin nonReentrant whenNotPaused {
        require(!users[_user].isRegistered, "Already registered");
        require(_tier != DataStructures.PackageTier.NONE && uint8(_tier) <= 8, "Invalid tier");
        
        uint256 packageAmount = getPackageAmount(uint8(_tier));
        require(msg.value >= packageAmount, "Insufficient payment");
        
        // Track admin's registration activity
        adminInfo[msg.sender].totalRegistered++;
        adminInfo[msg.sender].totalVolume += packageAmount;
        
        // Register the user (use existing logic)
        _registerUser(_user, _sponsor, _tier, packageAmount);
        
        // Refund excess payment
        if (msg.value > packageAmount) {
            payable(msg.sender).transfer(msg.value - packageAmount);
        }
    }
    
    // ==================== ADMIN GETTERS ====================
    
    /**
     * @dev Get all admins
     */
    function getAllAdmins() external view returns (address[] memory) {
        return adminList;
    }
    
    /**
     * @dev Get active admins only
     */
    function getActiveAdmins() external view returns (address[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < adminList.length; i++) {
            if (adminInfo[adminList[i]].isActive) {
                activeCount++;
            }
        }
        
        address[] memory activeAdmins = new address[](activeCount);
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < adminList.length; i++) {
            if (adminInfo[adminList[i]].isActive) {
                activeAdmins[currentIndex] = adminList[i];
                currentIndex++;
            }
        }
        
        return activeAdmins;
    }
    
    /**
     * @dev Get admin stats
     */
    function getAdminStats(address admin) external view returns (
        bool isRegistered,
        bool isFree,
        bool isActive,
        uint256 registrationTime,
        uint256 totalRegistered,
        uint256 totalVolume,
        string memory contact
    ) {
        AdminInfo memory info = adminInfo[admin];
        return (
            info.isRegistered,
            info.isFreeAdmin,
            info.isActive,
            info.registrationTime,
            info.totalRegistered,
            info.totalVolume,
            info.contact
        );
    }
    
    /**
     * @dev Get total number of admins
     */
    function getTotalAdmins() external view returns (uint256) {
        return adminList.length;
    }
    
    /**
     * @dev Get number of active admins
     */
    function getActiveAdminCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < adminList.length; i++) {
            if (adminInfo[adminList[i]].isActive) {
                count++;
            }
        }
        return count;
    }
    
    // ==================== HELPER FUNCTIONS ====================
    
    /**
     * @dev Internal user registration function (extracted for reuse)
     */
    function _registerUser(
        address _user,
        address _sponsor,
        DataStructures.PackageTier _tier,
        uint256 _amount
    ) internal {
        // Implementation would mirror the existing registerUser logic
        // This is a placeholder - you'd copy the actual registration logic here
        require(users[_sponsor].isRegistered || _sponsor == address(0), "Invalid sponsor");
        
        // Create user registration (simplified for this upgrade)
        users[_user] = DataStructures.User({
            isRegistered: true,
            sponsor: _sponsor,
            currentTier: _tier,
            totalInvestment: _amount,
            totalEarnings: 0,
            withdrawableBalance: 0,
            directReferrals: 0,
            teamSize: 0,
            teamVolume: 0,
            registrationTime: block.timestamp,
            rank: DataStructures.LeaderRank.NONE,
            isActive: true,
            isBlacklisted: false,
            lastWithdrawal: 0,
            earningsCap: (_amount * EARNINGS_CAP_BASIS_POINTS) / BASIS_POINTS,
            leftChild: address(0),
            rightChild: address(0),
            leftVolume: 0,
            rightVolume: 0,
            clubMember: uint8(_tier) >= 3,
            clubJoinTime: uint8(_tier) >= 3 ? block.timestamp : 0
        });
        
        totalUsers++;
        totalInvestments += _amount;
        
        emit UserRegistered(_user, _sponsor, _tier);
    }
    
    // ==================== UPGRADE AUTHORIZATION ====================
    
    /**
     * @dev Authorize upgrade (override from UUPSUpgradeable)
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
