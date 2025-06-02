const { ethers } = require("hardhat");

/**
 * Gas Optimization Analysis Tool for Orphi CrowdFund
 * 
 * This script analyzes gas usage patterns and provides optimization recommendations
 */

class GasAnalyzer {
    constructor(contractV1, contractV2, mockUSDT) {
        this.contractV1 = contractV1;
        this.contractV2 = contractV2;
        this.mockUSDT = mockUSDT;
        this.gasData = {
            v1: {},
            v2: {},
            improvements: {}
        };
    }

    /**
     * Measure gas usage for user registration
     */
    async measureRegistrationGas(users, packageTier) {
        console.log("\n📊 Measuring Registration Gas Usage...");
        
        // V1 Registration
        const v1Tx = await this.contractV1.connect(users[0]).registerUser(
            await this.contractV1.matrixRoot(),
            packageTier
        );
        const v1Receipt = await v1Tx.wait();
        this.gasData.v1.registration = v1Receipt.gasUsed;

        // V2 Registration
        const v2Tx = await this.contractV2.connect(users[1]).registerUser(
            await this.contractV2.matrixRoot(),
            packageTier
        );
        const v2Receipt = await v2Tx.wait();
        this.gasData.v2.registration = v2Receipt.gasUsed;

        // Calculate improvement
        const improvement = this.gasData.v1.registration - this.gasData.v2.registration;
        const percentImprovement = (improvement * 100n) / this.gasData.v1.registration;
        
        this.gasData.improvements.registration = {
            gasReduction: improvement,
            percentReduction: percentImprovement
        };

        console.log(`V1 Registration: ${this.gasData.v1.registration.toString()} gas`);
        console.log(`V2 Registration: ${this.gasData.v2.registration.toString()} gas`);
        console.log(`Improvement: ${improvement.toString()} gas (${percentImprovement.toString()}%)`);
    }

    /**
     * Measure gas usage for withdrawals
     */
    async measureWithdrawalGas(users) {
        console.log("\n📊 Measuring Withdrawal Gas Usage...");
        
        // Need to have withdrawable amounts first
        await this.setupWithdrawableAmounts(users);

        try {
            // V1 Withdrawal
            const v1Tx = await this.contractV1.connect(users[0]).withdraw();
            const v1Receipt = await v1Tx.wait();
            this.gasData.v1.withdrawal = v1Receipt.gasUsed;
        } catch (error) {
            console.log("V1 Withdrawal failed or no withdrawable amount:", error.message);
            this.gasData.v1.withdrawal = 0n;
        }

        try {
            // V2 Withdrawal
            const v2Tx = await this.contractV2.connect(users[1]).withdraw();
            const v2Receipt = await v2Tx.wait();
            this.gasData.v2.withdrawal = v2Receipt.gasUsed;
        } catch (error) {
            console.log("V2 Withdrawal failed or no withdrawable amount:", error.message);
            this.gasData.v2.withdrawal = 0n;
        }

        if (this.gasData.v1.withdrawal > 0n && this.gasData.v2.withdrawal > 0n) {
            const improvement = this.gasData.v1.withdrawal - this.gasData.v2.withdrawal;
            const percentImprovement = (improvement * 100n) / this.gasData.v1.withdrawal;
            
            this.gasData.improvements.withdrawal = {
                gasReduction: improvement,
                percentReduction: percentImprovement
            };

            console.log(`V1 Withdrawal: ${this.gasData.v1.withdrawal.toString()} gas`);
            console.log(`V2 Withdrawal: ${this.gasData.v2.withdrawal.toString()} gas`);
            console.log(`Improvement: ${improvement.toString()} gas (${percentImprovement.toString()}%)`);
        }
    }

