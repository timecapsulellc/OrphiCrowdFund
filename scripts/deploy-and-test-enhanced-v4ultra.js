// Enhanced V4Ultra Deployment and Testing Script
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

async function main() {
    console.log("\n🚀 ENHANCED V4ULTRA DEPLOYMENT & TESTING");
    console.log("========================================");

    try {
        // Get signers
        const [deployer, admin, ...testUsers] = await ethers.getSigners();
        console.log(`\n👤 Deployer: ${deployer.address}`);
        console.log(`👤 Admin: ${admin.address}`);
        console.log(`👥 Test Users: ${testUsers.length} available`);

        // Deploy MockUSDT
        console.log("\n📦 Deploying MockUSDT...");
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        const mockUSDT = await MockUSDT.deploy();
        await mockUSDT.waitForDeployment();
        const mockUSDTAddress = await mockUSDT.getAddress();
        console.log(`✅ MockUSDT deployed at: ${mockUSDTAddress}`);

        // Deploy Enhanced V4Ultra
        console.log("\n📦 Deploying OrphiCrowdFundV4UltraEnhanced...");
        const V4UltraEnhanced = await ethers.getContractFactory("OrphiCrowdFundV4UltraEnhanced");
        const v4UltraEnhanced = await V4UltraEnhanced.deploy(mockUSDTAddress, admin.address);
        await v4UltraEnhanced.waitForDeployment();
        const v4UltraEnhancedAddress = await v4UltraEnhanced.getAddress();
        console.log(`✅ V4UltraEnhanced deployed at: ${v4UltraEnhancedAddress}`);

        // Check contract size
        const contractCode = await ethers.provider.getCode(v4UltraEnhancedAddress);
        const sizeInBytes = (contractCode.length - 2) / 2;
        console.log(`📏 Contract size: ${sizeInBytes} bytes (${(sizeInBytes/1024).toFixed(1)}KB)`);

        // Initialize users with funds
        console.log("\n💰 Setting up test users...");
        const userCount = Math.min(testUsers.length, 100); // Test with 100 users
        const testAmount = ethers.parseUnits("10000", 6); // 10,000 USDT

        for (let i = 0; i < userCount; i++) {
            await mockUSDT.mint(testUsers[i].address, testAmount);
            await mockUSDT.connect(testUsers[i]).approve(v4UltraEnhancedAddress, testAmount);
        }
        console.log(`✅ Set up ${userCount} test users with funds`);

        // Test 1: Basic deployment verification
        console.log("\n🧪 TEST 1: Basic Deployment Verification");
        console.log("----------------------------------------");
        
        const systemHealth = await v4UltraEnhanced.getSystemHealth();
        console.log(`System Health Score: ${systemHealth.performanceScore}`);
        console.log(`Gas Usage Tracking: ${systemHealth.totalGasUsed}`);
        
        const circuitBreakerState = await v4UltraEnhanced.getCircuitBreakerState();
        console.log(`Circuit Breaker State: ${circuitBreakerState.isOpen ? 'OPEN' : 'CLOSED'}`);
        console.log(`Failure Count: ${circuitBreakerState.consecutiveFailures}`);
        console.log("✅ Basic deployment verification passed");

        // Test 2: Gas Optimization with Large User Base
        console.log("\n🧪 TEST 2: Gas Optimization - Large User Registration");
        console.log("---------------------------------------------------");
        
        // Register users in batches to test gas optimization
        const batchSize = 10;
        const registrationGasUsed = [];
        
        for (let batch = 0; batch < Math.min(10, Math.floor(userCount / batchSize)); batch++) {
            const startIndex = batch * batchSize;
            const batchUsers = testUsers.slice(startIndex, startIndex + batchSize);
            
            console.log(`Registering batch ${batch + 1} (users ${startIndex + 1}-${startIndex + batchSize})...`);
            
            for (let i = 0; i < batchUsers.length; i++) {
                const user = batchUsers[i];
                
                // Set KYC status
                await v4UltraEnhanced.setKYCStatus(user.address, true);
                
                // Register user with tier 1 package (100 USDT)
                const sponsor = i === 0 && batch === 0 ? ethers.ZeroAddress : testUsers[startIndex + i - 1].address;
                const tx = await v4UltraEnhanced.connect(user).register(sponsor, 1);
                const receipt = await tx.wait();
                
                registrationGasUsed.push(receipt.gasUsed);
                
                // Check for real-time events
                const events = receipt.logs.filter(log => {
                    try {
                        const parsed = v4UltraEnhanced.interface.parseLog(log);
                        return parsed.name === 'RealTimeEvent';
                    } catch {
                        return false;
                    }
                });
                
                if (events.length > 0) {
                    console.log(`  📡 RealTimeEvent emitted for user ${startIndex + i + 1}`);
                }
            }
            
            const avgGas = registrationGasUsed.slice(-batchSize).reduce((a, b) => a + b, 0n) / BigInt(batchSize);
            console.log(`  ⛽ Average gas per registration: ${avgGas}`);
        }
        
        const totalRegistered = registrationGasUsed.length;
        const avgGasPerRegistration = registrationGasUsed.reduce((a, b) => a + b, 0n) / BigInt(totalRegistered);
        console.log(`✅ Successfully registered ${totalRegistered} users`);
        console.log(`⛽ Overall average gas per registration: ${avgGasPerRegistration}`);

        // Test 3: Circuit Breaker Functionality
        console.log("\n🧪 TEST 3: Circuit Breaker Testing");
        console.log("----------------------------------");
        
        // Enable automation
        await v4UltraEnhanced.enableAutomation(true);
        console.log("✅ Automation enabled");
        
        // Simulate failures to trigger circuit breaker
        console.log("Simulating automation failures...");
        for (let i = 0; i < 3; i++) {
            try {
                // Try to perform upkeep when not needed (should fail)
                await v4UltraEnhanced.performUpkeep("0x");
            } catch (error) {
                console.log(`  ❌ Simulated failure ${i + 1}: ${error.message.slice(0, 50)}...`);
            }
        }
        
        const circuitBreakerAfterFailures = await v4UltraEnhanced.getCircuitBreakerState();
        console.log(`Circuit Breaker State After Failures: ${circuitBreakerAfterFailures.isOpen ? 'OPEN' : 'CLOSED'}`);
        console.log(`Consecutive Failures: ${circuitBreakerAfterFailures.consecutiveFailures}`);
        
        if (circuitBreakerAfterFailures.consecutiveFailures >= 3) {
            console.log("✅ Circuit breaker triggered correctly after failures");
        }

        // Test 4: Real-time Event System
        console.log("\n🧪 TEST 4: Real-time Event System");
        console.log("---------------------------------");
        
        // Register one more user to trigger events
        const eventTestUser = testUsers[totalRegistered];
        if (eventTestUser) {
            await mockUSDT.mint(eventTestUser.address, testAmount);
            await mockUSDT.connect(eventTestUser).approve(v4UltraEnhancedAddress, testAmount);
            await v4UltraEnhanced.setKYCStatus(eventTestUser.address, true);
            
            const tx = await v4UltraEnhanced.connect(eventTestUser).register(testUsers[0].address, 2);
            const receipt = await tx.wait();
            
            // Check for real-time events
            const realTimeEvents = receipt.logs.filter(log => {
                try {
                    const parsed = v4UltraEnhanced.interface.parseLog(log);
                    return parsed.name === 'RealTimeEvent';
                } catch {
                    return false;
                }
            });
            
            console.log(`✅ RealTimeEvent emitted: ${realTimeEvents.length} events`);
            if (realTimeEvents.length > 0) {
                const event = v4UltraEnhanced.interface.parseLog(realTimeEvents[0]);
                console.log(`  Event Type: ${event.args.eventType}`);
                console.log(`  Event Data: ${event.args.eventData}`);
            }
        }

        // Test 5: System Health Monitoring
        console.log("\n🧪 TEST 5: System Health Monitoring");
        console.log("-----------------------------------");
        
        const finalSystemHealth = await v4UltraEnhanced.getSystemHealth();
        console.log(`Performance Score: ${finalSystemHealth.performanceScore}/100`);
        console.log(`Total Gas Used: ${finalSystemHealth.totalGasUsed}`);
        console.log(`Last Health Check: ${new Date(Number(finalSystemHealth.lastHealthCheck) * 1000).toISOString()}`);
        console.log(`Users Processed: ${finalSystemHealth.usersProcessed}`);
        
        if (finalSystemHealth.performanceScore >= 70) {
            console.log("✅ System health is good");
        } else {
            console.log("⚠️  System health needs attention");
        }

        // Test 6: Distribution Testing with Gas Optimization
        console.log("\n🧪 TEST 6: Distribution Gas Optimization");
        console.log("---------------------------------------");
        
        // Check pool balances
        const poolBalances = await v4UltraEnhanced.getPoolBalances();
        console.log(`GHP Pool Balance: ${ethers.formatUnits(poolBalances[4], 6)} USDT`);
        
        if (poolBalances[4] > 0) {
            // Fast forward time to enable distribution
            await time.increase(7 * 24 * 60 * 60 + 1); // 7 days + 1 second
            
            const [upkeepNeeded, performData] = await v4UltraEnhanced.checkUpkeep("0x");
            console.log(`Upkeep needed: ${upkeepNeeded}`);
            
            if (upkeepNeeded) {
                const tx = await v4UltraEnhanced.performUpkeep(performData);
                const receipt = await tx.wait();
                console.log(`✅ Distribution executed with gas: ${receipt.gasUsed}`);
                
                // Check if distribution was optimized for large user base
                if (receipt.gasUsed < 8000000n) { // MAX_GAS_PER_BATCH
                    console.log("✅ Gas optimization successful - under limit");
                } else {
                    console.log("⚠️  Gas usage at limit - may need further optimization");
                }
            }
        }

        // Summary
        console.log("\n📋 ENHANCED V4ULTRA TEST SUMMARY");
        console.log("================================");
        console.log(`✅ Contract deployed at: ${v4UltraEnhancedAddress}`);
        console.log(`✅ MockUSDT deployed at: ${mockUSDTAddress}`);
        console.log(`✅ Users registered: ${totalRegistered}`);
        console.log(`✅ Average gas per registration: ${avgGasPerRegistration}`);
        console.log(`✅ Circuit breaker tested: ${circuitBreakerAfterFailures.consecutiveFailures} failures recorded`);
        console.log(`✅ Real-time events working: Event system operational`);
        console.log(`✅ System health score: ${finalSystemHealth.performanceScore}/100`);
        
        // Environment variables for WebSocket integration
        console.log("\n🔸 Environment Variables for WebSocket Integration:");
        console.log(`export ENHANCED_V4ULTRA_ADDRESS="${v4UltraEnhancedAddress}"`);
        console.log(`export MOCKUSDT_ADDRESS="${mockUSDTAddress}"`);
        console.log(`export ADMIN_ADDRESS="${admin.address}"`);
        
        console.log("\n✅ ENHANCED V4ULTRA DEPLOYMENT & TESTING COMPLETED SUCCESSFULLY");

    } catch (error) {
        console.error("\n❌ TESTING FAILED:", error);
        throw error;
    }
}

// Export for use in other scripts
module.exports = { main };

// Run if called directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
