// SPDX-License-Identifier: MIT
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Configuration and verification script for deployed modular contracts
 */

class OrphiConfigurationManager {
    constructor() {
        this.config = {};
        this.deployedContracts = {};
    }

    async loadDeploymentArtifacts(artifactPath = "./deployment-artifacts/addresses-latest.json") {
        try {
            const artifactFile = fs.readFileSync(artifactPath, "utf8");
            this.deployedContracts = JSON.parse(artifactFile);
            console.log(`✓ Deployment artifacts loaded from ${artifactPath}`);
        } catch (error) {
            throw new Error(`Could not load deployment artifacts: ${error.message}`);
        }
    }

    async loadConfiguration(configPath = "./deployment-config.json") {
        try {
            const configFile = fs.readFileSync(configPath, "utf8");
            this.config = JSON.parse(configFile);
            console.log(`✓ Configuration loaded from ${configPath}`);
        } catch (error) {
            throw new Error(`Could not load configuration: ${error.message}`);
        }
    }

    async configureModularContracts() {
        console.log("=== Configuring Modular Contracts ===");
        
        if (!this.deployedContracts.orphiCore) {
            throw new Error("OrphiCore contract address not found");
        }
        
        const orphiCore = await ethers.getContractAt("OrphiCrowdFundCore", this.deployedContracts.orphiCore);
        const modularContracts = await orphiCore.getModularContracts();
        
        // Configure Matrix Contract
        await this.configureMatrixContract(modularContracts.matrix);
        
        // Configure Commission Contract
        await this.configureCommissionContract(modularContracts.commission);
        
        // Configure Earnings Contract
        await this.configureEarningsContract(modularContracts.earnings);
        
        // Configure Pool Contracts
        await this.configurePoolContracts(modularContracts.ghp, modularContracts.leaderPool);
        
        console.log("✓ Modular contracts configured successfully");
    }

    async configureMatrixContract(matrixAddress) {
        console.log(`Configuring OrphiMatrix at ${matrixAddress}...`);
        
        const matrixContract = await ethers.getContractAt("OrphiMatrix", matrixAddress);
        
        // Set the main Orphi contract address
        await matrixContract.setOrphiContract(this.deployedContracts.orphiCore);
        
        console.log("✓ OrphiMatrix configured");
    }

    async configureCommissionContract(commissionAddress) {
        console.log(`Configuring OrphiCommissions at ${commissionAddress}...`);
        
        const commissionContract = await ethers.getContractAt("OrphiCommissions", commissionAddress);
        
        // Set the main Orphi contract address
        await commissionContract.setOrphiContract(this.deployedContracts.orphiCore);
        
        // Configure commission rates if specified in config
        if (this.config.poolConfig) {
            const rates = this.config.poolConfig;
            await commissionContract.updateCommissionRates(
                rates.sponsorCommissionRate,
                rates.levelBonusRate,
                rates.uplineBonusRate,
                rates.leaderBonusRate,
                rates.globalHelpPoolRate
            );
            console.log("✓ Commission rates configured");
        }
        
        console.log("✓ OrphiCommissions configured");
    }

    async configureEarningsContract(earningsAddress) {
        console.log(`Configuring OrphiEarnings at ${earningsAddress}...`);
        
        const earningsContract = await ethers.getContractAt("OrphiEarnings", earningsAddress);
        
        // Set the main Orphi contract address
        await earningsContract.setOrphiContract(this.deployedContracts.orphiCore);
        
        // Configure earnings cap if specified
        if (this.config.securityConfig && this.config.securityConfig.earningsCapMultiplier) {
            await earningsContract.updateEarningsCapMultiplier(this.config.securityConfig.earningsCapMultiplier);
            console.log("✓ Earnings cap configured");
        }
        
        console.log("✓ OrphiEarnings configured");
    }

