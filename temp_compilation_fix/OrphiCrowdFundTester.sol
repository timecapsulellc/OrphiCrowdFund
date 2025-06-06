// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../../OrphiCrowdFundV2.sol";

/**
 * @title OrphiCrowdFundTester
 * @dev Test contract that exposes internal functions for testing
 */
contract OrphiCrowdFundTester is OrphiCrowdFundV2 {
    function testUpdateLeaderRank(address _user, uint32 teamSize, uint32 directCount) external {
        users[_user].teamSize = teamSize;
        users[_user].directSponsorsCount = directCount;
        // _updateLeaderRankEnhanced(_user); // Removed: function not present in V2
    }
    
    function testCreditEarnings(address _user, uint256 _amount, uint8 _poolType) external {
        _creditEarningsEnhanced(_user, _amount, _poolType);
    }
    
    function testManuallyAddToPool(uint8 _poolType, uint256 _amount) external {
        require(_poolType < 5, "Invalid pool type");
        require(_amount <= type(uint128).max, "Amount too large");
        poolBalances[_poolType] += uint128(_amount);
    }
    
    function getLeaderRank(address _user) external view returns (LeaderRank) {
        return users[_user].leaderRank;
    }
    
    function setIsCapped(address _user, bool _isCapped) external {
        users[_user].isCapped = _isCapped;
    }
    
    function setLastActivity(address _user, uint64 _timestamp) external {
        users[_user].lastActivity = _timestamp;
    }
}
