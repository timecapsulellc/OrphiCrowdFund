const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OrphiCrowdFundV4LibOptimized - Basic Tests", function () {
    let crowdFund, mockUSDT, owner, user1, adminReserve;

    beforeEach(async function () {
        [owner, user1, adminReserve] = await ethers.getSigners();

        // Deploy MockUSDT
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        mockUSDT = await MockUSDT.deploy();
        await mockUSDT.waitForDeployment();

        // Deploy optimized V4 contract
        const OrphiCrowdFundV4LibOptimized = await ethers.getContractFactory("OrphiCrowdFundV4LibOptimized");
        crowdFund = await OrphiCrowdFundV4LibOptimized.deploy(
            await mockUSDT.getAddress(),
            adminReserve.address
        );
        await crowdFund.waitForDeployment();

        // Mint tokens for testing
        await mockUSDT.mint(user1.address, ethers.parseUnits("1000", 6));
        await mockUSDT.connect(user1).approve(await crowdFund.getAddress(), ethers.parseUnits("1000", 6));
    });

    it("Should deploy successfully under 24KB limit", async function () {
        const contractCode = await ethers.provider.getCode(await crowdFund.getAddress());
        const sizeInBytes = (contractCode.length - 2) / 2; // Remove 0x and divide by 2
        console.log(`Contract size: ${sizeInBytes} bytes (${(sizeInBytes/1024).toFixed(1)}KB)`);
        expect(sizeInBytes).to.be.lessThan(24576); // 24KB limit
    });

    it("Should have correct initial values", async function () {
        expect(await crowdFund.totalMembers()).to.equal(0);
        expect(await crowdFund.totalVolume()).to.equal(0);
        expect(await crowdFund.automationEnabled()).to.equal(false);
    });

    it("Should register first user correctly", async function () {
        await expect(crowdFund.connect(user1).register(ethers.ZeroAddress, 0))
            .to.emit(crowdFund, 'UserRegistered')
            .withArgs(user1.address, ethers.ZeroAddress, 0);

        const user = await crowdFund.users(user1.address);
        expect(user.isActive).to.be.true;
        expect(user.sponsor).to.equal(ethers.ZeroAddress);
        expect(user.currentPackage).to.equal(0);
        expect(await crowdFund.totalMembers()).to.equal(1);
    });

    it("Should enable automation correctly", async function () {
        await crowdFund.enableAutomation(500000);
        expect(await crowdFund.automationEnabled()).to.be.true;
        expect(await crowdFund.gasLimit()).to.equal(500000);
    });

    it("Should check upkeep when automation enabled", async function () {
        await crowdFund.enableAutomation(500000);
        const [upkeepNeeded, ] = await crowdFund.checkUpkeep("0x");
        expect(typeof upkeepNeeded).to.equal('boolean');
    });
});
