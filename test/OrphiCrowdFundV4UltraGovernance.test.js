const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("OrphiCrowdFundV4UltraGovernance", function () {
    let orphiGovernance;
    let mockUSDT;
    let accessControl;
    let emergencyContract;
    let owner, admin, user1, user2, user3, user4, user5;
    let signers, treasurySigners;

    const PackageTier = {
        PACKAGE_100: 1,
        PACKAGE_200: 2,
        PACKAGE_500: 3,
        PACKAGE_1000: 4,
        PACKAGE_2000: 5
    };

    async function deployGovernanceFixture() {
        [owner, admin, user1, user2, user3, user4, user5, ...signers] = await ethers.getSigners();
        treasurySigners = [owner.address, admin.address, user1.address];

        // Deploy Mock USDT
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        mockUSDT = await MockUSDT.deploy();
        await mockUSDT.waitForDeployment();

        // Deploy main governance contract
        const OrphiGovernance = await ethers.getContractFactory("OrphiCrowdFundV4UltraGovernance");
        orphiGovernance = await OrphiGovernance.deploy(
            await mockUSDT.getAddress(),
            admin.address, // Trezor admin
            treasurySigners,
            2 // Required signatures
        );
        await orphiGovernance.waitForDeployment();

        // Initialize governance contracts
        await orphiGovernance.initializeGovernance();

        // Get governance contract addresses
        const [accessControlAddr, emergencyAddr] = await orphiGovernance.getGovernanceAddresses();
        
        accessControl = await ethers.getContractAt("OrphiAccessControl", accessControlAddr);
        emergencyContract = await ethers.getContractAt("OrphiEmergency", emergencyAddr);

        // Setup mock USDT balances
        const fundAmount = ethers.parseUnits("1000000", 6); // 1M USDT
        await mockUSDT.mint(owner.address, fundAmount);
        await mockUSDT.mint(user1.address, fundAmount);
        await mockUSDT.mint(user2.address, fundAmount);
        await mockUSDT.mint(user3.address, fundAmount);
        await mockUSDT.mint(user4.address, fundAmount);
        await mockUSDT.mint(user5.address, fundAmount);

        // Transfer some USDT to contract for treasury testing
        await mockUSDT.transfer(await orphiGovernance.getAddress(), ethers.parseUnits("100000", 6));

        return {
            orphiGovernance,
            mockUSDT,
            accessControl,
            emergencyContract,
            owner,
            admin,
            user1,
            user2,
            user3,
            user4,
            user5,
            treasurySigners
        };
    }

    beforeEach(async function () {
        const fixture = await loadFixture(deployGovernanceFixture);
        orphiGovernance = fixture.orphiGovernance;
        mockUSDT = fixture.mockUSDT;
        accessControl = fixture.accessControl;
        emergencyContract = fixture.emergencyContract;
        owner = fixture.owner;
        admin = fixture.admin;
        user1 = fixture.user1;
        user2 = fixture.user2;
        user3 = fixture.user3;
        user4 = fixture.user4;
        user5 = fixture.user5;
        treasurySigners = fixture.treasurySigners;
    });

    describe("🏛️ Governance Integration", function () {
        it("Should initialize governance contracts correctly", async function () {
            expect(await orphiGovernance.isGovernanceInitialized()).to.be.true;
            
            const [accessControlAddr, emergencyAddr] = await orphiGovernance.getGovernanceAddresses();
            expect(accessControlAddr).to.not.equal(ethers.ZeroAddress);
            expect(emergencyAddr).to.not.equal(ethers.ZeroAddress);
            
            // Check that owner has admin role
            expect(await accessControl.hasRole(await accessControl.ADMIN_ROLE(), owner.address)).to.be.true;
            expect(await accessControl.hasRole(await accessControl.EMERGENCY_ROLE(), owner.address)).to.be.true;
        });

        it("Should prevent double initialization", async function () {
            await expect(orphiGovernance.initializeGovernance())
                .to.be.revertedWith("Governance: already initialized");
        });

        it("Should allow setting external governance contracts", async function () {
            // Deploy new governance contract to test setting external contracts
            const OrphiGovernance2 = await ethers.getContractFactory("OrphiCrowdFundV4UltraGovernance");
            const orphiGovernance2 = await OrphiGovernance2.deploy(
                await mockUSDT.getAddress(),
                admin.address,
                treasurySigners,
                2
            );

            const OrphiAccessControl = await ethers.getContractFactory("OrphiAccessControl");
            const externalAccessControl = await OrphiAccessControl.deploy(owner.address);

            const OrphiEmergency = await ethers.getContractFactory("OrphiEmergency");
            const externalEmergency = await OrphiEmergency.deploy(await orphiGovernance2.getAddress(), owner.address);

            await orphiGovernance2.setGovernanceContracts(
                await externalAccessControl.getAddress(),
                await externalEmergency.getAddress()
            );

            expect(await orphiGovernance2.isGovernanceInitialized()).to.be.true;
        });
    });

    describe("🔐 Access Control Management", function () {
        it("Should grant and revoke operator roles", async function () {
            // Grant operator role
            await orphiGovernance.grantOperatorRole(user1.address);
            expect(await accessControl.hasRole(await accessControl.OPERATOR_ROLE(), user1.address)).to.be.true;

            // Revoke operator role
            await orphiGovernance.revokeOperatorRole(user1.address);
            expect(await accessControl.hasRole(await accessControl.OPERATOR_ROLE(), user1.address)).to.be.false;
        });

        it("Should grant distributor roles", async function () {
            await orphiGovernance.grantDistributorRole(user2.address);
            expect(await accessControl.hasRole(await accessControl.DISTRIBUTOR_ROLE(), user2.address)).to.be.true;
        });

        it("Should prevent unauthorized role management", async function () {
            await expect(orphiGovernance.connect(user1).grantOperatorRole(user2.address))
                .to.be.revertedWith("Governance: unauthorized");
        });
    });

    describe("🚨 Emergency Management", function () {
        it("Should allow emergency pause by emergency role", async function () {
            await orphiGovernance.emergencyPauseSystem("Test emergency");
            
            expect(await orphiGovernance.paused()).to.be.true;
            expect(await emergencyContract.emergencyActive()).to.be.true;
        });

        it("Should allow emergency unpause by governance", async function () {
            await orphiGovernance.emergencyPauseSystem("Test emergency");
            await orphiGovernance.emergencyUnpauseSystem();
            
            expect(await orphiGovernance.paused()).to.be.false;
            expect(await emergencyContract.emergencyActive()).to.be.false;
        });

        it("Should prevent unauthorized emergency actions", async function () {
            await expect(orphiGovernance.connect(user1).emergencyPauseSystem("Unauthorized"))
                .to.be.revertedWith("Governance: emergency role required");
        });

        it("Should block operations during emergency", async function () {
            await orphiGovernance.emergencyPauseSystem("Test emergency");
            
            // Approve USDT for registration
            await mockUSDT.connect(user1).approve(await orphiGovernance.getAddress(), ethers.parseUnits("100", 6));
            
            // Should fail due to emergency mode
            await expect(
                orphiGovernance.connect(user1).register(ethers.ZeroAddress, PackageTier.PACKAGE_100)
            ).to.be.revertedWith("Emergency: system in emergency mode");
        });
    });

    describe("💰 Multi-Signature Treasury", function () {
        it("Should configure multi-sig correctly on deployment", async function () {
            const config = await orphiGovernance.getMultiSigConfig();
            expect(config.signers).to.deep.equal(treasurySigners);
            expect(config.requiredSignatures).to.equal(2);
            expect(config.enabled).to.be.true;
        });

        it("Should allow reconfiguring multi-sig by governance", async function () {
            const newSigners = [owner.address, admin.address, user1.address, user2.address];
            await orphiGovernance.configureMultiSig(newSigners, 3, 5 * 24 * 3600); // 5 days

            const config = await orphiGovernance.getMultiSigConfig();
            expect(config.signers).to.deep.equal(newSigners);
            expect(config.requiredSignatures).to.equal(3);
        });

        it("Should create treasury proposals", async function () {
            const amount = ethers.parseUnits("1000", 6);
            const reason = "Treasury fund distribution";

            const tx = await orphiGovernance.createTreasuryProposal(
                await mockUSDT.getAddress(),
                user5.address,
                amount,
                reason,
                false
            );

            await expect(tx).to.emit(orphiGovernance, "TreasuryProposalCreated");
        });

        it("Should execute treasury proposals with sufficient approvals", async function () {
            const amount = ethers.parseUnits("1000", 6);
            const reason = "Treasury fund distribution";

            // Create proposal
            const proposalId = await orphiGovernance.createTreasuryProposal.staticCall(
                await mockUSDT.getAddress(),
                user5.address,
                amount,
                reason,
                false
            );

            await orphiGovernance.createTreasuryProposal(
                await mockUSDT.getAddress(),
                user5.address,
                amount,
                reason,
                false
            );

            // Get initial balance
            const initialBalance = await mockUSDT.balanceOf(user5.address);

            // Approve with first signer (owner)
            await orphiGovernance.approveTreasuryProposal(proposalId);

            // Approve with second signer (admin) - should auto-execute
            await orphiGovernance.connect(admin).approveTreasuryProposal(proposalId);

            // Check that funds were transferred
            const finalBalance = await mockUSDT.balanceOf(user5.address);
            expect(finalBalance - initialBalance).to.equal(amount);

            // Check proposal is marked as executed
            const proposal = await orphiGovernance.getTreasuryProposal(proposalId);
            expect(proposal.executed).to.be.true;
        });

        it("Should prevent double approval", async function () {
            const amount = ethers.parseUnits("500", 6);
            const proposalId = await orphiGovernance.createTreasuryProposal.staticCall(
                await mockUSDT.getAddress(),
                user4.address,
                amount,
                "Test proposal",
                false
            );

            await orphiGovernance.createTreasuryProposal(
                await mockUSDT.getAddress(),
                user4.address,
                amount,
                "Test proposal",
                false
            );

            await orphiGovernance.approveTreasuryProposal(proposalId);

            await expect(orphiGovernance.approveTreasuryProposal(proposalId))
                .to.be.revertedWith("MultiSig: already approved");
        });

        it("Should allow cancelling proposals", async function () {
            const amount = ethers.parseUnits("500", 6);
            const proposalId = await orphiGovernance.createTreasuryProposal.staticCall(
                await mockUSDT.getAddress(),
                user4.address,
                amount,
                "Test proposal",
                false
            );

            await orphiGovernance.createTreasuryProposal(
                await mockUSDT.getAddress(),
                user4.address,
                amount,
                "Test proposal",
                false
            );

            await orphiGovernance.cancelTreasuryProposal(proposalId, "Changed mind");

            const proposal = await orphiGovernance.getTreasuryProposal(proposalId);
            expect(proposal.cancelled).to.be.true;
        });

        it("Should handle emergency treasury actions", async function () {
            const amount = ethers.parseUnits("2000", 6);
            const initialBalance = await mockUSDT.balanceOf(user3.address);

            await orphiGovernance.emergencyTreasuryAction(
                await mockUSDT.getAddress(),
                user3.address,
                amount,
                "Emergency fund recovery"
            );

            const finalBalance = await mockUSDT.balanceOf(user3.address);
            expect(finalBalance - initialBalance).to.equal(amount);
        });

        it("Should prevent unauthorized emergency treasury actions", async function () {
            await expect(
                orphiGovernance.connect(user1).emergencyTreasuryAction(
                    await mockUSDT.getAddress(),
                    user3.address,
                    ethers.parseUnits("1000", 6),
                    "Unauthorized emergency"
                )
            ).to.be.revertedWith("Governance: emergency role required");
        });

        it("Should cleanup expired proposals", async function () {
            const amount = ethers.parseUnits("100", 6);
            
            // Create a proposal with very short duration
            await orphiGovernance.configureMultiSig(treasurySigners, 2, 1); // 1 second duration
            
            const proposalId = await orphiGovernance.createTreasuryProposal.staticCall(
                await mockUSDT.getAddress(),
                user4.address,
                amount,
                "Short duration proposal",
                false
            );

            await orphiGovernance.createTreasuryProposal(
                await mockUSDT.getAddress(),
                user4.address,
                amount,
                "Short duration proposal",
                false
            );

            // Wait for proposal to expire
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Cleanup expired proposals
            await orphiGovernance.cleanupExpiredProposals();

            const proposal = await orphiGovernance.getTreasuryProposal(proposalId);
            expect(proposal.cancelled).to.be.true;
        });
    });

    describe("🔄 Enhanced Registration with Governance", function () {
        beforeEach(async function () {
            // Approve USDT for registrations
            const approveAmount = ethers.parseUnits("10000", 6);
            await mockUSDT.connect(user1).approve(await orphiGovernance.getAddress(), approveAmount);
            await mockUSDT.connect(user2).approve(await orphiGovernance.getAddress(), approveAmount);
            await mockUSDT.connect(user3).approve(await orphiGovernance.getAddress(), approveAmount);
        });

        it("Should allow registration when governance is active", async function () {
            await orphiGovernance.connect(user1).register(ethers.ZeroAddress, PackageTier.PACKAGE_100);
            
            // Check user was registered
            const userInfo = await orphiGovernance.users(user1.address);
            expect(userInfo.id).to.be.greaterThan(0);
        });

        it("Should block registration during emergency", async function () {
            await orphiGovernance.emergencyPauseSystem("Test emergency");
            
            await expect(
                orphiGovernance.connect(user1).register(ethers.ZeroAddress, PackageTier.PACKAGE_100)
            ).to.be.revertedWith("Emergency: system in emergency mode");
        });

        it("Should block registration when registrations are disabled", async function () {
            // Disable registrations via emergency contract
            await emergencyContract.toggleRegistrations("Testing registration block");
            
            await expect(
                orphiGovernance.connect(user1).register(ethers.ZeroAddress, PackageTier.PACKAGE_100)
            ).to.be.revertedWith("Emergency: registrations disabled");
        });

        it("Should block blacklisted addresses", async function () {
            // Blacklist user1
            await emergencyContract.addEmergencyOperator(owner.address);
            await emergencyContract.blacklistAddress(user1.address, "Testing blacklist");
            
            await expect(
                orphiGovernance.connect(user1).register(ethers.ZeroAddress, PackageTier.PACKAGE_100)
            ).to.be.revertedWith("Emergency: address blacklisted");
        });
    });

    describe("💸 Enhanced Withdrawal with Governance", function () {
        beforeEach(async function () {
            // Register a user and give them withdrawable balance
            await mockUSDT.connect(user1).approve(await orphiGovernance.getAddress(), ethers.parseUnits("1000", 6));
            await orphiGovernance.connect(user1).register(ethers.ZeroAddress, PackageTier.PACKAGE_100);
            
            // Manually set withdrawable balance for testing
            // This would normally be set through the distribution mechanism
            // await orphiGovernance.setWithdrawableBalance(user1.address, ethers.parseUnits("50", 6));
        });

        it("Should block withdrawal during emergency", async function () {
            await orphiGovernance.emergencyPauseSystem("Test emergency");
            
            await expect(orphiGovernance.connect(user1).withdraw())
                .to.be.revertedWith("Emergency: system in emergency mode");
        });

        it("Should block withdrawal when withdrawals are disabled", async function () {
            await emergencyContract.toggleWithdrawals("Testing withdrawal block");
            
            await expect(orphiGovernance.connect(user1).withdraw())
                .to.be.revertedWith("Emergency: withdrawals disabled");
        });

        it("Should block blacklisted addresses from withdrawal", async function () {
            await emergencyContract.addEmergencyOperator(owner.address);
            await emergencyContract.blacklistAddress(user1.address, "Testing blacklist");
            
            await expect(orphiGovernance.connect(user1).withdraw())
                .to.be.revertedWith("Emergency: address blacklisted");
        });
    });

    describe("📊 View Functions", function () {
        it("Should return correct treasury proposal details", async function () {
            const amount = ethers.parseUnits("1000", 6);
            const reason = "Test proposal details";

            const proposalId = await orphiGovernance.createTreasuryProposal.staticCall(
                await mockUSDT.getAddress(),
                user5.address,
                amount,
                reason,
                false
            );

            await orphiGovernance.createTreasuryProposal(
                await mockUSDT.getAddress(),
                user5.address,
                amount,
                reason,
                false
            );

            const proposal = await orphiGovernance.getTreasuryProposal(proposalId);
            expect(proposal.proposer).to.equal(owner.address);
            expect(proposal.token).to.equal(await mockUSDT.getAddress());
            expect(proposal.to).to.equal(user5.address);
            expect(proposal.amount).to.equal(amount);
            expect(proposal.reason).to.equal(reason);
            expect(proposal.executed).to.be.false;
            expect(proposal.cancelled).to.be.false;
        });

        it("Should track proposal approvals correctly", async function () {
            const amount = ethers.parseUnits("500", 6);
            const proposalId = await orphiGovernance.createTreasuryProposal.staticCall(
                await mockUSDT.getAddress(),
                user4.address,
                amount,
                "Test approval tracking",
                false
            );

            await orphiGovernance.createTreasuryProposal(
                await mockUSDT.getAddress(),
                user4.address,
                amount,
                "Test approval tracking",
                false
            );

            // Check initial approval status
            expect(await orphiGovernance.hasApprovedProposal(proposalId, owner.address)).to.be.false;

            // Approve and check status
            await orphiGovernance.approveTreasuryProposal(proposalId);
            expect(await orphiGovernance.hasApprovedProposal(proposalId, owner.address)).to.be.true;
        });

        it("Should return active proposals", async function () {
            const amount = ethers.parseUnits("300", 6);
            
            // Create multiple proposals
            await orphiGovernance.createTreasuryProposal(
                await mockUSDT.getAddress(),
                user2.address,
                amount,
                "Proposal 1",
                false
            );

            await orphiGovernance.createTreasuryProposal(
                await mockUSDT.getAddress(),
                user3.address,
                amount,
                "Proposal 2",
                false
            );

            const activeProposals = await orphiGovernance.getActiveProposals();
            expect(activeProposals.length).to.equal(2);
        });
    });

    describe("⚠️ Edge Cases and Security", function () {
        it("Should prevent invalid multi-sig configurations", async function () {
            await expect(
                orphiGovernance.configureMultiSig([], 1, 7 * 24 * 3600)
            ).to.be.revertedWith("MultiSig: invalid config");

            await expect(
                orphiGovernance.configureMultiSig([owner.address], 2, 7 * 24 * 3600)
            ).to.be.revertedWith("MultiSig: invalid config");

            await expect(
                orphiGovernance.configureMultiSig([owner.address, admin.address], 0, 7 * 24 * 3600)
            ).to.be.revertedWith("MultiSig: required signatures must be > 0");
        });

        it("Should prevent invalid proposal parameters", async function () {
            await expect(
                orphiGovernance.createTreasuryProposal(
                    ethers.ZeroAddress,
                    user1.address,
                    ethers.parseUnits("100", 6),
                    "Invalid token",
                    false
                )
            ).to.be.revertedWith("MultiSig: invalid token");

            await expect(
                orphiGovernance.createTreasuryProposal(
                    await mockUSDT.getAddress(),
                    ethers.ZeroAddress,
                    ethers.parseUnits("100", 6),
                    "Invalid recipient",
                    false
                )
            ).to.be.revertedWith("MultiSig: invalid recipient");

            await expect(
                orphiGovernance.createTreasuryProposal(
                    await mockUSDT.getAddress(),
                    user1.address,
                    0,
                    "Invalid amount",
                    false
                )
            ).to.be.revertedWith("MultiSig: invalid amount");
        });

        it("Should handle approval of non-existent proposals", async function () {
            const fakeProposalId = ethers.keccak256(ethers.toUtf8Bytes("fake"));
            
            await expect(orphiGovernance.approveTreasuryProposal(fakeProposalId))
                .to.be.revertedWith("MultiSig: invalid proposal");
        });

        it("Should prevent non-signers from creating proposals", async function () {
            await expect(
                orphiGovernance.connect(user5).createTreasuryProposal(
                    await mockUSDT.getAddress(),
                    user1.address,
                    ethers.parseUnits("100", 6),
                    "Unauthorized proposal",
                    false
                )
            ).to.be.revertedWith("MultiSig: not a signer");
        });
    });
});
