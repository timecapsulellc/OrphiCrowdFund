// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title OrphiCrowdFundCoreSimple
 * @dev Simplified version of the core modular contract for testing and demonstration
 * @notice Essential functionality only, without complex governance or automation
 */
contract OrphiCrowdFundCoreSimple is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ===== ENUMS =====
    enum PackageTier { NONE, TIER1, TIER2, TIER3, TIER4, TIER5 }

    // ===== STRUCTS =====
    struct UserInfo {
        address sponsor;
        PackageTier packageTier;
        uint256 totalInvested;
        uint256 registrationTime;
        uint256 lastActivity;
    }

    struct MatrixPosition {
        address leftChild;
        address rightChild;
        address parent;
        uint256 level;
    }

    // ===== STATE VARIABLES =====
    IERC20 public paymentToken;
    address public matrixRoot;
    
    mapping(address => UserInfo) public users;
    mapping(address => bool) public isRegistered;
    mapping(address => MatrixPosition) public matrixPositions;
    mapping(PackageTier => uint256) public packagePrices;
    
    uint256 public totalUsers;
    uint256 public totalInvested;
    
    // ===== EVENTS =====
    event UserRegistered(
        address indexed user,
        address indexed sponsor,
        PackageTier packageTier,
        uint256 amount,
        uint256 timestamp
    );

    event MatrixPlacement(
        address indexed user,
        address indexed parent,
        bool isLeftChild,
        uint256 level
    );

    // ===== CONSTRUCTOR =====
    constructor(address _paymentToken) Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
        
        // Set package prices (in token decimals)
        packagePrices[PackageTier.TIER1] = 100 * 10**6; // 100 USDT
        packagePrices[PackageTier.TIER2] = 200 * 10**6; // 200 USDT
        packagePrices[PackageTier.TIER3] = 500 * 10**6; // 500 USDT
        packagePrices[PackageTier.TIER4] = 1000 * 10**6; // 1000 USDT
        packagePrices[PackageTier.TIER5] = 2000 * 10**6; // 2000 USDT
    }

    // ===== REGISTRATION FUNCTION =====
    function registerUser(address _sponsor, PackageTier _packageTier) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(!isRegistered[msg.sender], "User already registered");
        require(_packageTier != PackageTier.NONE, "Invalid package tier");
        require(packagePrices[_packageTier] > 0, "Package price not set");
        
        uint256 packagePrice = packagePrices[_packageTier];
        
        // Handle payment
        paymentToken.safeTransferFrom(msg.sender, address(this), packagePrice);
        
        // Set matrix root if first user
        if (matrixRoot == address(0)) {
            matrixRoot = msg.sender;
            _sponsor = address(0);
        } else {
            require(isRegistered[_sponsor], "Invalid sponsor");
        }
        
        // Register user
        users[msg.sender] = UserInfo({
            sponsor: _sponsor,
            packageTier: _packageTier,
            totalInvested: packagePrice,
            registrationTime: block.timestamp,
            lastActivity: block.timestamp
        });
        
        isRegistered[msg.sender] = true;
        totalUsers++;
        totalInvested += packagePrice;
        
        // Place in matrix
        _placeInMatrix(msg.sender, _sponsor);
        
        emit UserRegistered(msg.sender, _sponsor, _packageTier, packagePrice, block.timestamp);
    }

    // ===== MATRIX PLACEMENT =====
    function _placeInMatrix(address _user, address _sponsor) internal {
        if (_sponsor == address(0)) {
            // First user becomes root
            matrixPositions[_user] = MatrixPosition({
                leftChild: address(0),
                rightChild: address(0),
                parent: address(0),
                level: 1
            });
            return;
        }
        
        // Simple placement logic - find first available spot
        address parent = _findAvailableParent(_sponsor);
        bool isLeftChild = matrixPositions[parent].leftChild == address(0);
        
        if (isLeftChild) {
            matrixPositions[parent].leftChild = _user;
        } else {
            matrixPositions[parent].rightChild = _user;
        }
        
        matrixPositions[_user] = MatrixPosition({
            leftChild: address(0),
            rightChild: address(0),
            parent: parent,
            level: matrixPositions[parent].level + 1
        });
        
        emit MatrixPlacement(_user, parent, isLeftChild, matrixPositions[_user].level);
    }

    function _findAvailableParent(address _sponsor) internal view returns (address) {
        // Simple BFS to find available parent
        address current = _sponsor;
        
        // Check if sponsor has available slots
        if (matrixPositions[current].leftChild == address(0) || 
            matrixPositions[current].rightChild == address(0)) {
            return current;
        }
        
        // Otherwise return sponsor (simplified logic)
        return _sponsor;
    }

    // ===== VIEW FUNCTIONS =====
    function getUserInfo(address _user) 
        external 
        view 
        returns (
            address sponsor,
            PackageTier packageTier,
            uint256 totalInvested,
            uint256 registrationTime,
            uint256 lastActivity,
            bool registered
        ) 
    {
        UserInfo storage user = users[_user];
        return (
            user.sponsor,
            user.packageTier,
            user.totalInvested,
            user.registrationTime,
            user.lastActivity,
            isRegistered[_user]
        );
    }

    function getMatrixPosition(address _user) 
        external 
        view 
        returns (
            address leftChild,
            address rightChild,
            address parent,
            uint256 level
        ) 
    {
        MatrixPosition storage position = matrixPositions[_user];
        return (
            position.leftChild,
            position.rightChild,
            position.parent,
            position.level
        );
    }

    function getContractStats() 
        external 
        view 
        returns (
            uint256 totalUsersCount,
            uint256 totalInvestedAmount,
            address matrixRootAddress,
            uint256 contractBalance
        ) 
    {
        return (
            totalUsers,
            totalInvested,
            matrixRoot,
            paymentToken.balanceOf(address(this))
        );
    }

    // ===== ADMIN FUNCTIONS =====
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function updatePackagePrice(PackageTier _tier, uint256 _price) external onlyOwner {
        packagePrices[_tier] = _price;
    }

    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(owner(), _amount);
    }
}
