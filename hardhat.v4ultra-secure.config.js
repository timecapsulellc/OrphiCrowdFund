require("hardhat-gas-reporter");
require("solidity-coverage");
require("@nomicfoundation/hardhat-chai-matchers");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  paths: {
    sources: "./standalone-v4ultra",
    artifacts: "./artifacts-v4ultra-test",
    cache: "./cache-v4ultra-test",
    tests: "./standalone-v4ultra",
  },
  networks: {
    hardhat: {
      chainId: 1337,
      accounts: {
        count: 20,
      },
    },
  },
  gasReporter: {
    enabled: true,
    currency: "USD",
  },
};
