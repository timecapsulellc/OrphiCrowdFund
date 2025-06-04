/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  // Only include V4Ultra and its dependencies
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache-v4ultra",
    artifacts: "./artifacts-v4ultra"
  },
  networks: {
    hardhat: {
      chainId: 31337
    }
  }
};
