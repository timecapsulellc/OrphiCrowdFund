require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.22",
  paths: {
    sources: "./",
    tests: "./",
    cache: "../cache-standalone-v4ultra",
    artifacts: "../artifacts-standalone-v4ultra",
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
  },
};
