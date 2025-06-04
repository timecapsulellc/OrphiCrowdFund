require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1  // Optimize for size instead of gas efficiency
      },
      viaIR: true  // Use the new IR-based optimizer
    },
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true
    }
  }
};
