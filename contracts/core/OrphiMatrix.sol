// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/MatrixLibrary.sol";

/**
 * @title OrphiMatrix
 * @dev Handles 2×∞ matrix placement and tree operations
 * @notice Focused contract for matrix functionality only
 */
contract OrphiMatrix is Ownable, ReentrancyGuard {
    using MatrixLibrary for uint256;
    
    // ===== STRUCTS =====
    struct MatrixNode {
        address user;
        address parent;
        address leftChild;
        address rightChild;
        uint256 position;
        uint256 teamSize;
        uint256 level;
        bool isActive;
    }
    
    // ===== STATE VARIABLES =====
    uint256 public totalNodes;
    address public matrixRoot;
    
    // ===== MAPPINGS =====
    mapping(address => MatrixNode) public matrixNodes;
    mapping(uint256 => address) public positionToAddress;
    mapping(address => bool) public isRegistered;
    mapping(address => uint256) public userTeamSize;
    
    // ===== EVENTS =====
    event MatrixPlacement(
        address indexed user,
        address indexed parent,
        uint256 position,
        bool isLeftChild,
        uint256 level
    );
    event TeamSizeUpdate(address indexed user, uint256 newTeamSize);
    event MatrixNodeActivated(address indexed user, uint256 position);
    event MatrixNodeDeactivated(address indexed user, uint256 position);
    
    // ===== CONSTRUCTOR =====
    constructor(address _matrixRoot, address _initialOwner) Ownable(_initialOwner) {
        require(_matrixRoot != address(0), "Invalid matrix root");
        
        matrixRoot = _matrixRoot;
        totalNodes = 1;
        
        // Initialize root node
        matrixNodes[_matrixRoot] = MatrixNode({
            user: _matrixRoot,
            parent: address(0),
            leftChild: address(0),
            rightChild: address(0),
            position: 1,
            teamSize: 1,
            level: 0,
            isActive: true
        });
        
        positionToAddress[1] = _matrixRoot;
        isRegistered[_matrixRoot] = true;
        userTeamSize[_matrixRoot] = 1;
    }
    
    // ===== EXTERNAL FUNCTIONS =====
    
    /**
     * @dev Place user in matrix under specified sponsor
     * @param user User address to place
     * @param sponsor Sponsor address
     * @return position Matrix position assigned
     */
    function placeInMatrix(address user, address sponsor) 
        external 
        onlyOwner 
        nonReentrant 
        returns (uint256 position) 
    {
        require(
            MatrixLibrary.validateMatrixPlacement(user, sponsor, isRegistered),
            "Invalid matrix placement"
        );
        
        // Find optimal placement position
        address optimalParent = _findOptimalParent(sponsor);
        bool isLeftChild = matrixNodes[optimalParent].leftChild == address(0);
        
        totalNodes++;
        position = totalNodes;
        
        // Create matrix node
        matrixNodes[user] = MatrixNode({
            user: user,
            parent: optimalParent,
            leftChild: address(0),
            rightChild: address(0),
            position: position,
            teamSize: 1,
            level: matrixNodes[optimalParent].level + 1,
            isActive: true
        });
        
        // Update parent's children
        if (isLeftChild) {
            matrixNodes[optimalParent].leftChild = user;
        } else {
            matrixNodes[optimalParent].rightChild = user;
        }
        
        // Update mappings
        positionToAddress[position] = user;
        isRegistered[user] = true;
        userTeamSize[user] = 1;
        
        // Update team sizes up the chain
        _updateTeamSizesUpward(optimalParent);
        
        emit MatrixPlacement(user, optimalParent, position, isLeftChild, matrixNodes[user].level);
        return position;
    }
    
    /**
     * @dev Get comprehensive matrix information for user
     * @param user User address
     * @return node Complete matrix node information
     */
    function getMatrixInfo(address user) external view returns (MatrixNode memory node) {
        return matrixNodes[user];
    }
    
    /**
     * @dev Get user's upline chain
     * @param user User address
     * @param levels Number of levels to retrieve
     * @return upline Array of upline addresses
     */
    function getUplineChain(address user, uint256 levels) 
        external 
        view 
        returns (address[] memory upline) 
    {
        upline = new address[](levels);
        address current = matrixNodes[user].parent;
        
        for (uint256 i = 0; i < levels && current != address(0); i++) {
            upline[i] = current;
            current = matrixNodes[current].parent;
        }
        
        return upline;
    }
    
    /**
     * @dev Get user's downline at specific level
     * @param user User address
     * @param targetLevel Target level depth
     * @return downline Array of downline addresses at that level
     */
    function getDownlineAtLevel(address user, uint256 targetLevel) 
        external 
        view 
        returns (address[] memory downline) 
    {
        uint256 currentLevel = matrixNodes[user].level;
        if (targetLevel <= currentLevel) {
            return new address[](0);
        }
        
        uint256 levelDepth = targetLevel - currentLevel;
        return _getDownlineRecursive(user, levelDepth, 0);
    }
    
    /**
     * @dev Calculate team size for user
     * @param user User address
     * @return teamSize Total team size including user
     */
    function calculateTeamSize(address user) external view returns (uint256 teamSize) {
        // return MatrixLibrary.calculateTeamSize(
        //     user,
        //     _getLeftChildMapping(),
        //     _getRightChildMapping()
        // );
        revert("calculateTeamSize not implemented: mapping workaround required");
    }
    
    /**
     * @dev Activate/deactivate matrix node
     * @param user User address
     * @param active New active status
     */
    function setNodeActive(address user, bool active) external onlyOwner {
        require(isRegistered[user], "User not registered");
        
        matrixNodes[user].isActive = active;
        
        if (active) {
            emit MatrixNodeActivated(user, matrixNodes[user].position);
        } else {
            emit MatrixNodeDeactivated(user, matrixNodes[user].position);
        }
    }
    
    // ===== INTERNAL FUNCTIONS =====
    
    /**
     * @dev Find optimal parent for placement using BFS
     * @param sponsor Starting sponsor address
     * @return optimalParent Best parent for placement
     */
    function _findOptimalParent(address sponsor) internal view returns (address optimalParent) {
        // Start with sponsor
        address[] memory queue = new address[](totalNodes);
        uint256 front = 0;
        uint256 rear = 0;
        
        queue[rear++] = sponsor;
        
        while (front < rear) {
            address current = queue[front++];
            
            // Check if this node has available spots
            if (matrixNodes[current].leftChild == address(0) || 
                matrixNodes[current].rightChild == address(0)) {
                return current;
            }
            
            // Add children to queue
            if (matrixNodes[current].leftChild != address(0) && rear < queue.length) {
                queue[rear++] = matrixNodes[current].leftChild;
            }
            if (matrixNodes[current].rightChild != address(0) && rear < queue.length) {
                queue[rear++] = matrixNodes[current].rightChild;
            }
        }
        
        // Fallback to sponsor
        return sponsor;
    }
    
    /**
     * @dev Update team sizes up the sponsor chain
     * @param startUser Starting user address
     */
    function _updateTeamSizesUpward(address startUser) internal {
        address current = startUser;
        
        while (current != address(0)) {
            uint256 newTeamSize = 1 + 
                _getSubtreeSize(matrixNodes[current].leftChild) +
                _getSubtreeSize(matrixNodes[current].rightChild);
            
            matrixNodes[current].teamSize = newTeamSize;
            userTeamSize[current] = newTeamSize;
            
            emit TeamSizeUpdate(current, newTeamSize);
            
            current = matrixNodes[current].parent;
        }
    }
    
    /**
     * @dev Get subtree size recursively
     * @param user User address (root of subtree)
     * @return size Size of subtree
     */
    function _getSubtreeSize(address user) internal view returns (uint256 size) {
        if (user == address(0)) return 0;
        
        return 1 + 
            _getSubtreeSize(matrixNodes[user].leftChild) +
            _getSubtreeSize(matrixNodes[user].rightChild);
    }
    
    /**
     * @dev Get downline recursively at specific level
     * @param user Current user
     * @param targetDepth Target depth to reach
     * @param currentDepth Current depth
     * @return downline Array of addresses at target level
     */
    function _getDownlineRecursive(
        address user, 
        uint256 targetDepth, 
        uint256 currentDepth
    ) internal view returns (address[] memory downline) {
        if (user == address(0)) {
            return new address[](0);
        }
        
        if (currentDepth == targetDepth) {
            address[] memory result = new address[](1);
            result[0] = user;
            return result;
        }
        
        // Get downlines from both children
        address[] memory leftDownline = _getDownlineRecursive(
            matrixNodes[user].leftChild, 
            targetDepth, 
            currentDepth + 1
        );
        address[] memory rightDownline = _getDownlineRecursive(
            matrixNodes[user].rightChild, 
            targetDepth, 
            currentDepth + 1
        );
        
        // Combine results
        address[] memory combined = new address[](leftDownline.length + rightDownline.length);
        
        for (uint256 i = 0; i < leftDownline.length; i++) {
            combined[i] = leftDownline[i];
        }
        for (uint256 i = 0; i < rightDownline.length; i++) {
            combined[leftDownline.length + i] = rightDownline[i];
        }
        
        return combined;
    }
    
    /**
     * @dev Helper to get left child mapping for library
     */
    // function _getLeftChildMapping() internal view returns (mapping(address => address) storage) {
    //     // This is a workaround for library compatibility
    //     // In practice, we'd pass the mapping directly
    //     mapping(address => address) storage leftChildren;
    //     assembly {
    //         leftChildren.slot := 0 // This would be handled differently in practice
    //     }
    //     return leftChildren;
    // }
    /**
     * @dev Helper to get right child mapping for library
     */
    // function _getRightChildMapping() internal view returns (mapping(address => address) storage) {
    //     // This is a workaround for library compatibility
    //     mapping(address => address) storage rightChildren;
    //     assembly {
    //         rightChildren.slot := 0 // This would be handled differently in practice
    //     }
    //     return rightChildren;
    // }
    
    // ===== VIEW FUNCTIONS =====
    
    /**
     * @dev Get matrix statistics
     * @return totalNodes_ Total number of nodes
     * @return activeNodes Total active nodes
     * @return maxLevel Deepest level in matrix
     */
    function getMatrixStats() external view returns (
        uint256 totalNodes_,
        uint256 activeNodes,
        uint256 maxLevel
    ) {
        totalNodes_ = totalNodes;
        
        // Calculate active nodes and max level
        for (uint256 i = 1; i <= totalNodes; i++) {
            address user = positionToAddress[i];
            if (user != address(0) && matrixNodes[user].isActive) {
                activeNodes++;
                if (matrixNodes[user].level > maxLevel) {
                    maxLevel = matrixNodes[user].level;
                }
            }
        }
    }
    
    /**
     * @dev Check if user is registered in matrix
     * @param user User address
     * @return registered True if user is registered
     */
    function isUserRegistered(address user) external view returns (bool registered) {
        return isRegistered[user];
    }
    
    /**
     * @dev Get team size for user
     * @param user User address
     * @return teamSize User's team size
     */
    function getTeamSize(address user) external view returns (uint256 teamSize) {
        return userTeamSize[user];
    }
}
