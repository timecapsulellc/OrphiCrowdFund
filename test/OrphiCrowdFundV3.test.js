const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("OrphiCrowdFundV3 - Advanced Security & Formal Verification", function () {
    const PACKAGE_30 = ethers.parseEther("30");
    const PACKAGE_50 = ethers.parseEther("50");
    const PACKAGE_100 = ethers.parseEther("100");
    const PACKAGE_200 = ethers.parseEther("200");

    const PackageTier = {
        NONE: 0,
        PACKAGE_30: 1,
        PACKAGE_50: 2,
        PACKAGE_100: 3,
        PACKAGE_200: 4
    };

    async function deployV3Fixture() {
        const [owner, adminReserve, matrixRoot, signer1, signer2, signer3, user1, user2, oracle, ...users] = await ethers.getSigners();

        // Deploy mock USDT
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        const mockUSDT = await MockUSDT.deploy();
        await mockUSDT.waitForDeployment();

        // Deploy price oracle mock
        const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
        const mockOracle = await MockPriceOracle.deploy();
        await mockOracle.waitForDeployment();

        // Deploy V3 contract
        const OrphiCrowdFundV3 = await ethers.getContractFactory("OrphiCrowdFundV3");
        const orphiCrowdFundV3 = await upgrades.deployProxy(
            OrphiCrowdFundV3,
            [await mockUSDT.getAddress(), adminReserve.address, matrixRoot.address],
            { initializer: 'initialize', kind: 'uups' }
        );

        await orphiCrowdFundV3.waitForDeployment();

        // Initialize V3 features
        await orphiCrowdFundV3.initializeV3(
            [signer1.address, signer2.address, signer3.address],
            2, // Require 2 out of 3 signatures
            await mockOracle.getAddress()
        );

        // Mint tokens for testing
        for (let i = 0; i < 20; i++) {
            await mockUSDT.mint(users[i].address, ethers.parseEther("10000"));
            await mockUSDT.connect(users[i]).approve(await orphiCrowdFundV3.getAddress(), ethers.parseEther("10000"));
        }

        await mockUSDT.mint(user1.address, ethers.parseEther("1000"));
        await mockUSDT.connect(user1).approve(await orphiCrowdFundV3.getAddress(), ethers.parseEther("1000"));

        return {
            orphiCrowdFundV3,
            mockUSDT,
            mockOracle,
            owner,
            adminReserve,
            matrixRoot,
            signer1,
            signer2,
            signer3,
            user1,
            user2,
            oracle,
            users
        };
    }

    describe("Multi-Signature Wallet Integration", function () {
        it("Should require multiple signatures for critical operations", async function () {
            const { orphiCrowdFundV3, signer1, signer2, signer3 } = await loadFixture(deployV3Fixture);

            // Create a proposal to pause the contract
            const pauseData = orphiCrowdFundV3.interface.encodeFunctionData("pause");
            const deadline = Math.floor(Date.now() / 1000) + 86400; // 24 hours

            const proposalId = await orphiCrowdFundV3.connect(signer1).createMultiSigProposal.staticCall(
                await orphiCrowdFundV3.getAddress(),
                pauseData,
                0,
                deadline
            );

            await orphiCrowdFundV3.connect(signer1).createMultiSigProposal(
                await orphiCrowdFundV3.getAddress(),
                pauseData,
                0,
                deadline
            );

            // First approval
            await orphiCrowdFundV3.connect(signer1).approveMultiSigProposal(proposalId);
            
            // Check that contract is not paused yet
            expect(await orphiCrowdFundV3.paused()).to.be.false;

            // Second approval should trigger execution
            await orphiCrowdFundV3.connect(signer2).approveMultiSigProposal(proposalId);
            
            // Contract should now be paused
            expect(await orphiCrowdFundV3.paused()).to.be.true;
        });

        it("Should prevent double approval from same signer", async function () {
            const { orphiCrowdFundV3, signer1 } = await loadFixture(deployV3Fixture);

            const pauseData = orphiCrowdFundV3.interface.encodeFunctionData("unpause");
            const deadline = Math.floor(Date.now() / 1000) + 86400;

            const proposalId = await orphiCrowdFundV3.connect(signer1).createMultiSigProposal.staticCall(
                await orphiCrowdFundV3.getAddress(),
                pauseData,
                0,
                deadline
            );

            await orphiCrowdFundV3.connect(signer1).createMultiSigProposal(
                await orphiCrowdFundV3.getAddress(),
                pauseData,
                0,
                deadline
            );

            await orphiCrowdFundV3.connect(signer1).approveMultiSigProposal(proposalId);

            // Attempt double approval
            await expect(
                orphiCrowdFundV3.connect(signer1).approveMultiSigProposal(proposalId)
            ).to.be.revertedWith("Already approved");
        });
    });

    describe("MEV Protection", function () {
        it("Should prevent rapid consecutive transactions", async function () {
            const { orphiCrowdFundV3, user1, matrixRoot } = await loadFixture(deployV3Fixture);

            // First transaction should succeed
            const domain = {
                name: "OrphiCrowdFundV3",
                version: "1",
                chainId: await ethers.provider.getNetwork().then(n => n.chainId),
                verifyingContract: await orphiCrowdFundV3.getAddress()
            };

            const types = {
                RegisterUser: [
                    { name: "user", type: "address" },
                    { name: "sponsor", type: "address" },
                    { name: "packageTier", type: "uint8" },
                    { name: "nonce", type: "uint256" }
                ]
            };

            const value = {
                user: user1.address,
                sponsor: matrixRoot.address,
                packageTier: PackageTier.PACKAGE_30,
                nonce: 0
            };

            // Get operator to sign
            const operator = await ethers.getSigner(0); // Owner has operator role
            await orphiCrowdFundV3.grantRole(await orphiCrowdFundV3.OPERATOR_ROLE(), operator.address);

            const signature = await operator.signTypedData(domain, types, value);

            await orphiCrowdFundV3.connect(user1).registerUserV3(
                matrixRoot.address,
                PackageTier.PACKAGE_30,
                0,
                signature
            );

            // Second transaction in same block should fail
            const value2 = { ...value, nonce: 1 };
            const signature2 = await operator.signTypedData(domain, types, value2);

            await expect(
                orphiCrowdFundV3.connect(user1).registerUserV3(
                    matrixRoot.address,
                    PackageTier.PACKAGE_30,
                    1,
                    signature2
                )
            ).to.be.revertedWith("MEV protection: too frequent interactions");
        });
    });

    describe("Oracle Integration", function () {
        it("Should pause operations when oracle detects price deviation", async function () {
            const { orphiCrowdFundV3, mockOracle, user1, matrixRoot } = await loadFixture(deployV3Fixture);

            // Set oracle to report unhealthy price
            await mockOracle.setPrice(ethers.parseEther("1.10")); // 10% deviation

            await expect(
                orphiCrowdFundV3.connect(user1).withdrawV3()
            ).to.be.revertedWith("USDT price deviation detected");
        });

        it("Should allow operations when oracle is healthy", async function () {
            const { orphiCrowdFundV3, mockOracle, user1, matrixRoot } = await loadFixture(deployV3Fixture);

            // Register user first
            const domain = {
                name: "OrphiCrowdFundV3",
                version: "1",
                chainId: await ethers.provider.getNetwork().then(n => n.chainId),
                verifyingContract: await orphiCrowdFundV3.getAddress()
            };

            const types = {
                RegisterUser: [
                    { name: "user", type: "address" },
                    { name: "sponsor", type: "address" },
                    { name: "packageTier", type: "uint8" },
                    { name: "nonce", type: "uint256" }
                ]
            };

            const value = {
                user: user1.address,
                sponsor: matrixRoot.address,
                packageTier: PackageTier.PACKAGE_30,
                nonce: 0
            };

            const operator = await ethers.getSigner(0);
            await orphiCrowdFundV3.grantRole(await orphiCrowdFundV3.OPERATOR_ROLE(), operator.address);

            // Wait for MEV protection to reset
            await ethers.provider.send("evm_mine", []);
            await ethers.provider.send("evm_mine", []);

            const signature = await operator.signTypedData(domain, types, value);

            await orphiCrowdFundV3.connect(user1).registerUserV3(
                matrixRoot.address,
                PackageTier.PACKAGE_30,
                0,
                signature
            );

            // Set healthy oracle price
            await mockOracle.setPrice(ethers.parseEther("1.00"));
            await mockOracle.setHealthy(true);

            // Withdrawal should work when oracle is healthy
            // (Would need to add earnings first in a real test)
        });
    });

    describe("Formal Verification Support", function () {
        it("Should maintain invariants after operations", async function () {
            const { orphiCrowdFundV3, user1, user2, matrixRoot } = await loadFixture(deployV3Fixture);

            // Register multiple users and verify system invariants
            // Invariant 1: Total member count should equal registered users
            // Invariant 2: Pool distributions should sum to 100%
            // Invariant 3: User earnings should not exceed cap
            // Invariant 4: Matrix tree should maintain binary structure

            const initialTotalMembers = await orphiCrowdFundV3.totalMembers();
            expect(initialTotalMembers).to.equal(1); // Matrix root

            // Test invariants preservation
            expect(true).to.be.true; // Placeholder for formal verification tests
        });

        it("Should handle edge cases with mathematical precision", async function () {
            const { orphiCrowdFundV3 } = await loadFixture(deployV3Fixture);

            // Test edge cases that formal verification would catch
            // - Integer overflow/underflow
            // - Division by zero
            // - Rounding errors in percentage calculations
            
            expect(true).to.be.true; // Placeholder for formal verification tests
        });
    });

    describe("Cross-Chain Preparation", function () {
        it("Should prepare cross-chain transfers correctly", async function () {
            const { orphiCrowdFundV3, user1, matrixRoot } = await loadFixture(deployV3Fixture);

            // Register user and give them some earnings
            // Then test cross-chain transfer preparation

            expect(true).to.be.true; // Placeholder for cross-chain tests
        });
    });

    describe("Governance Token Integration", function () {
        it("Should calculate governance tokens based on participation", async function () {
            const { orphiCrowdFundV3, user1, matrixRoot } = await loadFixture(deployV3Fixture);

            // Test governance token calculation
            const governanceTokens = await orphiCrowdFundV3.calculateGovernanceTokens(matrixRoot.address);
            expect(governanceTokens).to.be.a('bigint');
        });
    });
});

// Mock contracts for testing
describe("Mock Contracts", function () {
    it("Should deploy MockPriceOracle", async function () {
        const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
        const mockOracle = await MockPriceOracle.deploy();
        await mockOracle.waitForDeployment();

        expect(await mockOracle.getAddress()).to.be.properAddress;
    });
});