    async configurePoolContracts(ghpAddress, leaderPoolAddress) {
        console.log(`Configuring pool contracts...`);
        
        // Configure Global Help Pool
        const ghpContract = await ethers.getContractAt("OrphiGlobalHelpPool", ghpAddress);
        await ghpContract.setOrphiContract(this.deployedContracts.orphiCore);
        
        if (this.config.poolConfig && this.config.poolConfig.ghpDistributionInterval) {
            await ghpContract.setDistributionInterval(this.config.poolConfig.ghpDistributionInterval);
        }
        
        // Configure Leader Pool
        const leaderPoolContract = await ethers.getContractAt("OrphiLeaderPool", leaderPoolAddress);
        await leaderPoolContract.setOrphiContract(this.deployedContracts.orphiCore);
        
        if (this.config.poolConfig && this.config.poolConfig.leaderDistributionInterval) {
            await leaderPoolContract.setDistributionInterval(this.config.poolConfig.leaderDistributionInterval);
        }
        
        console.log("✓ Pool contracts configured");
    }

    async configureGovernanceContracts() {
        if (!this.deployedContracts.governance) {
            console.log("No governance contracts to configure");
            return;
        }
        
        console.log("=== Configuring Governance Contracts ===");
        
        // Configure Access Control
        const accessControl = await ethers.getContractAt("OrphiAccessControl", this.deployedContracts.governance.accessControl);
        
        // Configure Emergency Contract
        const emergencyContract = await ethers.getContractAt("OrphiEmergency", this.deployedContracts.governance.emergency);
        
        // Set risk limits if configured
        if (this.config.securityConfig) {
            const security = this.config.securityConfig;
            if (security.maxDailyVolume && security.maxDailyRegistrations) {
                await emergencyContract.updateRiskLimits(security.maxDailyVolume, security.maxDailyRegistrations);
                console.log("✓ Risk limits configured");
            }
        }
        
        console.log("✓ Governance contracts configured");
    }

    async configureAutomationContract() {
        if (!this.deployedContracts.automation) {
            console.log("No automation contract to configure");
            return;
        }
        
        console.log("=== Configuring Automation Contract ===");
        
        const automationContract = await ethers.getContractAt("OrphiChainlinkAutomation", this.deployedContracts.automation);
        
        if (this.config.automationConfig) {
            const automation = this.config.automationConfig;
            
            // Configure automation parameters
            await automationContract.configureAutomation(
                "GHP",
                true,
                automation.automationInterval,
                automation.maxGasLimit
            );
            
            await automationContract.configureAutomation(
                "LEADER",
                true,
                automation.automationInterval,
                automation.maxGasLimit
            );
            
            // Set thresholds
            await automationContract.updateThresholds(
                automation.ghpThreshold,
                automation.leaderThreshold
            );
            
            console.log("✓ Automation contract configured");
        }
    }

    async verifyConfiguration() {
        console.log("=== Verifying Configuration ===");
        
        const orphiCore = await ethers.getContractAt("OrphiCrowdFundCore", this.deployedContracts.orphiCore);
        
        // Verify modular contracts are set
        const modularContracts = await orphiCore.getModularContracts();
        
        console.log("Modular Contracts:");
        console.log(`  Matrix: ${modularContracts.matrix}`);
        console.log(`  Commission: ${modularContracts.commission}`);
        console.log(`  Earnings: ${modularContracts.earnings}`);
        console.log(`  GHP: ${modularContracts.ghp}`);
        console.log(`  Leader Pool: ${modularContracts.leaderPool}`);
        
        // Verify each contract is properly initialized
        const matrixContract = await ethers.getContractAt("OrphiMatrix", modularContracts.matrix);
        const orphiContractAddress = await matrixContract.orphiContract();
        console.log(`✓ Matrix contract linked to: ${orphiContractAddress}`);
        
        const commissionContract = await ethers.getContractAt("OrphiCommissions", modularContracts.commission);
        const commissionRates = await commissionContract.getCommissionRates();
        console.log(`✓ Commission rates: Sponsor ${commissionRates.sponsorRate}, Level ${commissionRates.levelRate}`);
        
        console.log("✓ Configuration verification completed");
    }