    /**
     * Measure gas usage for view functions
     */
    async measureViewFunctionGas() {
        console.log("\n📊 Measuring View Function Gas Usage...");
        
        const matrixRoot = await this.contractV1.matrixRoot();
        
        // Estimate gas for getUserInfo
        try {
            const v1Gas = await this.contractV1.getUserInfo.estimateGas(matrixRoot);
            const v2Gas = await this.contractV2.getUserInfoEnhanced.estimateGas(matrixRoot);
            
            console.log(`V1 getUserInfo: ${v1Gas.toString()} gas`);
            console.log(`V2 getUserInfoEnhanced: ${v2Gas.toString()} gas`);
            
            const improvement = v1Gas - v2Gas;
            console.log(`View function improvement: ${improvement.toString()} gas`);
        } catch (error) {
            console.log("Error measuring view function gas:", error.message);
        }
    }

    /**
     * Analyze storage layout efficiency
     */
    async analyzeStorageLayout() {
        console.log("\n📊 Analyzing Storage Layout Efficiency...");
        
        // This would require access to storage layout information
        // For now, we'll provide theoretical analysis based on struct definitions
        
        console.log("V1 User Struct Analysis:");
        console.log("- address sponsor (20 bytes)");
        console.log("- address leftChild (20 bytes)");
        console.log("- address rightChild (20 bytes)");
        console.log("- uint256 directSponsorsCount (32 bytes)");
        console.log("- uint256 teamSize (32 bytes)");
        console.log("- PackageTier packageTier (1 byte)");
        console.log("- mapping(uint256 => uint256) totalEarned");
        console.log("- uint256 totalInvested (32 bytes)");
        console.log("- bool isCapped (1 byte)");
        console.log("- LeaderRank leaderRank (1 byte)");
        console.log("- uint256 matrixPosition (32 bytes)");
        console.log("- uint256 lastActivity (32 bytes)");
        console.log("- uint256 withdrawableAmount (32 bytes)");
        console.log("Total: ~12 storage slots + mapping");
        
        console.log("\nV2 User Struct Analysis (Optimized):");
        console.log("- address sponsor (20 bytes)");
        console.log("- address leftChild (20 bytes)");
        console.log("- address rightChild (20 bytes)");
        console.log("- uint32 directSponsorsCount (4 bytes)");
        console.log("- uint32 teamSize (4 bytes)");
        console.log("- PackageTier packageTier (1 byte)");
        console.log("- uint128 totalInvested (16 bytes)");
        console.log("- uint128 withdrawableAmount (16 bytes)");
        console.log("- uint64 registrationTime (8 bytes)");
        console.log("- uint64 lastActivity (8 bytes)");
        console.log("- bool isCapped (1 byte)");
        console.log("- LeaderRank leaderRank (1 byte)");
        console.log("- uint32 matrixPosition (4 bytes)");
        console.log("- mapping(uint8 => uint128) poolEarnings");
        console.log("Total: ~9 storage slots + mapping");
        console.log("Storage reduction: ~25% fewer storage slots");
    }

    /**
     * Setup withdrawable amounts for testing
     */
    async setupWithdrawableAmounts(users) {
        // Register additional users to generate commissions
        const PackageTier = { PACKAGE_30: 1 };
        
        try {
            // Register users under the first user to generate sponsor commissions
            for (let i = 2; i < 5; i++) {
                await this.contractV1.connect(users[i]).registerUser(users[0].address, PackageTier.PACKAGE_30);
                if (i < 4) { // Don't exceed available test users
                    await this.contractV2.connect(users[i + 10]).registerUser(users[1].address, PackageTier.PACKAGE_30);
                }
            }
        } catch (error) {
            console.log("Setup error:", error.message);
        }
    }

