const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Enhanced deployment script for OrphiCrowdFundV4UltraGovernance
 * Includes governance contracts and multi-signature treasury setup
 */
async function main() {
    console.log("🚀 Starting OrphiCrowdFund V4 Ultra Governance Deployment...\n");

    const [deployer, trezorAdmin, ...signers] = await ethers.getSigners();
    console.log("📋 Deployment Configuration:");
    console.log("Deployer address:", deployer.address);
    console.log("Trezor admin address:", trezorAdmin.address);
    console.log("Deployer balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

    // Deployment configuration
    const config = {
        // Multi-signature treasury configuration
        treasurySigners: [
            deployer.address,
            trezorAdmin.address,
            signers[0]?.address || deployer.address, // Fallback if not enough signers
            signers[1]?.address || trezorAdmin.address
        ].slice(0, 4), // Take first 4 signers
        requiredSignatures: 3, // Require 3 out of 4 signatures
        proposalDuration: 7 * 24 * 3600, // 7 days
        
        // USDT token configuration (use actual USDT address on mainnet)
        usdtAddress: process.env.USDT_ADDRESS || null, // Set in .env for mainnet
        
        // Security configuration
        emergencyOperators: [
            deployer.address,
            trezorAdmin.address
        ],
        
        // Initial package configuration (in USDT wei - 6 decimals)
        packages: {
            tier1: ethers.parseUnits("100", 6),   // $100
            tier2: ethers.parseUnits("200", 6),   // $200
            tier3: ethers.parseUnits("500", 6),   // $500
            tier4: ethers.parseUnits("1000", 6),  // $1000
            tier5: ethers.parseUnits("2000", 6)   // $2000
        }
    };

    console.log("\n🔧 Configuration:");
    console.log("Treasury signers:", config.treasurySigners);
    console.log("Required signatures:", config.requiredSignatures);
    console.log("Proposal duration:", config.proposalDuration / (24 * 3600), "days");

    let deployedContracts = {};

    try {
        // Step 1: Deploy or get USDT token
        let usdtToken;
        if (config.usdtAddress) {
            console.log("\n📄 Using existing USDT token at:", config.usdtAddress);
            usdtToken = await ethers.getContractAt("IERC20", config.usdtAddress);
        } else {
            console.log("\n📄 Deploying Mock USDT for testing...");
            const MockUSDT = await ethers.getContractFactory("MockUSDT");
            usdtToken = await MockUSDT.deploy();
            await usdtToken.waitForDeployment();
            
            const usdtAddress = await usdtToken.getAddress();
            console.log("✅ Mock USDT deployed at:", usdtAddress);
            deployedContracts.mockUSDT = usdtAddress;

            // Mint initial supply for testing
            if (!config.usdtAddress) {
                const mintAmount = ethers.parseUnits("10000000", 6); // 10M USDT
                await usdtToken.mint(deployer.address, mintAmount);
                console.log("💰 Minted", ethers.formatUnits(mintAmount, 6), "USDT to deployer");
            }
        }

        // Step 2: Deploy main governance contract
        console.log("\n🏛️ Deploying OrphiCrowdFundV4UltraGovernance...");
        const OrphiGovernance = await ethers.getContractFactory("OrphiCrowdFundV4UltraGovernance");
        
        const orphiGovernance = await OrphiGovernance.deploy(
            await usdtToken.getAddress(),
            trezorAdmin.address,
            config.treasurySigners,
            config.requiredSignatures
        );
        await orphiGovernance.waitForDeployment();
        
        const governanceAddress = await orphiGovernance.getAddress();
        console.log("✅ OrphiCrowdFundV4UltraGovernance deployed at:", governanceAddress);
        deployedContracts.orphiGovernance = governanceAddress;

        // Step 3: Initialize governance contracts
        console.log("\n🔐 Initializing governance contracts...");
        const initTx = await orphiGovernance.initializeGovernance();
        await initTx.wait();
        console.log("✅ Governance contracts initialized");

        // Get governance contract addresses
        const [accessControlAddr, emergencyAddr] = await orphiGovernance.getGovernanceAddresses();
        console.log("📋 Access Control contract:", accessControlAddr);
        console.log("🚨 Emergency contract:", emergencyAddr);
        
        deployedContracts.accessControl = accessControlAddr;
        deployedContracts.emergencyContract = emergencyAddr;

        // Step 4: Configure emergency operators
        console.log("\n⚠️ Configuring emergency operators...");
        const emergencyContract = await ethers.getContractAt("OrphiEmergency", emergencyAddr);
        
        for (const operator of config.emergencyOperators) {
            if (operator !== deployer.address) { // Owner is automatically an operator
                const addOpTx = await emergencyContract.addEmergencyOperator(operator);
                await addOpTx.wait();
                console.log("✅ Added emergency operator:", operator);
            }
        }

        // Step 5: Grant additional roles through access control
        console.log("\n👥 Configuring access control roles...");
        const accessControl = await ethers.getContractAt("OrphiAccessControl", accessControlAddr);
        
        // Grant operator role to trezor admin
        await orphiGovernance.grantOperatorRole(trezorAdmin.address);
        console.log("✅ Granted operator role to trezor admin");

        // Grant distributor role to deployer (for initial distributions)
        await orphiGovernance.grantDistributorRole(deployer.address);
        console.log("✅ Granted distributor role to deployer");

        // Step 6: Create initial treasury proposal for testing (if using mock USDT)
        if (!config.usdtAddress) {
            console.log("\n💰 Creating initial treasury setup...");
            
            // Transfer some USDT to the contract for treasury testing
            const treasuryAmount = ethers.parseUnits("100000", 6); // 100k USDT
            await usdtToken.transfer(governanceAddress, treasuryAmount);
            console.log("✅ Transferred", ethers.formatUnits(treasuryAmount, 6), "USDT to contract treasury");

            // Create a test treasury proposal
            const testAmount = ethers.parseUnits("1000", 6);
            const proposalTx = await orphiGovernance.createTreasuryProposal(
                await usdtToken.getAddress(),
                deployer.address,
                testAmount,
                "Initial treasury test proposal",
                false
            );
            const receipt = await proposalTx.wait();
            console.log("✅ Created test treasury proposal");
        }

        // Step 7: Verify deployment
        console.log("\n🔍 Verifying deployment...");
        
        // Check governance initialization
        const isInitialized = await orphiGovernance.isGovernanceInitialized();
        console.log("Governance initialized:", isInitialized);

        // Check multi-sig configuration
        const multiSigConfig = await orphiGovernance.getMultiSigConfig();
        console.log("Multi-sig signers:", multiSigConfig.signers.length);
        console.log("Required signatures:", multiSigConfig.requiredSignatures.toString());

        // Check access control roles
        const hasAdminRole = await accessControl.hasRole(await accessControl.ADMIN_ROLE(), deployer.address);
        console.log("Deployer has admin role:", hasAdminRole);

        console.log("\n🎉 Deployment completed successfully!");
        
        // Step 8: Save deployment information
        const deploymentInfo = {
            network: (await ethers.provider.getNetwork()).name,
            chainId: (await ethers.provider.getNetwork()).chainId.toString(),
            deployer: deployer.address,
            trezorAdmin: trezorAdmin.address,
            deploymentTimestamp: new Date().toISOString(),
            contracts: deployedContracts,
            configuration: {
                treasurySigners: config.treasurySigners,
                requiredSignatures: config.requiredSignatures,
                proposalDuration: config.proposalDuration,
                emergencyOperators: config.emergencyOperators
            },
            gasUsed: {
                // You can add gas usage tracking here if needed
            }
        };

        // Save to deployments directory
        const deploymentsDir = path.join(__dirname, "..", "deployments");
        if (!fs.existsSync(deploymentsDir)) {
            fs.mkdirSync(deploymentsDir, { recursive: true });
        }

        const deploymentFile = path.join(deploymentsDir, `governance-deployment-${Date.now()}.json`);
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        console.log("📁 Deployment info saved to:", deploymentFile);

        // Save latest deployment
        const latestFile = path.join(deploymentsDir, "latest-governance.json");
        fs.writeFileSync(latestFile, JSON.stringify(deploymentInfo, null, 2));
        console.log("📁 Latest deployment saved to:", latestFile);

        // Step 9: Display usage instructions
        console.log("\n📖 Usage Instructions:");
        console.log("1. Treasury Management:");
        console.log("   - Create proposals with createTreasuryProposal()");
        console.log("   - Approve with approveTreasuryProposal()");
        console.log("   - Execute automatically when threshold is reached");
        
        console.log("\n2. Emergency Controls:");
        console.log("   - Emergency pause: emergencyPauseSystem()");
        console.log("   - Emergency unpause: emergencyUnpauseSystem()");
        console.log("   - Emergency treasury: emergencyTreasuryAction()");
        
        console.log("\n3. Access Control:");
        console.log("   - Grant roles: grantOperatorRole(), grantDistributorRole()");
        console.log("   - Manage through AccessControl contract");
        
        console.log("\n4. Contract Addresses:");
        for (const [name, address] of Object.entries(deployedContracts)) {
            console.log(`   ${name}: ${address}`);
        }

        console.log("\n⚠️ Security Reminders:");
        console.log("- Transfer ownership to a secure multi-sig wallet");
        console.log("- Verify all contract addresses before mainnet use");
        console.log("- Test all functionality on testnet first");
        console.log("- Keep private keys secure");
        console.log("- Set up monitoring for contract events");

        return deployedContracts;

    } catch (error) {
        console.error("\n❌ Deployment failed:", error);
        throw error;
    }
}

// Handle both direct execution and module export
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = main;
