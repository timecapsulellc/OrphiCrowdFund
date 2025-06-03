const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("OrphiCrowdFundV4Simple Minimal Test", function () {
  let orphiCrowdFundV4;
  let mockUSDT;
  let owner;
  let adminReserve;
  let matrixRoot;

  beforeEach(async function () {
    [owner, adminReserve, matrixRoot] = await ethers.getSigners();
    
    // Deploy MockUSDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    console.log("MockUSDT deployed successfully");

    // Deploy OrphiCrowdFundV4Simple
    console.log("Getting OrphiCrowdFundV4Simple factory...");
    const OrphiCrowdFundV4Simple = await ethers.getContractFactory("OrphiCrowdFundV4Simple");
    console.log("Deploying OrphiCrowdFundV4Simple...");
    
    orphiCrowdFundV4 = await upgrades.deployProxy(
      OrphiCrowdFundV4Simple,
      [await mockUSDT.getAddress(), adminReserve.address, matrixRoot.address],
      { initializer: "initialize" }
    );
    await orphiCrowdFundV4.waitForDeployment();
    console.log("OrphiCrowdFundV4Simple deployed successfully");
  });

  it("Should deploy successfully", async function () {
    expect(await orphiCrowdFundV4.getAddress()).to.not.equal(ethers.ZeroAddress);
  });
});
