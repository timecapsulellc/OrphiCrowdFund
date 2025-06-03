// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title MatrixLibrary
 * @dev Pure computational functions for 2×∞ matrix operations
 * @notice Optimized for gas efficiency and contract size
 */
library MatrixLibrary {
    
    /**
     * @dev Calculate optimal matrix position using BFS algorithm
     * @param totalMembers Current total number of members
     * @param targetSponsor The sponsor under whom to place the user
     * @return position The calculated matrix position
     */
    function calculateMatrixPosition(
        uint256 totalMembers,
        address targetSponsor,
        mapping(uint256 => address) storage userIdToAddress,
        mapping(address => address) storage leftChild,
        mapping(address => address) storage rightChild
    ) external view returns (uint256 position) {
        // Start BFS from target sponsor
        address[] memory queue = new address[](totalMembers + 1);
        uint256 front = 0;
        uint256 rear = 0;
        
        queue[rear++] = targetSponsor;
        
        while (front < rear) {
            address current = queue[front++];
            
            // Check if left position is available
            if (leftChild[current] == address(0)) {
                return _getPositionId(current, true); // Left position
            }
            
            // Check if right position is available
            if (rightChild[current] == address(0)) {
                return _getPositionId(current, false); // Right position
            }
            
            // Add children to queue for next level
            if (leftChild[current] != address(0) && rear < queue.length) {
                queue[rear++] = leftChild[current];
            }
            if (rightChild[current] != address(0) && rear < queue.length) {
                queue[rear++] = rightChild[current];
            }
        }
        
        // Fallback to sponsor if no position found
        return _getPositionId(targetSponsor, true);
    }
    
    /**
     * @dev Calculate team size for a user
     * @param user The user address
     * @param leftChild Mapping of left children
     * @param rightChild Mapping of right children
     * @return teamSize Total team size including user
     */
    function calculateTeamSize(
        address user,
        mapping(address => address) storage leftChild,
        mapping(address => address) storage rightChild
    ) internal view returns (uint256 teamSize) {
        if (user == address(0)) return 0;
        
        teamSize = 1; // Count the user
        
        // Add left subtree
        teamSize += calculateTeamSize(leftChild[user], leftChild, rightChild);
        
        // Add right subtree
        teamSize += calculateTeamSize(rightChild[user], leftChild, rightChild);
        
        return teamSize;
    }

    /**
     * @dev Public wrapper for calculateTeamSize
     */
    function getTeamSize(
        address user,
        mapping(address => address) storage leftChild,
        mapping(address => address) storage rightChild
    ) external view returns (uint256) {
        return calculateTeamSize(user, leftChild, rightChild);
    }
    
    /**
     * @dev Determine leadership level based on team size and direct sponsors
     * @param teamSize Total team size
     * @param directSponsors Number of direct sponsors
     * @return level Leadership level (0=none, 1=silver, 2=shining)
     */
    function calculateLeadershipLevel(
        uint256 teamSize,
        uint256 directSponsors
    ) external pure returns (uint8 level) {
        if (teamSize >= 500) {
            return 2; // Shining Star
        } else if (teamSize >= 250 && directSponsors >= 10) {
            return 1; // Silver Star
        }
        return 0; // No leadership level
    }
    
    /**
     * @dev Check if user qualifies for package upgrade
     * @param currentLevel Current package level
     * @param teamSize Current team size
     * @return newLevel New package level (0 if no upgrade)
     */
    function checkPackageUpgrade(
        uint256 currentLevel,
        uint256 teamSize
    ) external pure returns (uint256 newLevel) {
        if (teamSize >= 32768 && currentLevel < 5) return 5;
        if (teamSize >= 2048 && currentLevel < 4) return 4;
        if (teamSize >= 256 && currentLevel < 3) return 3;
        if (teamSize >= 128 && currentLevel < 2) return 2;
        return currentLevel; // No upgrade
    }
    
    /**
     * @dev Internal function to generate position ID
     */
    function _getPositionId(address parent, bool isLeft) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(parent, isLeft))) % 1000000;
    }
    
    /**
     * @dev Validate matrix placement parameters
     * @param user User address
     * @param sponsor Sponsor address
     * @param isRegistered Mapping to check if addresses are registered
     * @return isValid True if placement is valid
     */
    function validateMatrixPlacement(
        address user,
        address sponsor,
        mapping(address => bool) storage isRegistered
    ) external view returns (bool isValid) {
        if (user == address(0) || sponsor == address(0)) return false;
        if (user == sponsor) return false;
        if (!isRegistered[sponsor]) return false;
        if (isRegistered[user]) return false;
        return true;
    }
}
