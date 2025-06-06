const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * OrphiCrowdFund Governance Management Utility
 * Provides CLI tools for managing governance functions
 */
class GovernanceManager {
    constructor() {
        this.contracts = {};
        this.signer = null;
    }

    async initialize(deploymentFile = null) {
        console.log("🔧 Initializing Governance Manager...");
        
        // Get signer
        const [signer] = await ethers.getSigners();
        this.signer = signer;
        console.log("📝 Using signer:", signer.address);

        // Load deployment info
        if (!deploymentFile) {
            const latestFile = path.join(__dirname, "..", "deployments", "latest-governance.json");
            if (fs.existsSync(latestFile)) {
                deploymentFile = latestFile;
            } else {
                throw new Error("No deployment file found. Please provide deployment file path.");
            }
        }

        const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
        console.log("📄 Loaded deployment from:", deploymentFile);

        // Initialize contracts
        this.contracts.governance = await ethers.getContractAt(
            "OrphiCrowdFundV4UltraGovernance",
            deploymentInfo.contracts.orphiGovernance
        );

        this.contracts.accessControl = await ethers.getContractAt(
            "OrphiAccessControl",
            deploymentInfo.contracts.accessControl
        );

        this.contracts.emergency = await ethers.getContractAt(
            "OrphiEmergency",
            deploymentInfo.contracts.emergencyContract
        );

        if (deploymentInfo.contracts.mockUSDT) {
            this.contracts.usdt = await ethers.getContractAt(
                "MockUSDT",
                deploymentInfo.contracts.mockUSDT
            );
        }

        console.log("✅ Governance Manager initialized");
        return this;
    }

    // ===== TREASURY MANAGEMENT =====
    async createTreasuryProposal(tokenAddress, recipientAddress, amount, reason, isEmergency = false) {
        console.log("\n💰 Creating Treasury Proposal...");
        console.log("Token:", tokenAddress);
        console.log("Recipient:", recipientAddress);
        console.log("Amount:", ethers.formatUnits(amount, 6), "USDT");
        console.log("Reason:", reason);
        console.log("Emergency:", isEmergency);

        try {
            const tx = await this.contracts.governance.createTreasuryProposal(
                tokenAddress,
                recipientAddress,
                amount,
                reason,
                isEmergency
            );
            const receipt = await tx.wait();

            // Extract proposal ID from events
            const event = receipt.logs.find(log => {
                try {
                    const parsed = this.contracts.governance.interface.parseLog(log);
                    return parsed.name === "TreasuryProposalCreated";
                } catch (e) {
                    return false;
                }
            });

            if (event) {
                const parsed = this.contracts.governance.interface.parseLog(event);
                const proposalId = parsed.args.proposalId;
                console.log("✅ Proposal created with ID:", proposalId);
                return proposalId;
            } else {
                console.log("✅ Proposal created (ID not found in events)");
                return null;
            }
        } catch (error) {
            console.error("❌ Failed to create proposal:", error.message);
            throw error;
        }
    }

    async approveTreasuryProposal(proposalId) {
        console.log("\n✅ Approving Treasury Proposal:", proposalId);

        try {
            const tx = await this.contracts.governance.approveTreasuryProposal(proposalId);
            await tx.wait();
            
            console.log("✅ Proposal approved");

            // Check if proposal was executed
            const proposal = await this.contracts.governance.getTreasuryProposal(proposalId);
            if (proposal.executed) {
                console.log("🎉 Proposal automatically executed!");
            } else {
                console.log("⏳ Proposal needs more approvals");
                console.log("Current approvals:", proposal.approvals.toString());
                const config = await this.contracts.governance.getMultiSigConfig();
                console.log("Required approvals:", config.requiredSignatures.toString());
            }
        } catch (error) {
            console.error("❌ Failed to approve proposal:", error.message);
            throw error;
        }
    }

