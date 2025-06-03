// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IOrphiMatrix
 * @dev Interface for Orphi matrix management contracts
 */
interface IOrphiMatrix {
    // ===== STRUCTS =====
    struct MatrixInfo {
        address leftChild;
        address rightChild;
        address sponsor;
        address matrixParent;
        uint256 matrixPosition;
        uint256 level;
        bool isPlaced;
        uint256 placementTime;
    }

    struct TeamInfo {
        uint32 teamSize;
        uint32 leftTeamSize;
        uint32 rightTeamSize;
        uint32 directSponsorsCount;
        uint32 maxLevel;
        uint256 lastUpdate;
    }

    // ===== EVENTS =====
    event UserPlaced(
        address indexed user,
        address indexed sponsor,
        address indexed matrixParent,
        uint256 matrixPosition,
        bool isLeftChild,
        uint256 timestamp
    );

    event TeamSizeUpdated(
        address indexed user,
        uint32 oldTeamSize,
        uint32 newTeamSize,
        uint32 level,
        uint256 timestamp
    );

    event MatrixOverflow(
        address indexed user,
        address indexed originalSponsor,
        address indexed newMatrixParent,
        uint256 timestamp
    );

    event MatrixRebalanced(
        address indexed rootUser,
        uint256 nodesAffected,
        uint256 timestamp
    );

    // ===== MATRIX MANAGEMENT =====
    function addUser(address _user, address _sponsor) external;
    
    function updateTeamSizes(address _user) external;
    
    function findOptimalPlacement(address _sponsor) external view returns (address);

    // ===== MATRIX QUERIES =====
    function getMatrixInfo(address _user) external view returns (MatrixInfo memory);
    
    function getTeamInfo(address _user) external view returns (TeamInfo memory);
    
    function getMatrixPath(address _user) external view returns (address[] memory);
    
    function getDirectChildren(address _user) external view returns (address[] memory);
    
    function getTeamMembers(address _user, uint256 _levels) external view returns (address[] memory);

    // ===== MATRIX VALIDATION =====
    function isValidPlacement(address _user, address _sponsor) external view returns (bool);
    
    function canPlaceUser(address _sponsor) external view returns (bool);
    
    function getNextAvailablePosition(address _sponsor) external view returns (address parent, bool isLeft);

    // ===== MATRIX ANALYTICS =====
    function calculateTeamVolume(address _user, uint256 _levels) external view returns (uint256);
    
    function getMatrixDepth(address _user) external view returns (uint256);
    
    function getMatrixStats() external view returns (
        uint256 totalNodes,
        uint256 maxDepth,
        uint256 avgTeamSize,
        uint256 lastUpdate
    );

    // ===== ADVANCED FEATURES =====
    function rebalanceMatrix(address _rootUser) external;
    
    function simulatePlacement(address _sponsor) external view returns (
        address parent,
        uint256 position,
        uint256 estimatedTeamGrowth
    );

    function getUplineChain(address _user, uint256 _levels) external view returns (address[] memory);
    
    function getDownlineTree(address _user, uint256 _maxDepth) external view returns (
        address[] memory users,
        uint256[] memory levels
    );
}