    /**
     * Benchmark matrix placement performance
     */
    async benchmarkMatrixPlacement(users, numberOfUsers = 50) {
        console.log(`\n📊 Benchmarking Matrix Placement (${numberOfUsers} users)...`);
        
        const PackageTier = { PACKAGE_30: 1 };
        const startTime = Date.now();
        let totalGasV1 = 0n;
        let totalGasV2 = 0n;
        
        try {
            // Measure V1 matrix placement
            const v1StartTime = Date.now();
            for (let i = 0; i < Math.min(numberOfUsers, users.length - 10); i++) {
                const tx = await this.contractV1.connect(users[i]).registerUser(
                    await this.contractV1.matrixRoot(),
                    PackageTier.PACKAGE_30
                );
                const receipt = await tx.wait();
                totalGasV1 += receipt.gasUsed;
            }
            const v1EndTime = Date.now();
            
            // Measure V2 matrix placement
            const v2StartTime = Date.now();
            for (let i = 0; i < Math.min(numberOfUsers, users.length - 10); i++) {
                const tx = await this.contractV2.connect(users[i + 10]).registerUser(
                    await this.contractV2.matrixRoot(),
                    PackageTier.PACKAGE_30
                );
                const receipt = await tx.wait();
                totalGasV2 += receipt.gasUsed;
            }
            const v2EndTime = Date.now();
            
            const avgGasV1 = totalGasV1 / BigInt(numberOfUsers);
            const avgGasV2 = totalGasV2 / BigInt(numberOfUsers);
            const gasImprovement = avgGasV1 - avgGasV2;
            const percentImprovement = (gasImprovement * 100n) / avgGasV1;
            
            console.log(`V1 Average Gas per Registration: ${avgGasV1.toString()}`);
            console.log(`V2 Average Gas per Registration: ${avgGasV2.toString()}`);
            console.log(`Average Gas Improvement: ${gasImprovement.toString()} (${percentImprovement.toString()}%)`);
            console.log(`V1 Time: ${v1EndTime - v1StartTime}ms`);
            console.log(`V2 Time: ${v2EndTime - v2StartTime}ms`);
            
        } catch (error) {
            console.log("Benchmark error:", error.message);
        }
    }

    /**
     * Generate comprehensive gas optimization report
     */
    generateReport() {
        console.log("\n📋 GAS OPTIMIZATION REPORT");
        console.log("================================");
        
        console.log("\n🎯 Key Improvements in V2:");
        console.log("• Optimized struct packing reduces storage costs");
        console.log("• uint32/uint128 types instead of uint256 where appropriate");
        console.log("• Enhanced event logging with structured data");
        console.log("• Modular function design reduces code duplication");
        console.log("• Improved validation logic reduces unnecessary checks");
        
        console.log("\n💰 Estimated Cost Savings:");
        if (this.gasData.improvements.registration) {
            console.log(`• Registration: ${this.gasData.improvements.registration.percentReduction.toString()}% reduction`);
        }
        if (this.gasData.improvements.withdrawal) {
            console.log(`• Withdrawal: ${this.gasData.improvements.withdrawal.percentReduction.toString()}% reduction`);
        }
        console.log("• Storage operations: ~25% reduction due to struct optimization");
        
        console.log("\n🔧 Additional Optimization Opportunities:");
        console.log("• Batch operations for multiple registrations");
        console.log("• Lazy evaluation for complex calculations");
        console.log("• Assembly optimizations for critical paths");
        console.log("• Custom errors instead of string revert messages");
        console.log("• Proxy storage layout optimization");
        
        console.log("\n📈 Production Scaling Considerations:");
        console.log("• Matrix tree depth optimization for large user bases");
        console.log("• Pagination for view functions returning large datasets");
        console.log("• Event filtering and indexing optimization");
        console.log("• Circuit breaker gas limits for emergency situations");
    }
}

async function main() {
    console.log("🚀 Starting Gas Optimization Analysis...");
    
    // This would be run with actual deployed contracts
    console.log("Note: This is a template for gas analysis.");
    console.log("To run actual analysis, deploy both V1 and V2 contracts with test data.");
    
    // Example usage:
    /*
    const [owner, ...users] = await ethers.getSigners();
    
    // Deploy contracts
    const mockUSDT = await deployMockUSDT();
    const contractV1 = await deployV1(mockUSDT);
    const contractV2 = await deployV2(mockUSDT);
    
    // Initialize analyzer
    const analyzer = new GasAnalyzer(contractV1, contractV2, mockUSDT);
    
    // Run analysis
    await analyzer.measureRegistrationGas(users, 1);
    await analyzer.measureWithdrawalGas(users);
    await analyzer.measureViewFunctionGas();
    await analyzer.analyzeStorageLayout();
    await analyzer.benchmarkMatrixPlacement(users, 20);
    
    // Generate report
    analyzer.generateReport();
    */
}

module.exports = {
    GasAnalyzer,
    main
};

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