    async listActiveProposals() {
        console.log("\n📋 Active Treasury Proposals:");

        try {
            const activeProposals = await this.contracts.governance.getActiveProposals();
            
            if (activeProposals.length === 0) {
                console.log("No active proposals");
                return [];
            }

            for (let i = 0; i < activeProposals.length; i++) {
                const proposalId = activeProposals[i];
                const proposal = await this.contracts.governance.getTreasuryProposal(proposalId);
                
                console.log(`\n${i + 1}. Proposal ID: ${proposalId}`);
                console.log(`   Proposer: ${proposal.proposer}`);
                console.log(`   Token: ${proposal.token}`);
                console.log(`   Recipient: ${proposal.to}`);
                console.log(`   Amount: ${ethers.formatUnits(proposal.amount, 6)} USDT`);
                console.log(`   Reason: ${proposal.reason}`);
                console.log(`   Deadline: ${new Date(Number(proposal.deadline) * 1000).toLocaleString()}`);
                console.log(`   Approvals: ${proposal.approvals}/${(await this.contracts.governance.getMultiSigConfig()).requiredSignatures}`);
                console.log(`   Status: ${proposal.executed ? "Executed" : proposal.cancelled ? "Cancelled" : "Pending"}`);
            }

            return activeProposals;
        } catch (error) {
            console.error("❌ Failed to list proposals:", error.message);
            throw error;
        }
    }

    // ===== ACCESS CONTROL MANAGEMENT =====
    async grantRole(roleType, userAddress) {
        console.log(`\n👥 Granting ${roleType} role to:`, userAddress);

        try {
            let tx;
            switch (roleType.toLowerCase()) {
                case "operator":
                    tx = await this.contracts.governance.grantOperatorRole(userAddress);
                    break;
                case "distributor":
                    tx = await this.contracts.governance.grantDistributorRole(userAddress);
                    break;
                default:
                    throw new Error("Invalid role type. Use 'operator' or 'distributor'");
            }

            await tx.wait();
            console.log("✅ Role granted successfully");
        } catch (error) {
            console.error("❌ Failed to grant role:", error.message);
            throw error;
        }
    }

    async revokeRole(roleType, userAddress) {
        console.log(`\n👥 Revoking ${roleType} role from:`, userAddress);

        try {
            let tx;
            switch (roleType.toLowerCase()) {
                case "operator":
                    tx = await this.contracts.governance.revokeOperatorRole(userAddress);
                    break;
                default:
                    throw new Error("Invalid role type. Use 'operator'");
            }

            await tx.wait();
            console.log("✅ Role revoked successfully");
        } catch (error) {
            console.error("❌ Failed to revoke role:", error.message);
            throw error;
        }
    }

    async listRoles() {
        console.log("\n👥 Access Control Roles:");

        try {
            const accessControl = this.contracts.accessControl;
            
            // Get role constants
            const adminRole = await accessControl.ADMIN_ROLE();
            const operatorRole = await accessControl.OPERATOR_ROLE();
            const distributorRole = await accessControl.DISTRIBUTOR_ROLE();
            const emergencyRole = await accessControl.EMERGENCY_ROLE();

            const roles = [
                { name: "Admin", hash: adminRole },
                { name: "Operator", hash: operatorRole },
                { name: "Distributor", hash: distributorRole },
                { name: "Emergency", hash: emergencyRole }
            ];

            for (const role of roles) {
                console.log(`\n${role.name} Role:`);
                const memberCount = await accessControl.getRoleMemberCount(role.hash);
                console.log(`  Members: ${memberCount}`);
                
                for (let i = 0; i < memberCount; i++) {
                    const member = await accessControl.getRoleMember(role.hash, i);
                    console.log(`  - ${member}`);
                }
            }
        } catch (error) {
            console.error("❌ Failed to list roles:", error.message);
            throw error;
        }
    }

    // ===== EMERGENCY MANAGEMENT =====
    async emergencyPause(reason) {
        console.log("\n🚨 Activating Emergency Pause...");
        console.log("Reason:", reason);

        try {
            const tx = await this.contracts.governance.emergencyPauseSystem(reason);
            await tx.wait();
            console.log("✅ Emergency pause activated");
        } catch (error) {
            console.error("❌ Failed to activate emergency pause:", error.message);
            throw error;
        }
    }

