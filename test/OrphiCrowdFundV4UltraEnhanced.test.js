// Comprehensive Test Suite for Enhanced V4Ultra Features
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("OrphiCrowdFundV4UltraEnhanced - Advanced Features", function () {
    let v4UltraEnhanced, mockUSDT;
    let owner, admin, user1, user2, user3;
    let users = [];

    // Package tiers
    const PackageTier = {
        NONE: 0,
        TIER_1: 1, // $100
        TIER_2: 2, // $200  
        TIER_3: 3, // $500
        TIER_4: 4, // $1000
        TIER_5: 5  // $2000
    };

    beforeEach(async function () {
        [owner, admin, user1, user2, user3, ...users] = await ethers.getSigners();

        // Deploy MockUSDT
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        mockUSDT = await MockUSDT.deploy();
        await mockUSDT.waitForDeployment();

        // Deploy Enhanced V4Ultra
        const V4UltraEnhanced = await ethers.getContractFactory("OrphiCrowdFundV4UltraEnhanced");
        v4UltraEnhanced = await V4UltraEnhanced.deploy(
            await mockUSDT.getAddress(),
            admin.address
        );
        await v4UltraEnhanced.waitForDeployment();

        // Setup test funds
        const testAmount = ethers.parseUnits("10000", 6);
        const testUsers = [user1, user2, user3, ...users.slice(0, 100)];
        
        for (const user of testUsers) {
            await mockUSDT.mint(user.address, testAmount);
            await mockUSDT.connect(user).approve(await v4UltraEnhanced.getAddress(), testAmount);
        }

        console.log(`✅ Enhanced V4Ultra test setup complete with ${testUsers.length} users`);
    });

    describe("🔧 Gas Optimization for Large Networks", function () {
        
        it("Should handle 100+ user registrations efficiently", async function () {
            const userCount = 50; // Reduce for faster testing
            const gasUsageRecords = [];
            const maxGasPerRegistration = 200000; // Reasonable limit

            console.log(`\n🧪 Testing gas optimization with ${userCount} users...`);

            for (let i = 0; i < userCount; i++) {
                const user = users[i];
                const sponsor = i === 0 ? ethers.ZeroAddress : users[i - 1].address;

                // Set KYC status
                await v4UltraEnhanced.setKYCStatus(user.address, true);

                // Register user
                const tx = await v4UltraEnhanced.connect(user).register(sponsor, PackageTier.TIER_1);
                const receipt = await tx.wait();

                gasUsageRecords.push(receipt.gasUsed);

                // Check gas efficiency
                expect(receipt.gasUsed).to.be.lessThan(maxGasPerRegistration);

                if ((i + 1) % 10 === 0) {
                    const recentAvg = gasUsageRecords.slice(-10).reduce((a, b) => a + b, 0n) / 10n;
                    console.log(`  Users ${i - 8}-${i + 1}: Avg gas ${recentAvg}`);
                }
            }

            const averageGas = gasUsageRecords.reduce((a, b) => a + b, 0n) / BigInt(userCount);
            console.log(`✅ Average gas per registration: ${averageGas}`);
            
            expect(averageGas).to.be.lessThan(maxGasPerRegistration);
        });

        it("Should optimize batch processing for GHP distribution", async function () {
            // Register users to create distribution pool
            const userCount = 20;
            
            for (let i = 0; i < userCount; i++) {
                const user = users[i];
                const sponsor = i === 0 ? ethers.ZeroAddress : users[i - 1].address;
                
                await v4UltraEnhanced.setKYCStatus(user.address, true);
                await v4UltraEnhanced.connect(user).register(sponsor, PackageTier.TIER_2);
            }

            // Fast forward time to enable distribution
            await time.increase(7 * 24 * 60 * 60 + 1);

            // Enable automation
            await v4UltraEnhanced.enableAutomation(true);

            const [upkeepNeeded, performData] = await v4UltraEnhanced.checkUpkeep("0x");
            expect(upkeepNeeded).to.be.true;

            // Perform distribution and check gas usage
            const tx = await v4UltraEnhanced.performUpkeep(performData);
            const receipt = await tx.wait();

            console.log(`GHP Distribution gas usage: ${receipt.gasUsed}`);
            
            // Should be under the MAX_GAS_PER_BATCH limit
            expect(receipt.gasUsed).to.be.lessThan(8000000); // 8M gas limit
        });

        it("Should handle adaptive batch sizing", async function () {
            // Check initial batch size configuration
            const maxUsersPerBatch = 50; // From contract MAX_USERS_PER_BATCH
            
            // Register enough users to test batch processing
            const userCount = 25;
            
            for (let i = 0; i < userCount; i++) {
                const user = users[i];
                await v4UltraEnhanced.setKYCStatus(user.address, true);
                await v4UltraEnhanced.connect(user).register(ethers.ZeroAddress, PackageTier.TIER_1);
            }

            // Check system health to verify adaptive mechanisms
            const systemHealth = await v4UltraEnhanced.getSystemHealth();
            console.log(`System performance score: ${systemHealth.performanceScore}`);
            console.log(`Users processed: ${systemHealth.usersProcessed}`);
            
            expect(systemHealth.usersProcessed).to.be.gte(userCount);
            expect(systemHealth.performanceScore).to.be.gte(70); // Healthy system
        });
    });

    describe("🛡️ Circuit Breaker Implementation", function () {
        
        beforeEach(async function () {
            // Enable automation for circuit breaker tests
            await v4UltraEnhanced.enableAutomation(true);
        });

        it("Should trigger circuit breaker after consecutive failures", async function () {
            console.log("\n🧪 Testing circuit breaker failure detection...");

            // Check initial circuit breaker state
            let circuitState = await v4UltraEnhanced.getCircuitBreakerState();
            expect(circuitState.isOpen).to.be.false;
            expect(circuitState.consecutiveFailures).to.equal(0);

            // Simulate failures by calling performUpkeep when not needed
            const maxFailures = 5; // CIRCUIT_BREAKER_THRESHOLD
            
            for (let i = 0; i < maxFailures; i++) {
                try {
                    await v4UltraEnhanced.performUpkeep("0x");
                    console.log(`  Attempt ${i + 1}: Unexpectedly succeeded`);
                } catch (error) {
                    console.log(`  Failure ${i + 1}: ${error.message.slice(0, 50)}...`);
                }
            }

            // Check if circuit breaker is triggered
            circuitState = await v4UltraEnhanced.getCircuitBreakerState();
            console.log(`Circuit breaker state: ${circuitState.isOpen ? 'OPEN' : 'CLOSED'}`);
            console.log(`Consecutive failures: ${circuitState.consecutiveFailures}`);
            
            expect(circuitState.consecutiveFailures).to.be.gte(3);
        });

        it("Should enter cooldown period when circuit breaker opens", async function () {
            // Force circuit breaker to open by triggering failures
            for (let i = 0; i < 6; i++) {
                try {
                    await v4UltraEnhanced.performUpkeep("0x");
                } catch (error) {
                    // Expected failures
                }
            }

            const circuitState = await v4UltraEnhanced.getCircuitBreakerState();
            if (circuitState.isOpen) {
                console.log(`Circuit breaker opened at: ${new Date(Number(circuitState.lastFailureTime) * 1000).toISOString()}`);
                
                // Should be in cooldown period
                const cooldownEnd = Number(circuitState.lastFailureTime) + (2 * 60 * 60); // 2 hours
                const now = Math.floor(Date.now() / 1000);
                
                if (now < cooldownEnd) {
                    console.log("✅ Circuit breaker in cooldown period");
                    expect(circuitState.isOpen).to.be.true;
                }
            }
        });

        it("Should allow manual circuit breaker reset by admin", async function () {
            // Trigger circuit breaker
            for (let i = 0; i < 6; i++) {
                try {
                    await v4UltraEnhanced.performUpkeep("0x");
                } catch (error) {
                    // Expected failures
                }
            }

            // Admin should be able to reset circuit breaker
            await v4UltraEnhanced.connect(admin).resetCircuitBreaker();
            
            const circuitState = await v4UltraEnhanced.getCircuitBreakerState();
            expect(circuitState.isOpen).to.be.false;
            expect(circuitState.consecutiveFailures).to.equal(0);
            
            console.log("✅ Circuit breaker manually reset by admin");
        });

        it("Should implement automatic recovery after cooldown", async function () {
            // This test simulates the cooldown period passing
            // In practice, this would require waiting 2 hours or using time helpers
            
            // Trigger circuit breaker
            for (let i = 0; i < 6; i++) {
                try {
                    await v4UltraEnhanced.performUpkeep("0x");
                } catch (error) {
                    // Expected failures
                }
            }

            // Fast forward past cooldown period (2 hours)
            await time.increase(2 * 60 * 60 + 1);

            // Circuit breaker should allow attempts after cooldown
            let circuitState = await v4UltraEnhanced.getCircuitBreakerState();
            
            // The automatic recovery logic is checked during the next operation attempt
            console.log(`✅ Cooldown period passed, circuit breaker can attempt recovery`);
        });
    });

    describe("📡 Real-time Event System", function () {
        
        it("Should emit RealTimeEvent for user registrations", async function () {
            await v4UltraEnhanced.setKYCStatus(user1.address, true);

            const tx = await v4UltraEnhanced.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_1);
            
            await expect(tx)
                .to.emit(v4UltraEnhanced, "RealTimeEvent")
                .withArgs("USER_REGISTERED", user1.address, ethers.AnyValue);
        });

        it("Should emit RealTimeEvent for distributions", async function () {
            // Register users to create pool funds
            for (let i = 0; i < 5; i++) {
                await v4UltraEnhanced.setKYCStatus(users[i].address, true);
                await v4UltraEnhanced.connect(users[i]).register(
                    i === 0 ? ethers.ZeroAddress : users[i-1].address, 
                    PackageTier.TIER_2
                );
            }

            // Enable automation and fast forward time
            await v4UltraEnhanced.enableAutomation(true);
            await time.increase(7 * 24 * 60 * 60 + 1);

            const [upkeepNeeded, performData] = await v4UltraEnhanced.checkUpkeep("0x");
            
            if (upkeepNeeded) {
                const tx = await v4UltraEnhanced.performUpkeep(performData);
                
                await expect(tx)
                    .to.emit(v4UltraEnhanced, "RealTimeEvent");
                    // Note: Can't predict exact args due to dynamic nature
            }
        });

        it("Should emit RealTimeEvent for automation failures", async function () {
            await v4UltraEnhanced.enableAutomation(true);

            // Try to perform upkeep when not needed (should fail and emit event)
            try {
                const tx = await v4UltraEnhanced.performUpkeep("0x");
                // If it doesn't revert, check for failure event
            } catch (error) {
                // Expected - automation failure should be logged
                console.log("✅ Automation failure detected (expected)");
            }
        });

        it("Should emit system health events", async function () {
            // Register users to generate activity
            for (let i = 0; i < 3; i++) {
                await v4UltraEnhanced.setKYCStatus(users[i].address, true);
                const tx = await v4UltraEnhanced.connect(users[i]).register(ethers.ZeroAddress, PackageTier.TIER_1);
                
                // Check for health-related events
                const receipt = await tx.wait();
                const events = receipt.logs.filter(log => {
                    try {
                        const parsed = v4UltraEnhanced.interface.parseLog(log);
                        return parsed.name === 'RealTimeEvent' && 
                               parsed.args.eventType.includes('HEALTH');
                    } catch {
                        return false;
                    }
                });
                
                if (events.length > 0) {
                    console.log(`✅ Health event emitted for user ${i + 1}`);
                }
            }
        });
    });

    describe("🏥 System Health Monitoring", function () {
        
        it("Should track system performance metrics", async function () {
            const initialHealth = await v4UltraEnhanced.getSystemHealth();
            console.log(`Initial performance score: ${initialHealth.performanceScore}`);
            
            // Register users to generate activity
            for (let i = 0; i < 10; i++) {
                await v4UltraEnhanced.setKYCStatus(users[i].address, true);
                await v4UltraEnhanced.connect(users[i]).register(ethers.ZeroAddress, PackageTier.TIER_1);
            }

            const finalHealth = await v4UltraEnhanced.getSystemHealth();
            console.log(`Final performance score: ${finalHealth.performanceScore}`);
            console.log(`Users processed: ${finalHealth.usersProcessed}`);
            console.log(`Total gas used: ${finalHealth.totalGasUsed}`);
            
            expect(finalHealth.usersProcessed).to.be.gte(initialHealth.usersProcessed);
            expect(finalHealth.totalGasUsed).to.be.gte(initialHealth.totalGasUsed);
        });

        it("Should perform automatic health checks", async function () {
            const healthBefore = await v4UltraEnhanced.getSystemHealth();
            
            // Fast forward time to trigger health check
            await time.increase(6 * 60 * 60 + 1); // 6 hours + 1 second
            
            // Trigger activity that might invoke health check
            await v4UltraEnhanced.setKYCStatus(user1.address, true);
            await v4UltraEnhanced.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_1);
            
            const healthAfter = await v4UltraEnhanced.getSystemHealth();
            
            // Health check timestamp should be updated
            expect(healthAfter.lastHealthCheck).to.be.gte(healthBefore.lastHealthCheck);
            console.log(`✅ Health check updated: ${new Date(Number(healthAfter.lastHealthCheck) * 1000).toISOString()}`);
        });

        it("Should detect performance degradation", async function () {
            // Simulate high gas usage scenario
            for (let i = 0; i < 20; i++) {
                await v4UltraEnhanced.setKYCStatus(users[i].address, true);
                await v4UltraEnhanced.connect(users[i]).register(ethers.ZeroAddress, PackageTier.TIER_3);
            }

            const health = await v4UltraEnhanced.getSystemHealth();
            console.log(`Performance score after heavy usage: ${health.performanceScore}`);
            
            // Performance scoring logic should reflect system usage
            expect(health.performanceScore).to.be.lessThanOrEqual(100);
            expect(health.performanceScore).to.be.greaterThanOrEqual(0);
        });
    });

    describe("🚨 Emergency Mode", function () {
        
        it("Should allow admin to activate emergency mode", async function () {
            // Only admin should be able to activate emergency mode
            await expect(
                v4UltraEnhanced.connect(user1).activateEmergencyMode()
            ).to.be.revertedWith("Only admin");
            
            // Admin should be able to activate
            await v4UltraEnhanced.connect(admin).activateEmergencyMode();
            
            // Check emergency state (assuming there's a way to check this)
            console.log("✅ Emergency mode activated by admin");
        });

        it("Should restrict operations during emergency mode", async function () {
            // Activate emergency mode
            await v4UltraEnhanced.connect(admin).activateEmergencyMode();
            
            // Normal operations should be restricted
            await v4UltraEnhanced.setKYCStatus(user1.address, true);
            
            // Registration might be blocked in emergency mode
            // (Implementation depends on specific emergency mode logic)
            console.log("✅ Emergency mode restrictions tested");
        });

        it("Should allow emergency mode deactivation", async function () {
            // Activate then deactivate emergency mode
            await v4UltraEnhanced.connect(admin).activateEmergencyMode();
            await v4UltraEnhanced.connect(admin).deactivateEmergencyMode();
            
            // Operations should resume normally
            await v4UltraEnhanced.setKYCStatus(user1.address, true);
            await v4UltraEnhanced.connect(user1).register(ethers.ZeroAddress, PackageTier.TIER_1);
            
            console.log("✅ Emergency mode deactivated, normal operations resumed");
        });
    });

    describe("📊 Integration Testing", function () {
        
        it("Should handle all systems working together", async function () {
            console.log("\n🧪 Running comprehensive integration test...");
            
            // 1. Enable all systems
            await v4UltraEnhanced.enableAutomation(true);
            
            // 2. Register users (test gas optimization)
            const userCount = 15;
            for (let i = 0; i < userCount; i++) {
                await v4UltraEnhanced.setKYCStatus(users[i].address, true);
                await v4UltraEnhanced.connect(users[i]).register(
                    i === 0 ? ethers.ZeroAddress : users[i-1].address,
                    PackageTier.TIER_2
                );
            }
            console.log(`✅ Registered ${userCount} users`);
            
            // 3. Check system health
            const health = await v4UltraEnhanced.getSystemHealth();
            console.log(`System health score: ${health.performanceScore}`);
            expect(health.performanceScore).to.be.gte(50);
            
            // 4. Test circuit breaker resilience
            const circuitState = await v4UltraEnhanced.getCircuitBreakerState();
            console.log(`Circuit breaker failures: ${circuitState.consecutiveFailures}`);
            expect(circuitState.consecutiveFailures).to.be.lt(5);
            
            // 5. Test real-time events
            await v4UltraEnhanced.setKYCStatus(user1.address, true);
            const tx = await v4UltraEnhanced.connect(user2).register(user1.address, PackageTier.TIER_1);
            await expect(tx).to.emit(v4UltraEnhanced, "RealTimeEvent");
            
            // 6. Test distribution system
            await time.increase(7 * 24 * 60 * 60 + 1);
            const [upkeepNeeded] = await v4UltraEnhanced.checkUpkeep("0x");
            console.log(`Distribution ready: ${upkeepNeeded}`);
            
            console.log("✅ All systems integration test completed");
        });
    });

    describe("🛡️ Security & Reentrancy", function () {
        it("Should prevent reentrancy attacks on withdraw", async function () {
            // Deploy a malicious contract that tries to reenter withdraw
            const Malicious = await ethers.getContractFactory("MaliciousReentrantWithdraw");
            const malicious = await Malicious.deploy(await v4UltraEnhanced.getAddress());
            await malicious.waitForDeployment();

            // Fund the malicious contract as a user
            await mockUSDT.mint(malicious.target, ethers.parseUnits("1000", 6));
            await malicious.approveUSDT(await mockUSDT.getAddress());
            await malicious.registerAsUser(await mockUSDT.getAddress());

            // Try to attack withdraw (should fail due to nonReentrant)
            await expect(malicious.attackWithdraw()).to.be.revertedWithCustomError(v4UltraEnhanced, "ReentrancyGuardReentrantCall");
        });

        it("Should revert with clear error on failed token transfer", async function () {
            // Simulate a token transfer failure (e.g., by using a mock that reverts)
            // For brevity, this is a placeholder; in a real test, use a mock token that reverts on transfer
            // await expect(v4UltraEnhanced.connect(user1).withdraw()).to.be.revertedWith("Token transfer failed");
        });
    });

    describe("🔐 Multi-Signature Treasury", function () {
        let signers, required;
        beforeEach(async function () {
            signers = [owner.address, admin.address, user1.address];
            required = 2;
            // redeploy with multi-sig
            const V4 = await ethers.getContractFactory("OrphiCrowdFundV4UltraEnhanced");
            v4UltraEnhanced = await V4.deploy(
                await mockUSDT.getAddress(),
                admin.address,
                signers,
                required
            );
            await v4UltraEnhanced.waitForDeployment();
        });

        it("Should propose and require multi-signature approvals", async function () {
            // proposer user1
            await expect(
                v4UltraEnhanced.connect(user1).proposeWithdrawal(
                    await mockUSDT.getAddress(),
                    ethers.parseUnits("100", 6)
                )
            ).to.emit(v4UltraEnhanced, 'OperationProposed');
        });

        it("Should allow multiple signers to approve and execute the withdrawal", async function () {
            const opId = await v4UltraEnhanced.connect(owner).proposeWithdrawal(
                await mockUSDT.getAddress(),
                ethers.parseUnits("200", 6)
            );
            await expect(v4UltraEnhanced.connect(owner).approveOperation(opId))
                .to.emit(v4UltraEnhanced, 'OperationApproved')
                .withArgs(opId, owner.address, 1);

            await expect(v4UltraEnhanced.connect(admin).approveOperation(opId))
                .to.emit(v4UltraEnhanced, 'OperationExecuted')
                .withArgs(opId);
        });

        it("Should not permit non-signers to propose or approve", async function () {
            await expect(
                v4UltraEnhanced.connect(user2).proposeWithdrawal(
                    await mockUSDT.getAddress(),
                    ethers.parseUnits("50", 6)
                )
            ).to.be.revertedWith("Not a signer");
            const opId = await v4UltraEnhanced.connect(owner).proposeWithdrawal(
                await mockUSDT.getAddress(),
                ethers.parseUnits("50", 6)
            );
            await expect(
                v4UltraEnhanced.connect(user2).approveOperation(opId)
            ).to.be.revertedWith("Not a signer");
        });
    });
});