    async setupInitialData() {
        console.log("=== Setting Up Initial Data ===");
        
        if (this.config.network === "bsc_testnet" || this.config.network === "hardhat") {
            // For testnet, we can set up some initial test data
            const orphiCore = await ethers.getContractAt("OrphiCrowdFundCore", this.deployedContracts.orphiCore);
            
            // Initialize matrix root if needed
            const systemStats = await orphiCore.getSystemStats();
            console.log(`Current total members: ${systemStats.totalMembers}`);
            
            if (systemStats.totalMembers == 0) {
                console.log("Note: Matrix root should be initialized during first registration");
            }
        }
        
        console.log("✓ Initial data setup completed");
    }

    async generateContractInterface() {
        console.log("=== Generating Contract Interface Documentation ===");
        
        const interfaceDoc = {
            network: this.config.network,
            deploymentTier: this.config.deploymentTier,
            timestamp: new Date().toISOString(),
            contracts: this.deployedContracts,
            configuration: this.config,
            interfaces: {
                core: {
                    address: this.deployedContracts.orphiCore,
                    mainFunctions: [
                        "registerUser(address sponsor, uint8 packageTier)",
                        "upgradePackage(uint8 newPackageTier)",
                        "withdraw(uint256 amount)",
                        "withdrawAll()",
                        "getUserInfo(address user)",
                        "getMatrixInfo(address user)",
                        "getSystemStats()"
                    ]
                }
            }
        };
        
        // Add Pro interface if deployed
        if (this.deployedContracts.orphiPro) {
            interfaceDoc.interfaces.pro = {
                address: this.deployedContracts.orphiPro,
                additionalFunctions: [
                    "registerUserPro(address sponsor, uint8 packageTier)",
                    "withdrawPro(uint256 amount)",
                    "getAdvancedUserStats(address user)",
                    "getDailyMetrics(uint256 day)"
                ]
            };
        }
        
        // Add Enterprise interface if deployed
        if (this.deployedContracts.orphiEnterprise) {
            interfaceDoc.interfaces.enterprise = {
                address: this.deployedContracts.orphiEnterprise,
                additionalFunctions: [
                    "registerUserEnterprise(address sponsor, uint8 packageTier, bytes affiliateData)",
                    "createCustomPool(string poolName, uint256 initialBalance)",
                    "getEnterpriseUserStats(address user)",
                    "configureAutomation(bool enabled, uint256 interval, uint256 gasLimit)"
                ]
            };
        }
        
        // Save interface documentation
        const interfaceDir = path.join(__dirname, "../deployment-artifacts");
        const interfacePath = path.join(interfaceDir, `interface-${this.config.network}-latest.json`);
        
        if (!fs.existsSync(interfaceDir)) {
            fs.mkdirSync(interfaceDir, { recursive: true });
        }
        
        fs.writeFileSync(interfacePath, JSON.stringify(interfaceDoc, null, 2));
        console.log(`✓ Contract interface documentation saved to: ${interfacePath}`);
    }

    async configure() {
        console.log("🔧 Starting Contract Configuration");
        
        try {
            // Load deployment artifacts and configuration
            await this.loadDeploymentArtifacts();
            await this.loadConfiguration();
            
            // Configure all contracts
            await this.configureModularContracts();
            await this.configureGovernanceContracts();
            await this.configureAutomationContract();
            
            // Verify configuration
            await this.verifyConfiguration();
            
            // Setup initial data
            await this.setupInitialData();
            
            // Generate documentation
            await this.generateContractInterface();
            
            console.log("🎉 Contract configuration completed successfully!");
            
        } catch (error) {
            console.error(`💥 Configuration failed: ${error.message}`);
            throw error;
        }
    }
}

// Main configuration function
async function main() {
    const configManager = new OrphiConfigurationManager();
    await configManager.configure();
}

// Execute configuration
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { OrphiConfigurationManager, main };