    async emergencyUnpause() {
        console.log("\n🔄 Deactivating Emergency Pause...");

        try {
            const tx = await this.contracts.governance.emergencyUnpauseSystem();
            await tx.wait();
            console.log("✅ Emergency pause deactivated");
        } catch (error) {
            console.error("❌ Failed to deactivate emergency pause:", error.message);
            throw error;
        }
    }

    async getEmergencyStatus() {
        console.log("\n🚨 Emergency Status:");

        try {
            const status = await this.contracts.emergency.getEmergencyStatus();
            console.log("Emergency Active:", status.emergency);
            console.log("Pause Active:", status.paused);
            console.log("Withdrawals Disabled:", status.withdrawalsDisabledFlag);
            console.log("Registrations Disabled:", status.registrationsDisabledFlag);
            console.log("Emergency Fund Balance:", ethers.formatUnits(status.emergencyFundBalanceAmount, 18), "ETH");

            return status;
        } catch (error) {
            console.error("❌ Failed to get emergency status:", error.message);
            throw error;
        }
    }

    async blacklistAddress(address, reason) {
        console.log("\n⛔ Blacklisting Address:", address);
        console.log("Reason:", reason);

        try {
            const tx = await this.contracts.emergency.blacklistAddress(address, reason);
            await tx.wait();
            console.log("✅ Address blacklisted");
        } catch (error) {
            console.error("❌ Failed to blacklist address:", error.message);
            throw error;
        }
    }

    async whitelistAddress(address) {
        console.log("\n✅ Whitelisting Address:", address);

        try {
            const tx = await this.contracts.emergency.whitelistAddress(address);
            await tx.wait();
            console.log("✅ Address whitelisted");
        } catch (error) {
            console.error("❌ Failed to whitelist address:", error.message);
            throw error;
        }
    }

    // ===== SYSTEM STATUS =====
    async getSystemStatus() {
        console.log("\n📊 System Status:");

        try {
            // Governance status
            const isInitialized = await this.contracts.governance.isGovernanceInitialized();
            console.log("Governance Initialized:", isInitialized);

            const isPaused = await this.contracts.governance.paused();
            console.log("System Paused:", isPaused);

            // Multi-sig configuration
            const multiSigConfig = await this.contracts.governance.getMultiSigConfig();
            console.log("Multi-sig Signers:", multiSigConfig.signers.length);
            console.log("Required Signatures:", multiSigConfig.requiredSignatures.toString());

            // Active proposals
            const activeProposals = await this.contracts.governance.getActiveProposals();
            console.log("Active Proposals:", activeProposals.length);

            // Emergency status
            const emergencyStatus = await this.contracts.emergency.getEmergencyStatus();
            console.log("Emergency Mode:", emergencyStatus.emergency);

            // Contract balances (if USDT is available)
            if (this.contracts.usdt) {
                const contractBalance = await this.contracts.usdt.balanceOf(await this.contracts.governance.getAddress());
                console.log("Contract USDT Balance:", ethers.formatUnits(contractBalance, 6), "USDT");
            }

            return {
                initialized: isInitialized,
                paused: isPaused,
                multiSig: multiSigConfig,
                activeProposals: activeProposals.length,
                emergencyMode: emergencyStatus.emergency
            };
        } catch (error) {
            console.error("❌ Failed to get system status:", error.message);
            throw error;
        }
    }

    // ===== UTILITY FUNCTIONS =====
    async fundAccount(address, amount) {
        if (!this.contracts.usdt) {
            console.log("❌ No USDT contract available (mainnet deployment)");
            return;
        }

        console.log(`\n💰 Funding ${address} with ${ethers.formatUnits(amount, 6)} USDT...`);

        try {
            const tx = await this.contracts.usdt.mint(address, amount);
            await tx.wait();
            console.log("✅ Account funded");
        } catch (error) {
            console.error("❌ Failed to fund account:", error.message);
            throw error;
        }
    }

