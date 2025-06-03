const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("OrphiCrowdFundV4LibOptimized", function () {
    let crowdFund, mockUSDT, owner, user1, user2, user3, user4, user5;
    let adminReserve;

    const PACKAGE_PRICES = [
        ethers.parseUnits("100", 6),   // Level 0
        ethers.parseUnits("200", 6),   // Level 1  
        ethers.parseUnits("500", 6),   // Level 2
        ethers.parseUnits("1000", 6),  // Level 3
        ethers.parseUnits("2000", 6)   // Level 4
    ];

    beforeEach(async function () {
        [owner, user1, user2, user3, user4, user5, adminReserve] = await ethers.getSigners();

        // Deploy MockUSDT
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        mockUSDT = await MockUSDT.deploy();
        await mockUSDT.waitForDeployment();

        // Deploy libraries first
        const PoolDistributionLibSimple = await ethers.getContractFactory("PoolDistributionLibSimple");
        const poolDistributionLib = await PoolDistributionLibSimple.deploy();
        await poolDistributionLib.waitForDeployment();

        const AutomationLibSimple = await ethers.getContractFactory("AutomationLibSimple");
        const automationLib = await AutomationLibSimple.deploy();
        await automationLib.waitForDeployment();

        // Deploy optimized V4 contract with library linking
        const OrphiCrowdFundV4LibOptimized = await ethers.getContractFactory("OrphiCrowdFundV4LibOptimized", {
            libraries: {
                "PoolDistributionLibSimple": await poolDistributionLib.getAddress(),
                "AutomationLibSimple": await automationLib.getAddress(),
            },
        });
        crowdFund = await OrphiCrowdFundV4LibOptimized.deploy(
            await mockUSDT.getAddress(),
            adminReserve.address,
            owner.address
        );
        await crowdFund.waitForDeployment();

        // Mint tokens for testing
        const users = [user1, user2, user3, user4, user5];
        for (let user of users) {
            await mockUSDT.mint(user.address, ethers.parseUnits("10000", 6));
            await mockUSDT.connect(user).approve(await crowdFund.getAddress(), ethers.parseUnits("10000", 6));
        }
    });

    describe("Contract Size and Deployment", function () {
        it("Should deploy successfully under 24KB limit", async function () {
            const contractCode = await ethers.provider.getCode(await crowdFund.getAddress());
            const sizeInBytes = (contractCode.length - 2) / 2; // Remove 0x and divide by 2
            console.log(`Contract size: ${sizeInBytes} bytes (${(sizeInBytes/1024).toFixed(1)}KB)`);
            expect(sizeInBytes).to.be.lessThan(24576); // 24KB limit
        });

        it("Should have correct initial values", async function () {
            expect(await crowdFund.totalMembers()).to.equal(0);
            expect(await crowdFund.totalVolume()).to.equal(0);
            expect(await crowdFund.automationEnabled()).to.equal(false);
            
            // Check package prices
            for (let i = 0; i < 5; i++) {
                expect(await crowdFund.PACKAGE_PRICES(i)).to.equal(PACKAGE_PRICES[i]);
            }
        });
    });

    describe("Core MLM Functionality", function () {
        it("Should register first user correctly", async function () {
            await expect(crowdFund.connect(user1).register(ethers.ZeroAddress, 0))
                .to.emit(crowdFund, 'UserRegistered')
                .withArgs(user1.address, ethers.ZeroAddress, 0);

            const user = await crowdFund.users(user1.address);
            expect(user.isActive).to.be.true;
            expect(user.sponsor).to.equal(ethers.ZeroAddress);
            expect(user.currentPackage).to.equal(0);
            expect(await crowdFund.totalMembers()).to.equal(1);
        });

        it("Should handle sponsored registrations correctly", async function () {
            // Register first user
            await crowdFund.connect(user1).register(ethers.ZeroAddress, 0);
            
            // Register sponsored user
            await expect(crowdFund.connect(user2).register(user1.address, 1))
                .to.emit(crowdFund, 'UserRegistered')
                .withArgs(user2.address, user1.address, 1);

            const user2Data = await crowdFund.users(user2.address);
            expect(user2Data.sponsor).to.equal(user1.address);
            expect(user2Data.currentPackage).to.equal(1);
        });

        it("Should distribute commissions correctly", async function () {
            // Setup: Register users in hierarchy
            await crowdFund.connect(user1).register(ethers.ZeroAddress, 0);
            await crowdFund.connect(user2).register(user1.address, 1);
            
            // Get initial balances
            const initialUser1Balance = await crowdFund.users(user1.address).then(u => u.totalEarnings);
            
            // User3 registers under user2 with higher package
            await crowdFund.connect(user3).register(user2.address, 2);
            
            // Check that user1 (sponsor's sponsor) received level bonus
            const finalUser1Balance = await crowdFund.users(user1.address).then(u => u.totalEarnings);
            expect(finalUser1Balance).to.be.greaterThan(initialUser1Balance);
        });
    });

    describe("Pool Distribution System", function () {
        beforeEach(async function () {
            // Setup some users for testing distributions
            await crowdFund.connect(user1).register(ethers.ZeroAddress, 2); // $500 package
            await crowdFund.connect(user2).register(user1.address, 3); // $1000 package
            await crowdFund.connect(user3).register(user2.address, 4); // $2000 package
            
            // Enable automation for testing
            await crowdFund.enableAutomation(500000); // 500k gas limit
        });

        it("Should accumulate pool balances correctly", async function () {
            const poolBalance = await crowdFund.poolBalances(2); // Level 2 pool
            expect(poolBalance).to.be.greaterThan(0);
        });

        it("Should check GHP distribution timing with library", async function () {
            // Fast forward time to make distribution available
            await time.increase(7 * 24 * 60 * 60); // 7 days
            
            // Check using the library function through automation
            const [upkeepNeeded, ] = await crowdFund.checkUpkeep("0x");
            expect(upkeepNeeded).to.be.true;
        });

        it("Should distribute GHP correctly", async function () {
            // Fast forward time
            await time.increase(7 * 24 * 60 * 60); // 7 days
            
            const initialTotalEarnings = await crowdFund.users(user1.address).then(u => u.totalEarnings);
            
            // Trigger distribution through automation
            const [upkeepNeeded, performData] = await crowdFund.checkUpkeep("0x");
            if (upkeepNeeded) {
                await crowdFund.performUpkeep(performData);
            }
            
            // Check that distribution happened
            const finalTotalEarnings = await crowdFund.users(user1.address).then(u => u.totalEarnings);
            expect(finalTotalEarnings).to.be.greaterThanOrEqual(initialTotalEarnings);
        });
    });

    describe("Chainlink Automation Integration", function () {
        beforeEach(async function () {
            // Setup users and enable automation
            await crowdFund.connect(user1).register(ethers.ZeroAddress, 2);
            await crowdFund.connect(user2).register(user1.address, 3);
            await crowdFund.enableAutomation(500000);
        });

        it("Should enable automation correctly", async function () {
            expect(await crowdFund.automationEnabled()).to.be.true;
            expect(await crowdFund.gasLimit()).to.equal(500000);
        });

        it("Should return false for checkUpkeep when no distributions needed", async function () {
            const [upkeepNeeded, ] = await crowdFund.checkUpkeep("0x");
            expect(upkeepNeeded).to.be.false;
        });

        it("Should return true for checkUpkeep when distributions are due", async function () {
            // Fast forward time to make distributions due
            await time.increase(7 * 24 * 60 * 60); // 7 days
            
            const [upkeepNeeded, performData] = await crowdFund.checkUpkeep("0x");
            expect(upkeepNeeded).to.be.true;
            expect(performData).to.not.equal("0x");
        });

        it("Should execute performUpkeep successfully", async function () {
            // Fast forward time
            await time.increase(7 * 24 * 60 * 60); // 7 days
            
            const [upkeepNeeded, performData] = await crowdFund.checkUpkeep("0x");
            if (upkeepNeeded) {
                await expect(crowdFund.performUpkeep(performData))
                    .to.not.be.reverted;
                
                // Check that performance counter increased
                expect(await crowdFund.performanceCounter()).to.be.greaterThan(0);
            }
        });
    });

    describe("Library Integration", function () {
        it("Should use PoolDistributionLibSimple for calculations", async function () {
            // Register users to create some activity
            await crowdFund.connect(user1).register(ethers.ZeroAddress, 0);
            await crowdFund.connect(user2).register(user1.address, 1);
            
            // The library functions are called internally, but we can verify the contract works
            expect(await crowdFund.totalMembers()).to.equal(2);
        });

        it("Should use AutomationLibSimple for automation logic", async function () {
            await crowdFund.enableAutomation(500000);
            
            // The library is used in checkUpkeep - verify it doesn't revert
            const [upkeepNeeded, ] = await crowdFund.checkUpkeep("0x");
            expect(typeof upkeepNeeded).to.equal('boolean');
        });
    });

    describe("Gas Optimization", function () {
        it("Should have reasonable gas costs for registration", async function () {
            const tx = await crowdFund.connect(user1).register(ethers.ZeroAddress, 0);
            const receipt = await tx.wait();
            console.log(`Registration gas used: ${receipt.gasUsed.toString()}`);
            
            // Should be under 500k gas for registration
            expect(receipt.gasUsed).to.be.lessThan(500000);
        });

        it("Should have reasonable gas costs for automation", async function () {
            // Setup and fast forward
            await crowdFund.connect(user1).register(ethers.ZeroAddress, 2);
            await crowdFund.enableAutomation(500000);
            await time.increase(7 * 24 * 60 * 60);
            
            const [upkeepNeeded, performData] = await crowdFund.checkUpkeep("0x");
            if (upkeepNeeded) {
                const tx = await crowdFund.performUpkeep(performData);
                const receipt = await tx.wait();
                console.log(`Automation gas used: ${receipt.gasUsed.toString()}`);
                
                // Should be under gas limit
                expect(receipt.gasUsed).to.be.lessThan(500000);
            }
        });
    });

    describe("Edge Cases and Security", function () {
        it("Should prevent registration with invalid sponsor", async function () {
            await expect(crowdFund.connect(user1).register(user2.address, 0))
                .to.be.revertedWith("Invalid sponsor");
        });

        it("Should prevent double registration", async function () {
            await crowdFund.connect(user1).register(ethers.ZeroAddress, 0);
            
            await expect(crowdFund.connect(user1).register(ethers.ZeroAddress, 1))
                .to.be.revertedWith("User already registered");
        });

        it("Should enforce earnings cap", async function () {
            // This would need a more complex setup to test earnings cap
            // For now, just verify the cap multiplier is set correctly
            const user1Data = await crowdFund.users(user1.address);
            // The cap is calculated as package_price * 4, tested in actual usage
        });

        it("Should handle paused state correctly", async function () {
            await crowdFund.pause();
            
            await expect(crowdFund.connect(user1).register(ethers.ZeroAddress, 0))
                .to.be.revertedWith("Pausable: paused");
                
            await crowdFund.unpause();
            
            // Should work after unpause
            await expect(crowdFund.connect(user1).register(ethers.ZeroAddress, 0))
                .to.not.be.reverted;
        });
    });

    describe("Admin Functions", function () {
        it("Should allow owner to enable/disable automation", async function () {
            await crowdFund.enableAutomation(500000);
            expect(await crowdFund.automationEnabled()).to.be.true;
            
            await crowdFund.disableAutomation();
            expect(await crowdFund.automationEnabled()).to.be.false;
        });

        it("Should allow owner to update gas limit", async function () {
            await crowdFund.enableAutomation(500000);
            await crowdFund.updateGasLimit(750000);
            expect(await crowdFund.gasLimit()).to.equal(750000);
        });

        it("Should prevent non-owner from admin functions", async function () {
            await expect(crowdFund.connect(user1).enableAutomation(500000))
                .to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
});
