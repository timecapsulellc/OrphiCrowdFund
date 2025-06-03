// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../libraries/CommissionLibrary.sol";

/**
 * @title OrphiCommissions
 * @dev Handles all commission calculations and distributions
 * @notice Focused contract for commission management only
 */
contract OrphiCommissions is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using CommissionLibrary for uint256;

    // ===== STRUCTS =====
    struct CommissionTier {
        uint256 sponsorRate;     // Basis points (4000 = 40%)
        uint256 levelBonusRate;  // Basis points (1000 = 10%)
        uint256 uplineRate;      // Basis points (1000 = 10%)
        uint256 leaderRate;      // Basis points (1000 = 10%)
        uint256 helpPoolRate;    // Basis points (3000 = 30%)
    }

    struct UserCommissions {
        uint256 totalSponsorEarned;
        uint256 totalLevelEarned;
        uint256 totalUplineEarned;
        uint256 totalLeaderEarned;
        uint256 totalHelpPoolEarned;
        uint256 withdrawableAmount;
        bool isCapped;
        uint256 totalInvested;
        uint256 earningsCap; // 4x investment
    }

    // ===== CONSTANTS =====
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant EARNINGS_MULTIPLIER = 4; // 4x earnings cap
    uint256 public constant MAX_UPLINE_LEVELS = 30;
    uint256[10] public LEVEL_PERCENTAGES = [300, 100, 100, 100, 100, 100, 50, 50, 50, 50]; // Basis points

    // ===== STATE VARIABLES =====
    IERC20 public paymentToken;
    address public adminReserve;
    address public matrixContract;
    address public poolContract;

    CommissionTier public defaultTier = CommissionTier({
        sponsorRate: 4000,      // 40%
        levelBonusRate: 1000,   // 10%
        uplineRate: 1000,       // 10%
        leaderRate: 1000,       // 10%
        helpPoolRate: 3000      // 30%
    });

    // ===== MAPPINGS =====
    mapping(address => UserCommissions) public userCommissions;
    mapping(address => address) public userSponsor;
    mapping(address => uint256) public userPackageLevel;
    mapping(address => uint256) public userDirectSponsors;

    // ===== EVENTS =====
    event SponsorCommissionPaid(
        address indexed sponsor,
        address indexed user,
        uint256 amount,
        uint256 timestamp
    );
    event LevelBonusPaid(
        address indexed recipient,
        address indexed user,
        uint256 level,
        uint256 amount,
        uint256 timestamp
    );
    event UplineBonusPaid(
        address indexed recipient,
        address indexed user,
        uint256 level,
        uint256 amount,
        uint256 timestamp
    );
    event UserCapped(
        address indexed user,
        uint256 totalEarnings,
        uint256 cap,
        uint256 timestamp
    );
    event CommissionDistributed(
        address indexed user,
        uint256 totalAmount,
        uint256 sponsorAmount,
        uint256 levelAmount,
        uint256 uplineAmount,
        uint256 poolAmount,
        uint256 timestamp
    );

    // ===== MODIFIERS =====
    modifier onlyMatrixContract() {
        require(msg.sender == matrixContract, "Only matrix contract");
        _;
    }

    modifier onlyPoolContract() {
        require(msg.sender == poolContract, "Only pool contract");
        _;
    }

    modifier validUser(address _user) {
        require(_user != address(0), "Invalid user address");
        _;
    }

    // ===== CONSTRUCTOR =====
    constructor(
        address _paymentToken,
        address _adminReserve,
        address _initialOwner
    ) Ownable(_initialOwner) {
        require(_paymentToken != address(0), "Invalid payment token");
        require(_adminReserve != address(0), "Invalid admin reserve");
        
        paymentToken = IERC20(_paymentToken);
        adminReserve = _adminReserve;
    }

    // ===== CONFIGURATION FUNCTIONS =====
    function setMatrixContract(address _matrixContract) external onlyOwner {
        require(_matrixContract != address(0), "Invalid matrix contract");
        matrixContract = _matrixContract;
    }

    function setPoolContract(address _poolContract) external onlyOwner {
        require(_poolContract != address(0), "Invalid pool contract");
        poolContract = _poolContract;
    }

    function setCommissionTier(CommissionTier memory _tier) external onlyOwner {
        require(
            _tier.sponsorRate + _tier.levelBonusRate + _tier.uplineRate + 
            _tier.leaderRate + _tier.helpPoolRate == BASIS_POINTS,
            "Invalid tier percentages"
        );
        defaultTier = _tier;
    }

    // ===== USER MANAGEMENT =====
    function registerUser(
        address _user,
        address _sponsor,
        uint256 _packageLevel,
        uint256 _investmentAmount
    ) external onlyMatrixContract validUser(_user) {
        userSponsor[_user] = _sponsor;
        userPackageLevel[_user] = _packageLevel;
        
        UserCommissions storage userComm = userCommissions[_user];
        userComm.totalInvested = _investmentAmount;
        userComm.earningsCap = _investmentAmount * EARNINGS_MULTIPLIER;
        userComm.isCapped = false;

        if (_sponsor != address(0)) {
            userDirectSponsors[_sponsor]++;
        }
    }

    // ===== COMMISSION DISTRIBUTION =====
    function distributeCommissions(
        address _user,
        uint256 _totalAmount
    ) external onlyMatrixContract nonReentrant returns (uint256) {
        require(_totalAmount > 0, "Invalid amount");

        // Calculate individual amounts
        uint256 sponsorAmount = (_totalAmount * defaultTier.sponsorRate) / BASIS_POINTS;
        uint256 levelAmount = (_totalAmount * defaultTier.levelBonusRate) / BASIS_POINTS;
        uint256 uplineAmount = (_totalAmount * defaultTier.uplineRate) / BASIS_POINTS;
        uint256 leaderAmount = (_totalAmount * defaultTier.leaderRate) / BASIS_POINTS;
        uint256 helpPoolAmount = (_totalAmount * defaultTier.helpPoolRate) / BASIS_POINTS;

        uint256 totalDistributed = 0;

        // 1. Pay Sponsor Commission
        totalDistributed += _paySponsorCommission(_user, sponsorAmount);

        // 2. Pay Level Bonus
        totalDistributed += _payLevelBonus(_user, levelAmount);

        // 3. Pay Global Upline Bonus
        totalDistributed += _payUplineBonus(_user, uplineAmount);

        // 4. Send to pools (handled by pool contract)
        if (poolContract != address(0)) {
            paymentToken.safeTransfer(poolContract, leaderAmount + helpPoolAmount);
            totalDistributed += leaderAmount + helpPoolAmount;
        } else {
            // Fallback to admin reserve
            paymentToken.safeTransfer(adminReserve, leaderAmount + helpPoolAmount);
            totalDistributed += leaderAmount + helpPoolAmount;
        }

        emit CommissionDistributed(
            _user,
            _totalAmount,
            sponsorAmount,
            levelAmount,
            uplineAmount,
            leaderAmount + helpPoolAmount,
            block.timestamp
        );

        return totalDistributed;
    }

    // ===== INTERNAL COMMISSION LOGIC =====
    function _paySponsorCommission(address _user, uint256 _amount) internal returns (uint256) {
        address sponsor = userSponsor[_user];
        if (sponsor == address(0) || userCommissions[sponsor].isCapped) {
            // Send to admin reserve if no sponsor or sponsor is capped
            paymentToken.safeTransfer(adminReserve, _amount);
            return _amount;
        }

        _creditEarnings(sponsor, _amount, 0);
        userCommissions[sponsor].totalSponsorEarned += _amount;

        emit SponsorCommissionPaid(sponsor, _user, _amount, block.timestamp);
        return _amount;
    }

    function _payLevelBonus(address _user, uint256 _totalAmount) internal returns (uint256) {
        address current = userSponsor[_user];
        uint256 totalPaid = 0;
        uint256 level = 0;

        while (current != address(0) && level < 10) {
            if (!userCommissions[current].isCapped) {
                uint256 levelAmount = (_totalAmount * LEVEL_PERCENTAGES[level]) / BASIS_POINTS;
                
                _creditEarnings(current, levelAmount, 1);
                userCommissions[current].totalLevelEarned += levelAmount;
                totalPaid += levelAmount;

                emit LevelBonusPaid(current, _user, level + 1, levelAmount, block.timestamp);
            }

            current = userSponsor[current];
            level++;
        }

        // Send remaining to admin reserve
        uint256 remaining = _totalAmount - totalPaid;
        if (remaining > 0) {
            paymentToken.safeTransfer(adminReserve, remaining);
        }

        return _totalAmount;
    }

    function _payUplineBonus(address _user, uint256 _totalAmount) internal returns (uint256) {
        address current = userSponsor[_user];
        uint256 perUplineAmount = _totalAmount / MAX_UPLINE_LEVELS;
        uint256 totalPaid = 0;
        uint256 level = 0;

        while (current != address(0) && level < MAX_UPLINE_LEVELS) {
            if (!userCommissions[current].isCapped) {
                _creditEarnings(current, perUplineAmount, 2);
                userCommissions[current].totalUplineEarned += perUplineAmount;
                totalPaid += perUplineAmount;

                emit UplineBonusPaid(current, _user, level + 1, perUplineAmount, block.timestamp);
            }

            current = userSponsor[current];
            level++;
        }

        // Send remaining to admin reserve
        uint256 remaining = _totalAmount - totalPaid;
        if (remaining > 0) {
            paymentToken.safeTransfer(adminReserve, remaining);
        }

        return _totalAmount;
    }

    function _creditEarnings(address _user, uint256 _amount, uint8 _poolType) internal {
        UserCommissions storage userComm = userCommissions[_user];
        
        userComm.withdrawableAmount += _amount;
        
        // Check earnings cap
        uint256 totalEarnings = getTotalUserEarnings(_user);
        if (totalEarnings >= userComm.earningsCap && !userComm.isCapped) {
            userComm.isCapped = true;
            emit UserCapped(_user, totalEarnings, userComm.earningsCap, block.timestamp);
        }
    }

    // ===== VIEW FUNCTIONS =====
    function getTotalUserEarnings(address _user) public view returns (uint256) {
        UserCommissions storage userComm = userCommissions[_user];
        return userComm.totalSponsorEarned + 
               userComm.totalLevelEarned + 
               userComm.totalUplineEarned + 
               userComm.totalLeaderEarned + 
               userComm.totalHelpPoolEarned;
    }

    function getUserCommissionInfo(address _user) external view returns (
        uint256 totalSponsorEarned,
        uint256 totalLevelEarned,
        uint256 totalUplineEarned,
        uint256 totalLeaderEarned,
        uint256 totalHelpPoolEarned,
        uint256 withdrawableAmount,
        bool isCapped,
        uint256 totalInvested,
        uint256 earningsCap
    ) {
        UserCommissions storage userComm = userCommissions[_user];
        return (
            userComm.totalSponsorEarned,
            userComm.totalLevelEarned,
            userComm.totalUplineEarned,
            userComm.totalLeaderEarned,
            userComm.totalHelpPoolEarned,
            userComm.withdrawableAmount,
            userComm.isCapped,
            userComm.totalInvested,
            userComm.earningsCap
        );
    }

    function getWithdrawalRate(address _user) external view returns (uint256) {
        uint256 directCount = userDirectSponsors[_user];
        
        if (directCount >= 20) {
            return 8000; // 80%
        } else if (directCount >= 5) {
            return 7500; // 75%
        } else {
            return 7000; // 70%
        }
    }

    // ===== EMERGENCY FUNCTIONS =====
    function emergencyWithdraw(address _token, uint256 _amount) external onlyOwner {
        IERC20(_token).safeTransfer(adminReserve, _amount);
    }
}