    async cleanupExpiredProposals() {
        console.log("\n🧹 Cleaning up expired proposals...");

        try {
            const tx = await this.contracts.governance.cleanupExpiredProposals();
            await tx.wait();
            console.log("✅ Expired proposals cleaned up");
        } catch (error) {
            console.error("❌ Failed to cleanup proposals:", error.message);
            throw error;
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
📖 OrphiCrowdFund Governance Manager CLI

Usage: node governance-manager.js <command> [options]

Commands:
  status                          - Show system status
  proposals                       - List active proposals
  create-proposal <token> <to> <amount> <reason> [emergency]
  approve-proposal <proposalId>
  grant-role <type> <address>     - Grant role (operator/distributor)
  revoke-role <type> <address>    - Revoke role
  list-roles                      - List all roles and members
  emergency-pause <reason>        - Activate emergency pause
  emergency-unpause               - Deactivate emergency pause
  emergency-status                - Show emergency status
  blacklist <address> <reason>    - Blacklist address
  whitelist <address>             - Whitelist address
  fund <address> <amount>         - Fund address with test USDT
  cleanup                         - Clean up expired proposals

Examples:
  node governance-manager.js status
  node governance-manager.js proposals
  node governance-manager.js create-proposal 0x123... 0x456... 1000000000 "Monthly distribution"
  node governance-manager.js approve-proposal 0xabc123...
  node governance-manager.js grant-role operator 0x789...
  node governance-manager.js emergency-pause "Security issue detected"
        `);
        process.exit(0);
    }

    const manager = new GovernanceManager();
    await manager.initialize();

    const command = args[0];

    try {
        switch (command) {
            case "status":
                await manager.getSystemStatus();
                break;

            case "proposals":
                await manager.listActiveProposals();
                break;

            case "create-proposal":
                if (args.length < 5) {
                    console.log("Usage: create-proposal <token> <to> <amount> <reason> [emergency]");
                    process.exit(1);
                }
                const proposalId = await manager.createTreasuryProposal(
                    args[1], // token
                    args[2], // to
                    args[3], // amount
                    args[4], // reason
                    args[5] === "true" // emergency
                );
                if (proposalId) {
                    console.log("\n📋 Use this ID to approve:", proposalId);
                }
                break;

            case "approve-proposal":
                if (args.length < 2) {
                    console.log("Usage: approve-proposal <proposalId>");
                    process.exit(1);
                }
                await manager.approveTreasuryProposal(args[1]);
                break;

            case "grant-role":
                if (args.length < 3) {
                    console.log("Usage: grant-role <type> <address>");
                    process.exit(1);
                }
                await manager.grantRole(args[1], args[2]);
                break;

            case "revoke-role":
                if (args.length < 3) {
                    console.log("Usage: revoke-role <type> <address>");
                    process.exit(1);
                }
                await manager.revokeRole(args[1], args[2]);
                break;

            case "list-roles":
                await manager.listRoles();
                break;

            case "emergency-pause":
                if (args.length < 2) {
                    console.log("Usage: emergency-pause <reason>");
                    process.exit(1);
                }
                await manager.emergencyPause(args[1]);
                break;

            case "emergency-unpause":
                await manager.emergencyUnpause();
                break;

            case "emergency-status":
                await manager.getEmergencyStatus();
                break;

            case "blacklist":
                if (args.length < 3) {
                    console.log("Usage: blacklist <address> <reason>");
                    process.exit(1);
                }
                await manager.blacklistAddress(args[1], args[2]);
                break;

            case "whitelist":
                if (args.length < 2) {
                    console.log("Usage: whitelist <address>");
                    process.exit(1);
                }
                await manager.whitelistAddress(args[1]);
                break;

            case "fund":
                if (args.length < 3) {
                    console.log("Usage: fund <address> <amount>");
                    process.exit(1);
                }
                await manager.fundAccount(args[1], args[2]);
                break;

            case "cleanup":
                await manager.cleanupExpiredProposals();
                break;

            default:
                console.log("❌ Unknown command:", command);
                console.log("Run without arguments to see available commands");
                process.exit(1);
        }

        console.log("\n✅ Command completed successfully");
    } catch (error) {
        console.error("\n❌ Command failed:", error.message);
        process.exit(1);
    }
}

// Handle both CLI and module usage
if (require.main === module) {
    main().catch(console.error);
}

module.exports = GovernanceManager;
