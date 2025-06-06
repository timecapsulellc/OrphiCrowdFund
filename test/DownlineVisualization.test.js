const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DownlineVisualization", function () {
    let downlineVisualization;
    let owner, user1, user2, user3, user4, user5;
    let mockUSDT;
    let usdt;
    let matrixRoot;
    let users = [];

    beforeEach(async function () {
        [owner, user1, user2, user3, user4, user5] = await ethers.getSigners();

        // Deploy mock USDT token
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        mockUSDT = await MockUSDT.deploy("Mock USDT", "USDT", 18);
        await mockUSDT.waitForDeployment();

        // Deploy DownlineVisualization contract
        const DownlineVisualization = await ethers.getContractFactory("DownlineVisualization");
        downlineVisualization = await DownlineVisualization.deploy(
            await mockUSDT.getAddress(),
            owner.address // Initial admin
        );
        await downlineVisualization.waitForDeployment();

        // Setup initial user structure for testing
        await setupTestNetwork();
    });

    async function setupTestNetwork() {
        // Mint USDT for test users
        const amount = ethers.parseEther("1000");
        await mockUSDT.mint(user1.address, amount);
        await mockUSDT.mint(user2.address, amount);
        await mockUSDT.mint(user3.address, amount);
        await mockUSDT.mint(user4.address, amount);
        await mockUSDT.mint(user5.address, amount);

        // Approve contract to spend USDT
        await mockUSDT.connect(user1).approve(await downlineVisualization.getAddress(), amount);
        await mockUSDT.connect(user2).approve(await downlineVisualization.getAddress(), amount);
        await mockUSDT.connect(user3).approve(await downlineVisualization.getAddress(), amount);
        await mockUSDT.connect(user4).approve(await downlineVisualization.getAddress(), amount);
        await mockUSDT.connect(user5).approve(await downlineVisualization.getAddress(), amount);

        // Register users in a hierarchy: owner -> user1 -> user2 -> user3, user4
        //                                    -> user5
        await downlineVisualization.connect(user1).register(owner.address, 2); // Package 50
        await downlineVisualization.connect(user2).register(user1.address, 2);
        await downlineVisualization.connect(user3).register(user2.address, 1); // Package 30
        await downlineVisualization.connect(user4).register(user2.address, 3); // Package 100
        await downlineVisualization.connect(user5).register(user1.address, 2);
    }

    describe("Network Visualization Data", function () {
        it("Should return complete downline visualization data", async function () {
            const vizData = await downlineVisualization.getDownlineVisualizationData(user1.address, 3);

            expect(vizData.rootUser).to.equal(user1.address);
            expect(vizData.totalMembers).to.be.greaterThan(0);
            expect(vizData.nodes.length).to.be.greaterThan(0);
            expect(vizData.connections.length).to.be.greaterThan(0);
            expect(vizData.maxDepth).to.be.at.least(1);

            // Check node structure
            const firstNode = vizData.nodes[0];
            expect(firstNode.userAddress).to.be.properAddress;
            expect(firstNode.level).to.be.a("number");
            expect(firstNode.isActive).to.be.a("boolean");
        });

        it("Should respect depth limits", async function () {
            const shallowData = await downlineVisualization.getDownlineVisualizationData(user1.address, 1);
            const deepData = await downlineVisualization.getDownlineVisualizationData(user1.address, 5);

            expect(shallowData.maxDepth).to.be.at.most(1);
            expect(shallowData.nodes.length).to.be.at.most(deepData.nodes.length);
        });

        it("Should include accurate connection data", async function () {
            const vizData = await downlineVisualization.getDownlineVisualizationData(user1.address, 3);

            // Find connection from user1 to user2
            const connection = vizData.connections.find(conn => 
                conn.from === user1.address && conn.to === user2.address
            );

            expect(connection).to.not.be.undefined;
            expect(connection.weight).to.be.greaterThan(0);
            expect(connection.establishedDate).to.be.greaterThan(0);
        });
    });

    describe("Team Analytics", function () {
        it("Should calculate team analytics correctly", async function () {
            const analytics = await downlineVisualization.getTeamAnalytics(user1.address);

            expect(analytics.totalTeamSize).to.be.greaterThan(0);
            expect(analytics.activeMembers).to.be.at.most(analytics.totalTeamSize);
            expect(analytics.levelDistribution.length).to.be.greaterThan(0);
            expect(analytics.topPerformers.length).to.be.at.most(10);
        });

        it("Should track 30-day metrics", async function () {
            const analytics = await downlineVisualization.getTeamAnalytics(user1.address);

            expect(analytics.newMembersLast30).to.be.a("number");
            expect(analytics.teamVolume30d).to.be.a("number");
            expect(analytics.teamEarnings30d).to.be.a("number");
        });

        it("Should identify top performers", async function () {
            const analytics = await downlineVisualization.getTeamAnalytics(user1.address);

            if (analytics.topPerformers.length > 0) {
                expect(analytics.topPerformers[0]).to.be.properAddress;
                expect(analytics.performerVolumes.length).to.equal(analytics.topPerformers.length);
            }
        });
    });

    describe("Network Metrics", function () {
        it("Should calculate network metrics accurately", async function () {
            const metrics = await downlineVisualization.getUserNetworkMetrics(user1.address);

            expect(metrics.networkDepth).to.be.greaterThan(0);
            expect(metrics.networkWidth).to.be.greaterThan(0);
            expect(metrics.networkDensity).to.be.at.most(100); // Percentage
            expect(metrics.leadershipIndex).to.be.a("number");
        });

        it("Should calculate growth and retention rates", async function () {
            const metrics = await downlineVisualization.getUserNetworkMetrics(user1.address);

            expect(metrics.growthRate30d).to.be.a("number");
            expect(metrics.retentionRate).to.be.at.most(100); // Percentage
        });
    });

    describe("Sponsor Chain", function () {
        it("Should return correct sponsor chain", async function () {
            const chain = await downlineVisualization.getSponsorChain(user3.address);

            expect(chain.length).to.be.greaterThan(0);
            expect(chain).to.include(user2.address); // user3's direct sponsor
            expect(chain).to.include(user1.address); // user2's sponsor
        });

        it("Should handle root user correctly", async function () {
            const chain = await downlineVisualization.getSponsorChain(owner.address);
            expect(chain.length).to.equal(0); // Owner has no sponsors
        });
    });

    describe("Direct Referrals", function () {
        it("Should return detailed referral information", async function () {
            const referrals = await downlineVisualization.getDirectReferralsDetailed(user1.address);

            expect(referrals.length).to.be.greaterThan(0);

            if (referrals.length > 0) {
                const referral = referrals[0];
                expect(referral.userAddress).to.be.properAddress;
                expect(referral.joinDate).to.be.greaterThan(0);
                expect(referral.packageTier).to.be.within(1, 4);
                expect(referral.isActive).to.be.a("boolean");
            }
        });

        it("Should match direct referrals count", async function () {
            const referrals = await downlineVisualization.getDirectReferralsDetailed(user1.address);
            const userInfo = await downlineVisualization.getUserInfoEnhanced(user1.address);

            expect(referrals.length).to.equal(Number(userInfo.directReferrals));
        });
    });

    describe("Error Handling", function () {
        it("Should revert for unregistered users", async function () {
            const unregisteredUser = ethers.Wallet.createRandom();
            
            await expect(
                downlineVisualization.getDownlineVisualizationData(unregisteredUser.address, 3)
            ).to.be.revertedWith("User not registered");

            await expect(
                downlineVisualization.getTeamAnalytics(unregisteredUser.address)
            ).to.be.revertedWith("User not registered");
        });

        it("Should handle invalid depth gracefully", async function () {
            await expect(
                downlineVisualization.getDownlineVisualizationData(user1.address, 0)
            ).to.be.revertedWith("Invalid depth");

            await expect(
                downlineVisualization.getDownlineVisualizationData(user1.address, 21)
            ).to.be.revertedWith("Depth too large");
        });
    });

    describe("Gas Efficiency", function () {
        it("Should use reasonable gas for visualization data", async function () {
            const tx = await downlineVisualization.getDownlineVisualizationData.staticCall(
                user1.address, 
                3
            );

            // This is a view function, so we're mainly checking it doesn't revert
            expect(tx).to.be.ok;
        });

        it("Should efficiently handle large networks", async function () {
            // Test with maximum reasonable depth
            const tx = await downlineVisualization.getDownlineVisualizationData.staticCall(
                user1.address, 
                10
            );

            expect(tx).to.be.ok;
        });
    });

    describe("Data Consistency", function () {
        it("Should maintain consistency between different endpoints", async function () {
            const vizData = await downlineVisualization.getDownlineVisualizationData(user1.address, 5);
            const analytics = await downlineVisualization.getTeamAnalytics(user1.address);
            const userInfo = await downlineVisualization.getUserInfoEnhanced(user1.address);

            // Team size should be consistent
            expect(Number(userInfo.teamSize)).to.equal(Number(analytics.totalTeamSize));
            
            // Visualization should include the team
            expect(vizData.totalMembers).to.be.at.least(Number(analytics.totalTeamSize));
        });

        it("Should have accurate connection counts", async function () {
            const vizData = await downlineVisualization.getDownlineVisualizationData(user1.address, 5);

            // Each connection should have valid addresses
            for (const connection of vizData.connections) {
                expect(connection.from).to.be.properAddress;
                expect(connection.to).to.be.properAddress;
                expect(connection.from).to.not.equal(connection.to);
            }
        });
    });

    describe("Events and Monitoring", function () {
        it("Should emit NetworkAnalysisRequested event", async function () {
            await expect(
                downlineVisualization.getDownlineVisualizationData(user1.address, 3)
            ).to.emit(downlineVisualization, "NetworkAnalysisRequested")
             .withArgs(user1.address, 3, anyValue);
        });

        it("Should emit TeamAnalyticsGenerated event", async function () {
            await expect(
                downlineVisualization.getTeamAnalytics(user1.address)
            ).to.emit(downlineVisualization, "TeamAnalyticsGenerated")
             .withArgs(user1.address, anyValue, anyValue);
        });
    });

    // Variables moved to top of file to avoid duplication

    const PackageTier = {
        PACKAGE_50: 1,
        PACKAGE_75: 2,
        PACKAGE_100: 3,
        PACKAGE_150: 4,
        PACKAGE_250: 5,
        PACKAGE_350: 6
    };

    const PACKAGE_AMOUNTS = {
        [PackageTier.PACKAGE_50]: ethers.parseEther("50"),
        [PackageTier.PACKAGE_75]: ethers.parseEther("75"),
        [PackageTier.PACKAGE_100]: ethers.parseEther("100"),
        [PackageTier.PACKAGE_150]: ethers.parseEther("150"),
        [PackageTier.PACKAGE_250]: ethers.parseEther("250"),
        [PackageTier.PACKAGE_350]: ethers.parseEther("350")
    };

    beforeEach(async function () {
        [matrixRoot, user1, user2, user3, user4, user5, ...users] = await ethers.getSigners();

        // Deploy mock USDT
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        usdt = await MockUSDT.deploy();
        await usdt.waitForDeployment();

        // Deploy DownlineVisualization
        const DownlineVisualization = await ethers.getContractFactory("DownlineVisualization");
        downlineVisualization = await DownlineVisualization.deploy();
        await downlineVisualization.waitForDeployment();

        // Initialize contract
        await downlineVisualization.initialize(
            await usdt.getAddress(),
            matrixRoot.address,
            matrixRoot.address // Admin reserve
        );

        // Setup initial USDT balances and approvals
        const testAmount = ethers.parseEther("10000");
        
        for (const user of [matrixRoot, user1, user2, user3, user4, user5, ...users.slice(0, 20)]) {
            await usdt.mint(user.address, testAmount);
            await usdt.connect(user).approve(await downlineVisualization.getAddress(), testAmount);
        }

        // Register matrix root
        await downlineVisualization.connect(matrixRoot).registerUser(
            ethers.ZeroAddress, 
            PackageTier.PACKAGE_350
        );
    });

    describe("Network Visualization Data", function () {
        beforeEach(async function () {
            // Create a test network structure
            // Level 1: user1, user2 under matrixRoot
            await downlineVisualization.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_100);
            await downlineVisualization.connect(user2).registerUser(matrixRoot.address, PackageTier.PACKAGE_150);
            
            // Level 2: user3, user4 under user1; user5, users[0] under user2
            await downlineVisualization.connect(user3).registerUser(user1.address, PackageTier.PACKAGE_75);
            await downlineVisualization.connect(user4).registerUser(user1.address, PackageTier.PACKAGE_100);
            await downlineVisualization.connect(user5).registerUser(user2.address, PackageTier.PACKAGE_50);
            await downlineVisualization.connect(users[0]).registerUser(user2.address, PackageTier.PACKAGE_75);
            
            // Level 3: Add some users under level 2
            await downlineVisualization.connect(users[1]).registerUser(user3.address, PackageTier.PACKAGE_50);
            await downlineVisualization.connect(users[2]).registerUser(user3.address, PackageTier.PACKAGE_75);
        });

        it("Should return comprehensive downline visualization data", async function () {
            const vizData = await downlineVisualization.getDownlineVisualizationData(matrixRoot.address, 3);
            
            expect(vizData.rootUser).to.equal(matrixRoot.address);
            expect(vizData.totalMembers).to.be.greaterThan(1);
            expect(vizData.totalVolume).to.be.greaterThan(0);
            expect(vizData.activeMembersCount).to.be.greaterThan(0);
            expect(vizData.maxDepth).to.be.greaterThan(0);
            
            // Check nodes structure
            expect(vizData.nodes.length).to.be.greaterThan(0);
            expect(vizData.nodes[0].userAddress).to.equal(matrixRoot.address);
            expect(vizData.nodes[0].level).to.equal(0);
            
            // Check connections
            expect(vizData.connections.length).to.be.greaterThan(0);
            expect(vizData.connections[0].from).to.not.equal(ethers.ZeroAddress);
            expect(vizData.connections[0].to).to.not.equal(ethers.ZeroAddress);
        });

        it("Should respect depth limit in visualization data", async function () {
            const depth2Data = await downlineVisualization.getDownlineVisualizationData(matrixRoot.address, 2);
            const depth3Data = await downlineVisualization.getDownlineVisualizationData(matrixRoot.address, 3);
            
            expect(depth2Data.maxDepth).to.be.lessThanOrEqual(2);
            expect(depth3Data.maxDepth).to.be.lessThanOrEqual(3);
            expect(depth3Data.totalMembers).to.be.greaterThanOrEqual(depth2Data.totalMembers);
        });

        it("Should provide accurate node information", async function () {
            const vizData = await downlineVisualization.getDownlineVisualizationData(user1.address, 2);
            
            // Find user1's node (should be root in this query)
            const user1Node = vizData.nodes.find(node => node.userAddress === user1.address);
            expect(user1Node).to.not.be.undefined;
            expect(user1Node.level).to.equal(0);
            expect(user1Node.directReferrals).to.equal(2); // user3, user4
            expect(user1Node.packageTier).to.equal(PackageTier.PACKAGE_100);
            
            // Check team size calculation
            expect(user1Node.teamSize).to.be.greaterThanOrEqual(4); // user3, user4, users[1], users[2]
        });

        it("Should track active vs inactive users correctly", async function () {
            const vizData = await downlineVisualization.getDownlineVisualizationData(matrixRoot.address, 3);
            
            // All newly registered users should be active
            const activeNodes = vizData.nodes.filter(node => node.isActive);
            expect(activeNodes.length).to.equal(vizData.activeMembersCount);
            expect(vizData.activeMembersCount).to.be.greaterThan(0);
        });

        it("Should handle edge weights and establishment dates", async function () {
            const vizData = await downlineVisualization.getDownlineVisualizationData(matrixRoot.address, 2);
            
            expect(vizData.connections.length).to.be.greaterThan(0);
            
            for (const edge of vizData.connections) {
                expect(edge.weight).to.be.greaterThan(0); // Should have investment volume
                expect(edge.establishedDate).to.be.greaterThan(0); // Should have registration timestamp
                expect(edge.packageTier).to.be.greaterThan(0); // Should have valid package tier
            }
        });
    });

    describe("Team Analytics", function () {
        beforeEach(async function () {
            // Create a larger test network for analytics
            const testUsers = [user1, user2, user3, user4, user5, ...users.slice(0, 15)];
            
            // Register users with varied packages and timing
            for (let i = 0; i < testUsers.length; i++) {
                const user = testUsers[i];
                const sponsor = i === 0 ? matrixRoot.address : testUsers[Math.floor(i/2)].address;
                const packageTier = (i % 3) + 1; // Vary package tiers
                
                await downlineVisualization.connect(user).registerUser(sponsor, packageTier);
            }
        });

        it("Should return comprehensive team analytics", async function () {
            const analytics = await downlineVisualization.getTeamAnalytics(matrixRoot.address);
            
            expect(analytics.totalTeamSize).to.be.greaterThan(0);
            expect(analytics.activeMembers).to.be.greaterThan(0);
            expect(analytics.activeMembers).to.be.lessThanOrEqual(analytics.totalTeamSize);
            
            // Level distribution should have data
            expect(analytics.levelDistribution.length).to.equal(10);
            expect(analytics.levelDistribution[0]).to.be.greaterThan(0); // Level 0 should have at least root
            
            // Daily activity should be array of 30 elements
            expect(analytics.dailyActivity.length).to.equal(30);
            
            // Top performers should be limited to 10
            expect(analytics.topPerformers.length).to.be.lessThanOrEqual(10);
            expect(analytics.performerVolumes.length).to.equal(analytics.topPerformers.length);
        });

        it("Should calculate team metrics accurately for sub-teams", async function () {
            const user1Analytics = await downlineVisualization.getTeamAnalytics(user1.address);
            const user2Analytics = await downlineVisualization.getTeamAnalytics(user2.address);
            
            // user1 should have a team (registered some users under them)
            expect(user1Analytics.totalTeamSize).to.be.greaterThan(0);
            expect(user2Analytics.totalTeamSize).to.be.greaterThan(0);
            
            // Each should have some active members
            expect(user1Analytics.activeMembers).to.be.greaterThan(0);
            expect(user2Analytics.activeMembers).to.be.greaterThan(0);
        });

        it("Should handle empty teams gracefully", async function () {
            // Register a new user with no team
            await downlineVisualization.connect(users[19]).registerUser(matrixRoot.address, PackageTier.PACKAGE_50);
            
            const analytics = await downlineVisualization.getTeamAnalytics(users[19].address);
            
            expect(analytics.totalTeamSize).to.equal(0);
            expect(analytics.activeMembers).to.equal(0);
            expect(analytics.newMembersLast30).to.equal(0);
        });
    });

    describe("Network Metrics", function () {
        beforeEach(async function () {
            // Create a deep network for metrics testing
            const testUsers = [user1, user2, user3, user4, user5, ...users.slice(0, 10)];
            
            // Create a chain: matrixRoot -> user1 -> user2 -> user3 -> user4 -> user5
            await downlineVisualization.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_100);
            await downlineVisualization.connect(user2).registerUser(user1.address, PackageTier.PACKAGE_100);
            await downlineVisualization.connect(user3).registerUser(user2.address, PackageTier.PACKAGE_100);
            await downlineVisualization.connect(user4).registerUser(user3.address, PackageTier.PACKAGE_100);
            await downlineVisualization.connect(user5).registerUser(user4.address, PackageTier.PACKAGE_100);
            
            // Add some width to the network
            for (let i = 0; i < 5; i++) {
                await downlineVisualization.connect(users[i]).registerUser(user1.address, PackageTier.PACKAGE_75);
            }
        });

        it("Should calculate network depth correctly", async function () {
            const metrics = await downlineVisualization.getUserNetworkMetrics(matrixRoot.address);
            
            expect(metrics.networkDepth).to.be.greaterThan(0);
            expect(metrics.networkWidth).to.be.greaterThan(0);
            expect(metrics.networkDensity).to.be.greaterThan(0);
            expect(metrics.networkDensity).to.be.lessThanOrEqual(10000); // Should be in basis points
        });

        it("Should calculate leadership index based on team and rank", async function () {
            const metrics = await downlineVisualization.getUserNetworkMetrics(matrixRoot.address);
            
            expect(metrics.leadershipIndex).to.be.greaterThan(0);
            expect(metrics.averageTeamSize).to.be.greaterThanOrEqual(0);
            expect(metrics.growthRate30d).to.be.greaterThanOrEqual(0);
            expect(metrics.retentionRate).to.be.greaterThan(0);
            expect(metrics.retentionRate).to.be.lessThanOrEqual(10000); // Should be in basis points
        });

        it("Should handle metrics for users with no team", async function () {
            await downlineVisualization.connect(users[15]).registerUser(matrixRoot.address, PackageTier.PACKAGE_50);
            
            const metrics = await downlineVisualization.getUserNetworkMetrics(users[15].address);
            
            expect(metrics.networkDepth).to.equal(0);
            expect(metrics.networkWidth).to.equal(0);
            expect(metrics.averageTeamSize).to.equal(0);
        });
    });

    describe("Sponsor Chain and Direct Referrals", function () {
        beforeEach(async function () {
            // Create a sponsor chain: matrixRoot -> user1 -> user2 -> user3 -> user4
            await downlineVisualization.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_100);
            await downlineVisualization.connect(user2).registerUser(user1.address, PackageTier.PACKAGE_100);
            await downlineVisualization.connect(user3).registerUser(user2.address, PackageTier.PACKAGE_100);
            await downlineVisualization.connect(user4).registerUser(user3.address, PackageTier.PACKAGE_100);
            
            // Add direct referrals to user1
            await downlineVisualization.connect(user5).registerUser(user1.address, PackageTier.PACKAGE_75);
            await downlineVisualization.connect(users[0]).registerUser(user1.address, PackageTier.PACKAGE_50);
        });

        it("Should return correct sponsor chain", async function () {
            const sponsorChain = await downlineVisualization.getSponsorChain(user4.address, 10);
            
            expect(sponsorChain.length).to.equal(4);
            expect(sponsorChain[0]).to.equal(user3.address);
            expect(sponsorChain[1]).to.equal(user2.address);
            expect(sponsorChain[2]).to.equal(user1.address);
            expect(sponsorChain[3]).to.equal(matrixRoot.address);
        });

        it("Should respect max depth in sponsor chain", async function () {
            const shortChain = await downlineVisualization.getSponsorChain(user4.address, 2);
            
            expect(shortChain.length).to.equal(2);
            expect(shortChain[0]).to.equal(user3.address);
            expect(shortChain[1]).to.equal(user2.address);
        });

        it("Should return detailed direct referrals", async function () {
            const directReferrals = await downlineVisualization.getDirectReferralsDetailed(user1.address);
            
            expect(directReferrals.length).to.equal(3); // user2, user5, users[0]
            
            // Check if all returned addresses are actually direct referrals
            const referralAddresses = directReferrals.map(ref => ref.userAddress);
            expect(referralAddresses).to.include(user2.address);
            expect(referralAddresses).to.include(user5.address);
            expect(referralAddresses).to.include(users[0].address);
            
            // Check node details
            for (const referral of directReferrals) {
                expect(referral.level).to.equal(1); // All direct referrals should be level 1
                expect(referral.packageTier).to.be.greaterThan(0);
                expect(referral.volume).to.be.greaterThan(0);
                expect(referral.joinDate).to.be.greaterThan(0);
            }
        });

        it("Should handle users with no direct referrals", async function () {
            const directReferrals = await downlineVisualization.getDirectReferralsDetailed(user4.address);
            
            expect(directReferrals.length).to.equal(0);
        });
    });

    describe("Error Handling", function () {
        it("Should revert for unregistered users", async function () {
            await expect(
                downlineVisualization.getDownlineVisualizationData(users[10].address, 3)
            ).to.be.revertedWith("User not registered");
            
            await expect(
                downlineVisualization.getTeamAnalytics(users[10].address)
            ).to.be.revertedWith("User not registered");
            
            await expect(
                downlineVisualization.getUserNetworkMetrics(users[10].address)
            ).to.be.revertedWith("User not registered");
        });

        it("Should revert for invalid depth parameters", async function () {
            await expect(
                downlineVisualization.getDownlineVisualizationData(matrixRoot.address, 0)
            ).to.be.revertedWith("Invalid depth range");
            
            await expect(
                downlineVisualization.getDownlineVisualizationData(matrixRoot.address, 11)
            ).to.be.revertedWith("Invalid depth range");
            
            await expect(
                downlineVisualization.getSponsorChain(matrixRoot.address, 0)
            ).to.be.revertedWith("Invalid depth");
            
            await expect(
                downlineVisualization.getSponsorChain(matrixRoot.address, 51)
            ).to.be.revertedWith("Invalid depth");
        });
    });

    describe("Gas Efficiency", function () {
        it("Should handle large networks efficiently", async function () {
            // Create a moderately large network
            const testUsers = users.slice(0, 15);
            
            for (let i = 0; i < testUsers.length; i++) {
                const user = testUsers[i];
                const sponsor = i === 0 ? matrixRoot.address : testUsers[Math.floor(i/3)].address;
                await downlineVisualization.connect(user).registerUser(sponsor, PackageTier.PACKAGE_75);
            }
            
            // Test that visualization data can be retrieved without timeout
            const startTime = Date.now();
            const vizData = await downlineVisualization.getDownlineVisualizationData(matrixRoot.address, 4);
            const endTime = Date.now();
            
            expect(vizData.totalMembers).to.be.greaterThan(10);
            expect(endTime - startTime).to.be.lessThan(5000); // Should complete within 5 seconds
        });

        it("Should limit data size for very deep networks", async function () {
            const vizData = await downlineVisualization.getDownlineVisualizationData(matrixRoot.address, 8);
            
            // Should not return an excessive number of nodes even with high depth
            expect(vizData.nodes.length).to.be.lessThan(1000);
            expect(vizData.connections.length).to.be.lessThan(1000);
        });
    });

    describe("Data Consistency", function () {
        beforeEach(async function () {
            // Create test network
            await downlineVisualization.connect(user1).registerUser(matrixRoot.address, PackageTier.PACKAGE_100);
            await downlineVisualization.connect(user2).registerUser(user1.address, PackageTier.PACKAGE_75);
            await downlineVisualization.connect(user3).registerUser(user1.address, PackageTier.PACKAGE_50);
        });

        it("Should maintain consistency between different views", async function () {
            const vizData = await downlineVisualization.getDownlineVisualizationData(matrixRoot.address, 3);
            const analytics = await downlineVisualization.getTeamAnalytics(matrixRoot.address);
            const metrics = await downlineVisualization.getUserNetworkMetrics(matrixRoot.address);
            
            // Team sizes should be consistent
            const rootNode = vizData.nodes.find(node => node.userAddress === matrixRoot.address);
            expect(rootNode.teamSize).to.equal(analytics.totalTeamSize);
            
            // Active member counts should be consistent
            expect(vizData.activeMembersCount).to.equal(analytics.activeMembers);
        });

        it("Should correctly reflect matrix structure in visualization", async function () {
            const vizData = await downlineVisualization.getDownlineVisualizationData(matrixRoot.address, 2);
            
            // Check that connections match actual sponsor relationships
            for (const connection of vizData.connections) {
                const childNode = vizData.nodes.find(node => node.userAddress === connection.to);
                expect(childNode).to.not.be.undefined;
                expect(childNode.level).to.be.greaterThan(0);
            }
        });
    });
});
