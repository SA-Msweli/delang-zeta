require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    zetachain_testnet: {
      url: "https://zetachain-evm.blockpi.network/v1/rpc/public",
      chainId: 7001,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    },
    zetachain_mainnet: {
      url: "https://zetachain-evm.blockpi.network/v1/rpc/public",
      chainId: 7000,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
    }
  },
  etherscan: {
    apiKey: {
      zetachain_testnet: "your-etherscan-api-key",
      zetachain_mainnet: "your-etherscan-api-key"
    }
  }
};