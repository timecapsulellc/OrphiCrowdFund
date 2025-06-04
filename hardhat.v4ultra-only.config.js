require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
      viaIR: true
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache-v4ultra",
    artifacts: "./artifacts-v4ultra"
  }
};
