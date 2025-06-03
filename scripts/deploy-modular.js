// SPDX-License-Identifier: MIT
const { ethers, upgrades } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Comprehensive deployment script for Orphi Modular Architecture
 * Supports Core, Pro, and Enterprise deployments with full configuration
 */

class OrphiDeploymentManager {
    constructor() {
        this.deploymentLog = [];
        this.deployedContracts = {};
        this.config = {};
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}`;
        console.log(logEntry);
        this.deploymentLog.push(logEntry);
    }

    async loadConfig(configPath = "./deployment-config.json") {
        try {
            const configFile = fs.readFileSync(configPath, "utf8");
            this.config = JSON.parse(configFile);
            this.log(`Configuration loaded from ${configPath}`);
        } catch (error) {
            this.log(`Warning: Could not load config from ${configPath}, using defaults`);
            this.config = this.getDefaultConfig();
        }
    }

    getDefaultConfig() {
        return {
            // Network configuration
            network: "bsc_testnet",
            
            // Contract addresses (update for your network)
            usdtAddress: "0x55d398326f99059fF775485246999027B3197955", // BSC Mainnet USDT
            adminReserve: "0x0000000000000000000000000000000000000000", // Will be set to deployer if zero
            matrixRoot: "0x0000000000000000000000000000000000000000", // Will be set to deployer if zero
            
            // Deployment options
            deploymentTier: "core", // "core", "pro", or "enterprise"
            verifyContracts: true,
            saveArtifacts: true,
            runTests: true,
            
            // Gas configuration
            gasPrice: "5000000000", // 5 gwei
            gasLimit: "8000000",
            
            // Feature flags
            features: {
                governance: true,
                automation: true,
                emergencyControls: true,
                advancedAnalytics: false
            }
        };
    }

    async deployLibraries() {
        this.log("=== Deploying Libraries ===");
        
        // Deploy MatrixLibrary
        this.log("Deploying MatrixLibrary...");
        const MatrixLibrary = await ethers.getContractFactory("MatrixLibrary");
        const matrixLibrary = await MatrixLibrary.deploy();
        await matrixLibrary.waitForDeployment();
        
        const matrixLibAddress = await matrixLibrary.getAddress();
        this.deployedContracts.matrixLibrary = matrixLibAddress;
        this.log(`✓ MatrixLibrary deployed at: ${matrixLibAddress}`);
        
        // Deploy CommissionLibrary
        this.log("Deploying CommissionLibrary...");
        const CommissionLibrary = await ethers.getContractFactory("CommissionLibrary");
        const commissionLibrary = await CommissionLibrary.deploy();
        await commissionLibrary.waitForDeployment();
        
        const commissionLibAddress = await commissionLibrary.getAddress();
        this.deployedContracts.commissionLibrary = commissionLibAddress;
        this.log(`✓ CommissionLibrary deployed at: ${commissionLibAddress}`);
        
        return {
            MatrixLibrary: matrixLibAddress,
            CommissionLibrary: commissionLibAddress
        };
    }

    async deployMockUSDT() {
        if (this.config.network !== "bsc_testnet" && this.config.network !== "hardhat") {
            this.log("Skipping MockUSDT deployment for mainnet");
            return this.config.usdtAddress;
        }
        
        this.log("Deploying MockUSDT for testing...");
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        const mockUSDT = await MockUSDT.deploy();
        await mockUSDT.waitForDeployment();
        
        const mockUSDTAddress = await mockUSDT.getAddress();
        this.deployedContracts.mockUSDT = mockUSDTAddress;
        this.log(`✓ MockUSDT deployed at: ${mockUSDTAddress}`);
        
        return mockUSDTAddress;
    }

    async deployCoreContracts(libraries, usdtAddress) {
        this.log("=== Deploying Core Contracts ===");
        
        const [deployer] = await ethers.getSigners();
        const adminReserve = this.config.adminReserve === "0x0000000000000000000000000000000000000000" 
            ? deployer.address : this.config.adminReserve;
        const matrixRoot = this.config.matrixRoot === "0x0000000000000000000000000000000000000000" 
            ? deployer.address : this.config.matrixRoot;
        
        this.log(`Using admin reserve: ${adminReserve}`);
        this.log(`Using matrix root: ${matrixRoot}`);
        
        // Deploy OrphiCrowdFundCore
        this.log("Deploying OrphiCrowdFundCore...");
        const OrphiCrowdFundCore = await ethers.getContractFactory("OrphiCrowdFundCore", {
            libraries: {
                MatrixLibrary: libraries.MatrixLibrary,
                CommissionLibrary: libraries.CommissionLibrary
            }
        });
        
        const orphiCore = await OrphiCrowdFundCore.deploy(
            usdtAddress,
            adminReserve,
            matrixRoot,
            deployer.address
        );
        await orphiCore.waitForDeployment();
        
        const orphiCoreAddress = await orphiCore.getAddress();
        this.deployedContracts.orphiCore = orphiCoreAddress;
        this.log(`✓ OrphiCrowdFundCore deployed at: ${orphiCoreAddress}`);
        
        // Deploy modular contracts
        this.log("Deploying modular contracts...");
        await orphiCore.deployModularContracts();
        
        const modularContracts = await orphiCore.getModularContracts();
        this.deployedContracts.modular = modularContracts;
        
        this.log(`✓ OrphiMatrix deployed at: ${modularContracts.matrix}`);
        this.log(`✓ OrphiCommissions deployed at: ${modularContracts.commission}`);
        this.log(`✓ OrphiEarnings deployed at: ${modularContracts.earnings}`);
        this.log(`✓ OrphiGlobalHelpPool deployed at: ${modularContracts.ghp}`);
        this.log(`✓ OrphiLeaderPool deployed at: ${modularContracts.leaderPool}`);
        
        return {
            core: orphiCoreAddress,
            modular: modularContracts
        };
    }

    async deployProContracts(libraries, usdtAddress) {
        if (this.config.deploymentTier === "core") {
            this.log("Skipping Pro contracts for core deployment");
            return null;
        }
        
        this.log("=== Deploying Pro Contracts ===");
        
        const [deployer] = await ethers.getSigners();
        const adminReserve = this.config.adminReserve === "0x0000000000000000000000000000000000000000" 
            ? deployer.address : this.config.adminReserve;
        const matrixRoot = this.config.matrixRoot === "0x0000000000000000000000000000000000000000" 
            ? deployer.address : this.config.matrixRoot;
        
        // Deploy OrphiCrowdFundPro
        this.log("Deploying OrphiCrowdFundPro...");
        const OrphiCrowdFundPro = await ethers.getContractFactory("OrphiCrowdFundPro", {
            libraries: {
                MatrixLibrary: libraries.MatrixLibrary,
                CommissionLibrary: libraries.CommissionLibrary
            }
        });
        
        const orphiPro = await OrphiCrowdFundPro.deploy(
            usdtAddress,
            adminReserve,
            matrixRoot,
            deployer.address
        );
        await orphiPro.waitForDeployment();
        
        const orphiProAddress = await orphiPro.getAddress();
        this.deployedContracts.orphiPro = orphiProAddress;
        this.log(`✓ OrphiCrowdFundPro deployed at: ${orphiProAddress}`);
        
        // Deploy modular contracts
        await orphiPro.deployModularContracts();
        const proModularContracts = await orphiPro.getModularContracts();
        this.deployedContracts.proModular = proModularContracts;
        
        // Deploy governance contracts if enabled
        if (this.config.features.governance) {
            this.log("Deploying governance contracts...");
            await orphiPro.deployGovernanceContracts();
            
            const governanceContracts = {
                accessControl: await orphiPro.accessControl(),
                emergency: await orphiPro.emergencyContract()
            };
            this.deployedContracts.governance = governanceContracts;
            
            this.log(`✓ OrphiAccessControl deployed at: ${governanceContracts.accessControl}`);
            this.log(`✓ OrphiEmergency deployed at: ${governanceContracts.emergency}`);
        }
        
        return {
            pro: orphiProAddress,
            modular: proModularContracts,
            governance: this.deployedContracts.governance
        };
    }

    async deployEnterpriseContracts(libraries, usdtAddress) {
        if (this.config.deploymentTier !== "enterprise") {
            this.log("Skipping Enterprise contracts for non-enterprise deployment");
            return null;
        }
        
        this.log("=== Deploying Enterprise Contracts ===");
        
        const [deployer] = await ethers.getSigners();
        const adminReserve = this.config.adminReserve === "0x0000000000000000000000000000000000000000" 
            ? deployer.address : this.config.adminReserve;
        const matrixRoot = this.config.matrixRoot === "0x0000000000000000000000000000000000000000" 
            ? deployer.address : this.config.matrixRoot;
        
        // Deploy OrphiCrowdFundEnterprise
        this.log("Deploying OrphiCrowdFundEnterprise...");
        const OrphiCrowdFundEnterprise = await ethers.getContractFactory("OrphiCrowdFundEnterprise", {
            libraries: {
                MatrixLibrary: libraries.MatrixLibrary,
                CommissionLibrary: libraries.CommissionLibrary
            }
        });
        
        const orphiEnterprise = await OrphiCrowdFundEnterprise.deploy(
            usdtAddress,
            adminReserve,
            matrixRoot,
            deployer.address
        );
        await orphiEnterprise.waitForDeployment();
        
        const orphiEnterpriseAddress = await orphiEnterprise.getAddress();
        this.deployedContracts.orphiEnterprise = orphiEnterpriseAddress;
        this.log(`✓ OrphiCrowdFundEnterprise deployed at: ${orphiEnterpriseAddress}`);
        
        // Deploy modular contracts
        await orphiEnterprise.deployModularContracts();
        const enterpriseModularContracts = await orphiEnterprise.getModularContracts();
        this.deployedContracts.enterpriseModular = enterpriseModularContracts;
        
        // Deploy governance contracts
        await orphiEnterprise.deployGovernanceContracts();
        const governanceContracts = {
            accessControl: await orphiEnterprise.accessControl(),
            emergency: await orphiEnterprise.emergencyContract()
        };
        this.deployedContracts.enterpriseGovernance = governanceContracts;
        
        // Deploy automation contract if enabled
        if (this.config.features.automation) {
            this.log("Deploying automation contracts...");
            await orphiEnterprise.deployAutomationContract();
            
            const automationAddress = await orphiEnterprise.automationContract();
            this.deployedContracts.automation = automationAddress;
            this.log(`✓ OrphiChainlinkAutomation deployed at: ${automationAddress}`);
        }
        
        return {
            enterprise: orphiEnterpriseAddress,
            modular: enterpriseModularContracts,
            governance: governanceContracts,
            automation: this.deployedContracts.automation
        };
    }

    async verifyContracts() {
        if (!this.config.verifyContracts) {
            this.log("Contract verification skipped");
            return;
        }
        
        this.log("=== Verifying Contracts ===");
        
        try {
            // Verify libraries
            if (this.deployedContracts.matrixLibrary) {
                await hre.run("verify:verify", {
                    address: this.deployedContracts.matrixLibrary,
                    constructorArguments: []
                });
                this.log(`✓ MatrixLibrary verified`);
            }
            
            if (this.deployedContracts.commissionLibrary) {
                await hre.run("verify:verify", {
                    address: this.deployedContracts.commissionLibrary,
                    constructorArguments: []
                });
                this.log(`✓ CommissionLibrary verified`);
            }
            
            // Verify main contracts
            if (this.deployedContracts.orphiCore) {
                await hre.run("verify:verify", {
                    address: this.deployedContracts.orphiCore,
                    constructorArguments: [
                        this.config.usdtAddress,
                        this.config.adminReserve,
                        this.config.matrixRoot,
                        (await ethers.getSigners())[0].address
                    ]
                });
                this.log(`✓ OrphiCrowdFundCore verified`);
            }
            
            // Add verification for other contracts as needed
            
        } catch (error) {
            this.log(`Warning: Contract verification failed: ${error.message}`);
        }
    }

    async saveDeploymentArtifacts() {
        if (!this.config.saveArtifacts) {
            this.log("Artifact saving skipped");
            return;
        }
        
        this.log("=== Saving Deployment Artifacts ===");
        
        const artifactsDir = path.join(__dirname, "../deployment-artifacts");
        if (!fs.existsSync(artifactsDir)) {
            fs.mkdirSync(artifactsDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const networkName = this.config.network;
        
        // Save deployment summary
        const deploymentSummary = {
            timestamp,
            network: networkName,
            deploymentTier: this.config.deploymentTier,
            contracts: this.deployedContracts,
            config: this.config,
            deploymentLog: this.deploymentLog
        };
        
        const summaryPath = path.join(artifactsDir, `deployment-${networkName}-${timestamp}.json`);
        fs.writeFileSync(summaryPath, JSON.stringify(deploymentSummary, null, 2));
        this.log(`✓ Deployment summary saved to: ${summaryPath}`);
        
        // Save contract addresses in a simple format
        const addressesPath = path.join(artifactsDir, `addresses-${networkName}-latest.json`);
        fs.writeFileSync(addressesPath, JSON.stringify(this.deployedContracts, null, 2));
        this.log(`✓ Contract addresses saved to: ${addressesPath}`);
        
        // Save ABI files for frontend integration
        this.saveABIFiles(artifactsDir);
    }

    async saveABIFiles(artifactsDir) {
        const abiDir = path.join(artifactsDir, "abi");
        if (!fs.existsSync(abiDir)) {
            fs.mkdirSync(abiDir, { recursive: true });
        }
        
        const contractNames = [
            "OrphiCrowdFundCore",
            "OrphiCrowdFundPro", 
            "OrphiCrowdFundEnterprise",
            "OrphiMatrix",
            "OrphiCommissions",
            "OrphiEarnings",
            "OrphiGlobalHelpPool",
            "OrphiLeaderPool",
            "OrphiAccessControl",
            "OrphiEmergency",
            "OrphiChainlinkAutomation"
        ];
        
        for (const contractName of contractNames) {
            try {
                const artifactPath = path.join(__dirname, `../artifacts/contracts/**/${contractName}.sol/${contractName}.json`);
                if (fs.existsSync(artifactPath)) {
                    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
                    const abiPath = path.join(abiDir, `${contractName}.json`);
                    fs.writeFileSync(abiPath, JSON.stringify(artifact.abi, null, 2));
                }
            } catch (error) {
                this.log(`Warning: Could not save ABI for ${contractName}: ${error.message}`);
            }
        }
        
        this.log(`✓ ABI files saved to: ${abiDir}`);
    }

    async runBasicTests() {
        if (!this.config.runTests) {
            this.log("Testing skipped");
            return;
        }
        
        this.log("=== Running Basic Tests ===");
        
        try {
            // Test core functionality
            if (this.deployedContracts.orphiCore) {
                const orphiCore = await ethers.getContractAt("OrphiCrowdFundCore", this.deployedContracts.orphiCore);
                
                // Test basic getters
                const totalMembers = await orphiCore.totalMembers();
                this.log(`✓ Total members: ${totalMembers}`);
                
                const systemStats = await orphiCore.getSystemStats();
                this.log(`✓ System stats retrieved`);
                
                const modularContracts = await orphiCore.getModularContracts();
                this.log(`✓ Modular contracts configured`);
            }
            
            this.log("✓ Basic tests passed");
            
        } catch (error) {
            this.log(`✗ Basic tests failed: ${error.message}`);
            throw error;
        }
    }

    async deploy() {
        this.log("🚀 Starting Orphi Modular Architecture Deployment");
        this.log(`Deployment Tier: ${this.config.deploymentTier.toUpperCase()}`);
        this.log(`Network: ${this.config.network}`);
        
        try {
            // 1. Deploy Libraries
            const libraries = await this.deployLibraries();
            
            // 2. Deploy MockUSDT (if needed)
            const usdtAddress = await this.deployMockUSDT();
            
            // 3. Deploy Core Contracts
            const coreDeployment = await this.deployCoreContracts(libraries, usdtAddress);
            
            // 4. Deploy Pro Contracts (if enabled)
            const proDeployment = await this.deployProContracts(libraries, usdtAddress);
            
            // 5. Deploy Enterprise Contracts (if enabled)
            const enterpriseDeployment = await this.deployEnterpriseContracts(libraries, usdtAddress);
            
            // 6. Verify Contracts
            await this.verifyContracts();
            
            // 7. Run Basic Tests
            await this.runBasicTests();
            
            // 8. Save Artifacts
            await this.saveDeploymentArtifacts();
            
            this.log("🎉 Deployment completed successfully!");
            
            return {
                libraries,
                core: coreDeployment,
                pro: proDeployment,
                enterprise: enterpriseDeployment,
                allContracts: this.deployedContracts
            };
            
        } catch (error) {
            this.log(`💥 Deployment failed: ${error.message}`);
            throw error;
        }
    }
}

// Main deployment function
async function main() {
    const deploymentManager = new OrphiDeploymentManager();
    
    // Load configuration
    await deploymentManager.loadConfig();
    
    // Execute deployment
    const result = await deploymentManager.deploy();
    
    console.log("\n=== DEPLOYMENT SUMMARY ===");
    console.log("Libraries:");
    console.log(`  MatrixLibrary: ${result.libraries.MatrixLibrary}`);
    console.log(`  CommissionLibrary: ${result.libraries.CommissionLibrary}`);
    
    if (result.core) {
        console.log("\nCore Contracts:");
        console.log(`  OrphiCrowdFundCore: ${result.core.core}`);
        console.log(`  OrphiMatrix: ${result.core.modular.matrix}`);
        console.log(`  OrphiCommissions: ${result.core.modular.commission}`);
        console.log(`  OrphiEarnings: ${result.core.modular.earnings}`);
        console.log(`  OrphiGlobalHelpPool: ${result.core.modular.ghp}`);
        console.log(`  OrphiLeaderPool: ${result.core.modular.leaderPool}`);
    }
    
    if (result.pro) {
        console.log("\nPro Contracts:");
        console.log(`  OrphiCrowdFundPro: ${result.pro.pro}`);
        if (result.pro.governance) {
            console.log(`  OrphiAccessControl: ${result.pro.governance.accessControl}`);
            console.log(`  OrphiEmergency: ${result.pro.governance.emergency}`);
        }
    }
    
    if (result.enterprise) {
        console.log("\nEnterprise Contracts:");
        console.log(`  OrphiCrowdFundEnterprise: ${result.enterprise.enterprise}`);
        if (result.enterprise.automation) {
            console.log(`  OrphiChainlinkAutomation: ${result.enterprise.automation}`);
        }
    }
    
    return result;
}

// Execute deployment
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = { OrphiDeploymentManager, main };
