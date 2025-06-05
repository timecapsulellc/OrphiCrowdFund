const { ethers } = require("hardhat");

async function main() {
    console.log("🚀 Deploying OrphiCrowdFundV4UltraEnhancedSimple...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    try {
        // Deploy the enhanced contract
        const OrphiCrowdFundV4UltraEnhanced = await ethers.getContractFactory("OrphiCrowdFundV4UltraEnhancedSimple");
        const contract = await OrphiCrowdFundV4UltraEnhanced.deploy();
        await contract.waitForDeployment();
        
        const contractAddress = await contract.getAddress();
        console.log("✅ OrphiCrowdFundV4UltraEnhancedSimple deployed to:", contractAddress);
        
        // Quick functionality test
        console.log("\n🧪 Running basic functionality tests...");
        
        // Test initialization
        const maxUsers = await contract.MAX_USERS_PER_BATCH();
        const maxGas = await contract.MAX_GAS_PER_BATCH();
        const threshold = await contract.CIRCUIT_BREAKER_THRESHOLD();
        
        console.log("📊 Contract Parameters:");
        console.log(`  - Max Users Per Batch: ${maxUsers}`);
        console.log(`  - Max Gas Per Batch: ${maxGas}`);
        console.log(`  - Circuit Breaker Threshold: ${threshold}`);
        
        // Test system health
        const health = await contract.getSystemHealth();
        console.log("\n❤️  System Health:");
        console.log(`  - Score: ${health.score}`);
        console.log(`  - Last Check: ${new Date(Number(health.lastHealthCheck) * 1000).toISOString()}`);
        console.log(`  - Total Gas Used: ${health.totalGasUsed}`);
        console.log(`  - Emergency Mode: ${health.emergencyMode}`);
        
        // Test circuit breaker status
        const circuitBreakerOpen = await contract.circuitBreakerOpen();
        console.log(`\n⚡ Circuit Breaker: ${circuitBreakerOpen ? 'OPEN' : 'CLOSED'}`);
        
        console.log("\n✅ Enhanced V4Ultra deployment and basic tests completed successfully!");
        
        return {
            contract,
            address: contractAddress
        };
        
    } catch (error) {
        console.error("❌ Deployment failed:", error);
        throw error;
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = main;
