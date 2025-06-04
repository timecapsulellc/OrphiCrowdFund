/**
 * V4Ultra Hardhat configuration
 * Focused only on compiling and testing the V4Ultra contract
 */
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      viaIR: true, // Enable the new IR-based code generator
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf"
          }
        }
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache-v4ultra",
    artifacts: "./artifacts-v4ultra"
  }
};
