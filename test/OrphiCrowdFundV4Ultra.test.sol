const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

contract OrphiCrowdFundV4UltraTest {
    OrphiCrowdFundV4Ultra public v4Ultra;
    MockUSDT public mockToken;
    
    address public owner;
    address public admin;
    address public user1;
    address public user2;
    address public user3;
    
    function beforeEach() public {
        // Set up accounts
        owner = address(0x1);
        admin = address(0x2);
        user1 = address(0x3);
        user2 = address(0x4);
        user3 = address(0x5);
        
        // Deploy mock token
        mockToken = new MockUSDT();
        
        // Deploy V4Ultra
        v4Ultra = new OrphiCrowdFundV4Ultra(address(mockToken), admin);
        
        // Fund users
        mockToken.mint(user1, 1000 * 10**6);
        mockToken.mint(user2, 1000 * 10**6);
        mockToken.mint(user3, 1000 * 10**6);
    }
    
    function testRegistration() public {
        // Set KYC status
        v4Ultra.setKYCStatus(user1, true);
        
        // Approve token spend
        uint256 packageAmount = 100 * 10**6; // Tier 1 package
        mockToken.approve(address(v4Ultra), packageAmount);
        
        // Register user1
        v4Ultra.register(address(0), 1); // Register without sponsor
        
        // Verify registration
        (uint32 id, , , uint16 packageTier, , , , , , ) = v4Ultra.getUserInfo(user1);
        assert(id > 0);
        assert(packageTier == 1);
    }
    
    function testChainlinkAutomation() public {
        // Enable automation
        v4Ultra.enableAutomation(true);
        
        // Set up configuration
        v4Ultra.updateAutomationConfig(3000000, 100);
        
        // Check upkeep status
        (bool upkeepNeeded, ) = v4Ultra.checkUpkeep("");
        assert(!upkeepNeeded); // No upkeep needed yet
        
        // Register users to generate pool funds
        v4Ultra.setKYCStatus(user1, true);
        v4Ultra.setKYCStatus(user2, true);
        
        mockToken.approve(address(v4Ultra), 500 * 10**6);
        v4Ultra.register(address(0), 3); // Tier 3 package
        
        mockToken.approve(address(v4Ultra), 500 * 10**6);
        v4Ultra.register(user1, 3); // Tier 3 package with user1 as sponsor
        
        // Fast forward time (simulate 7 days)
        // This would need network helpers in actual test
        
        // Check upkeep after funds added
        (upkeepNeeded, ) = v4Ultra.checkUpkeep("");
        assert(upkeepNeeded); // Upkeep should be needed now
    }
    
    function testClubPool() public {
        // Create club pool
        v4Ultra.createClubPool(7 days);
        
        // Register users
        v4Ultra.setKYCStatus(user1, true);
        v4Ultra.setKYCStatus(user2, true);
        
        mockToken.approve(address(v4Ultra), 500 * 10**6);
        v4Ultra.register(address(0), 3); // Tier 3 package
        
        // Add to club pool
        v4Ultra.addToClubPool();
        
        // Verify club membership
        bool isMember = v4Ultra.clubMembers(user1);
        assert(isMember);
    }
    
    function testEmergencyWithdrawal() public {
        // Register user
        v4Ultra.setKYCStatus(user1, true);
        mockToken.approve(address(v4Ultra), 100 * 10**6);
        v4Ultra.register(address(0), 1);
        
        // Activate emergency mode
        v4Ultra.activateEmergencyMode(500); // 5% fee
        
        // Try emergency withdrawal
        v4Ultra.emergencyWithdraw();
        
        // Check user balance is 0 after withdrawal
        (, , , , , , uint64 withdrawable, , , ) = v4Ultra.getUserInfo(user1);
        assert(withdrawable == 0);
    }
}
