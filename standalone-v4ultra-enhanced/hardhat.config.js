require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.22",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          }
        }
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          }
        }
      }
    ]
  },
  paths: {
    sources: "./standalone-v4ultra-enhanced/contracts",
    tests: "./standalone-v4ultra-enhanced/test",
    cache: "./standalone-v4ultra-enhanced/cache",
    artifacts: "./standalone-v4ultra-enhanced/artifacts"
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    localhost: {
      url: "http://127.0.0.1:8545/",
      chainId: 1337
    }
  }
};
